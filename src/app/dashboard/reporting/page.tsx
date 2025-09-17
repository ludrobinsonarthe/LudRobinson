
"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUser } from '@/hooks/use-user';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Course, CashTransaction, Payment, Field } from '@/lib/types';
import { Users, GraduationCap, UserCog, Wallet, BookOpen, ArrowUpCircle, ArrowDownCircle, Scale } from 'lucide-react';
import StudentFieldDistributionChart from '@/components/charts/student-field-distribution-chart';
import FinancialMonthlyOverviewChart from '@/components/charts/financial-monthly-overview-chart';

export default function ReportingPage() {
    const { users, loading: usersLoading, settings, fields } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        setLoadingData(true);
        const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => setCourses(snapshot.docs.map(doc => doc.data() as Course)));
        const unsubTransactions = onSnapshot(collection(db, 'cashTransactions'), snapshot => setTransactions(snapshot.docs.map(doc => doc.data() as CashTransaction)));

        setLoadingData(false);
        return () => {
            unsubCourses();
            unsubTransactions();
        }
    }, []);

    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    
    const stats = useMemo(() => {
        const studentCount = students.length;
        const teacherCount = users.filter(u => u.role === 'teacher').length;
        const adminCount = users.filter(u => u.role === 'admin').length;
        const courseCount = courses.length;

        let totalIncome = 0;
        let totalExpense = 0;
        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            else totalExpense += t.amount;
        });
        const balance = totalIncome - totalExpense;

        return { studentCount, teacherCount, adminCount, courseCount, totalIncome, totalExpense, balance };
    }, [users, courses, transactions, students]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(amount);
    }

    const loading = usersLoading || loadingData;

    if (loading) {
        return <div className="text-center">Chargement des statistiques...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Tableau de Bord Analytique</h1>
                <p className="text-muted-foreground">
                    Vue d'ensemble des statistiques clés de l'institut.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Étudiants Inscrits</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.studentCount}</div>
                        <p className="text-xs text-muted-foreground">Total des étudiants actifs</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Professeurs</CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.teacherCount}</div>
                        <p className="text-xs text-muted-foreground">Total des enseignants</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Personnel Admin</CardTitle>
                        <UserCog className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.adminCount}</div>
                        <p className="text-xs text-muted-foreground">Total des administrateurs</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cours Disponibles</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.courseCount}</div>
                        <p className="text-xs text-muted-foreground">Total des cours créés</p>
                    </CardContent>
                </Card>
            </div>

             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Solde de Caisse</CardTitle>
                        <Scale className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.balance)}</div>
                        <p className="text-xs text-muted-foreground">Balance des entrées et sorties</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total des Entrées</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalIncome)}</div>
                        <p className="text-xs text-muted-foreground">Total des fonds reçus</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total des Sorties</CardTitle>
                        <ArrowDownCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalExpense)}</div>
                        <p className="text-xs text-muted-foreground">Total des dépenses effectuées</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                        <CardTitle>Répartition des Étudiants par Filière</CardTitle>
                        <CardDescription>
                            Visualisation du nombre d'étudiants dans chaque filière.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <StudentFieldDistributionChart students={students} fields={fields} />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Aperçu Financier Mensuel</CardTitle>
                        <CardDescription>
                            Evolution des entrées et sorties sur les 12 derniers mois.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FinancialMonthlyOverviewChart transactions={transactions} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
