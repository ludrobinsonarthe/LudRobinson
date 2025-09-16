
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
import { CashTransaction } from "@/lib/types";
import { MoreHorizontal, PlusCircle, ArrowUpCircle, ArrowDownCircle, Banknote, DollarSign, Scale } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import CashTransactionFormDialog from '@/components/cash-transaction-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { mockCashTransactions } from '@/lib/mock-data';

export default function CashFlowPage() {
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<CashTransaction | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        setTransactions(mockCashTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setLoading(false);
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
        if(selectedTransaction) {
            setTransactions(prev => prev.filter(t => t.id !== selectedTransaction.id));
            toast({ title: "Transaction supprimée (Simulation)", description: "L'opération a été supprimée localement." });
            setIsDeleteOpen(false);
            setSelectedTransaction(null);
        }
    }
    
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
    const categoryTranslation: { [key: string]: string } = {
        tuition: "Scolarité",
        salary: "Salaire",
        equipment: "Matériel",
        utilities: "Services",
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
                 <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter une transaction
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Solde Actuel</CardTitle>
                        <Scale className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
                        <p className="text-xs text-muted-foreground">Balance des entrées et sorties</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total des Entrées</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
                        <p className="text-xs text-muted-foreground">Total des fonds reçus</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total des Sorties</CardTitle>
                        <ArrowDownCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalExpense)}</div>
                        <p className="text-xs text-muted-foreground">Total des dépenses effectuées</p>
                    </CardContent>
                </Card>
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
                            ) : transactions.length > 0 ? transactions.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell>{format(new Date(t.date), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                    <TableCell><Badge variant={typeVariant[t.type]}>{typeTranslation[t.type]}</Badge></TableCell>
                                    <TableCell><Badge variant="outline">{categoryTranslation[t.category]}</Badge></TableCell>
                                    <TableCell className="font-medium">{t.description}</TableCell>
                                    <TableCell className={`text-right font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
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
                                               <DropdownMenuItem onClick={() => handleDelete(t)} className="text-destructive">
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
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
                onAdd={(newTransaction) => setTransactions(prev => [newTransaction, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()))}
            />

            {selectedTransaction && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    user={{uid: selectedTransaction.id, firstName: "Cette transaction", lastName: ''}}
                />
            )}
        </div>
    );
}

    
