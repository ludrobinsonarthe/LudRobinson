

"use client";

import { useState, useMemo, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { TeacherSalary, Attendance, Course, UnifiedSalary, User, ActivityLog } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Trash2, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, getMonth, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, query, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import SalaryFormDialog from '@/components/salary-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

function SalaryManagementContent() {
    const { allUsers: users, loading: usersLoading, settings, user } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const userIdFilter = searchParams.get('userId');

    const [teacherSalaries, setTeacherSalaries] = useState<TeacherSalary[]>([]);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedSalary, setSelectedSalary] = useState<UnifiedSalary | null>(null);
    const [userFilter, setUserFilter] = useState(userIdFilter || 'all');
    const { toast } = useToast();

    useEffect(() => {
        if (user?.role !== 'admin') {
            setLoadingData(false);
            return;
        }

        setLoadingData(true);
        const unsubSalaries = onSnapshot(query(collection(db, 'teacherSalaries')), snapshot => {
            setTeacherSalaries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherSalary)));
        });
        const unsubAttendances = onSnapshot(collection(db, 'attendances'), snapshot => {
            setAttendances(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Attendance)));
        });
        const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => {
            setCourses(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Course)));
        });
        
        const timer = setTimeout(() => setLoadingData(false), 300);

        return () => {
            unsubSalaries();
            unsubAttendances();
            unsubCourses();
            clearTimeout(timer);
        };
    }, [user]);

    const teachersAndAdmins = useMemo(() => {
      const all = users.filter(u => u.role === 'teacher' || u.role === 'admin');
      return all.filter((user, index, self) => 
        index === self.findIndex(u => u.uid === user.uid)
      );
    }, [users]);

    const usersById = useMemo(() => teachersAndAdmins.reduce((acc, user) => ({ ...acc, [user.uid]: user }), {} as Record<string, User>), [teachersAndAdmins]);
    
    const getUserName = (userId: string) => {
        const user = usersById[userId];
        return user ? `${user.lastName} ${user.firstName}` : 'Inconnu';
    }

    const unifiedSalaries = useMemo((): UnifiedSalary[] => {
        const allSalaries: UnifiedSalary[] = [];
        
        teacherSalaries.forEach(ts => {
            const user = usersById[ts.teacherId];
            if (user) {
                allSalaries.push({
                    ...ts,
                    id: ts.id,
                    userId: ts.teacherId,
                    userName: getUserName(ts.teacherId),
                    userRole: 'teacher',
                });
            }
        });

        const currentMonthStr = format(new Date(), 'MMMM', { locale: fr });
        const currentYearStr = format(new Date(), 'yyyy');
        
        users.filter(u => u.role === 'admin' && u.admin?.baseSalary).forEach(admin => {
             const salaryAlreadyExists = allSalaries.some(s => 
                s.userId === admin.uid &&
                s.month.toLowerCase() === currentMonthStr.toLowerCase() &&
                s.year === currentYearStr
             );

             if (!salaryAlreadyExists) {
                 allSalaries.push({
                    id: `admin-${admin.uid}-${currentYearStr}-${currentMonthStr}`,
                    userId: admin.uid,
                    userName: `${admin.lastName} ${admin.firstName}`,
                    userRole: 'admin',
                    month: currentMonthStr,
                    year: currentYearStr,
                    totalSalary: admin.admin!.baseSalary!,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    currency: 'XAF',
                    baseSalary: admin.admin!.baseSalary!,
                });
             }
        });

        return allSalaries.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    }, [teacherSalaries, users, usersById]);

    const filteredSalaries = useMemo(() => {
        if (userFilter === 'all') return unifiedSalaries;
        return unifiedSalaries.filter(s => s.userId === userFilter);
    }, [unifiedSalaries, userFilter]);

    const handleAdd = () => {
        setSelectedSalary(null);
        setIsFormOpen(true);
    }
    
    const calculateHours = useCallback((teacherId: string, month: number, year: number): number => {
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
                const scheduleEntry = course.schedule.find(s => s.day === format(new Date(att.date), 'EEEE', { locale: fr }));
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
    }, [attendances, courses]);


    const handleSave = async (salaryData: Omit<TeacherSalary, 'id' | 'createdAt' | 'status'>) => {
        const newSalary: Omit<TeacherSalary, 'id'> = {
            createdAt: new Date().toISOString(),
            status: 'pending',
            ...salaryData
        };
        try {
            await addDoc(collection(db, 'teacherSalaries'), newSalary);
            toast({ title: "Fiche de paie générée", description: "La fiche de paie a été enregistrée." });
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving salary:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de générer la fiche de paie." });
        }
    }
    
    const handleUpdateStatus = async (salary: UnifiedSalary, status: 'paid') => {
        if (!user) return;
    
        const isTeacher = salary.userRole === 'teacher';
        const batch = writeBatch(db);
    
        try {
            // Update or Create Salary Document
            if (isTeacher && salary.id) {
                const salaryRef = doc(db, 'teacherSalaries', salary.id);
                batch.update(salaryRef, { status, paidAt: new Date().toISOString(), paidBy: user.uid });
            } else if (!isTeacher) {
                // For admins, create a persistent salary record when paid
                const adminSalaryRecord: Omit<TeacherSalary, 'id'> = {
                    teacherId: salary.userId,
                    month: salary.month,
                    year: salary.year,
                    hourlyRate: 0, 
                    hoursWorked: 0,
                    totalSalary: salary.totalSalary,
                    status: 'paid',
                    paidAt: new Date().toISOString(),
                    paidBy: user.uid,
                    createdAt: salary.createdAt,
                    currency: salary.currency,
                };
                const newSalaryRef = doc(collection(db, 'teacherSalaries'));
                batch.set(newSalaryRef, adminSalaryRecord);
                salary.id = newSalaryRef.id; // Update ID for cash transaction link
            }
    
            // Create Cash Transaction for both
            const transactionRef = doc(collection(db, 'cashTransactions'));
            batch.set(transactionRef, {
                type: 'expense',
                category: 'salary',
                amount: salary.totalSalary,
                currency: salary.currency,
                description: `Paie ${salary.month} - ${getUserName(salary.userId)}`,
                date: new Date().toISOString(),
                createdBy: user.uid,
                relatedDocId: salary.id,
            });
    
            await batch.commit();
            toast({ title: "Statut mis à jour", description: `Le salaire a été marqué comme payé.` });
        } catch (error) {
            console.error("Error updating salary status: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    }

    const handleDelete = (salary: UnifiedSalary) => {
        if (salary.status === 'paid') {
            toast({ variant: "destructive", title: "Action impossible", description: "Vous ne pouvez pas supprimer un salaire déjà payé." });
            return;
        }
        setSelectedSalary(salary);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if(selectedSalary) {
             try {
                // Only teacher salaries are actual documents to be deleted
                if (selectedSalary.userRole === 'teacher') {
                    await deleteDoc(doc(db, 'teacherSalaries', selectedSalary.id));
                }
                toast({ title: "Fiche de paie supprimée" });
            } catch (error) {
                console.error("Error deleting salary record: ", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la fiche de paie." });
            } finally {
                setIsDeleteOpen(false);
                setSelectedSalary(null);
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

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }
    
    const loading = usersLoading || loadingData;

    if (user?.role !== 'admin') {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-destructive">Accès Refusé</CardTitle>
                    <CardDescription>
                        Vous n'avez pas les permissions nécessaires pour accéder à cette page.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start flex-wrap gap-4">
                 <div className="flex items-center gap-4">
                     {userIdFilter && (
                        <Button variant="outline" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Salaires</h1>
                        <p className="text-muted-foreground">
                            Générez, suivez et gérez la paie des professeurs et du personnel.
                        </p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Générer une fiche de paie
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <CardTitle>Historique des fiches de paie</CardTitle>
                            <CardDescription>Liste de toutes les fiches de paie générées et leur statut.</CardDescription>
                        </div>
                        <Select value={userFilter} onValueChange={setUserFilter}>
                            <SelectTrigger className="w-full sm:w-[280px]">
                                <SelectValue placeholder="Filtrer par employé..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les employés</SelectItem>
                                {teachersAndAdmins.map(u => <SelectItem key={u.uid} value={u.uid}>{`${u.lastName} ${u.firstName}`}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Employé</TableHead>
                                <TableHead className="hidden sm:table-cell">Rôle</TableHead>
                                <TableHead>Mois/Année</TableHead>
                                <TableHead>Salaire Total</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_,i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24"/></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                                        <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto"/></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredSalaries.length > 0 ? filteredSalaries.map(salary => (
                                <TableRow key={salary.id}>
                                    <TableCell className="font-medium">{salary.userName}</TableCell>
                                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">{salary.userRole === 'teacher' ? 'Professeur' : 'Admin'}</Badge></TableCell>
                                    <TableCell>{salary.month} {salary.year}</TableCell>
                                    <TableCell className='font-semibold'>{formatCurrency(salary.totalSalary, salary.currency)}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[salary.status]}>{statusTranslation[salary.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {salary.status === 'pending' && (
                                                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(salary, 'paid')}>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    Marquer Payé
                                                </Button>
                                            )}
                                            <DropdownMenu>
                                               <DropdownMenuTrigger asChild>
                                                   <Button variant="ghost" size="icon">
                                                       <MoreHorizontal className="h-4 w-4" />
                                                   </Button>
                                               </DropdownMenuTrigger>
                                               <DropdownMenuContent align="end">
                                                   <DropdownMenuItem onClick={() => handleDelete(salary)} className="text-destructive" disabled={salary.status === 'paid'}>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Supprimer
                                                   </DropdownMenuItem>
                                               </DropdownMenuContent>
                                           </DropdownMenu>
                                        </div>
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
                teachers={teachersAndAdmins.filter(u => u.role === 'teacher')}
                initialTeacherId={userIdFilter}
                calculateHours={calculateHours}
            />

            {selectedSalary && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    item={{id: selectedSalary.id, name: `Fiche de paie pour ${selectedSalary.userName}`}}
                    title="Supprimer cette fiche de paie ?"
                />
            )}
        </div>
    );
}

export default function SalaryManagementPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <SalaryManagementContent />
        </Suspense>
    );
}
