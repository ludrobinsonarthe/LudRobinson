
"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { TeacherSalary, Attendance, Course } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Trash2, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, getMonth, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import SalaryFormDialog from '@/components/salary-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';

function SalaryManagementContent() {
    const { users, loading: usersLoading } = useUser();
    const searchParams = useSearchParams();
    const teacherIdFilter = searchParams.get('teacherId');

    const [salaries, setSalaries] = useState<TeacherSalary[]>([]);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedSalary, setSelectedSalary] = useState<TeacherSalary | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsubSalaries = onSnapshot(collection(db, "salaries"), (snapshot) => {
            const data: TeacherSalary[] = [];
            snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as TeacherSalary));
            setSalaries(data.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });
        const unsubAttendances = onSnapshot(collection(db, "attendances"), (snapshot) => {
            const data: Attendance[] = [];
            snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Attendance));
            setAttendances(data);
        });
        const unsubCourses = onSnapshot(collection(db, "courses"), (snapshot) => {
            const data: Course[] = [];
            snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Course));
            setCourses(data);
        });
        setLoadingData(false);
        return () => {
            unsubSalaries();
            unsubAttendances();
            unsubCourses();
        }
    }, []);
    
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    
    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(s => s.uid === teacherId);
        return teacher ? `${'\'teacher.firstName\''} ${'\'teacher.lastName\''}` : 'Inconnu';
    }

    const filteredSalaries = useMemo(() => {
        if (!teacherIdFilter) return salaries;
        return salaries.filter(s => s.teacherId === teacherIdFilter);
    }, [salaries, teacherIdFilter]);

    const pageTitle = useMemo(() => {
        if (teacherIdFilter) {
            return `Salaires pour ${getTeacherName(teacherIdFilter)}`;
        }
        return "Gestion des Salaires";
    }, [teacherIdFilter, teachers]);


    const handleAdd = () => {
        setSelectedSalary(null);
        setIsFormOpen(true);
    }
    
    const calculateHours = (teacherId: string, month: number, year: number): number => {
        const teacherAttendances = attendances.filter(a => 
            a.teacherId === teacherId &&
            a.status === 'present' &&
            getMonth(new Date(a.date)) === month &&
            getYear(new Date(a.date)) === year
        );

        let totalHours = 0;
        teacherAttendances.forEach(att => {
            const course = courses.find(c => c.id === att.courseId);
            const scheduleEntry = course?.schedule?.find(s => format(new Date(att.date), 'EEEE', {locale: fr}) === s.day);
            if(scheduleEntry) {
                 const start = parseFloat(scheduleEntry.start.replace(':', '.'));
                 const end = parseFloat(scheduleEntry.end.replace(':', '.'));
                 totalHours += (end - start);
            }
        });
        return totalHours;
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
            const batch = writeBatch(db);
            const salaryRef = doc(db, "salaries", salary.id);
            batch.update(salaryRef, { status, paidAt: new Date().toISOString() });
            
            if(status === 'paid') {
                const transactionRef = doc(collection(db, 'cash_transactions'));
                batch.set(transactionRef, {
                    id: transactionRef.id,
                    date: new Date().toISOString(),
                    type: 'expense',
                    category: 'salary',
                    description: `Paiement salaire - ${getTeacherName(salary.teacherId)} - ${salary.month} ${salary.year}`,
                    amount: salary.totalSalary,
                    currency: salary.currency,
                    createdBy: 'admin', // This should be the current admin's UID
                    relatedDocId: salary.id,
                });
            }

            await batch.commit();

            toast({ title: "Statut mis à jour", description: `Le salaire a été marqué comme payé et enregistré en caisse.` });
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

    const loading = usersLoading || loadingData;

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">{pageTitle}</h1>
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
                                {!teacherIdFilter && <TableHead>Professeur</TableHead>}
                                <TableHead>Mois/Année</TableHead>
                                <TableHead>Taux Horaire</TableHead>
                                <TableHead>Heures</TableHead>
                                <TableHead>Salaire Total</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : filteredSalaries.length > 0 ? filteredSalaries.map(salary => (
                                <TableRow key={salary.id}>
                                    {!teacherIdFilter && <TableCell className="font-medium">{getTeacherName(salary.teacherId)}</TableCell>}
                                    <TableCell>{salary.month} {salary.year}</TableCell>
                                    <TableCell>{formatCurrency(salary.hourlyRate, salary.currency)}</TableCell>
                                    <TableCell>{salary.hoursWorked}h</TableCell>
                                    <TableCell className='font-semibold'>{formatCurrency(salary.totalSalary, salary.currency)}</TableCell>
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
                                    <TableCell colSpan={7} className="h-24 text-center">
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
                initialTeacherId={teacherIdFilter}
                calculateHours={calculateHours}
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

export default function SalaryManagementPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <SalaryManagementContent />
        </Suspense>
    )
}
