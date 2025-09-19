

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
import { Payment, User } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Trash2, Download, Check, X, ArrowLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import PaymentFormDialog from '@/components/payment-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import jsPDF from "jspdf";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function TuitionManagementContent() {
    const { users, loading: usersLoading, settings } = useUser();
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
        setLoadingPayments(true);
        const q = query(collection(db, "payments"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment))
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setPayments(allPayments);
            setLoadingPayments(false);
        });

        return () => unsubscribe();
    }, []);
    
    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const getStudentName = (studentId: string) => {
        const student = students.find(s => s.uid === studentId);
        return student ? `${student.firstName} ${student.lastName}` : 'Inconnu';
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
            batch.update(paymentRef, { status });

            if (status === 'validated') {
                const transactionRef = doc(collection(db, 'cashTransactions'));
                batch.set(transactionRef, {
                    type: 'income',
                    category: 'tuition',
                    amount: payment.amountPaid,
                    currency: payment.currency,
                    description: `Scolarité ${payment.month} - ${getStudentName(payment.studentId)}`,
                    date: new Date().toISOString(),
                    createdBy: 'system', // or current admin ID
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

    const handleGenerateReceipt = (payment: Payment) => {
        const student = students.find(s => s.uid === payment.studentId);
        if (!student) return;

        const doc = new jsPDF();
        const schoolName = settings?.schoolName || "Institut Supérieur";
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(schoolName, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
        
        doc.setFontSize(20);
        doc.text("REÇU DE PAIEMENT", doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${format(new Date(payment.createdAt), 'd MMMM yyyy', { locale: fr })}`, 20, 60);
        doc.text(`Reçu N°: ${payment.id}`, 20, 70);

        doc.text(`Reçu de: ${student.firstName} ${student.lastName}`, 20, 90);
        doc.text(`Matricule: ${student.student?.matricule}`, 20, 100);

        doc.autoTable({
            startY: 110,
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
        toast({ title: "Reçu généré", description: `Le reçu pour ${student.firstName} ${student.lastName} a été téléchargé.` });
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


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion de la Scolarité</h1>
                        <p className="text-muted-foreground">
                            Suivez et gérez les paiements des frais de scolarité.
                        </p>
                    </div>
                </div>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Enregistrer un paiement
                </Button>
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
                                {students.map(s => <SelectItem key={s.uid} value={s.uid}>{s.firstName} {s.lastName}</SelectItem>)}
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
                                        Chargement...
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
    )
}
    
