
"use client";

import { useState, useMemo } from "react";
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
import { User, UserRole, Class } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";
import { mockClasses } from "@/lib/mock-data";
import StudentFormDialog from "@/components/student-form-dialog";

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function StudentsPage() {
    const { users, setUsers } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    
    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const parents = useMemo(() => users.filter(u => u.role === 'parent'), [users]);
    const classesById = useMemo(() => mockClasses.reduce((acc, c) => ({...acc, [c.id]: c}), {} as Record<string, Class>), []);

    const handleAdd = () => {
        setSelectedStudent(null);
        setIsFormOpen(true);
    }

    const handleEdit = (user: User) => {
        setSelectedStudent(user);
        setIsFormOpen(true);
    }

    const handleDelete = (user: User) => {
        setSelectedStudent(user);
        setIsDeleteOpen(true);
    }

    const handleSave = (studentData: Partial<User>, parentData?: Partial<User>) => {
        if (selectedStudent) {
            // Edit existing student
            const updatedUsers = users.map(u => u.uid === selectedStudent.uid ? { ...u, ...studentData } as User : u);
            setUsers(updatedUsers);
        } else {
            // Add new student and potentially a new parent
            const newStudent: User = {
                uid: `user${Date.now()}`,
                createdAt: new Date().toISOString(),
                status: 'active',
                role: 'student',
                ...studentData
            } as User;

            let newUsers = [...users, newStudent];
            
            if (parentData && parentData.email) {
                 const newParent : User = {
                    uid: `user${Date.now() + 1}`,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    role: 'parent',
                    ...parentData,
                    parent: { childrenUids: [newStudent.uid] }
                 } as User;
                 newStudent.student!.parentUid = newParent.uid;
                 newUsers.push(newParent);
            } else if (studentData.student?.parentUid) {
                // Link to existing parent
                const parentIndex = newUsers.findIndex(u => u.uid === studentData.student?.parentUid);
                if(parentIndex !== -1) {
                    const parent = newUsers[parentIndex];
                    parent.parent = {
                        childrenUids: [...(parent.parent?.childrenUids || []), newStudent.uid]
                    }
                    newUsers[parentIndex] = parent;
                }
            }
            setUsers(newUsers);
        }
    }
    
    const confirmDelete = () => {
        if(selectedStudent) {
            setUsers(users.filter(u => u.uid !== selectedStudent.uid));
            setIsDeleteOpen(false);
            setSelectedStudent(null);
        }
    }
    
    const getParentName = (parentUid?: string) => {
        if (!parentUid) return 'N/A';
        const parent = parents.find(p => p.uid === parentUid);
        return parent ? `${parent.firstName} ${parent.lastName}` : 'Inconnu';
    }


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Étudiants</h1>
                    <p className="text-muted-foreground">
                        Consultez et gérez les informations des étudiants de l'institut.
                    </p>
                </div>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter un étudiant
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des étudiants</CardTitle>
                    <CardDescription>
                        Recherchez, ajoutez, ou modifiez les profils des étudiants.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead className="hidden md:table-cell">Classe</TableHead>
                                <TableHead className="hidden lg:table-cell">Tuteur</TableHead>
                                <TableHead className="hidden lg:table-cell">Date d'inscription</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.length > 0 ? students.map(student => (
                                <TableRow key={student.uid}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={student.photoUrl} alt={student.firstName} />
                                                <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid gap-0.5">
                                                <span className="font-semibold">{student.firstName} {student.lastName}</span>
                                                <span className="text-sm text-muted-foreground">{student.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="secondary">{student.student?.classId ? classesById[student.student.classId]?.name : 'Non assigné'}</Badge>
                                    </TableCell>
                                     <TableCell className="hidden lg:table-cell">
                                        {getParentName(student.student?.parentUid)}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {format(new Date(student.createdAt), 'd MMMM yyyy', { locale: fr })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem onClick={() => handleEdit(student)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifier
                                               </DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => handleDelete(student)} className="text-destructive">
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
                                        Aucun étudiant trouvé.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <StudentFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                student={selectedStudent}
                parents={parents}
                classes={mockClasses}
            />
            <UserDeleteDialog
                isOpen={isDeleteOpen}
                setIsOpen={setIsDeleteOpen}
                onConfirm={confirmDelete}
                user={selectedStudent}
            />
        </div>
    );
}
