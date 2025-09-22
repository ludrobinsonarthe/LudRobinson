
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from '@/hooks/use-user';
import { User, Grade, Course } from '@/lib/types';
import { ArrowRight, CheckCircle, GraduationCap, Loader2, Users, Repeat } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { db } from '@/lib/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const PASSING_GRADE = 10;

export default function AnnualTransitionPage() {
    const { users, loading, settings, setUsers, courses, grades } = useUser();
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const activeStudents = useMemo(() => users.filter(u => u.role === 'student' && u.status === 'active'), [users]);
    
    const getOverallAverage = (studentId: string, studentCourses: Course[]): number => {
        const studentGrades = grades.filter(g => g.studentId === studentId);
        if (studentGrades.length === 0 || studentCourses.length === 0) return 0;

        let totalWeightedAverage = 0;
        let totalCredits = 0;

        studentCourses.forEach(course => {
            const courseGrades = studentGrades.filter(g => g.courseId === course.id);
            if (courseGrades.length > 0) {
                const dc = courseGrades.find(g => g.type === 'devoir de classe');
                const dr = courseGrades.find(g => g.type === 'devoir de recherche');
                const exam = courseGrades.find(g => g.type === 'examen');
                
                const getScoreOutOf20 = (grade: Grade | undefined) => grade ? (grade.score / grade.total) * 20 : 0;
                
                let nc = 0; // Note de classe out of 20
                const dcScore20 = dc ? getScoreOutOf20(dc) : null;
                const drScore20 = dr ? getScoreOutOf20(dr) : null;

                if (dcScore20 !== null && drScore20 !== null) {
                    nc = (dcScore20 + drScore20) / 2;
                } else if (dcScore20 !== null) {
                    nc = dcScore20;
                } else if (drScore20 !== null) {
                    nc = drScore20;
                }

                const examScore20 = getScoreOutOf20(exam);

                const finalCourseAverage = (nc * 0.4) + (examScore20 * 0.6);
                
                totalWeightedAverage += finalCourseAverage * (course.credit || 1);
                totalCredits += (course.credit || 1);
            }
        });

        return totalCredits > 0 ? totalWeightedAverage / totalCredits : 0;
    };
    
    const transitionPlan = useMemo(() => {
        const studentsToPromote: User[] = [];
        const studentsToRepeat: User[] = [];
        const studentsToGraduate: User[] = [];
        const studentsWithNoGrades: User[] = [];

        activeStudents.forEach(student => {
             if (student.student?.fieldId && student.student?.level) {
                const studentCourses = courses.filter(c => c.fieldId === student.student!.fieldId && c.level === student.student!.level);
                const average = getOverallAverage(student.uid, studentCourses);

                if (average >= PASSING_GRADE) {
                    const nextLevel = getNextLevel(student.student.level);
                    if (nextLevel) {
                        studentsToPromote.push(student);
                    } else {
                        studentsToGraduate.push(student);
                    }
                } else {
                    studentsToRepeat.push(student);
                }
            } else {
                 studentsWithNoGrades.push(student);
            }
        });
        
        return { studentsToPromote, studentsToRepeat, studentsToGraduate, studentsWithNoGrades };

    }, [activeStudents, courses, grades, settings]);


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

        const { studentsToPromote, studentsToGraduate } = transitionPlan;

        studentsToPromote.forEach(student => {
            const nextLevel = getNextLevel(student.student!.level!);
            const studentRef = doc(db, 'users', student.uid);
            batch.update(studentRef, { 'student.level': nextLevel });
        });

        studentsToGraduate.forEach(student => {
            const studentRef = doc(db, 'users', student.uid);
            batch.update(studentRef, { 'status': 'graduated' });
        });

        try {
            await batch.commit();

            // Manually update the local user state to reflect changes immediately
            setUsers(currentUsers => {
                const updatedUsersMap = new Map(currentUsers.map(u => [u.uid, u]));
                studentsToPromote.forEach(u => updatedUsersMap.set(u.uid, { ...u, student: { ...u.student!, level: getNextLevel(u.student!.level!)! } }));
                studentsToGraduate.forEach(u => updatedUsersMap.set(u.uid, { ...u, status: 'graduated' }));
                return Array.from(updatedUsersMap.values());
            });

            toast({
                title: "Transition réussie !",
                description: `${studentsToPromote.length} étudiants promus, ${studentsToGraduate.length} diplômés et ${transitionPlan.studentsToRepeat.length} redoublants.`,
            });
            
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
                    Gérez le passage des étudiants à l'année académique suivante en fonction de leurs résultats. Seuls les étudiants avec une moyenne générale de {PASSING_GRADE}/20 ou plus seront promus.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Résumé de la Transition</CardTitle>
                    <CardDescription>
                        Aperçu des promotions, redoublements et diplômes qui seront appliqués.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     <Card className="text-center bg-green-500/10 border-green-500">
                        <CardHeader className="pb-2">
                             <CardTitle className="text-sm font-medium flex items-center justify-center gap-2"><CheckCircle className="h-4 w-4" /> Promus</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{transitionPlan.studentsToPromote.length}</p>
                            <p className="text-xs text-muted-foreground">étudiants admis</p>
                        </CardContent>
                    </Card>
                    <Card className="text-center bg-blue-500/10 border-blue-500">
                        <CardHeader className="pb-2">
                             <CardTitle className="text-sm font-medium flex items-center justify-center gap-2"><GraduationCap className="h-4 w-4"/> Diplômés</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{transitionPlan.studentsToGraduate.length}</p>
                            <p className="text-xs text-muted-foreground">étudiants en fin de cycle</p>
                        </CardContent>
                    </Card>
                    <Card className="text-center bg-orange-500/10 border-orange-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center justify-center gap-2"><Repeat className="h-4 w-4"/> Redoublants</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{transitionPlan.studentsToRepeat.length}</p>
                            <p className="text-xs text-muted-foreground">étudiants non admis</p>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>

            <Card className="bg-destructive/10 border-destructive">
                <CardHeader>
                    <CardTitle>Action de Transition</CardTitle>
                    <CardDescription>
                        Cette opération mettra à jour le statut et/ou le niveau de chaque étudiant actif en fonction de sa moyenne annuelle. Cette action est irréversible pour l'année en cours.
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
                                Lancer la transition des étudiants
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmer la transition annuelle ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est majeure et ne peut pas être annulée facilement.
                                    Les étudiants avec une moyenne supérieure ou égale à {PASSING_GRADE}/20 seront promus. Les autres redoubleront. Les étudiants en fin de cycle seront diplômés.
                                    <br/><br/>
                                    Assurez-vous que toutes les notes et les paiements pour l'année en cours sont finalisés avant de continuer.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isProcessing}>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePromoteStudents} disabled={isProcessing}>
                                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Oui, confirmer et lancer la transition
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

        </div>
    );
}
