
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { mockUsers } from '@/lib/mock-data';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [allUsers, setAllUsers] = useState<User[]>(mockUsers);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Ensure currentUser is always an object from the list
    const adminUser = allUsers.find(u => u.role === 'admin');
    const userInList = allUsers.find(u => u.uid === currentUser?.uid);

    if (userInList) {
        setCurrentUser(userInList);
    } else if (currentUser === null && adminUser) {
        setCurrentUser(adminUser);
    } else if (allUsers.length > 0 && !userInList) {
        setCurrentUser(allUsers[0]);
    } else if (allUsers.length === 0) {
        setCurrentUser(null);
    }
  }, [allUsers, currentUser?.uid]);


  const setUser = (user: User) => {
    setCurrentUser(user);
  };
  
  const value = { user: currentUser, setUser, users: allUsers, setUsers: setAllUsers };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
