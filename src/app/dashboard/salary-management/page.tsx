
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
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import SalaryFormDialog from '@/components/salary-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { mockSalaries, mockAttendances, mockCourses } from '@/lib/mock-data';

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
        setLoadingData(true);
        setSalaries(mockSalaries.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setAttendances(mockAttendances);
        setCourses(mockCourses);
        setLoadingData(false);
    }, []);
    
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    
    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(s => s.uid === teacherId);
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Inconnu';
    }

    const filteredSalaries = useMemo(() => {
        if (!teacherIdFilter) return salaries;
        return salaries.filter(s => s.teacherId === teacherIdFilter);
    }, [salaries, teacherIdFilter]);

    const pageTitle = useMemo(() => {
        if (teacherIdFilter) {
            const teacher = teachers.find(t => t.uid === teacherIdFilter);
            return `Salaires pour ${teacher ? `${teacher.firstName} ${teacher.lastName}`: 'Professeur'}`;
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
            a.teacherStatus === 'present' &&
            getMonth(new Date(a.date)) === month &&
            getYear(new Date(a.date)) === year
        );

        let totalHours = 0;
        teacherAttendances.forEach(att => {
            const course = courses.find(c => c.id === att.courseId);
            if (course?.schedule) {
                const scheduleEntry = course.schedule.find(s => format(new Date(att.date), 'EEEE', { locale: fr }) === s.day);
                if (scheduleEntry) {
                    try {
                        const [startHour, startMinute] = scheduleEntry.start.split(':').map(Number);
                        const [endHour, endMinute] = scheduleEntry.end.split(':').map(Number);
                        const duration = (endHour - startHour) + (endMinute - startMinute) / 60;
                        if (!isNaN(duration) && duration > 0) {
                            totalHours += duration;
                        }
                    } catch (e) {
                        console.error("Error parsing schedule time", e);
                    }
                }
            }
        });
        return totalHours;
    }


    const handleSave = async (salaryData: Omit<TeacherSalary, 'id' | 'createdAt' | 'status'>) => {
        const newSalary: TeacherSalary = {
            id: `salary_${Date.now()}`,
            createdAt: new Date().toISOString(),
            status: 'pending',
            ...salaryData
        };
        setSalaries(prev => [newSalary, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        toast({ title: "Fiche de paie générée (Simulation)", description: "La fiche de paie a été enregistrée localement." });
        setIsFormOpen(false);
    }
    
    const handleUpdateStatus = async (salary: TeacherSalary, status: 'paid') => {
        const updatedSalaryData = { status, paidAt: new Date().toISOString() };
        setSalaries(prev => prev.map(s => s.id === salary.id ? { ...s, ...updatedSalaryData } : s));
        toast({ title: "Statut mis à jour (Simulation)", description: `Le salaire a été marqué comme payé.` });
    }

    const handleDelete = (salary: TeacherSalary) => {
        setSelectedSalary(salary);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if(selectedSalary) {
            setSalaries(prev => prev.filter(s => s.id !== selectedSalary.id));
            toast({ title: "Fiche de paie supprimée (Simulation)" });
            setIsDeleteOpen(false);
            setSelectedSalary(null);
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
                                    <TableCell>{salary.hoursWorked.toFixed(2)}h</TableCell>
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

    
