
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, FeeStructure, Course, Grade, Payment, Attendance } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, FirestoreError } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type UserContextType = {
  user: User | null;
  loading: boolean;
  roles: AdminRole[];
  settings: Settings | null;
  userPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  allUsers: User[];
  fields: Field[];
  sectors: Sector[];
  allCourses: Course[];
  grades: Grade[];
};

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
  const { user: authUser, signOut } = useAuth();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Globally needed, small collections
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Data loaded on demand by pages, but stored globally in provider
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

  // Effect for the user's own profile
  useEffect(() => {
    if (!authUser) {
      setCurrentUser(null);
      setLoadingUser(false);
      return;
    }

    setLoadingUser(true);
    const userDocRef = doc(db, 'users', authUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUser(docSnap.data() as User);
      } else {
        setTimeout(() => {
            toast({
              variant: "destructive",
              title: "Profil non trouvé",
              description: "Votre compte n'est pas dans la base de données de l'école. Déconnexion.",
            });
            signOut();
        }, 2000);
      }
      setLoadingUser(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userDocRef.path, operation: 'get' }));
      }
      signOut();
      setLoadingUser(false);
    });

    return () => unsubscribeUser();
  }, [authUser, signOut, toast]);
  
  // Effect for globally needed small collections
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), 
        (snapshot) => setRoles(snapshot.docs.map(d => ({...d.data(), id: d.id} as AdminRole))),
        (error) => console.error("Error fetching roles: ", error)
    );
    unsubs.push(unsubRoles);

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), 
        (snap) => setSettings(snap.exists() ? snap.data() as Settings : defaultSettings),
        (error) => console.error("Error fetching settings: ", error)
    );
    unsubs.push(unsubSettings);
    
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') return [];
      
      if (currentUser.admin?.roleId === 'super_admin') {
          return Object.keys(adminPermissions) as AdminPermission[];
      }

      if (currentUser.admin?.roleId) {
          const userRole = roles.find(r => r.id === currentUser.admin?.roleId);
          return userRole?.permissions || [];
      }
      
      return [];
  }, [currentUser, roles]);

  const hasPermission = (permission: AdminPermission) => {
      return userPermissions.includes(permission);
  }
  
  const value: UserContextType = { 
      user: currentUser, 
      loading: loadingUser,
      roles,
      userPermissions,
      hasPermission,
      settings,
      setUsers: setAllUsers,
      allUsers,
      fields,
      sectors,
      allCourses,
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
