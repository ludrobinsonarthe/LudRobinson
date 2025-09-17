
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { useUser } from "@/hooks/use-user";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Payment, User } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
const methodTranslation: { [key: string]: string } = {
    cash: "Espèces",
    mobile_money: "Mobile Money",
    card: "Carte bancaire",
}

export default function PaymentsPage() {
    const { user: currentUser, users } = useUser();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

    const children = useMemo(() => {
        if (currentUser?.role !== 'parent') return [];
        return users.filter(u => currentUser.parent?.childrenUids.includes(u.uid));
    }, [currentUser, users]);

    const studentToView = useMemo(() => {
        if (currentUser?.role === 'student') return currentUser;
        if (currentUser?.role === 'parent') return users.find(u => u.uid === selectedChildId);
        return null;
    }, [currentUser, users, selectedChildId]);
    
     useEffect(() => {
        if (currentUser?.role === 'parent' && children.length > 0 && !selectedChildId) {
            setSelectedChildId(children[0].uid);
        }
    }, [currentUser, children, selectedChildId]);

    useEffect(() => {
        setLoading(true);
        if (!studentToView || !studentToView.uid) {
            setPayments([]);
            setLoading(false);
            return;
        }

        const q = query(collection(db, "payments"), where("studentId", "==", studentToView.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userPayments = snapshot.docs.map(doc => doc.data() as Payment)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setPayments(userPayments);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [studentToView]);

     const { totalExpected, totalPaid, totalBalance } = useMemo(() => {
        const totalExpected = payments.reduce((acc, p) => acc + p.amountExpected, 0);
        const totalPaid = payments.filter(p => p.status === 'validated').reduce((acc, p) => acc + p.amountPaid, 0);
        return {
            totalExpected: totalExpected,
            totalPaid: totalPaid,
            totalBalance: totalExpected - totalPaid,
        };
    }, [payments]);

    const handleChildChange = (studentId: string) => {
        setSelectedChildId(studentId);
    }
    
    const formatCurrency = (amount: number, currency: string = 'XAF') => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Scolarité et Paiements</h1>
                <p className="text-muted-foreground">
                    Suivez l'état de vos paiements de frais de scolarité.
                </p>
            </div>
             {currentUser?.role === 'parent' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sélection de l'enfant</CardTitle>
                        <CardDescription>
                            Choisissez l'enfant dont vous souhaitez consulter les paiements.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       {children.length > 0 ? (
                            <Select onValueChange={handleChildChange} value={selectedChildId || ""}>
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue placeholder="Sélectionner un enfant..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {children.map(child => (
                                        <SelectItem key={child.uid} value={child.uid}>
                                            {child.firstName} {child.lastName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                       ) : (
                           <p className="text-sm text-muted-foreground">Aucun enfant n'est associé à votre compte.</p>
                       )}
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <CardTitle>Historique des paiements</CardTitle>
                    <CardDescription>
                        Liste de tous les paiements effectués et soldes restants.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                         <div className="flex items-center justify-center h-48">
                            <p>Chargement des paiements...</p>
                        </div>
                    ) : payments.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Motif</TableHead>
                                    <TableHead>Montant Payé</TableHead>
                                    <TableHead>Méthode</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payments.map(payment => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{format(new Date(payment.createdAt), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                        <TableCell className='font-medium'>{payment.month} {payment.year}</TableCell>
                                        <TableCell className='font-semibold'>{formatCurrency(payment.amountPaid, payment.currency)}</TableCell>
                                        <TableCell><Badge variant='outline'>{methodTranslation[payment.method]}</Badge></TableCell>
                                        <TableCell><Badge variant={statusVariant[payment.status]}>{statusTranslation[payment.status]}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" disabled={payment.status !== 'validated'}>
                                                <Download className="mr-2 h-4 w-4" />
                                                Reçu
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">Aucun paiement trouvé</h3>
                            <p className="mb-4 mt-2 text-sm text-muted-foreground">
                                {currentUser?.role === 'parent' ? "Veuillez d'abord sélectionner un enfant." : "L'historique de vos paiements apparaîtra ici."}
                            </p>
                        </div>
                    )}
                </CardContent>
                 {payments.length > 0 && (
                     <CardFooter className="flex justify-end">
                        <div className='text-right space-y-2'>
                            <div >
                                <p className='text-sm text-muted-foreground'>Total Payé (Validé)</p>
                                <p className='font-semibold text-lg'>{formatCurrency(totalPaid, 'XAF')}</p>
                            </div>
                             <div>
                                <p className='text-sm text-muted-foreground'>Solde Restant</p>
                                <p className={`font-bold text-2xl ${totalBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>{formatCurrency(totalBalance, 'XAF')}</p>
                            </div>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
