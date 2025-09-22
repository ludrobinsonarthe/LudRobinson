
"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { TeacherSalary, Attendance, Course, UnifiedSalary, User } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Trash2, CheckCircle, Download, ArrowLeft, FileDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, getMonth, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, query, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import SalaryFormDialog from '@/components/salary-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { imageToDataUrl } from '@/lib/utils';

function SalaryManagementContent() {
    const { users, loading: usersLoading, settings } = useUser();
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
        
        setLoadingData(false);

        return () => {
            unsubSalaries();
            unsubAttendances();
            unsubCourses();
        };
    }, []);

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
        
        // Process teacher salaries
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
        
        // Process admin salaries from user data
        const currentMonth = getMonth(new Date());
        const currentYear = getYear(new Date());
        
        users.filter(u => u.role === 'admin' && u.admin?.baseSalary).forEach(admin => {
             allSalaries.push({
                id: `admin-${admin.uid}-${currentYear}-${currentMonth}`,
                userId: admin.uid,
                userName: `${admin.lastName} ${admin.firstName}`,
                userRole: 'admin',
                month: format(new Date(), 'MMMM', { locale: fr }),
                year: `${currentYear}`,
                totalSalary: admin.admin!.baseSalary!,
                status: 'pending', // Admin salaries are not marked as paid via this flow yet
                createdAt: new Date().toISOString(),
                currency: 'XAF',
                baseSalary: admin.admin!.baseSalary!,
            });
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
    }


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
        if (salary.userRole === 'admin') {
            toast({ variant: "destructive", title: "Action non supportée", description: "Le paiement des salaires du personnel admin n'est pas encore implémenté." });
            return;
        }

        const salaryRef = doc(db, 'teacherSalaries', salary.id);
        const user = users.find(u => u.role === 'admin');
        const updatedSalaryData = { status, paidAt: new Date().toISOString(), paidBy: user?.uid };
        
        try {
            const batch = writeBatch(db);
            batch.update(salaryRef, updatedSalaryData);

            const transactionRef = doc(collection(db, 'cashTransactions'));
            batch.set(transactionRef, {
                type: 'expense',
                category: 'salary',
                amount: salary.totalSalary,
                currency: salary.currency,
                description: `Paie ${salary.month} - ${getUserName(salary.userId)}`,
                date: new Date().toISOString(),
                createdBy: user?.uid || 'system',
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
        if (salary.userRole === 'admin') {
             toast({ variant: "destructive", title: "Action non supportée", description: "La suppression des salaires du personnel admin n'est pas implémentée." });
            return;
        }
        setSelectedSalary(salary);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if(selectedSalary) {
             try {
                await deleteDoc(doc(db, 'teacherSalaries', selectedSalary.id));
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
    
    const handleGeneratePayslip = async (salary: UnifiedSalary) => {
        const user = usersById[salary.userId];
        if (!user || !settings) {
            toast({ variant: 'destructive', title: 'Utilisateur ou paramètres introuvables' });
            return;
        }

        const doc = new jsPDF();
        
        const logoDataUrl = await imageToDataUrl(settings.logoUrl);
        if (logoDataUrl) {
            const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
            doc.addImage(logoDataUrl, logoExtension, doc.internal.pageSize.getWidth() / 2 - 10, 10, 20, 20);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(settings.schoolName, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
        
        doc.setFontSize(20);
        doc.text("BULLETIN DE PAIE", doc.internal.pageSize.getWidth() / 2, 55, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Période: ${salary.month} ${salary.year}`, doc.internal.pageSize.getWidth() - 20, 70, { align: 'right' });
        doc.text(`Date d'émission: ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`, 20, 70);

        doc.text(`Employé: ${user.lastName} ${user.firstName}`, 20, 90);
        doc.text(`Poste: ${user.role === 'teacher' ? 'Professeur' : user.admin?.position || 'Personnel'}`, 20, 100);

        const body: (string | number)[][] = [];
        if (salary.userRole === 'teacher' && salary.hourlyRate && salary.hoursWorked) {
            body.push(['Taux horaire', formatCurrency(salary.hourlyRate, salary.currency)]);
            body.push(['Heures travaillées', `${salary.hoursWorked.toFixed(2)}h`]);
            body.push(['Salaire brut (Taux * Heures)', formatCurrency(salary.totalSalary, salary.currency)]);
        } else if (salary.userRole === 'admin' && salary.baseSalary) {
            body.push(['Salaire de base mensuel', formatCurrency(salary.baseSalary, salary.currency)]);
        }
        body.push(['', '']); // spacer
        body.push(['Impôts & Cotisations (Exemple)', formatCurrency(0, salary.currency)]);
        body.push(['Primes & Bonus (Exemple)', formatCurrency(0, salary.currency)]);

        autoTable(doc, {
            startY: 110,
            head: [['Description', 'Montant']],
            body: body,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            didDrawPage: function(data) {
                // Total
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Salaire Net à Payer', data.settings.margin.left, data.cursor.y + 15);
                doc.text(formatCurrency(salary.totalSalary, salary.currency), data.settings.margin.left + 100, data.cursor.y + 15);
            }
        });
        
        doc.save(`bulletin_paie_${user.lastName}_${salary.month}_${salary.year}.pdf`);
        toast({ title: 'Bulletin de paie généré' });
    }

    const handleExportPDF = async () => {
        if (!settings) return;
        const doc = new jsPDF();
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if(logoDataUrl) {
                const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
                doc.addImage(logoDataUrl, logoExtension, 14, 10, 20, 20);
            }
        } catch (error) {
            console.error("Could not add logo to PDF, proceeding without it.", error);
        }
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Historique des Salaires - ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`, 14, 30);

        const tableColumn = ["Employé", "Rôle", "Mois/Année", "Salaire Total", "Statut"];
        const tableRows: string[][] = [];

        filteredSalaries.forEach(s => {
            const salaryData = [
                s.userName,
                s.userRole === 'teacher' ? 'Professeur' : 'Admin',
                `${s.month} ${s.year}`,
                formatCurrency(s.totalSalary, s.currency),
                statusTranslation[s.status],
            ];
            tableRows.push(salaryData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
        });

        doc.save(`historique_salaires_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Téléchargement réussi', description: 'Le fichier PDF de l\'historique des salaires a été généré.' });
    };

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
                    <Button variant="outline" onClick={handleExportPDF}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Exporter
                    </Button>
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Générer une fiche de paie
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Historique des fiches de paie</CardTitle>
                            <CardDescription>Liste de toutes les fiches de paie générées et leur statut.</CardDescription>
                        </div>
                        <Select value={userFilter} onValueChange={setUserFilter}>
                            <SelectTrigger className="w-[280px]">
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
                                <TableHead>Employé</TableHead>
                                <TableHead>Rôle</TableHead>
                                <TableHead>Mois/Année</TableHead>
                                <TableHead>Salaire Total</TableHead>
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
                            ) : filteredSalaries.length > 0 ? filteredSalaries.map(salary => (
                                <TableRow key={salary.id}>
                                    <TableCell className="font-medium">{salary.userName}</TableCell>
                                    <TableCell><Badge variant="outline">{salary.userRole === 'teacher' ? 'Professeur' : 'Admin'}</Badge></TableCell>
                                    <TableCell>{salary.month} {salary.year}</TableCell>
                                    <TableCell className='font-semibold'>{formatCurrency(salary.totalSalary, salary.currency)}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[salary.status]}>{statusTranslation[salary.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {salary.status === 'pending' && salary.userRole === 'teacher' && (
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
                                                   <DropdownMenuItem onClick={() => handleGeneratePayslip(salary)}>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Télécharger le bulletin
                                                    </DropdownMenuItem>
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
        <Suspense fallback={<div>Chargement...</div>}>
            <SalaryManagementContent />
        </Suspense>
    );
}

    

    

    
