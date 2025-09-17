

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
import { Payment } from "@/lib/types";
import { MoreHorizontal, PlusCircle, Trash2, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import PaymentFormDialog from '@/components/payment-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { mockPayments } from '@/lib/mock-data';
import jsPDF from "jspdf";

export default function TuitionManagementPage() {
    const { users, loading: usersLoading, settings } = useUser();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setLoadingPayments(true);
        setPayments(mockPayments.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoadingPayments(false);
    }, []);
    
    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const getStudentName = (studentId: string) => {
        const student = students.find(s => s.uid === studentId);
        return student ? `${student.firstName} ${student.lastName}` : 'Inconnu';
    }

    const handleAdd = () => {
        setSelectedPayment(null);
        setIsFormOpen(true);
    }

    const handleSave = async (paymentData: Omit<Payment, 'id' | 'createdAt' | 'status' | 'balance'>) => {
        const newPayment: Payment = {
            id: `pay_${Date.now()}`,
            createdAt: new Date().toISOString(),
            status: 'pending',
            balance: paymentData.amountExpected - paymentData.amountPaid,
            ...paymentData
        };
        setPayments(prev => [newPayment, ...prev].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        toast({ title: "Paiement enregistré (Simulation)", description: "Le paiement a été enregistré localement." });
        setIsFormOpen(false);
    }
    
    const handleUpdateStatus = async (payment: Payment, status: 'validated' | 'rejected') => {
        setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, status } : p));
        toast({ title: "Statut mis à jour (Simulation)", description: `Le paiement a été marqué comme ${status === 'validated' ? 'validé' : 'rejeté'}.` });
    }

    const handleDelete = (payment: Payment) => {
        setSelectedPayment(payment);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if(selectedPayment) {
            setPayments(prev => prev.filter(p => p.id !== selectedPayment.id));
            toast({ title: "Paiement supprimé (Simulation)" });
            setIsDeleteOpen(false);
            setSelectedPayment(null);
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

        const amountPaidText = `Montant payé: ${payment.amountPaid.toLocaleString()} ${payment.currency}`;
        const balanceText = `Solde restant pour ce paiement: ${payment.balance.toLocaleString()} ${payment.currency}`;

        doc.text(`Motif du paiement: ${payment.month} (${payment.year})`, 20, 120);
        doc.autoTable({
            startY: 125,
            head: [['Description', 'Montant']],
            body: [
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

    const loading = usersLoading || loadingPayments;


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion de la Scolarité</h1>
                    <p className="text-muted-foreground">
                        Suivez et gérez les paiements des frais de scolarité.
                    </p>
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
                        Liste de tous les paiements enregistrés dans le système.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                            ) : payments.length > 0 ? payments.map(payment => (
                                <TableRow key={payment.id}>
                                    <TableCell className="font-medium">{getStudentName(payment.studentId)}</TableCell>
                                    <TableCell>{payment.amountPaid.toLocaleString()} {payment.currency}</TableCell>
                                    <TableCell>{payment.month}</TableCell>
                                    <TableCell>{format(new Date(payment.createdAt), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[payment.status]}>{statusTranslation[payment.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               {payment.status === 'pending' && (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(payment, 'validated')}>Valider</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleUpdateStatus(payment, 'rejected')}>Rejeter</DropdownMenuItem>
                                                </>
                                               )}
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
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Aucun paiement trouvé.
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
            />

            {selectedPayment && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    user={{uid: selectedPayment.id, firstName: `Paiement pour ${getStudentName(selectedPayment.studentId)}`, lastName: ''}}
                />
            )}
        </div>
    );
}

    