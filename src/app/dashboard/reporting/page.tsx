

"use client";

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUser } from '@/hooks/use-user';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Course, CashTransaction, Payment, Field, User } from '@/lib/types';
import { Users, GraduationCap, UserCog, Wallet, BookOpen, ArrowUpCircle, ArrowDownCircle, Scale } from 'lucide-react';
import PendingPaymentsCard from '@/components/pending-payments-card';
import { Skeleton } from '@/components/ui/skeleton';

const FinancialMonthlyOverviewChart = dynamic(
    () => import('@/components/charts/financial-monthly-overview-chart'),
    { 
        ssr: false,
        loading: () => <Skeleton className="h-[250px] w-full" /> 
    }
);


export default function ReportingPage() {
    const { loading: userLoading, allUsers } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        setLoadingData(true);
        const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => setCourses(snapshot.docs.map(doc => doc.data() as Course)));
        const unsubTransactions = onSnapshot(collection(db, 'cashTransactions'), snapshot => setTransactions(snapshot.docs.map(doc => doc.data() as CashTransaction)));
        const unsubPayments = onSnapshot(collection(db, 'payments'), snapshot => setPayments(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Payment)));

        // Ensures a minimum loading time for better UX with skeletons
        const timer = setTimeout(() => setLoadingData(false), 300);
        
        return () => {
            unsubCourses();
            unsubTransactions();
            unsubPayments();
            clearTimeout(timer);
        }
    }, []);

    const students = useMemo(() => allUsers.filter(u => u.role === 'student'), [allUsers]);
    
    const stats = useMemo(() => {
        const studentCount = students.length;
        const teacherCount = allUsers.filter(u => u.role === 'teacher').length;
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        const courseCount = courses.length;

        let totalIncome = 0;
        let totalExpense = 0;
        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;
        });
        const balance = totalIncome - totalExpense;

        return { studentCount, teacherCount, adminCount, courseCount, totalIncome, totalExpense, balance };
    }, [allUsers, courses, transactions, students]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(amount);
    }

    const loading = userLoading || loadingData;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Tableau de Bord Analytique</h1>
                <p className="text-muted-foreground">
                    Vue d'ensemble des statistiques clés de l'institut.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
               {loading ? (
                    <>
                        <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-20" /></CardContent></Card>
                        <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-20" /></CardContent></Card>
                        <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-20" /></CardContent></Card>
                        <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-20" /></CardContent></Card>
                    </>
               ) : (
                <>
                    <Link href="/dashboard/students">
                        <Card className="hover:bg-muted/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Étudiants Inscrits</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.studentCount}</div>
                                <p className="text-xs text-muted-foreground">Total des étudiants actifs</p>
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/dashboard/users">
                        <Card className="hover:bg-muted/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Professeurs</CardTitle>
                                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.teacherCount}</div>
                                <p className="text-xs text-muted-foreground">Total des enseignants</p>
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/dashboard/users">
                        <Card className="hover:bg-muted/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Personnel Admin</CardTitle>
                                <UserCog className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.adminCount}</div>
                                <p className="text-xs text-muted-foreground">Total des administrateurs</p>
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/dashboard/course-management">
                        <Card className="hover:bg-muted/50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Cours Disponibles</CardTitle>
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.courseCount}</div>
                                <p className="text-xs text-muted-foreground">Total des cours créés</p>
                            </CardContent>
                        </Card>
                    </Link>
                </>
               )}
            </div>

             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 {loading ? (
                    <>
                        <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>
                        <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>
                        <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>
                    </>
                 ) : (
                <>
                <Link href="/dashboard/cash-flow">
                    <Card className="hover:bg-muted/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Solde de Caisse</CardTitle>
                            <Scale className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(stats.balance)}</div>
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
                            <div className="text-2xl font-bold">{formatCurrency(stats.totalIncome)}</div>
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
                            <div className="text-2xl font-bold">{formatCurrency(stats.totalExpense)}</div>
                            <p className="text-xs text-muted-foreground">Total des dépenses effectuées</p>
                        </CardContent>
                    </Card>
                </Link>
                </>
                 )}
            </div>

            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                    {loading ? (
                        <CardHeader>
                            <Skeleton className="h-6 w-48 mb-2" />
                            <Skeleton className="h-4 w-full" />
                        </CardHeader>
                    ) : (
                        <PendingPaymentsCard payments={payments} users={allUsers} />
                    )}
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Aperçu Financier Mensuel</CardTitle>
                        <CardDescription>
                            Evolution des entrées et sorties sur les 12 derniers mois.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        {loading ? <Skeleton className="h-[250px] w-full" /> : <FinancialMonthlyOverviewChart transactions={transactions} />}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
