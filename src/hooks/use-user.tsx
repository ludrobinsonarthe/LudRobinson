

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { mockUsers, mockAdminRoles } from '@/lib/mock-data';

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
  const [allUsers, setAllUsers] = useState<User[]>(mockUsers);
  const [roles, setRoles] = useState<AdminRole[]>(mockAdminRoles);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        const combinedUsers = [...mockUsers];
        usersData.forEach(liveUser => {
            const index = combinedUsers.findIndex(mockUser => mockUser.uid === liveUser.uid);
            if (index !== -1) {
                combinedUsers[index] = liveUser;
            } else {
                combinedUsers.push(liveUser);
            }
        });

        setAllUsers(combinedUsers);
        if(!currentUser && combinedUsers.length > 0) {
            const superAdmin = combinedUsers.find(u => u.admin?.position === 'Super-Administrateur');
            setCurrentUser(superAdmin || combinedUsers[0] || null);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching users:", error);
        // Fallback to mock data if firestore fails
        if(!currentUser && mockUsers.length > 0) {
            const superAdmin = mockUsers.find(u => u.admin?.position === 'Super-Administrateur');
            setCurrentUser(superAdmin || mockUsers[0] || null);
        }
        setLoading(false);
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
        const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
         const combinedRoles = [...mockAdminRoles];
        rolesData.forEach(liveRole => {
            const index = combinedRoles.findIndex(mockRole => mockRole.id === liveRole.id);
            if (index !== -1) {
                combinedRoles[index] = liveRole;
            } else {
                combinedRoles.push(liveRole);
            }
        });
        setRoles(combinedRoles);
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

    // Subscriptions to other collections to ensure they are being listened to
    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {});
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {});
    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snapshot) => {});
    const unsubGrades = onSnapshot(collection(db, 'grades'), (snapshot) => {});
    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {});
    const unsubSalaries = onSnapshot(collection(db, 'salaries'), (snapshot) => {});
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {});
    const unsubCashFlow = onSnapshot(collection(db, 'cashTransactions'), (snapshot) => {});
    const unsubAnnouncements = onSnapshot(collection(db, 'messages'), (snapshot) => {});
    const unsubFeeStructures = onSnapshot(collection(db, 'feeStructures'), (snapshot) => {});
    const unsubDocuments = onSnapshot(collection(db, 'documents'), (snapshot) => {});

    return () => {
      unsubUsers();
      unsubRoles();
      unsubSettings();
      unsubCourses();
      unsubStudents();
      unsubTeachers();
      unsubGrades();
      unsubPayments();
      unsubSalaries();
      unsubAttendance();
      unsubCashFlow();
      unsubAnnouncements();
      unsubFeeStructures();
      unsubDocuments();
    };
   
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const userPermissions = useMemo((): AdminPermission[] => {
      if (currentUser?.role === 'admin') {
          return Object.keys(adminPermissions) as AdminPermission[];
      }
      return [];
  }, [currentUser]);

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
