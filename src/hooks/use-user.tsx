
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { mockUsers, mockAdminRoles, mockSectors } from '@/lib/mock-data';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  loading: boolean;
  roles: AdminRole[];
  userPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  settings: Settings | null;
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>>;
}

const UserContext = createContext<UserContextType | null>(null);

const defaultSettings: Settings = {
    id: 'system',
    schoolName: "Institut Supérieur de Gestion et d'Ingénierie",
    logoUrl: "",
    academicYear: "2024-2025",
    currency: "XAF",
    levels: [{value: "Licence 1"}, {value: "Licence 2"}, {value: "Licence 3"}, {value: "Master 1"}, {value: "Master 2"}],
    sectors: mockSectors,
};


export function UserProvider({ children }: { children: React.ReactNode }) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const usersQuery = query(collection(db, "users"));
    const rolesQuery = query(collection(db, "roles"));
    const settingsQuery = query(collection(db, "settings"));

    const unsubUsers = onSnapshot(usersQuery, (querySnapshot) => {
      const usersData = querySnapshot.docs.map(doc => ({ ...doc.data() } as User));
      setAllUsers(usersData);
      if (!currentUser && usersData.length > 0) {
        const superAdmin = usersData.find(u => u.admin?.position === 'Super-Administrateur');
        setCurrentUser(superAdmin || usersData[0]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users: ", error);
      // Fallback to mock data on error
      setAllUsers(mockUsers);
      const superAdmin = mockUsers.find(u => u.admin?.position === 'Super-Administrateur');
      if (!currentUser) setCurrentUser(superAdmin || mockUsers[0]);
      setLoading(false);
    });

    const unsubRoles = onSnapshot(rolesQuery, (querySnapshot) => {
      const rolesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
      setRoles(rolesData);
    }, (error) => {
      console.error("Error fetching roles: ", error);
      setRoles(mockAdminRoles);
    });
    
    const unsubSettings = onSnapshot(settingsQuery, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const settingsData = querySnapshot.docs.map(doc => ({...doc.data() } as Settings));
        const systemSettings = settingsData.find(s => s.id === 'system');
        setSettings(systemSettings || defaultSettings);
      } else {
        setSettings(defaultSettings);
      }
    }, (error) => {
      console.error("Error fetching settings: ", error);
      setSettings(defaultSettings);
    });


    return () => {
      unsubUsers();
      unsubRoles();
      unsubSettings();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') {
          return [];
      }
      
      if (currentUser.admin?.position?.toLowerCase().includes('super')) {
          return Object.keys(adminPermissions) as AdminPermission[];
      }

      if (!currentUser.admin?.roleId) {
          return [];
      }

      const userRole = roles.find(r => r.id === currentUser.admin?.roleId);
      return userRole ? userRole.permissions : [];
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
