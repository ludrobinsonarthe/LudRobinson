

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import { User } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, Banknote, ClipboardCheck } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserFormDialog from "@/components/user-form-dialog";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, deleteDoc, addDoc, collection } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function TeachersPage() {
    const { users, loading } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
    const { toast } = useToast();
    
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

    const handleSave = async (userData: Partial<User>, photoFile?: File | Blob) => {
        const uid = selectedTeacher?.uid || `teacher_${Date.now()}`;
        let photoUrl = userData.photoUrl || selectedTeacher?.photoUrl;
        
        try {
            if (photoFile) {
                const photoRef = ref(storage, `avatars/${uid}`);
                const snapshot = await uploadBytes(photoRef, photoFile);
                photoUrl = await getDownloadURL(snapshot.ref);
            }

            const finalUserData = {
                ...userData,
                photoUrl: photoUrl || `https://picsum.photos/seed/${uid}/100/100`,
                role: 'teacher',
            };

            const userDocRef = doc(db, 'users', uid);

            if (selectedTeacher) {
                await setDoc(userDocRef, finalUserData, { merge: true });
                toast({ title: "Professeur mis à jour" });
            } else {
                 const newUser: User = {
                    uid: uid,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    ...finalUserData,
                } as User;
                await setDoc(userDocRef, newUser);
                toast({ title: "Professeur ajouté" });
            }
        } catch (error) {
             console.error("Error saving teacher:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le professeur." });
        }
    }
    
    const confirmDelete = async () => {
        if(selectedTeacher) {
             try {
                await deleteDoc(doc(db, "users", selectedTeacher.uid));
                toast({ title: "Professeur supprimé" });
            } catch (error) {
                console.error("Error deleting teacher:", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le professeur." });
            } finally {
                 setIsDeleteOpen(false);
                 setSelectedTeacher(null);
            }
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
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : teachers.length > 0 ? teachers.map(teacher => (
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
                                               <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/salary-management?teacherId=${teacher.uid}`}>
                                                        <Banknote className="mr-2 h-4 w-4" />
                                                        Gérer les salaires
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/attendance?teacherId=${teacher.uid}`}>
                                                        <ClipboardCheck className="mr-2 h-4 w-4" />
                                                        Voir les présences
                                                    </Link>
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
                userType="teacher"
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
