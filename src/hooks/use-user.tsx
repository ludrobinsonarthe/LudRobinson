"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { mockAdminRoles, mockUsers } from '@/lib/mock-data';
import { useAuth } from './use-auth';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  loading: boolean;
  roles: AdminRole[];
  setRoles: React.Dispatch<React.SetStateAction<AdminRole[]>>;
  userPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
         setAllUsers(usersData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
        const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
        setRoles(rolesData);
    }, (error) => {
        console.error("Error fetching roles:", error);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (doc) => {
        if(doc.exists()){
            setSettings(doc.data() as Settings);
        } else {
             setSettings({
                id: 'system',
                schoolName: 'ISGI',
                logoUrl: '',
                academicYear: '2024-2025',
                currency: 'XAF',
                levels: [{ value: 'Licence 1' }, { value: 'Licence 2' }, { value: 'Licence 3' }, { value: 'Master 1' }, { value: 'Master 2' }],
                sectors: []
            });
        }
    });

    return () => {
      unsubUsers();
      unsubRoles();
      unsubSettings();
    };
   
  }, []);
  
  useEffect(() => {
      if (authUser && allUsers.length > 0) {
          const matchedUser = allUsers.find(u => u.uid === authUser.uid);
          if (matchedUser) {
              setCurrentUser(matchedUser);
          } else {
              // This is a new user authenticated via Google for example
              const newUserProfile: User = {
                  uid: authUser.uid,
                  email: authUser.email || '',
                  firstName: authUser.displayName?.split(' ')[0] || 'Nouveau',
                  lastName: authUser.displayName?.split(' ')[1] || 'Utilisateur',
                  photoUrl: authUser.photoURL || `https://picsum.photos/seed/${authUser.uid}/100/100`,
                  role: 'student', // Default role for new users
                  status: 'active',
                  createdAt: new Date().toISOString(),
              };
              // Here you would typically save the new user to Firestore
              // For now, we add to local state
              setAllUsers(prev => [...prev, newUserProfile]);
              setCurrentUser(newUserProfile);
          }
      } else if (!authUser) {
          setCurrentUser(null);
      }
  }, [authUser, allUsers]);

  
  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') return [];
      
      const superAdminUser = mockUsers.find(u => u.admin?.position === 'Super-Administrateur');
      if (currentUser.uid === superAdminUser?.uid || currentUser.email === "semfranslinbourangon@gmail.com") {
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
      // This is now mainly for demo purposes to switch between user profiles
      // The actual logged-in user is determined by Firebase Auth
      const matchedUser = allUsers.find(u => u.uid === user.uid);
      if(matchedUser) setCurrentUser(matchedUser);
  };
  
  const value = { 
      user: currentUser, 
      setUser, 
      users: allUsers, 
      setUsers: setAllUsers, 
      loading,
      roles,
      setRoles,
      userPermissions,
      hasPermission,
      settings,
      setSettings
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
