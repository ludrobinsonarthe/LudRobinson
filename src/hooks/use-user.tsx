

"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, AdminRole, AdminPermission, Settings, Sector, Field, Course } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, doc, setDoc, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { adminPermissions } from '@/lib/types';
import { mockUsers, mockSectors } from '@/lib/mock-data';
import { useAuth } from './use-auth';

type UserContextType = {
  user: User | null;
  setUser: (user: User) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  loading: boolean;
  roles: AdminRole[];
  settings: Settings | null;
  setSettings: (settings: Settings) => void;
  userPermissions: AdminPermission[];
  hasPermission: (permission: AdminPermission) => boolean;
  sectors: Sector[];
  fields: Field[];
  courses: Course[];
}

const initialSectors: Sector[] = [
  { id: 'gestion', name: 'GESTION' },
  { id: 'industrie', name: 'INDUSTRIE' },
  { id: 'technologie', name: 'TECHNOLOGIE' },
];

const initialFields: Field[] = [
    // GESTION
    { "id": "cge", "name": "Comptabilité et gestion d’entreprise", "sectorId": "gestion" },
    { "id": "acg", "name": "Audit et contrôle de gestion", "sectorId": "gestion" },
    { "id": "ci", "name": "Commerce international", "sectorId": "gestion" },
    { "id": "gam", "name": "Gestion en affaires mondiales", "sectorId": "gestion" },
    { "id": "mce", "name": "Marketing et communication d’entreprise", "sectorId": "gestion" },
    { "id": "gf", "name": "Gestion des finances", "sectorId": "gestion" },
    { "id": "grhae", "name": "GRH et administration des entreprises", "sectorId": "gestion" },
    { "id": "eli", "name": "Entrepreneuriat et leadership international", "sectorId": "gestion" },
    { "id": "dia", "name": "Droit international des affaires", "sectorId": "gestion" },
    { "id": "lt", "name": "Logistique et transport", "sectorId": "gestion" },

    // TECHNOLOGIE
    { "id": "ri", "name": "Réseaux informatiques", "sectorId": "technologie" },
    { "id": "tfo", "name": "Télécommunications et fibre optique", "sectorId": "technologie" },
    { "id": "mi", "name": "Maintenance informatique", "sectorId": "technologie" },
    { "id": "a2d3dm", "name": "Animation 2D, 3D et motion design", "sectorId": "technologie" },
    { "id": "gi", "name": "Génie informatique", "sectorId": "technologie" },
    { "id": "cs", "name": "Cybersécurité", "sectorId": "technologie" },
    { "id": "ria", "name": "Robotique et Intelligence Artificielle", "sectorId": "technologie" },
    { "id": "dwm", "name": "Développement web et mobile", "sectorId": "technologie" },
    { "id": "prog", "name": "Programmation", "sectorId": "technologie" },
    { "id": "idg", "name": "Infographie et design graphique", "sectorId": "technologie" },
    { "id": "ars", "name": "Administration réseaux et systèmes", "sectorId": "technologie" },
    { "id": "abd", "name": "Administration des Bases de Données", "sectorId": "technologie" },
    { "id": "gl", "name": "Génie Logiciel", "sectorId": "technologie" },

    // INDUSTRIE
    { "id": "gee", "name": "Génie électrique et électronique", "sectorId": "industrie" },
    { "id": "gm", "name": "Génie mécanique", "sectorId": "industrie" },
    { "id": "gca", "name": "Génie civil & Architecture", "sectorId": "industrie" },
    { "id": "mpg", "name": "Maintenance du pétrole et du gaz", "sectorId": "industrie" },
    { "id": "ervl", "name": "Entretien et réparation des véhicules légers", "sectorId": "industrie" },
    { "id": "ervp", "name": "Entretien et réparation des véhicules lourds", "sectorId": "industrie" },
    { "id": "tpg", "name": "Traitement du pétrole et du gaz", "sectorId": "industrie" },
    { "id": "dpg", "name": "Distribution pétrolière et gazière", "sectorId": "industrie" },
    { "id": "ot", "name": "Opérateur topographe", "sectorId": "industrie" },
    { "id": "fc", "name": "Froid et climatisation", "sectorId": "industrie" },
    { "id": "esr", "name": "Énergie solaire et renouvelable", "sectorId": "industrie" },
    { "id": "psi", "name": "Plomberie et soudure industrielle", "sectorId": "industrie" },
    { "id": "eis", "name": "Équipement industriel et sanitaire", "sectorId": "industrie" }
];


const defaultSettings: Settings = {
    id: 'system',
    schoolName: 'ISGI',
    logoUrl: '/logo.png',
    academicYear: '2024-2025',
    currency: 'XAF',
    levels: [{ value: 'Licence 1' }, { value: 'Licence 2' }, { value: 'Licence 3' }, { value: 'Master 1' }, { value: 'Master 2' }],
    sectors: [],
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    });

    const unsubRoles = onSnapshot(collection(db, 'adminRoles'), (snapshot) => {
      if (!isMounted) return;
        const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminRole));
        setRoles(rolesData);
    }, (error) => {
        console.error("Error fetching roles:", error);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
        if (!isMounted) return;
        if(docSnap.exists()){
            const settingsData = docSnap.data() as Settings;
             if (!settingsData.sectors || settingsData.sectors.length === 0) {
                console.log("Settings document is missing sectors. Seeding initial sectors.");
                const settingsRef = doc(db, "settings", "system");
                updateDoc(settingsRef, { sectors: initialSectors }).then(() => {
                    if (isMounted) setSettings({...settingsData, sectors: initialSectors});
                    console.log("Initial sectors seeded successfully.");
                }).catch(e => console.error("Error seeding sectors:", e));
            } else {
                 if (isMounted) setSettings(settingsData);
            }
        } else {
             const newSettings = {...defaultSettings, sectors: initialSectors };
             setDoc(doc(db, "settings", "system"), newSettings, { merge: true });
             if (isMounted) setSettings(newSettings);
        }
    });
    
    const unsubFields = onSnapshot(collection(db, "fields"), (snapshot) => {
        if (!isMounted) return;
         if (snapshot.empty) {
            console.log("Fields collection is empty. Seeding initial fields.");
            const batch = writeBatch(db);
            initialFields.forEach(field => {
                const fieldRef = doc(db, 'fields', field.id);
                batch.set(fieldRef, field);
            });
            batch.commit().then(() => {
                if (isMounted) setFields(initialFields);
                console.log("Initial fields seeded successfully.");
            }).catch(e => console.error("Error seeding fields:", e));
        } else {
             const fieldsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Field));
             if (isMounted) setFields(fieldsData);
        }
    }, (error) => {
        console.error("Error fetching fields:", error);
    });
    
    const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => {
      if (!isMounted) return;
        setCourses(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Course));
    });

    // This ensures that loading is set to false only after all initial data fetches are attempted
     const timer = setTimeout(() => {
        if (isMounted) {
            setLoading(false);
        }
    }, 1500);


    return () => {
      isMounted = false;
      unsubUsers();
      unsubRoles();
      unsubSettings();
      unsubFields();
      unsubCourses();
      clearTimeout(timer);
    };
   
  }, []);
  
  useEffect(() => {
      if (authLoading || loading) return;
    
      if (authUser && allUsers.length > 0) {
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
                  photoUrl: authUser.photoURL || "/logo.png",
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
      
  }, [authUser, allUsers, authLoading, loading]);

  
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

  const handleSetSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };
  
  const finalLoadingState = authLoading || loading || (!!authUser && !currentUser);

  const value: UserContextType = { 
      user: currentUser, 
      setUser, 
      users: allUsers, 
      setUsers: setAllUsers, 
      loading: finalLoadingState,
      roles,
      userPermissions,
      hasPermission,
      settings,
      setSettings: handleSetSettings,
      sectors: settings?.sectors || [],
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
