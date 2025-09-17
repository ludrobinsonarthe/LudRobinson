

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { mockAdminRoles, mockUsers, mockSectors, mockFields } from '@/lib/mock-data';
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
  sectors: Sector[];
  fields: Field[];
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [fields, setFields] = useState<Field[]>([]);


  useEffect(() => {
    setLoading(true);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        if (usersData.length === 0) {
            // If no users, maybe bootstrap the admin user from mock data
            // For now, let's just use an empty array and let the auth handler create the user.
             setAllUsers([]);
        } else {
            setAllUsers(usersData);
        }
    }, (error) => {
        console.error("Error fetching users:", error);
        setAllUsers([]); 
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
        if (!snapshot.empty) {
            const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
            setRoles(rolesData);
        } else {
            setRoles(mockAdminRoles);
        }
    }, (error) => {
        console.error("Error fetching roles:", error);
        setRoles(mockAdminRoles);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (doc) => {
        if(doc.exists()){
            const settingsData = doc.data() as Settings;
            setSettings(settingsData);
            if (settingsData.sectors && settingsData.sectors.length > 0) {
                setSectors(settingsData.sectors);
            } else {
                 setSectors(mockSectors);
            }
        } else {
             const defaultSettings: Settings = {
                id: 'system',
                schoolName: 'ISGI',
                logoUrl: '',
                academicYear: '2024-2025',
                currency: 'XAF',
                levels: [{ value: 'Licence 1' }, { value: 'Licence 2' }, { value: 'Licence 3' }, { value: 'Master 1' }, { value: 'Master 2' }],
                sectors: mockSectors,
            };
            setSettings(defaultSettings);
            setSectors(mockSectors);
        }
    });
    
    const unsubFields = onSnapshot(collection(db, "fields"), (snapshot) => {
        if (!snapshot.empty) {
            const fieldsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Field));
            setFields(fieldsData);
        } else {
            setFields(mockFields);
        }
    }, (error) => {
        console.error("Error fetching fields:", error);
        setFields(mockFields);
    });

    
    setLoading(false);

    return () => {
      unsubUsers();
      unsubRoles();
      unsubSettings();
      unsubFields();
    };
   
  }, []);
  
  useEffect(() => {
      if (authUser && (allUsers.length > 0 || !loading)) {
          const matchedUser = allUsers.find(u => u.uid === authUser.uid);
          if (matchedUser) {
              setCurrentUser(matchedUser);
          } else {
              const isSuperAdminEmail = authUser.email === "admin@isgi.com" || authUser.email === "semfranslinbourangon@gmail.com";
              
              const newUserProfile: User = {
                  uid: authUser.uid,
                  email: authUser.email || '',
                  firstName: isSuperAdminEmail ? "ISGI Admin" : authUser.displayName?.split(' ')[0] || 'Nouveau',
                  lastName: isSuperAdminEmail ? "User" : authUser.displayName?.split(' ')[1] || 'Utilisateur',
                  photoUrl: authUser.photoURL || `https://picsum.photos/seed/${authUser.uid}/100/100`,
                  role: isSuperAdminEmail ? 'admin' : 'student',
                  status: 'active',
                  createdAt: new Date().toISOString(),
              };

              if (isSuperAdminEmail) {
                newUserProfile.admin = {
                    roleId: 'super_admin',
                    position: 'Super-Administrateur'
                }
              }
              
              const userDocRef = doc(db, 'users', authUser.uid);
              setDoc(userDocRef, newUserProfile).then(() => {
                 setAllUsers(prev => {
                    const userExists = prev.some(u => u.uid === newUserProfile.uid);
                    if (!userExists) {
                        return [...prev, newUserProfile];
                    }
                    return prev.map(u => u.uid === newUserProfile.uid ? newUserProfile : u);
                 });
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
      setCurrentUser(user);
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
      setSettings,
      sectors,
      fields
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
