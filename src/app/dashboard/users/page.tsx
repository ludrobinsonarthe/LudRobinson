
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
import { User, UserRole, AdminRole } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserFormDialog from "@/components/user-form-dialog";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, deleteDoc, updateDoc, collection, getDocs, query } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
    active: "default",
    suspended: "destructive",
}

const statusTranslation: { [key: string]: string } = {
    active: "Actif",
    suspended: "Suspendu",
}


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function UsersPage() {
    const { users, loading, setUsers } = useUser();
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        async function fetchRoles() {
            setLoadingRoles(true);
            const q = query(collection(db, "admin_roles"));
            const snapshot = await getDocs(q);
            const rolesFromDb: AdminRole[] = [];
            snapshot.forEach((doc) => {
                rolesFromDb.push({ id: doc.id, ...doc.data() } as AdminRole);
            });
            setRoles(rolesFromDb);
            setLoadingRoles(false);
        }
        fetchRoles();
    }, []);

    const admins = useMemo(() => {
        return users.filter(user => user.role === 'admin');
    }, [users]);
    
    const rolesById = useMemo(() => {
        return roles.reduce((acc, role) => {
            acc[role.id] = role;
            return acc;
        }, {} as Record<string, AdminRole>);
    }, [roles]);

    const handleAdd = () => {
        setSelectedUser(null);
        setIsFormOpen(true);
    }

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsFormOpen(true);
    }

    const handleDelete = (user: User) => {
        setSelectedUser(user);
        setIsDeleteOpen(true);
    }

    const handleSave = async (userData: Partial<User>, photoFile?: File | Blob) => {
        try {
            let userUid = selectedUser?.uid;
            if (!userUid) {
                userUid = doc(collection(db, "users")).id;
            }
            
            let photoUrl = userData.photoUrl || selectedUser?.photoUrl;

            if (photoFile && userUid) {
                 const storageRef = ref(storage, `profile-pictures/${userUid}/profile.jpg`);
                 const uploadResult = await uploadBytes(storageRef, photoFile, { contentType: 'image/jpeg' });
                 photoUrl = await getDownloadURL(uploadResult.ref);
            }
            
            const finalUserData: User = {
                ...selectedUser,
                ...userData,
                photoUrl: photoUrl || `https://picsum.photos/seed/${userUid}/100/100`,
            } as User;

            if (selectedUser) {
                // Edit
                const userRef = doc(db, "users", selectedUser.uid);
                await updateDoc(userRef, finalUserData);
                setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? finalUserData : u));
                toast({ title: "Administrateur mis à jour", description: "Les informations ont été mises à jour." });
            } else {
                // Add
                const newUser: User = {
                    uid: userUid,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    role: 'admin',
                    ...finalUserData,
                } as User;
                await setDoc(doc(db, "users", userUid), newUser);
                setUsers(prev => [...prev, newUser]);
                toast({ title: "Administrateur ajouté", description: "Le nouvel utilisateur a été ajouté." });
            }
        } catch (error) {
            console.error("Error saving user:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'utilisateur." });
        }
    }
    
    const confirmDelete = async () => {
        if(selectedUser) {
            try {
                await deleteDoc(doc(db, "users", selectedUser.uid));
                setUsers(prev => prev.filter(u => u.uid !== selectedUser.uid));
                toast({ title: "Utilisateur supprimé", description: "L'utilisateur a été supprimé." });
                setIsDeleteOpen(false);
                setSelectedUser(null);
            } catch (error) {
                console.error("Error deleting user: ", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'utilisateur." });
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion du Personnel</h1>
                    <p className="text-muted-foreground">
                        Gérez les comptes du personnel administratif.
                    </p>
                </div>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter un administrateur
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste du personnel</CardTitle>
                    <CardDescription>
                        Recherchez, ajoutez, ou modifiez les profils du personnel administratif.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead className="hidden md:table-cell">Rôle (Permissions)</TableHead>
                                <TableHead className="hidden md:table-cell">Poste</TableHead>
                                <TableHead className="hidden lg:table-cell">Statut</TableHead>
                                <TableHead className="hidden lg:table-cell">Date de création</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading || loadingRoles ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : admins.length > 0 ? admins.map(user => (
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
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="outline">{user.admin?.roleId ? rolesById[user.admin.roleId]?.name : 'Non défini'}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {user.admin?.position || 'N/A'}
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
                                        Aucun administrateur trouvé.
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
                userType="admin"
                adminRoles={roles}
            />
            <UserDeleteDialog
                isOpen={isDeleteOpen}
                setIsOpen={setIsDeleteOpen}
                onConfirm={confirmDelete}
                user={selectedUser}
            />
        </div>
    );
}

    