
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';

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
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(q, (querySnapshot) => {
      const usersFromDb: User[] = [];
      querySnapshot.forEach((doc) => {
        usersFromDb.push({ uid: doc.id, ...doc.data() } as User);
      });
      setAllUsers(usersFromDb);
      setLoadingUsers(false);
    });

    const rolesQuery = query(collection(db, "admin_roles"));
    const unsubscribeRoles = onSnapshot(rolesQuery, (querySnapshot) => {
      const rolesFromDb: AdminRole[] = [];
      querySnapshot.forEach((doc) => {
        rolesFromDb.push({ id: doc.id, ...doc.data() } as AdminRole);
      });
      setRoles(rolesFromDb);
      setLoadingRoles(false);
    });

    return () => {
        unsubscribeUsers();
        unsubscribeRoles();
    };
  }, []);
  
  const loading = loadingUsers || loadingRoles;

  useEffect(() => {
    if (loading) return;
    
    const adminUser = allUsers.find(u => u.role === 'admin' && u.admin?.position?.toLowerCase().includes('super'));
    const userInList = allUsers.find(u => u.uid === currentUser?.uid);

    if (userInList) {
        if (JSON.stringify(currentUser) !== JSON.stringify(userInList)) {
            setCurrentUser(userInList);
        }
    } else if (currentUser === null && adminUser) {
        setCurrentUser(adminUser);
    } else if (allUsers.length > 0 && !userInList) {
        setCurrentUser(allUsers[0]);
    } else if (allUsers.length === 0) {
        setCurrentUser(null);
    }
  }, [allUsers, currentUser, loading]);


  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role !== 'admin') {
          return [];
      }
      
      // Super admin has all permissions
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
