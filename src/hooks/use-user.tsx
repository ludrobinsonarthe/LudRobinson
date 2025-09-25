
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

    const collectionsToFetch = [
      { name: 'users', setter: setAllUsers },
      { name: 'adminRoles', setter: setRoles },
      { name: 'sectors', setter: setSectors },
      { name: 'fields', setter: setFields },
      { name: 'courses', setter: setCourses },
      { name: 'grades', setter: setGrades },
      { name: 'attendances', setter: setAttendances },
      { name: 'staffAttendances', setter: setStaffAttendances },
    ];

    const promises = collectionsToFetch.map(c => getDocs(collection(db, c.name)));
    const settingsPromise = getDoc(doc(db, 'settings', 'system'));

    Promise.all([...promises, settingsPromise]).then((results) => {
        const snapshots = results.slice(0, -1) as any[];
        const settingsSnap = results.slice(-1)[0] as any;

        snapshots.forEach((snapshot, index) => {
            const { setter } = collectionsToFetch[index];
            const docs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            setter(docs);
        });
        
        setSettings(settingsSnap.exists() ? settingsSnap.data() as Settings : defaultSettings);
        
        const unsubs: (() => void)[] = [];

        unsubs.push(onSnapshot(collection(db, 'users'), snap => setAllUsers(snap.docs.map(d => ({id: d.id, ...d.data()}) as User))));
        unsubs.push(onSnapshot(doc(db, 'settings', 'system'), snap => setSettings(snap.exists() ? snap.data() as Settings : defaultSettings)));
        unsubs.push(onSnapshot(collection(db, 'sectors'), snap => setSectors(snap.docs.map(d => ({id: d.id, ...d.data()}) as Sector))));
        unsubs.push(onSnapshot(collection(db, 'fields'), snap => setFields(snap.docs.map(d => ({id: d.id, ...d.data()}) as Field))));
        unsubs.push(onSnapshot(collection(db, 'courses'), snap => setCourses(snap.docs.map(d => ({...d.data(), id: d.id}) as Course))));
        unsubs.push(onSnapshot(collection(db, 'attendances'), snap => setAttendances(snap.docs.map(d => ({...d.data(), id: d.id}) as Attendance))));
        unsubs.push(onSnapshot(collection(db, 'staffAttendances'), snap => setStaffAttendances(snap.docs.map(d => ({...d.data(), id: d.id}) as StaffAttendance))));
        
        if (currentUser.role === 'admin') {
            unsubs.push(onSnapshot(collection(db, 'grades'), snap => setGrades(snap.docs.map(d => ({...d.data(), id: d.id}) as Grade))));
        } else {
            const studentId = currentUser.role === 'student' ? currentUser.uid : (currentUser.role === 'parent' ? currentUser.parent?.childrenUids[0] : null);
            if (studentId) {
                unsubs.push(onSnapshot(query(collection(db, 'grades'), where('studentId', '==', studentId)), snap => {
                    setGrades(snap.docs.map(d => ({...d.data(), id: d.id}) as Grade));
                }));
            }
        }
        
        unsubs.push(onSnapshot(collection(db, 'adminRoles'), snap => setRoles(snap.docs.map(d => ({id: d.id, ...d.data()}) as AdminRole))));

        setLoading(false); 
        
        return () => unsubs.forEach(unsub => unsub());

    }).catch(error => {
        console.error("Error fetching initial data:", error);
        toast({ variant: "destructive", title: "Erreur de chargement", description: "Impossible de charger les données initiales." });
        setLoading(false);
    });

  }, [currentUser, toast]);
  
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
