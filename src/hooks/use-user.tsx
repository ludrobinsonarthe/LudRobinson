
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  loading: boolean;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersFromDb: User[] = [];
      querySnapshot.forEach((doc) => {
        usersFromDb.push({ uid: doc.id, ...doc.data() } as User);
      });
      setAllUsers(usersFromDb);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    
    // Ensure currentUser is always an object from the list
    const adminUser = allUsers.find(u => u.role === 'admin');
    const userInList = allUsers.find(u => u.uid === currentUser?.uid);

    if (userInList) {
        // If current user exists in the new list, update its object
        if (JSON.stringify(currentUser) !== JSON.stringify(userInList)) {
            setCurrentUser(userInList);
        }
    } else if (currentUser === null && adminUser) {
        // If no user is selected, default to admin
        setCurrentUser(adminUser);
    } else if (allUsers.length > 0 && !userInList) {
        // If selected user is not in the list anymore, select first user
        setCurrentUser(allUsers[0]);
    } else if (allUsers.length === 0) {
        // If no users, set to null
        setCurrentUser(null);
    }
  }, [allUsers, currentUser, loading]);


  const setUser = (user: User) => {
    setCurrentUser(user);
  };
  
  const value = { user: currentUser, setUser, users: allUsers, setUsers: setAllUsers, loading };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === null) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
