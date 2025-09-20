

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, Course } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc, setDoc, writeBatch } from 'firebase/firestore';
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
  setSettings: React.Dispatch<React.SetStateAction<Settings | null>> | null;
  sectors: Sector[];
  fields: Field[];
  courses: Course[];
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);


  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (!isMounted) return;
        const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
        if (snapshot.empty) {
            console.log("Users collection is empty. Seeding mock users.");
            const batch = writeBatch(db);
            mockUsers.forEach(user => {
                const userRef = doc(db, 'users', user.uid);
                batch.set(userRef, user);
            });
            batch.commit().then(() => {
                if(isMounted) setAllUsers(mockUsers);
                 console.log("Mock users seeded successfully.");
            }).catch(e => console.error("Error seeding mock users: ", e));
        } else {
            if(isMounted) setAllUsers(usersData);
        }
    }, (error) => {
        console.error("Error fetching users:", error);
        if(isMounted) setAllUsers(mockUsers); 
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
      if (!isMounted) return;
        if (!snapshot.empty) {
            const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
            setRoles(rolesData);
        } else {
            setRoles(mockAdminRoles);
        }
    }, (error) => {
        console.error("Error fetching roles:", error);
        if(isMounted) setRoles(mockAdminRoles);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (doc) => {
      if (!isMounted) return;
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
                academicYear: '2024-2025',
                currency: 'XAF',
                levels: [{ value: 'Licence 1' }, { value: 'Licence 2' }, { value: 'Licence 3' }, { value: 'Master 1' }, { value: 'Master 2' }],
                sectors: mockSectors,
            };
            if(isMounted) setSettings(defaultSettings);
            if(isMounted) setSectors(mockSectors);
        }
    });
    
    const unsubFields = onSnapshot(collection(db, "fields"), (snapshot) => {
      if (!isMounted) return;
        if (!snapshot.empty) {
            const fieldsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Field));
            setFields(fieldsData);
        } else {
            setFields(mockFields);
        }
    }, (error) => {
        console.error("Error fetching fields:", error);
        if(isMounted) setFields(mockFields);
    });
    
    const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => {
      if (!isMounted) return;
        setCourses(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Course));
    });

    Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'adminRoles')),
        getDocs(doc(db, 'settings', 'system')),
    ]).finally(() => {
        if(isMounted) setLoading(false);
    })

    return () => {
      isMounted = false;
      unsubUsers();
      unsubRoles();
      unsubSettings();
      unsubFields();
      unsubCourses();
    };
   
  }, []);
  
  useEffect(() => {
    
      if (authUser && (allUsers.length > 0 || !authLoading)) {
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
                  photoUrl: authUser.photoURL || `/logo.png`,
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
      } else if (!authLoading && !authUser) {
          setCurrentUser(null);
      }
      
  }, [authUser, allUsers, authLoading]);

  
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
  
  const value = { 
      user: currentUser, 
      setUser, 
      users: allUsers, 
      setUsers: setAllUsers, 
      loading: loading,
      roles,
      setRoles,
      userPermissions,
      hasPermission,
      settings,
      setSettings,
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

    

    