
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
import { useMemo } from "react";


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function TeachersPage() {
    const { users, setUsers } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
    
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);

    const handleAdd = () => {
        setSelectedTeacher(null);
        setIsFormOpen(true);
    }

    const handleEdit = (user: User) => {
        setSelectedTeacher(user);
        setIsFormOpen(true);
    }

    const handleDelete = (user: User) => {
        setSelectedTeacher(user);
        setIsDeleteOpen(true);
    }

    const handleSave = (userData: Partial<User>) => {
        if (selectedTeacher) {
            // Edit
            setUsers(users.map(u => u.uid === selectedTeacher.uid ? { ...u, ...userData } as User : u));
        } else {
            // Add new teacher
            const newTeacher: User = {
                uid: `user${Date.now()}`,
                createdAt: new Date().toISOString(),
                status: 'active',
                role: 'teacher',
                ...userData
            } as User;
            setUsers([...users, newTeacher]);
        }
    }
    
    const confirmDelete = () => {
        if(selectedTeacher) {
            setUsers(users.filter(u => u.uid !== selectedTeacher.uid));
            setIsDeleteOpen(false);
            setSelectedTeacher(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Professeurs</h1>
                    <p className="text-muted-foreground">
                        Gérez les comptes et les attributions des professeurs.
                    </p>
                </div>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter un professeur
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des professeurs</CardTitle>
                    <CardDescription>
                        Consultez et gérez les profils des enseignants.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead className="hidden md:table-cell">Spécialité</TableHead>
                                <TableHead className="hidden lg:table-cell">Date d'ajout</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teachers.length > 0 ? teachers.map(teacher => (
                                <TableRow key={teacher.uid}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={teacher.photoUrl} alt={teacher.firstName} />
                                                <AvatarFallback>{getInitials(teacher.firstName, teacher.lastName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid gap-0.5">
                                                <span className="font-semibold">{teacher.firstName} {teacher.lastName}</span>
                                                <span className="text-sm text-muted-foreground">{teacher.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="secondary">{teacher.teacher?.specialty || 'Non définie'}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {format(new Date(teacher.createdAt), 'd MMMM yyyy', { locale: fr })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem onClick={() => handleEdit(teacher)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifier
                                               </DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => handleDelete(teacher)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Aucun professeur trouvé.
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
                user={selectedTeacher}
                defaultRole="teacher"
                allowedRoles={["teacher"]}
            />
            <UserDeleteDialog
                isOpen={isDeleteOpen}
                setIsOpen={setIsDeleteOpen}
                onConfirm={confirmDelete}
                user={selectedTeacher}
            />
        </div>
    );
}
