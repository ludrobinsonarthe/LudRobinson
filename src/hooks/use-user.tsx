

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, Course, Grade } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc, setDoc, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
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
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => doc.data() as User);
        setAllUsers(usersData);
    }, (error) => {
        console.error("Error fetching users:", error);
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
        const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
        setRoles(rolesData);
    }, (error) => {
        console.error("Error fetching roles:", error);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
        if(docSnap.exists()){
            const settingsData = docSnap.data() as Settings;
            setSettings(settingsData);
        } else {
             setDoc(doc(db, "settings", "system"), defaultSettings, { merge: true });
             setSettings(defaultSettings);
        }
    });

    const unsubSectors = onSnapshot(collection(db, "sectors"), (snapshot) => {
        const sectorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
        setSectors(sectorsData);
    });
    
    const unsubFields = onSnapshot(collection(db, "fields"), (snapshot) => {
         const fieldsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Field));
         setFields(fieldsData);
    }, (error) => {
        console.error("Error fetching fields:", error);
    });
    
    const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => {
        setCourses(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Course));
    });

    const unsubGrades = onSnapshot(collection(db, "grades"), (snapshot) => {
        setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    });

    // Combine all unsubscribers
    return () => {
      unsubUsers();
      unsubRoles();
      unsubSettings();
      unsubSectors();
      unsubFields();
      unsubCourses();
      unsubGrades();
    };
   
  }, []);
  
  useEffect(() => {
    setLoading(true);
    if (authLoading) {
      // Wait for auth state to be determined
      return;
    }

    if (authUser) {
      // Auth user exists, fetch their specific Firestore document
      const userDocRef = doc(db, 'users', authUser.uid);
      const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setCurrentUser(docSnap.data() as User);
          setLoading(false);
        } else {
          // User exists in Auth, but not in Firestore. This is an invalid state.
          toast({
            variant: "destructive",
            title: "Profil non trouvé",
            description: "Votre compte n'est pas enregistré dans la base de données. Déconnexion.",
          });
          signOut();
          setLoading(false);
        }
      }, (error) => {
         console.error("Error fetching user document:", error);
         toast({ variant: 'destructive', title: "Erreur de profil", description: "Impossible de charger votre profil." });
         signOut();
         setLoading(false);
      });
      return () => unsubscribe();

    } else {
      // No auth user, not loading
      setCurrentUser(null);
      setLoading(false);
    }
  }, [authUser, authLoading, signOut, toast]);

  
  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') return [];
      
      const isSuperAdminByEmail = currentUser.email === 'admin@isgi.com';
      
      if (isSuperAdminByEmail) {
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
