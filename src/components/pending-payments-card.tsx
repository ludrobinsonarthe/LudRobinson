
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Payment, User } from '@/lib/types';
import { ArrowRight, Receipt } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PendingPaymentsCardProps {
    payments: Payment[];
    users: User[];
}

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function PendingPaymentsCard({ payments, users }: PendingPaymentsCardProps) {

    const pendingPayments = useMemo(() => {
        return payments
            .filter(p => p.status === 'pending')
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
    }, [payments]);

    const usersById = useMemo(() => {
        return users.reduce((acc, user) => {
            acc[user.uid] = user;
            return acc;
        }, {} as Record<string, User>);
    }, [users]);
    
    if(pendingPayments.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Paiements en attente</CardTitle>
                    <CardDescription>
                        Les paiements soumis par les étudiants en attente de validation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center h-48">
                    <Receipt className="h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mt-4">Aucun paiement en attente</h3>
                    <p className="text-sm text-muted-foreground">Tout est à jour !</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <CardHeader>
                <CardTitle>Paiements en attente de validation</CardTitle>
                <CardDescription>
                    Les 5 paiements les plus récents qui nécessitent votre attention.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
                {pendingPayments.map(payment => {
                    const student = usersById[payment.studentId];
                    return (
                        <div key={payment.id} className="flex items-center gap-4">
                            <Avatar className="hidden h-9 w-9 sm:flex">
                                <AvatarImage src={student?.photoUrl} alt="Avatar" />
                                <AvatarFallback>{student ? getInitials(student.firstName, student.lastName) : '?'}</AvatarFallback>
                            </Avatar>
                            <div className="grid gap-1">
                                <p className="text-sm font-medium leading-none">
                                    {student?.firstName} {student?.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">{payment.month} - {new Intl.NumberFormat('fr-FR').format(payment.amountPaid)} {payment.currency}</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-sm font-medium">{formatDistanceToNow(new Date(payment.createdAt), {locale: fr, addSuffix: true})}</p>
                            </div>
                        </div>
                    )
                })}
            </CardContent>
            <CardFooter>
                 <Button className="w-full" asChild>
                    <Link href="/dashboard/tuition-management">
                        Voir tous les paiements
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </>
    );
}

