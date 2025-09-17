

"use client";

import { useState, useMemo, useEffect }from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, UserRole, AdminRole, TeacherSalary } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserFormDialog from "@/components/user-form-dialog";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, deleteDoc, addDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
    active: "default",
    suspended: "destructive",
}

const statusTranslation: { [key: string]: string } = {
    active: "Actif",
    suspended: "Suspendu",
}

const roleTranslation: { [key: string]: string } = {
    admin: "Admin",
    teacher: "Professeur",
}


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function UsersPage() {
    const { users, loading, roles } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userType, setUserType] = useState<'admin' | 'teacher'>('admin');
    const { toast } = useToast();

    // Filters
    const [nameFilter, setNameFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    
    const employees = useMemo(() => {
        return users.filter(user => user.role === 'admin' || user.role === 'teacher');
    }, [users]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(employee => 
            (`${employee.firstName} ${employee.lastName}`.toLowerCase().includes(nameFilter.toLowerCase())) &&
            (roleFilter === 'all' || employee.role === roleFilter)
        )
    }, [employees, nameFilter, roleFilter]);
    
    const rolesById = useMemo(() => {
        return roles.reduce((acc, role) => {
            acc[role.id] = role;
            return acc;
        }, {} as Record<string, AdminRole>);
    }, [roles]);

    const handleAdd = (type: 'admin' | 'teacher') => {
        setSelectedUser(null);
        setUserType(type);
        setIsFormOpen(true);
    }

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setUserType(user.role as 'admin' | 'teacher');
        setIsFormOpen(true);
    }

    const handleDelete = (user: User) => {
        setSelectedUser(user);
        setIsDeleteOpen(true);
    }

    const handleSave = async (userData: Partial<User>, photoFile?: File | Blob) => {
        const isNewUser = !selectedUser;
        const uid = selectedUser?.uid || doc(collection(db, "users")).id;
        let photoUrl = userData.photoUrl || selectedUser?.photoUrl;
        
        try {
            if (photoFile) {
                const photoRef = ref(storage, `avatars/${uid}`);
                const snapshot = await uploadBytes(photoRef, photoFile);
                photoUrl = await getDownloadURL(snapshot.ref);
            }

            const finalUserData: User = {
                ...selectedUser,
                ...userData,
                uid: uid,
                role: userData.role as UserRole,
                photoUrl: photoUrl || `https://picsum.photos/seed/${uid}/100/100`,
                createdAt: selectedUser?.createdAt || new Date().toISOString(),
                status: selectedUser?.status || 'active',
            } as User;

            const userDocRef = doc(db, 'users', uid);
            await setDoc(userDocRef, finalUserData, { merge: true });

            toast({ title: isNewUser ? "Personnel ajouté" : "Personnel mis à jour" });
            
        } catch (error) {
             console.error("Error saving user:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'utilisateur." });
        }
    }
    
    const confirmDelete = async () => {
        if(!selectedUser) return;
        
        const batch = writeBatch(db);
        const userId = selectedUser.uid;
        
        try {
            // 1. Delete user document
            batch.delete(doc(db, "users", userId));

            // 2. Query and delete related data if they are a teacher
            if (selectedUser.role === 'teacher') {
                const qSalaries = query(collection(db, "teacherSalaries"), where("teacherId", "==", userId));
                const salariesSnapshot = await getDocs(qSalaries);
                salariesSnapshot.forEach(doc => batch.delete(doc.ref));
            }
             // TODO: Add logic for deleting other admin-related data if necessary in future

            // 3. Delete avatar from storage
             if (selectedUser.photoUrl && selectedUser.photoUrl.includes('firebasestorage')) {
                 try {
                    const photoRef = ref(storage, selectedUser.photoUrl);
                    await deleteObject(photoRef);
                } catch (storageError: any) {
                    if (storageError.code !== 'storage/object-not-found') {
                         console.error("Could not delete avatar: ", storageError);
                    }
                }
            }

            await batch.commit();
            toast({ title: "Utilisateur supprimé" });

        } catch(error) {
            console.error("Error deleting user:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'utilisateur et ses données associées." });
        } finally {
             setIsDeleteOpen(false);
             setSelectedUser(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion du Personnel</h1>
                    <p className="text-muted-foreground">
                        Gérez les comptes des professeurs et du personnel administratif.
                    </p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Ajouter du personnel
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleAdd('teacher')}>Ajouter un Professeur</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAdd('admin')}>Ajouter un Administrateur</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste du personnel</CardTitle>
                    <CardDescription>
                        Recherchez, ajoutez, ou modifiez les profils du personnel.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex items-center gap-4 mb-4">
                        <Input
                            placeholder="Rechercher par nom..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les rôles</SelectItem>
                                <SelectItem value="teacher">Professeurs</SelectItem>
                                <SelectItem value="admin">Administrateurs</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead>Rôle</TableHead>
                                <TableHead className="hidden md:table-cell">Spécificité</TableHead>
                                <TableHead className="hidden lg:table-cell">Statut</TableHead>
                                <TableHead className="hidden lg:table-cell">Date d'ajout</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : filteredEmployees.length > 0 ? filteredEmployees.map(user => (
                                <TableRow key={user.uid}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={user.photoUrl} alt={user.firstName} />
                                                <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid gap-0.5">
                                                <span className="font-semibold">{user.firstName} {user.lastName}</span>
                                                <span className="text-sm text-muted-foreground">{user.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{roleTranslation[user.role]}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {user.role === 'teacher' ? user.teacher?.specialty : rolesById[user.admin?.roleId || '']?.name || 'N/A'}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <Badge variant={statusVariant[user.status]}>{statusTranslation[user.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {format(new Date(user.createdAt), 'd MMMM yyyy', { locale: fr })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifier
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(user)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Aucun personnel trouvé.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <UserFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                user={selectedUser}
                userType={userType}
                adminRoles={roles}
            />
            <UserDeleteDialog
                isOpen={isDeleteOpen}
                setIsOpen={setIsDeleteOpen}
                onConfirm={confirmDelete}
                item={selectedUser}
            />
        </div>
    );
}
