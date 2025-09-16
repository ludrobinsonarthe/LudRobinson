

"use client";

import { useState } from "react";
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
import { User, UserRole } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserFormDialog from "@/components/user-form-dialog";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";


const roleTranslation: { [key in UserRole]: string } = {
  admin: "Administrateur",
  teacher: "Enseignant",
  student: "Étudiant",
  parent: "Parent",
};

const statusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
    active: "default",
    suspended: "destructive",
    graduated: "secondary",
}

const statusTranslation: { [key: string]: string } = {
    active: "Actif",
    suspended: "Suspendu",
    graduated: "Diplômé",
}


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function UsersPage() {
    const { users, setUsers } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

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

    const handleSave = (userData: Partial<User>) => {
        if (selectedUser) {
            // Edit
            setUsers(users.map(u => u.uid === selectedUser.uid ? { ...u, ...userData } as User : u));
        } else {
            // Add
            const newUser: User = {
                uid: `user${Date.now()}`,
                createdAt: new Date().toISOString(),
                status: 'active',
                ...userData
            } as User;
            setUsers([...users, newUser]);
        }
    }
    
    const confirmDelete = () => {
        if(selectedUser) {
            setUsers(users.filter(u => u.uid !== selectedUser.uid));
            setIsDeleteOpen(false);
            setSelectedUser(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Utilisateurs</h1>
                    <p className="text-muted-foreground">
                        Gérez tous les comptes utilisateurs du système.
                    </p>
                </div>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter un utilisateur
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des utilisateurs</CardTitle>
                    <CardDescription>
                        Recherchez, ajoutez, ou modifiez les profils des utilisateurs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead className="hidden md:table-cell">Rôle</TableHead>
                                <TableHead className="hidden lg:table-cell">Statut</TableHead>
                                <TableHead className="hidden lg:table-cell">Date de création</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length > 0 ? users.map(user => (
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
                                        <Badge variant="outline">{roleTranslation[user.role]}</Badge>
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
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Aucun utilisateur trouvé.
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
