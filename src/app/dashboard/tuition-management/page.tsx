
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
import { MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import PaymentFormDialog from '@/components/payment-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';


export default function TuitionManagementPage() {
    const { users, loading: usersLoading } = useUser();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "payments"), (snapshot) => {
            const paymentsFromDb: Payment[] = [];
            snapshot.forEach((doc) => {
                paymentsFromDb.push({ id: doc.id, ...doc.data() } as Payment);
            });
            setPayments(paymentsFromDb.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setLoadingPayments(false);
        });
        return () => unsubscribe();
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
         try {
            const newPaymentId = doc(collection(db, "payments")).id;
            const newPayment: Payment = {
                id: newPaymentId,
                createdAt: new Date().toISOString(),
                status: 'pending',
                balance: paymentData.amountExpected - paymentData.amountPaid,
                ...paymentData
            };
            await setDoc(doc(db, "payments", newPaymentId), newPayment);
            toast({ title: "Paiement enregistré", description: "Le paiement a été enregistré avec succès et est en attente de validation." });
            setIsFormOpen(false);
        } catch (error) {
            console.error("Error saving payment:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le paiement." });
        }
    }
    
    const handleUpdateStatus = async (payment: Payment, status: 'validated' | 'rejected') => {
        try {
            const batch = writeBatch(db);
            const paymentRef = doc(db, "payments", payment.id);
            batch.update(paymentRef, { status });

            if(status === 'validated') {
                const transactionRef = doc(collection(db, 'cash_transactions'));
                batch.set(transactionRef, {
                    id: transactionRef.id,
                    date: new Date().toISOString(),
                    type: 'income',
                    category: 'tuition',
                    description: `Frais de scolarité - ${getStudentName(payment.studentId)} - ${payment.month} ${payment.year}`,
                    amount: payment.amountPaid,
                    currency: payment.currency,
                    createdBy: 'admin', // This should be the current admin's UID
                    relatedDocId: payment.id,
                });
            }

            await batch.commit();
            toast({ title: "Statut mis à jour", description: `Le paiement a été marqué comme ${status === 'validated' ? 'validé' : 'rejeté'}.` });
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour le statut." });
        }
    }

    const handleDelete = (payment: Payment) => {
        setSelectedPayment(payment);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if(selectedPayment) {
            try {
                await deleteDoc(doc(db, "payments", selectedPayment.id));
                toast({ title: "Paiement supprimé", description: "L'enregistrement du paiement a été supprimé." });
                setIsDeleteOpen(false);
                setSelectedPayment(null);
            } catch (error) {
                console.error("Error deleting payment: ", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le paiement." });
            }
        }
    }

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
                                               <DropdownMenuItem>Voir le reçu</DropdownMenuItem>
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
