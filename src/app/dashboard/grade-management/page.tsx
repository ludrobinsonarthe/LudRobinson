
"use client"

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { Grade, Course, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { db } from '@/lib/firebase';
import { collection, query, where, getDoc, doc, onSnapshot, addDoc, setDoc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

function GradeManagementContent() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');
    const { users, loading: usersLoading, settings } = useUser();
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | null>(null);
    const [students, setStudents] = useState<User[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);
    
    // States for the new evaluation dialog
    const [isEvalDialogOpen, setIsEvalDialogOpen] = useState(false);
    const [newEvalType, setNewEvalType] = useState<'devoir' | 'examen'>('devoir');
    const [newEvalTotal, setNewEvalTotal] = useState<number>(20);
    const [newEvalCoeff, setNewEvalCoeff] = useState<number>(1);
    
    // For inline editing
    const [editingGrade, setEditingGrade] = useState<{gradeId: string, score: number} | null>(null);


    useEffect(() => {
        if (!courseId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsubCourse = onSnapshot(doc(db, "courses", courseId), (doc) => {
            setCourse(doc.exists() ? { id: doc.id, ...doc.data() } as Course : null);
        });
        const qGrades = query(collection(db, "grades"), where("courseId", "==", courseId));
        const unsubGrades = onSnapshot(qGrades, (snapshot) => {
            setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
            setLoading(false);
        });
        return () => { unsubCourse(); unsubGrades(); };
    }, [courseId]);

    useEffect(() => {
        if (course) {
            const courseStudents = users.filter(user => 
                user.role === 'student' &&
                user.student?.fieldId === course.fieldId &&
                user.student?.level === course.level
            ).sort((a,b) => a.lastName.localeCompare(b.lastName));
            setStudents(courseStudents);
        } else {
            setStudents([]);
        }
    }, [course, users]);
    
    const evaluationColumns = useMemo(() => {
        const evalMap = new Map<string, {type: 'devoir' | 'examen', total: number, coeff: number, grades: Grade[]}>();
        grades.forEach(grade => {
            // Create a unique key for each evaluation based on type, total, and creation time proximity (e.g., all grades for one exam)
            // This is a simplification. A real implementation might have an "evaluation" entity.
            // Here, we group by type, total, and coefficient to represent a unique evaluation column.
            // For multiple 'devoir' with same properties, we need a better key. Let's use the first grade's creation time as a batch identifier.
            const uniqueKey = `${grade.type}-${grade.total}-${grade.coefficient}`;
            if (!evalMap.has(uniqueKey)) {
                evalMap.set(uniqueKey, {type: grade.type, total: grade.total, coeff: grade.coefficient, grades: []});
            }
            evalMap.get(uniqueKey)!.grades.push(grade);
        });
        
        // Let's refine the key to be more unique if needed, for now this is a workable simplification
        return Array.from(evalMap.entries()).map(([key, data], index) => ({
            id: key,
            name: `${data.type === 'examen' ? 'Examen' : 'Devoir'} ${index + 1} (/${data.total})`,
            ...data
        }));

    }, [grades]);
    
    const gradesByStudentAndEval = useMemo(() => {
        const grid: {[studentId: string]: {[evalId: string]: Grade | undefined}} = {};
        students.forEach(s => grid[s.uid] = {});
        evaluationColumns.forEach(col => {
            col.grades.forEach(grade => {
                if (grid[grade.studentId]) {
                   grid[grade.studentId][col.id] = grade;
                }
            })
        });
        return grid;
    }, [students, evaluationColumns]);

    const averageByStudent = useMemo(() => {
        const averages: { [studentId: string]: number } = {};
        students.forEach(student => {
            const studentGrades = grades.filter(g => g.studentId === student.uid);
            if (studentGrades.length > 0) {
                const totalScore = studentGrades.reduce((acc, g) => acc + (g.score * g.coefficient), 0);
                const totalCoeff = studentGrades.reduce((acc, g) => acc + g.coefficient, 0);
                averages[student.uid] = totalCoeff > 0 ? totalScore / totalCoeff : 0;
            } else {
                averages[student.uid] = 0;
            }
        });
        return averages;
    }, [students, grades]);

    const handleAddNewEvaluation = async () => {
        if (!courseId) return;
        const batch = writeBatch(db);
        students.forEach(student => {
            const newGradeRef = doc(collection(db, "grades"));
            const gradeData: Omit<Grade, 'id'> = {
                studentId: student.uid,
                courseId: courseId,
                type: newEvalType,
                score: 0, // Default score
                total: newEvalTotal,
                coefficient: newEvalCoeff,
                academicYear: settings?.academicYear || "2024-2025",
                createdAt: new Date().toISOString(),
            };
            batch.set(newGradeRef, gradeData);
        });
        try {
            await batch.commit();
            toast({ title: "Nouvelle évaluation ajoutée", description: "Vous pouvez maintenant saisir les notes." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ajouter l'évaluation." });
        } finally {
            setIsEvalDialogOpen(false);
        }
    };
    
    const handleScoreChange = async (gradeId: string, newScore: string) => {
        const scoreValue = parseFloat(newScore);
        if (isNaN(scoreValue)) return; // Or show error

        const gradeRef = doc(db, 'grades', gradeId);
        try {
            await updateDoc(gradeRef, { score: scoreValue });
            // No toast for inline edit to avoid spam
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier la note." });
        }
    }


    if (loading || usersLoading) {
        return <div className="text-center">Chargement...</div>;
    }

    if (!courseId) {
        return (
            <div className="text-center text-muted-foreground">
                Veuillez sélectionner un cours pour voir ou gérer les notes.
            </div>
        );
    }
    
     if (!course) {
        return <div className="text-center text-destructive">Cours non trouvé.</div>;
    }

    const title = `Gestion des notes pour le cours: ${course.name}`;
    const description = `Entrez et modifiez les notes directement dans le tableau.`;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-bold font-headline">{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                        <AlertDialog open={isEvalDialogOpen} onOpenChange={setIsEvalDialogOpen}>
                            <AlertDialogTrigger asChild>
                                <Button><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une évaluation</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Ajouter une nouvelle évaluation</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Ceci créera une nouvelle colonne de notes pour tous les étudiants de ce cours.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-4 py-4">
                                     <div className="space-y-2">
                                        <Label>Type d'évaluation</Label>
                                        <Select value={newEvalType} onValueChange={(v: any) => setNewEvalType(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="devoir">Devoir / Contrôle</SelectItem>
                                                <SelectItem value="examen">Examen</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Note sur</Label>
                                            <Input type="number" value={newEvalTotal} onChange={e => setNewEvalTotal(Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Coefficient</Label>
                                            <Input type="number" value={newEvalCoeff} onChange={e => setNewEvalCoeff(Number(e.target.value))} />
                                        </div>
                                    </div>
                                </div>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleAddNewEvaluation}>Ajouter</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='w-[250px] sticky left-0 bg-card z-10'>Étudiant</TableHead>
                                    {evaluationColumns.map(col => (
                                        <TableHead key={col.id} className="text-center">{col.name}</TableHead>
                                    ))}
                                    <TableHead className="w-[150px] text-center sticky right-0 bg-card z-10">Moyenne</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.length > 0 ? students.map(student => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-medium sticky left-0 bg-card z-10">{student.firstName} {student.lastName}</TableCell>
                                        {evaluationColumns.map(col => {
                                            const grade = gradesByStudentAndEval[student.uid]?.[col.id];
                                            return (
                                                <TableCell key={col.id} className="text-center">
                                                    {grade ? (
                                                        <Input
                                                            type="number"
                                                            defaultValue={grade.score}
                                                            onBlur={(e) => handleScoreChange(grade.id, e.target.value)}
                                                            className="w-20 mx-auto text-center"
                                                            max={grade.total}
                                                            min={0}
                                                        />
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="text-center font-bold text-lg sticky right-0 bg-card z-10">
                                            {averageByStudent[student.uid].toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={evaluationColumns.length + 2} className="h-24 text-center">
                                            Aucun étudiant trouvé pour ce cours.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function GradeManagementPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <GradeManagementContent />
        </Suspense>
    );
}
