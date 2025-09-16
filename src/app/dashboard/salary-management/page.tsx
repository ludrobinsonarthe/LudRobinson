
"use client";

import { useState, useMemo, useEffect } from 'react';
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
import { useUser } from "@/hooks/use-user";
import { TeacherSalary } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Trash2, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import SalaryFormDialog from '@/components/salary-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';


export default function SalaryManagementPage() {
    const { users, loading: usersLoading } = useUser();
    const [salaries, setSalaries] = useState<TeacherSalary[]>([]);
    const [loadingSalaries, setLoadingSalaries] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedSalary, setSelectedSalary] = useState<TeacherSalary | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "salaries"), (snapshot) => {
            const salariesFromDb: TeacherSalary[] = [];
            snapshot.forEach((doc) => {
                salariesFromDb.push({ id: doc.id, ...doc.data() } as TeacherSalary);
            });
            setSalaries(salariesFromDb.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setLoadingSalaries(false);
        });
        return () => unsubscribe();
    }, []);
    
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(s => s.uid === teacherId);
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Inconnu';
    }

    const handleAdd = () => {
        setSelectedSalary(null);
        setIsFormOpen(true);
    }

    const handleSave = async (salaryData: Omit<TeacherSalary, 'id' | 'createdAt' | 'status'>) => {
         try {
            const newSalaryId = doc(collection(db, "salaries")).id;
            const newSalary: TeacherSalary = {
                id: newSalaryId,
                createdAt: new Date().toISOString(),
                status: 'pending',
                ...salaryData
            };
            await setDoc(doc(db, "salaries", newSalaryId), newSalary);
            toast({ title: "Fiche de paie générée", description: "La fiche de paie a été enregistrée avec succès." });
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving salary:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer la fiche de paie." });
        }
    }
    
    const handleUpdateStatus = async (salary: TeacherSalary, status: 'paid') => {
        try {
            const salaryRef = doc(db, "salaries", salary.id);
            await updateDoc(salaryRef, { status, paidAt: new Date().toISOString() });
            toast({ title: "Statut mis à jour", description: `Le salaire a été marqué comme payé.` });
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    }

    const handleDelete = (salary: TeacherSalary) => {
        setSelectedSalary(salary);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if(selectedSalary) {
            try {
                await deleteDoc(doc(db, "salaries", selectedSalary.id));
                toast({ title: "Fiche de paie supprimée", description: "L'enregistrement a été supprimé." });
                setIsDeleteOpen(false);
                setSelectedSalary(null);
            } catch (error) {
                console.error("Error deleting salary: ", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la fiche de paie." });
            }
        }
    }

    const statusVariant: { [key: string]: "default" | "secondary" } = {
        paid: "default",
        pending: "secondary",
    }
    const statusTranslation: { [key: string]: string } = {
        paid: "Payé",
        pending: "En attente",
    }

    const loading = usersLoading || loadingSalaries;

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Salaires</h1>
                    <p className="text-muted-foreground">
                        Suivez et gérez la paie des professeurs.
                    </p>
                </div>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Générer une fiche de paie
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Historique des fiches de paie</CardTitle>
                    <CardDescription>
                        Liste de toutes les fiches de paie générées et leur statut.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Professeur</TableHead>
                                <TableHead>Mois/Année</TableHead>
                                <TableHead>Salaire Total</TableHead>
                                <TableHead>Date d'émission</TableHead>
                                <TableHead>Statut</TableHead>
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
                            ) : salaries.length > 0 ? salaries.map(salary => (
                                <TableRow key={salary.id}>
                                    <TableCell className="font-medium">{getTeacherName(salary.teacherId)}</TableCell>
                                    <TableCell>{salary.month} {salary.year}</TableCell>
                                    <TableCell className='font-semibold'>{formatCurrency(salary.totalSalary, salary.currency)}</TableCell>
                                    <TableCell>{format(new Date(salary.createdAt), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[salary.status]}>{statusTranslation[salary.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               {salary.status === 'pending' && (
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(salary, 'paid')}>
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        Marquer comme Payé
                                                    </DropdownMenuItem>
                                               )}
                                               <DropdownMenuItem>Voir détails</DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => handleDelete(salary)} className="text-destructive">
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
                                        Aucune fiche de paie trouvée.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <SalaryFormDialog
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                teachers={teachers}
            />

            {selectedSalary && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    user={{uid: selectedSalary.id, firstName: `Fiche de paie pour ${getTeacherName(selectedSalary.teacherId)}`, lastName: ''}}
                />
            )}
        </div>
    );
}
