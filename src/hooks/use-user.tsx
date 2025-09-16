"use client";

import React, { createContext, useContext, useState } from 'react';
import type { User } from '@/lib/types';
import { mockUsers } from '@/lib/mock-data';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Default to the first admin for demonstration
    return mockUsers.find(u => u.role === 'admin') || null;
  });

  const setUser = (user: User) => {
    setCurrentUser(user);
  };
  
  const value = { user: currentUser, setUser, users: mockUsers };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
