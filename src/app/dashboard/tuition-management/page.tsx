

"use client";

import { useState, useMemo, useEffect, Suspense } from 'react';
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
import { Payment, User, ActivityLog } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Trash2, Download, Check, X, ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import PaymentFormDialog from '@/components/payment-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { imageToDataUrl } from '@/lib/utils';

function TuitionManagementContent() {
    const { allUsers, loading: usersLoading, settings, user } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const studentIdFilter = searchParams.get('studentId');

    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const { toast } = useToast();

    // Filters
    const [studentFilter, setStudentFilter] = useState(studentIdFilter || 'all');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        if (user?.role !== 'admin') {
            setLoadingPayments(false);
            return;
        };

        setLoadingPayments(true);
        const q = query(collection(db, "payments"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment))
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setPayments(allPayments);
            setLoadingPayments(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    const students = useMemo(() => allUsers.filter(u => u.role === 'student'), [allUsers]);
    const getStudentName = (studentId: string) => {
        const student = students.find(s => s.uid === studentId);
        return student ? `${student.lastName} ${student.firstName}` : 'Inconnu';
    }
    
    const filteredPayments = useMemo(() => {
        return payments.filter(p => 
            (studentFilter === 'all' || p.studentId === studentFilter) &&
            (statusFilter === 'all' || p.status === statusFilter)
        )
    }, [payments, studentFilter, statusFilter]);

    const handleAdd = () => {
        setSelectedPayment(null);
        setIsFormOpen(true);
    }

    const handleSave = async (paymentData: Omit<Payment, 'id' | 'createdAt' | 'status' | 'balance'>) => {
         const newPayment: Omit<Payment, 'id'> = {
            createdAt: new Date().toISOString(),
            status: 'pending',
            balance: paymentData.amountExpected - paymentData.amountPaid,
            ...paymentData
        };

        try {
            await addDoc(collection(db, 'payments'), newPayment);
            toast({ title: "Paiement enregistré", description: "Le paiement a été soumis pour validation." });
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving payment: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le paiement." });
        }
    }
    
    const handleUpdateStatus = async (payment: Payment, status: 'validated' | 'rejected') => {
        const paymentRef = doc(db, 'payments', payment.id);

        try {
            const batch = writeBatch(db);
            batch.update(paymentRef, { status, validatedBy: user?.uid || 'system' });

            const studentName = getStudentName(payment.studentId);
            const logMessage = `Paiement de ${payment.amountPaid} ${payment.currency} pour ${studentName} (${payment.month}) ${status === 'validated' ? 'validé' : 'rejeté'}.`;

            // Create activity log
            const logRef = doc(collection(db, 'activityLogs'));
            const newLog: Omit<ActivityLog, 'id'> = {
                actorId: user!.uid,
                actorName: `${user!.lastName} ${user!.firstName}`,
                action: status === 'validated' ? 'payment_validation' : 'payment_rejection',
                entityType: 'payment',
                entityId: payment.id,
                timestamp: new Date().toISOString(),
                details: logMessage,
            };
            batch.set(logRef, newLog);

            if (status === 'validated') {
                const transactionRef = doc(collection(db, 'cashTransactions'));
                batch.set(transactionRef, {
                    type: 'income',
                    category: 'tuition',
                    amount: payment.amountPaid,
                    currency: payment.currency,
                    description: `Scolarité ${payment.month} - ${getStudentName(payment.studentId)}`,
                    date: new Date().toISOString(),
                    createdBy: user?.uid || 'system',
                    relatedDocId: payment.id,
                });
            }

            await batch.commit();
            toast({ title: "Statut mis à jour", description: `Le paiement a été marqué comme ${status === 'validated' ? 'validé' : 'rejeté'}.` });
        } catch (error) {
            console.error("Error updating status: ", error);
            toast({ variant: 'destructive', title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    }

    const handleDelete = (payment: Payment) => {
        setSelectedPayment(payment);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if(selectedPayment) {
             try {
                await deleteDoc(doc(db, 'payments', selectedPayment.id));
                 toast({ title: "Paiement supprimé" });
            } catch(error) {
                console.error("Error deleting payment: ", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le paiement." });
            } finally {
                setIsDeleteOpen(false);
                setSelectedPayment(null);
            }
        }
    }

    const handleGenerateReceipt = async (payment: Payment) => {
        const student = students.find(s => s.uid === payment.studentId);
        if (!student || !settings) return;

        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF();
        const schoolName = settings.schoolName;
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if (logoDataUrl) {
                const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
                doc.addImage(logoDataUrl, logoExtension, doc.internal.pageSize.getWidth() / 2 - 10, 10, 20, 20);
            }
        } catch (error) {
            console.error("Error loading logo for PDF", error);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(schoolName, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
        
        doc.setFontSize(20);
        doc.text("REÇU DE PAIEMENT", doc.internal.pageSize.getWidth() / 2, 60, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${format(new Date(payment.createdAt), 'd MMMM yyyy', { locale: fr })}`, 20, 80);
        doc.text(`Reçu N°: ${payment.id}`, 20, 90);

        doc.text(`Reçu de: ${student.lastName} ${student.firstName}`, 20, 110);
        doc.text(`Matricule: ${student.student?.matricule}`, 20, 120);

        autoTable(doc, {
            startY: 130,
            head: [['Description', 'Montant']],
            body: [
                ['Motif du paiement', `${payment.month} (${payment.year})`],
                ['Montant Attendu', `${payment.amountExpected.toLocaleString()} ${payment.currency}`],
                ['Montant Versé', `${payment.amountPaid.toLocaleString()} ${payment.currency}`],
                ['Solde pour ce versement', `${payment.balance.toLocaleString()} ${payment.currency}`]
            ],
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74] }
        });
        
        doc.text("Signature de l'administration", doc.internal.pageSize.getWidth() - 20, (doc as any).lastAutoTable.finalY + 30, { align: 'right' });

        doc.save(`recu_${payment.id}.pdf`);
        toast({ title: "Reçu généré", description: `Le reçu pour ${student.lastName} ${student.firstName} a été téléchargé.` });
    };

    const handleExportPDF = async () => {
        if (!settings) return;
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
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
        doc.text(`Historique des Paiements - ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`, 14, 30);

        const tableColumn = ["Étudiant", "Montant Payé", "Motif", "Date", "Statut"];
        const tableRows: string[][] = [];

        filteredPayments.forEach(p => {
            const paymentData = [
                getStudentName(p.studentId),
                formatCurrency(p.amountPaid, p.currency),
                p.month,
                format(new Date(p.createdAt), 'd MMM yyyy', { locale: fr }),
                statusTranslation[p.status],
            ];
            tableRows.push(paymentData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
        });

        doc.save(`historique_paiements_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Téléchargement réussi', description: 'Le fichier PDF de l\'historique des paiements a été généré.' });
    };

    const statusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
        validated: "default",
        pending: "secondary",
        rejected: "destructive",
    }
    const statusTranslation: { [key: string]: string } = {
        validated: "Validé",
        pending: "En attente",
        rejected: "Rejeté",
    }
    const formatCurrency = (amount: number, currency: string = 'XAF') => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }

    const loading = usersLoading || loadingPayments;

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
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                     {studentIdFilter && (
                        <Button variant="outline" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion de la Scolarité</h1>
                        <p className="text-muted-foreground">
                            Suivez et gérez les paiements des frais de scolarité.
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
                        Enregistrer un paiement
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Historique des Paiements</CardTitle>
                    <CardDescription>
                        Filtrez et gérez tous les paiements enregistrés dans le système.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                        <Select value={studentFilter} onValueChange={setStudentFilter}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Filtrer par étudiant" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les étudiants</SelectItem>
                                {students.map(s => <SelectItem key={s.uid} value={s.uid}>{s.lastName} {s.firstName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par statut" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les statuts</SelectItem>
                                <SelectItem value="pending">En attente</SelectItem>
                                <SelectItem value="validated">Validé</SelectItem>
                                <SelectItem value="rejected">Rejeté</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Étudiant</TableHead>
                                <TableHead>Montant Payé</TableHead>
                                <TableHead>Motif / Mois</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredPayments.length > 0 ? filteredPayments.map(payment => (
                                <TableRow key={payment.id}>
                                    <TableCell className="font-medium">{getStudentName(payment.studentId)}</TableCell>
                                    <TableCell>{formatCurrency(payment.amountPaid, payment.currency)}</TableCell>
                                    <TableCell>{payment.month}</TableCell>
                                    <TableCell>{format(new Date(payment.createdAt), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[payment.status]}>{statusTranslation[payment.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                       {payment.status === 'pending' ? (
                                           <div className="flex gap-2 justify-end">
                                               <Button size="icon" variant="ghost" className="text-green-600 hover:text-green-700" onClick={() => handleUpdateStatus(payment, 'validated')}><Check className="h-4 w-4"/></Button>
                                               <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive/80" onClick={() => handleUpdateStatus(payment, 'rejected')}><X className="h-4 w-4"/></Button>
                                                <Button size="icon" variant="ghost" onClick={() => handleDelete(payment)}><Trash2 className="h-4 w-4"/></Button>
                                           </div>
                                       ) : (
                                        <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem onClick={() => handleGenerateReceipt(payment)} disabled={payment.status !== 'validated'}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Générer le reçu
                                               </DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => handleDelete(payment)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                       )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Aucun paiement trouvé pour les filtres sélectionnés.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <PaymentFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                students={students}
                initialStudentId={studentIdFilter}
            />

            {selectedPayment && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    item={{id: selectedPayment.id, name: `Paiement pour ${getStudentName(selectedPayment.studentId)}`}}
                    title="Supprimer ce paiement ?"
                />
            )}
        </div>
    );
}

export default function TuitionManagementPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <TuitionManagementContent />
        </Suspense>
    );
}

    


    