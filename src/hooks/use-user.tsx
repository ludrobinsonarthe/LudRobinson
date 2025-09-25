

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, Course, Grade, Announcement, Attendance, StaffAttendance } from '@/lib/types';
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
  attendances: Attendance[];
  staffAttendances: StaffAttendance[];
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
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [staffAttendances, setStaffAttendances] = useState<StaffAttendance[]>([]);


  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', authUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUser(docSnap.data() as User);
      } else {
        toast({
          variant: "destructive",
          title: "Profil non trouvé",
          description: "Votre compte n'est pas enregistré. Déconnexion.",
        });
        signOut();
      }
    }, (error) => {
      console.error("Error fetching user document:", error);
      toast({ variant: 'destructive', title: "Erreur de profil", description: "Impossible de charger votre profil." });
      signOut();
    });

    return () => unsubscribeUser();
  }, [authUser, authLoading, signOut, toast]);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    
    const unsubs: (() => void)[] = [];

    const setupSubscription = (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        const q = query(collection(db, collectionName));
        const unsubscribe = onSnapshot(q, 
            (snapshot) => setter(snapshot.docs.map(d => ({...d.data(), id: d.id}))),
            (error) => console.error(`Error fetching ${collectionName}:`, error)
        );
        unsubs.push(unsubscribe);
    };

    setupSubscription('users', setAllUsers);
    setupSubscription('adminRoles', setRoles);
    setupSubscription('sectors', setSectors);
    setupSubscription('fields', setFields);
    setupSubscription('courses', setCourses);
    setupSubscription('attendances', setAttendances);
    setupSubscription('staffAttendances', setStaffAttendances);

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'system'), 
        (snap) => setSettings(snap.exists() ? snap.data() as Settings : defaultSettings),
        (error) => console.error("Error fetching settings:", error)
    );
    unsubs.push(settingsUnsub);
    
    // Conditional subscription for grades
    let gradesQuery;
    if (currentUser.role === 'admin') {
        gradesQuery = query(collection(db, 'grades'));
    } else {
        const studentId = currentUser.role === 'student' 
            ? currentUser.uid 
            : (currentUser.role === 'parent' && currentUser.parent?.childrenUids.length > 0 ? currentUser.parent.childrenUids[0] : null);
        
        if (studentId) {
            gradesQuery = query(collection(db, 'grades'), where('studentId', '==', studentId));
        }
    }
    
    if (gradesQuery) {
        unsubs.push(onSnapshot(gradesQuery, 
            (snap) => setGrades(snap.docs.map(d => ({...d.data(), id: d.id}) as Grade)),
            (error) => console.error("Error fetching grades:", error)
        ));
    }

    // This is a rough way to know when initial data is loaded.
    const initialLoadTimer = setTimeout(() => setLoading(false), 1500);
    unsubs.push(() => clearTimeout(initialLoadTimer));
    
    return () => unsubs.forEach(unsub => unsub());

  }, [currentUser]);
  
  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') return [];
      
      if (currentUser.admin?.roleId === 'super_admin') {
          return Object.keys(adminPermissions) as AdminPermission[];
      }

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
      grades,
      attendances,
      staffAttendances
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
