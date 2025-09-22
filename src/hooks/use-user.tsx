

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, Course } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc, setDoc, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
// Mock data is no longer used for seeding, but kept for reference if needed.
// import { mockUsers, mockSectors, mockFields } from '@/lib/mock-data';
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


  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (!isMounted) return;
        const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        if(isMounted) setAllUsers(usersData);
    }, (error) => {
        console.error("Error fetching users:", error);
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
      if (!isMounted) return;
        const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
        setRoles(rolesData);
    }, (error) => {
        console.error("Error fetching roles:", error);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
        if (!isMounted) return;
        if(docSnap.exists()){
            const settingsData = docSnap.data() as Settings;
            setSettings(settingsData);
        } else {
             setDoc(doc(db, "settings", "system"), defaultSettings, { merge: true });
             if (isMounted) setSettings(defaultSettings);
        }
    });

    const unsubSectors = onSnapshot(collection(db, "sectors"), (snapshot) => {
        if (!isMounted) return;
        const sectorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
        if (isMounted) setSectors(sectorsData);
    });
    
    const unsubFields = onSnapshot(collection(db, "fields"), (snapshot) => {
        if (!isMounted) return;
         const fieldsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Field));
         if (isMounted) setFields(fieldsData);
    }, (error) => {
        console.error("Error fetching fields:", error);
    });
    
    const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => {
      if (!isMounted) return;
        setCourses(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Course));
    });

    // This ensures that loading is set to false only after all initial data fetches are attempted
     const timer = setTimeout(() => {
        if (isMounted) {
            setLoading(false);
        }
    }, 1500);


    return () => {
      isMounted = false;
      unsubUsers();
      unsubRoles();
      unsubSettings();
      unsubFields();
      unsubCourses();
      unsubSectors();
      clearTimeout(timer);
    };
   
  }, []);
  
  useEffect(() => {
      if (authLoading || loading) return;
    
      if (authUser && allUsers.length > 0) {
          const matchedUser = allUsers.find(u => u.uid === authUser.uid);
          if (matchedUser) {
              setCurrentUser(matchedUser);
          } else {
              const isSuperAdminEmail = authUser.email === "admin@isgi.com" || authUser.email === "semfranslinbourangon@gmail.com";
              
              if (isSuperAdminEmail) {
                // This is a special case to ensure the super admin can always log in and be created if not present.
                 const newUserProfile: User = {
                    uid: authUser.uid,
                    email: authUser.email || '',
                    firstName: "ISGI Admin",
                    lastName: "User",
                    photoUrl: authUser.photoURL || "/logo.png",
                    role: 'admin',
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    admin: {
                        roleId: 'super_admin',
                        position: 'Super-Administrateur'
                    }
                };
                 const userDocRef = doc(db, 'users', authUser.uid);
                 setDoc(userDocRef, newUserProfile).then(() => {
                    setAllUsers(prev => [...prev, newUserProfile]);
                    setCurrentUser(newUserProfile);
                 });
              } else {
                 // For any other user not found in the database, sign them out.
                 toast({
                    variant: "destructive",
                    title: "Accès non autorisé",
                    description: "Votre compte n'est pas enregistré dans le système. Veuillez contacter l'administration.",
                });
                signOut();
              }
          }
      } else if (!authUser) {
          setCurrentUser(null);
      }
      
  }, [authUser, allUsers, authLoading, loading, signOut, toast]);

  
  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') return [];
      
      const isSuperAdminByPosition = currentUser.admin?.position === 'Super-Administrateur';
      const isSuperAdminByEmail = currentUser.email === "admin@isgi.com" || currentUser.email === "semfranslinbourangon@gmail.com";
      
      if (isSuperAdminByPosition || isSuperAdminByEmail) {
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

  const setUser = (user: User) => {
      setCurrentUser(user);
      setAllUsers(prevUsers => prevUsers.map(u => u.uid === user.uid ? user : u));
  };

  const handleSetSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  const finalLoadingState = authLoading || loading || (!!authUser && !currentUser);

  const value: UserContextType = { 
      user: currentUser, 
      setUser, 
      users: allUsers, 
      setUsers: setAllUsers, 
      loading: finalLoadingState,
      roles,
      userPermissions,
      hasPermission,
      settings,
      setSettings: handleSetSettings,
      sectors,
      fields,
      courses
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
