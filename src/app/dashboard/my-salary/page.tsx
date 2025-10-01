
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TeacherSalary, User, UnifiedSalary } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Banknote, Loader2 } from 'lucide-react';

const statusVariant: { [key: string]: "default" | "secondary" } = {
    paid: "default",
    pending: "secondary",
}
const statusTranslation: { [key: string]: string } = {
    paid: "Payé",
    pending: "En attente",
}

export default function MySalaryPage() {
    const { user: currentUser, loading: userLoading } = useUser();
    const [salaries, setSalaries] = useState<UnifiedSalary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'admin')) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(collection(db, "teacherSalaries"), where("teacherId", "==", currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userSalaries: UnifiedSalary[] = snapshot.docs.map(doc => {
                const data = doc.data() as TeacherSalary;
                return {
                    ...data,
                    id: doc.id,
                    userId: data.teacherId,
                    userName: `${currentUser.lastName} ${currentUser.firstName}`,
                    userRole: 'teacher',
                }
            });
            
            // For admins, we just fetch their records. We don't create pending ones on the fly here.
            setSalaries(userSalaries.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const { totalPaid } = useMemo(() => {
        const totalPaid = salaries.filter(s => s.status === 'paid').reduce((acc, s) => acc + s.totalSalary, 0);
        return { totalPaid };
    }, [salaries]);

    const formatCurrency = (amount: number, currency: string = 'XAF') => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }
    
    if (userLoading || loading) {
        return (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (currentUser?.role !== 'teacher' && currentUser?.role !== 'admin') {
         return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-destructive">Accès Refusé</CardTitle>
                    <CardDescription>
                        Cette page est réservée au personnel de l'établissement.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Mes Salaires</h1>
                <p className="text-muted-foreground">
                    Consultez l'historique de vos fiches de paie et le statut de vos paiements.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Historique des Paiements</CardTitle>
                    <CardDescription>
                        Liste de toutes les fiches de paie générées par l'administration.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {salaries.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mois / Année</TableHead>
                                    <TableHead>Montant</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead>Date de paiement</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salaries.map(salary => (
                                    <TableRow key={salary.id}>
                                        <TableCell className='font-medium'>{salary.month} {salary.year}</TableCell>
                                        <TableCell className='font-semibold'>{formatCurrency(salary.totalSalary, salary.currency)}</TableCell>
                                        <TableCell><Badge variant={statusVariant[salary.status]}>{statusTranslation[salary.status]}</Badge></TableCell>
                                        <TableCell>{salary.paidAt ? format(new Date(salary.paidAt), 'd MMMM yyyy', { locale: fr }) : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[300px]">
                            <Banknote className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">Aucune fiche de paie trouvée</h3>
                            <p className="mb-4 mt-2 text-sm text-muted-foreground">
                                L'historique de vos salaires apparaîtra ici dès qu'ils seront générés.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
