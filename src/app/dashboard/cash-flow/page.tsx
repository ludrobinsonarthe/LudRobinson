

"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { CashTransaction, Payment, TeacherSalary, ActivityLog } from "@/lib/types";
import { MoreHorizontal, PlusCircle, ArrowUpCircle, ArrowDownCircle, Scale, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, doc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import CashTransactionFormDialog from '@/components/cash-transaction-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { useUser } from '@/hooks/use-user';
import { cn } from '@/lib/utils';
import Link from 'next/link';


export default function CashFlowPage() {
    const { settings, user: adminUser } = useUser();
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [teacherSalaries, setTeacherSalaries] = useState<TeacherSalary[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<CashTransaction | null>(null);
    const { toast } = useToast();
    const router = useRouter();


    useEffect(() => {
        setLoading(true);
        const unsubTransactions = onSnapshot(collection(db, 'cashTransactions'), snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashTransaction));
            setTransactions(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setLoading(false);
        });

        const unsubPayments = onSnapshot(collection(db, 'payments'), snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
            setPayments(data);
        });

        const unsubSalaries = onSnapshot(collection(db, 'teacherSalaries'), snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherSalary));
            setTeacherSalaries(data);
        });

        return () => {
            unsubTransactions();
            unsubPayments();
            unsubSalaries();
        };
    }, []);

    const { totalIncome, totalExpense, balance } = useMemo(() => {
        let income = 0;
        let expense = 0;
        transactions.forEach(t => {
            if (t.type === 'income') {
                income += t.amount;
            } else {
                expense += t.amount;
            }
        });
        return { totalIncome: income, totalExpense: expense, balance: income - expense };
    }, [transactions]);
    
    const handleAdd = () => {
        setSelectedTransaction(null);
        setIsFormOpen(true);
    }
    
    const handleDelete = (transaction: CashTransaction) => {
        setSelectedTransaction(transaction);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedTransaction || !adminUser) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Transaction ou utilisateur non trouvé.' });
            return;
        }

        const batch = writeBatch(db);
        
        // 1. Reference to the document to delete
        const transactionRef = doc(db, 'cashTransactions', selectedTransaction.id);
        
        // 2. Reference for the new activity log document
        const logRef = doc(collection(db, 'activityLogs'));
        const log: Omit<ActivityLog, 'id'> = {
            actorId: adminUser.uid,
            actorName: `${adminUser.lastName} ${adminUser.firstName}`,
            action: 'transaction_deleted',
            entityType: 'cashTransaction',
            entityId: selectedTransaction.id,
            timestamp: new Date().toISOString(),
            details: `A supprimé la transaction manuelle : "${selectedTransaction.description}" de ${formatCurrency(selectedTransaction.amount, selectedTransaction.currency)}`,
        };

        // 3. Add operations to the batch
        batch.delete(transactionRef); // This will delete the document from Firestore
        batch.set(logRef, log); // This will create a new document in activityLogs
        
        try {
            // 4. Commit the batch: both operations succeed or both fail
            await batch.commit();

            // 5. Update UI immediately for a responsive feel
            setTransactions(prev => prev.filter(t => t.id !== selectedTransaction.id));
            
            toast({ title: "Transaction supprimée", description: "L'opération a été retirée de la caisse et archivée dans l'historique." });

        } catch (error) {
            console.error("Error deleting transaction: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la transaction." });
        } finally {
            setIsDeleteOpen(false);
            setSelectedTransaction(null);
        }
    }

    const getTransactionLink = (transaction: CashTransaction): string | null => {
        if (!transaction.relatedDocId) return null;
        
        if (transaction.category === 'tuition') {
             const studentId = payments.find(p => p.id === transaction.relatedDocId)?.studentId;
             if(studentId) return `/dashboard/tuition-management?studentId=${studentId}`;
        }
        if (transaction.category === 'salary') {
            const userId = teacherSalaries.find(s => s.id === transaction.relatedDocId)?.userId;
            if(userId) return `/dashboard/salary-management?userId=${userId}`;
        }
        return null;
      };
      
    const formatCurrency = (amount: number, currency: string = 'XAF') => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }

    const typeVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
        income: "default",
        expense: "destructive",
    }
    const typeTranslation: { [key: string]: string } = {
        income: "Entrée",
        expense: "Sortie",
    }
    const categoryTranslation: { [key in CashTransaction['category']]: string } = {
        tuition: "Scolarité",
        salary: "Salaire",
        equipment: "Matériel",
        utilities: "Services",
        session: "Frais de session",
        soutenance: "Frais de soutenance",
        other: "Autre",
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Suivi de Caisse</h1>
                    <p className="text-muted-foreground">
                        Gérez les entrées, les sorties et les dépenses de la caisse.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Ajouter une transaction
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Link href="/dashboard/cash-flow">
                    <Card className="hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Solde Actuel</CardTitle>
                            <Scale className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
                            <p className="text-xs text-muted-foreground">Balance des entrées et sorties</p>
                        </CardContent>
                    </Card>
                </Link>
                 <Link href="/dashboard/cash-flow">
                    <Card className="hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total des Entrées</CardTitle>
                            <ArrowUpCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
                            <p className="text-xs text-muted-foreground">Total des fonds reçus</p>
                        </CardContent>
                    </Card>
                </Link>
                 <Link href="/dashboard/cash-flow">
                    <Card className="hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total des Sorties</CardTitle>
                            <ArrowDownCircle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(totalExpense)}</div>
                            <p className="text-xs text-muted-foreground">Total des dépenses effectuées</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historique des transactions</CardTitle>
                    <CardDescription>
                        Liste de toutes les opérations de caisse.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Catégorie</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                                <TableHead className="w-[50px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : transactions.length > 0 ? transactions.map(t => {
                                const link = getTransactionLink(t);
                                return (
                                <TableRow key={t.id}>
                                    <TableCell>{format(new Date(t.date), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                    <TableCell><Badge variant={typeVariant[t.type]}>{typeTranslation[t.type]}</Badge></TableCell>
                                    <TableCell><Badge variant="outline">{categoryTranslation[t.category]}</Badge></TableCell>
                                    <TableCell className='font-medium'>
                                        {link ? (
                                            <Link href={link} className="hover:underline text-primary">{t.description}</Link>
                                        ) : (
                                            t.description
                                        )}
                                    </TableCell>
                                    <TableCell className={cn(`text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`)}>
                                        {t.type === 'expense' && '- '}{formatCurrency(t.amount, t.currency)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon" disabled={!!t.relatedDocId}>
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem onClick={() => handleDelete(t)} className="text-destructive" disabled={!!t.relatedDocId}>
                                                    <Trash2 className="mr-2 h-4 w-4"/>
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )}) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Aucune transaction trouvée.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            <CashTransactionFormDialog
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
            />

            {selectedTransaction && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    item={{id: selectedTransaction.id, name: "Cette transaction"}}
                    title="Supprimer cette transaction ?"
                    description="Cette action est irréversible et supprimera définitivement la transaction."
                />
            )}
        </div>
    );
}
