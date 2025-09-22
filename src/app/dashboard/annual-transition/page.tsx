
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from '@/hooks/use-user';
import { User, Settings } from '@/lib/types';
import { ArrowRight, CheckCircle, GraduationCap, Loader2, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { db } from '@/lib/firebase';
import { writeBatch, collection, doc, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function AnnualTransitionPage() {
    const { users, loading, settings, setUsers } = useUser();
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const activeStudents = useMemo(() => users.filter(u => u.role === 'student' && u.status === 'active'), [users]);
    
    const studentsByLevel = useMemo(() => {
        const grouped: Record<string, User[]> = {};
        (settings?.levels || []).forEach(level => {
            grouped[level.value] = [];
        });

        activeStudents.forEach(student => {
            if (student.student?.level) {
                if (!grouped[student.student.level]) {
                    grouped[student.student.level] = [];
                }
                grouped[student.student.level].push(student);
            }
        });
        return grouped;
    }, [activeStudents, settings]);

    const getNextLevel = (currentLevel: string): string | null => {
        if (!settings?.levels) return null;
        const currentIndex = settings.levels.findIndex(l => l.value === currentLevel);
        if (currentIndex > -1 && currentIndex < settings.levels.length - 1) {
            return settings.levels[currentIndex + 1].value;
        }
        return null; // This is the last level, student will graduate
    };

    const handlePromoteStudents = async () => {
        setIsProcessing(true);
        const batch = writeBatch(db);

        const studentsToUpdate: User[] = [];
        const studentsToGraduate: User[] = [];

        activeStudents.forEach(student => {
            if (student.student?.level) {
                const nextLevel = getNextLevel(student.student.level);
                const studentRef = doc(db, 'users', student.uid);

                if (nextLevel) {
                    batch.update(studentRef, { 'student.level': nextLevel });
                    studentsToUpdate.push({
                        ...student,
                        student: {
                            ...student.student,
                            level: nextLevel,
                        }
                    });
                } else {
                    batch.update(studentRef, { 'status': 'graduated' });
                    studentsToGraduate.push({
                        ...student,
                        status: 'graduated',
                    });
                }
            }
        });

        try {
            await batch.commit();

            // Manually update the local user state to reflect changes immediately
            setUsers(currentUsers => {
                const updatedUsersMap = new Map(currentUsers.map(u => [u.uid, u]));
                studentsToUpdate.forEach(u => updatedUsersMap.set(u.uid, u));
                studentsToGraduate.forEach(u => updatedUsersMap.set(u.uid, u));
                return Array.from(updatedUsersMap.values());
            });

            toast({
                title: "Transition réussie !",
                description: `${studentsToUpdate.length} étudiants ont été promus et ${studentsToGraduate.length} ont obtenu leur diplôme.`,
            });
            // Optional: redirect or refresh
            router.refresh();

        } catch (error) {
            console.error("Error promoting students: ", error);
            toast({
                variant: 'destructive',
                title: "Erreur lors de la transition",
                description: "Une erreur s'est produite. Veuillez réessayer.",
            });
        } finally {
            setIsProcessing(false);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Transition Annuelle</h1>
                <p className="text-muted-foreground">
                    Gérez le passage des étudiants à l'année académique suivante. Cette action est irréversible pour l'année en cours.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>État Actuel des Promotions</CardTitle>
                    <CardDescription>
                        Nombre d'étudiants actifs dans chaque niveau avant la transition.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(studentsByLevel).map(([level, students]) => (
                        <Card key={level} className="text-center">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">{level}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{students.length}</p>
                                <p className="text-xs text-muted-foreground">étudiants</p>
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
            </Card>

            <Card className="bg-destructive/10 border-destructive">
                <CardHeader>
                    <CardTitle>Action de Transition</CardTitle>
                    <CardDescription>
                        Cette opération fera passer tous les étudiants actifs au niveau supérieur. Les étudiants du dernier niveau seront marqués comme "Diplômé".
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isProcessing}>
                                {isProcessing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                )}
                                Lancer la promotion des étudiants
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmer la transition annuelle ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est majeure et ne peut pas être annulée facilement.
                                    Tous les étudiants actifs seront promus à leur niveau suivant. Les étudiants en fin de cycle recevront le statut "Diplômé".
                                    <br/><br/>
                                    Assurez-vous que toutes les notes et les paiements pour l'année en cours sont finalisés avant de continuer.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isProcessing}>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePromoteStudents} disabled={isProcessing}>
                                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Oui, confirmer et promouvoir
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

        </div>
    );
}
