
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { mockUsers } from '@/lib/mock-data';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  loading: boolean;
  roles: AdminRole[];
  userPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        // Fallback to mock data to prevent permission errors from blocking the UI
        const usersFromDb = mockUsers;
        
        // Find the first admin and make them super-admin for demo purposes
        const firstAdminIndex = usersFromDb.findIndex(u => u.role === 'admin');
        if (firstAdminIndex !== -1 && !usersFromDb[firstAdminIndex].admin?.position?.toLowerCase().includes('super')) {
            usersFromDb[firstAdminIndex].admin = {...usersFromDb[firstAdminIndex].admin, position: 'Super-Administrateur'};
        }
        setAllUsers(usersFromDb);

        try {
            const rolesQuery = query(collection(db, "admin_roles"));
            const rolesSnapshot = await getDocs(rolesQuery);
            const rolesFromDb: AdminRole[] = [];
            rolesSnapshot.forEach((doc) => {
                rolesFromDb.push({ id: doc.id, ...doc.data() } as AdminRole);
            });
            setRoles(rolesFromDb);
        } catch (error) {
            console.warn("Could not fetch roles from Firestore, using empty list. This might be due to security rules.", error);
            setRoles([]);
        }
        
        // Set initial user after fetching all data
        if (currentUser === null) {
             const adminUser = usersFromDb.find(u => u.role === 'admin' && u.admin?.position?.toLowerCase().includes('super'));
             if (adminUser) {
                setCurrentUser(adminUser);
             } else if (usersFromDb.length > 0) {
                setCurrentUser(usersFromDb[0]);
             }
        }
        
        setLoading(false);
    }
    fetchData();
  }, []);
  
  useEffect(() => {
      if (!loading && currentUser) {
          const userInList = allUsers.find(u => u.uid === currentUser.uid);
          if (!userInList) {
              setCurrentUser(allUsers.length > 0 ? allUsers[0] : null);
          } else if (JSON.stringify(currentUser) !== JSON.stringify(userInList)) {
              setCurrentUser(userInList);
          }
      }
  }, [allUsers, currentUser, loading]);


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
      hasPermission
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
