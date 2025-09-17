
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc, setDoc } from 'firebase/firestore';
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
    
    // Start with mock data and then let Firestore overwrite it
    setAllUsers(mockUsers);
    setRoles(mockAdminRoles);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        if (!snapshot.empty) {
            const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
            setAllUsers(usersData);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
        if (!snapshot.empty) {
            const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
            setRoles(rolesData);
        }
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
      if (authUser && (allUsers.length > 0 || !loading)) {
          const matchedUser = allUsers.find(u => u.uid === authUser.uid);
          if (matchedUser) {
              setCurrentUser(matchedUser);
          } else {
              // This is a new user authenticated via Google for example
              const isSuperAdminEmail = authUser.email === "admin@isgi.com" || authUser.email === "semfranslinbourangon@gmail.com";
              
              const newUserProfile: User = {
                  uid: authUser.uid,
                  email: authUser.email || '',
                  firstName: authUser.displayName?.split(' ')[0] || 'Nouveau',
                  lastName: authUser.displayName?.split(' ')[1] || 'Utilisateur',
                  photoUrl: authUser.photoURL || `https://picsum.photos/seed/${authUser.uid}/100/100`,
                  role: isSuperAdminEmail ? 'admin' : 'student', // Assign 'admin' role if super admin email
                  status: 'active',
                  createdAt: new Date().toISOString(),
              };

              if (isSuperAdminEmail) {
                newUserProfile.admin = {
                    roleId: 'super_admin',
                    position: 'Super-Administrateur'
                }
              }
              
              // Save the new user to Firestore
              const userDocRef = doc(db, 'users', authUser.uid);
              setDoc(userDocRef, newUserProfile).then(() => {
                 setAllUsers(prev => [...prev, newUserProfile]);
                 setCurrentUser(newUserProfile);
              });
          }
      } else if (!authUser) {
          setCurrentUser(null);
      }
  }, [authUser, allUsers, loading]);

  
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
