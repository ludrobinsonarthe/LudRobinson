

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, Course, Grade } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc, setDoc, writeBatch, getDoc, updateDoc, where, or } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  loading: boolean;
  roles: AdminRole[];
  settings: Settings | null;
  setSettings: (settings: Settings) => void;
  userPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  sectors: Sector[];
  fields: Field[];
  courses: Course[];
  grades: Grade[];
}

const defaultSettings: Settings = {
    id: 'system',
    schoolName: 'ISGI',
    logoUrl: '/logo.png',
    academicYear: '2024-2025',
    currency: 'XAF',
    levels: [{ value: 'Licence 1' }, { value: 'Licence 2' }, { value: 'Licence 3' }, { value: 'Master 1' }, { value: 'Master 2' }],
    sectors: [],
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Field[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);


  useEffect(() => {
    // This effect's job is ONLY to determine the currentUser based on auth state.
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (authUser) {
      // An auth user is present. Fetch their specific Firestore profile.
      const userDocRef = doc(db, 'users', authUser.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setCurrentUser(docSnap.data() as User);
        } else {
          // User exists in Auth, but not in Firestore. This is an invalid state.
          toast({
            variant: "destructive",
            title: "Profil non trouvé",
            description: "Votre compte n'est pas enregistré dans la base de données. Déconnexion.",
          });
          signOut();
        }
        // We will set loading to false in the next useEffect, after data is fetched.
      }, (error) => {
         console.error("Error fetching user document:", error);
         toast({ variant: 'destructive', title: "Erreur de profil", description: "Impossible de charger votre profil." });
         signOut();
         setLoading(false);
      });
      return () => unsubscribe();

    } else {
      // No auth user, so no current user. Stop loading.
      setCurrentUser(null);
      setLoading(false);
    }
  }, [authUser, authLoading, signOut, toast]);

  useEffect(() => {
    if (!currentUser) {
        // If there's no user, there's no data to fetch.
        if (!authLoading) setLoading(false);
        return;
    }

    setLoading(true);
    const unsubs: (() => void)[] = [];

    // General data that everyone needs
    unsubs.push(onSnapshot(doc(db, 'settings', 'system'), snap => setSettings(snap.exists() ? snap.data() as Settings : defaultSettings)));
    unsubs.push(onSnapshot(collection(db, 'sectors'), snap => setSectors(snap.docs.map(d => d.data() as Sector))));
    unsubs.push(onSnapshot(collection(db, 'fields'), snap => setFields(snap.docs.map(d => d.data() as Field))));
    
    // Role-based data fetching
    if (currentUser.role === 'admin') {
        // Admin needs (almost) everything
        unsubs.push(onSnapshot(collection(db, 'users'), snap => setAllUsers(snap.docs.map(d => d.data() as User))));
        unsubs.push(onSnapshot(collection(db, 'courses'), snap => setCourses(snap.docs.map(d => d.data() as Course))));
        unsubs.push(onSnapshot(collection(db, 'grades'), snap => setGrades(snap.docs.map(d => d.data() as Grade))));
        unsubs.push(onSnapshot(collection(db, 'adminRoles'), snap => setRoles(snap.docs.map(d => d.data() as AdminRole))));
    } else {
        // Other roles only get what they need.
        const usersQuery = query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin']));
        unsubs.push(onSnapshot(usersQuery, (usersSnap) => {
            const staffUsers = usersSnap.docs.map(d => d.data() as User);
            // Also add the current user and their potential children to the list
             if (currentUser.role === 'parent' && currentUser.parent?.childrenUids?.length) {
                const childrenQuery = query(collection(db, 'users'), where('uid', 'in', currentUser.parent.childrenUids));
                getDocs(childrenQuery).then(childrenDocs => {
                    const childrenData = childrenDocs.docs.map(d => d.data() as User);
                    setAllUsers([currentUser, ...staffUsers, ...childrenData]);
                });
            } else {
                setAllUsers([currentUser, ...staffUsers]);
            }
        }));

        if (currentUser.role === 'student' && currentUser.student) {
            const studentClauses = [];
             if(currentUser.student.fieldId) {
                studentClauses.push(where("fieldId", "==", currentUser.student.fieldId))
            }
             if(currentUser.student.sectorId) {
                 studentClauses.push(where("sectorId", "==", currentUser.student.sectorId))
            }

            if (studentClauses.length > 0) {
                 unsubs.push(onSnapshot(query(collection(db, 'courses'), where('level', '==', currentUser.student.level), or(...studentClauses)), snap => setCourses(snap.docs.map(d => d.data() as Course))));
            }
            
            unsubs.push(onSnapshot(query(collection(db, 'grades'), where('studentId', '==', currentUser.uid)), snap => setGrades(snap.docs.map(d => d.data() as Grade))));
        
        } else if (currentUser.role === 'teacher') {
            const coursesQuery = query(collection(db, 'courses'), where('teacherId', '==', currentUser.uid));
            unsubs.push(onSnapshot(coursesQuery, async (coursesSnap) => {
                const teacherCourses = coursesSnap.docs.map(d => d.data() as Course);
                setCourses(teacherCourses);
                const courseIds = teacherCourses.map(c => c.id);
                if (courseIds.length > 0) {
                    unsubs.push(onSnapshot(query(collection(db, 'grades'), where('courseId', 'in', courseIds)), snap => setGrades(snap.docs.map(d => d.data() as Grade))));
                } else {
                    setGrades([]);
                }
            }));
        } else if (currentUser.role === 'parent' && currentUser.parent?.childrenUids.length) {
            const childrenIds = currentUser.parent.childrenUids;
             unsubs.push(onSnapshot(query(collection(db, 'grades'), where('studentId', 'in', childrenIds)), snap => setGrades(snap.docs.map(d => d.data() as Grade))));
            
             // Fetch courses for all children
            getDocs(query(collection(db, 'users'), where('uid', 'in', childrenIds))).then(childrenDocs => {
                const childrenData = childrenDocs.docs.map(d => d.data() as User);
                const fieldIds = [...new Set(childrenData.map(c => c.student?.fieldId).filter(Boolean))];
                if (fieldIds.length > 0) {
                     unsubs.push(onSnapshot(query(collection(db, 'courses'), where('fieldId', 'in', fieldIds as string[])), snap => setCourses(snap.docs.map(d => d.data() as Course))));
                }
            });
        }
    }

    setLoading(false);
    return () => unsubs.forEach(unsub => unsub());

  }, [currentUser, authLoading]);
  
  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') return [];
      
      // A user is super admin if their roleId is 'super_admin'
      if (currentUser.admin?.roleId === 'super_admin') {
          return Object.keys(adminPermissions) as AdminPermission[];
      }

      // Otherwise, get permissions from their assigned role
      if (currentUser.admin?.roleId) {
          const userRole = roles.find(r => r.id === currentUser.admin.roleId);
          return userRole?.permissions || [];
      }
      
      return [];
  }, [currentUser, roles]);

  const hasPermission = (permission: AdminPermission) => {
      return userPermissions.includes(permission);
  }

  const setUser = (user: User) => {
      setCurrentUser(user);
      setAllUsers(prevUsers => prevUsers.map(u => u.uid === user.uid ? user : u));
  };

  const handleSetSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  const value: UserContextType = { 
      user: currentUser, 
      setUser, 
      users: allUsers, 
      setUsers: setAllUsers, 
      loading,
      roles,
      userPermissions,
      hasPermission,
      settings,
      setSettings: handleSetSettings,
      sectors,
      fields,
      courses,
      grades
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
