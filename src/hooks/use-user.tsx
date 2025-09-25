
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, Course, Grade, Attendance } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
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
  setSettings: (settings: Settings) => void;
  userPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  sectors: Sector[];
  fields: Field[];
  courses: Course[];
  grades: Grade[];
  attendances: Attendance[];
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
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
  const { user: authUser, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Field[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<User[]>([]);

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
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userDocRef.path, operation: 'get' }));
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
            (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: collectionName, operation: 'list' }));
            }
        );
        unsubs.push(unsubscribe);
    };
    
    // Always load these small, essential collections
    setupSubscription('adminRoles', setRoles);
    setupSubscription('sectors', setSectors);
    setupSubscription('fields', setFields);
    
    const settingsUnsub = onSnapshot(doc(db, 'settings', 'system'), 
        (snap) => setSettings(snap.exists() ? snap.data() as Settings : defaultSettings),
        (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/system', operation: 'get' }));
        }
    );
    unsubs.push(settingsUnsub);

    // Conditionally load larger collections only for admin users
    if (currentUser.role === 'admin') {
        setupSubscription('users', setUsers);
        setupSubscription('courses', setCourses);
        setupSubscription('grades', setGrades);
        setupSubscription('attendances', setAttendances);
    } else {
        // For non-admin users, we still need all courses for schedule/grades display
        // And we need all users for messaging
        setupSubscription('courses', setCourses);
        setupSubscription('users', setUsers);
    }
    
    const initialLoadTimer = setTimeout(() => setLoading(false), 500);
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

  const handleSetSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  const value: UserContextType = { 
      user: currentUser, 
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
      users,
      setUsers,
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
