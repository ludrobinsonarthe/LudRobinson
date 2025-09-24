

"use client"

import { useState, useEffect, useMemo, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { Grade, Course, User } from "@/lib/types";
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Edit, Trash2, FileDown, ArrowLeft, Loader2 } from 'lucide-react';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { imageToDataUrl } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};

type EvaluationColumn = {
    id: string;
    name: string;
    type: Grade['type'];
    total: number;
    coefficient: number;
    grades: Grade[];
}


function GradeManagementContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');
    const { users, loading: usersLoading, settings, courses: allCourses, user } = useUser();
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | null>(null);
    const [students, setStudents] = useState<User[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    
    // States for the new evaluation dialog
    const [isEvalDialogOpen, setIsEvalDialogOpen] = useState(false);
    const [newEvalType, setNewEvalType] = useState<Grade['type']>('devoir de classe');
    const [newEvalTotal, setNewEvalTotal] = useState<number>(20);
    const [newEvalCoefficient, setNewEvalCoefficient] = useState<number>(1);
    const [newEvalCourseId, setNewEvalCourseId] = useState(courseId || '');

    // State for deleting an evaluation
    const [evalToDelete, setEvalToDelete] = useState<EvaluationColumn | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);


    useEffect(() => {
        if (user?.role !== 'admin' && user?.role !== 'teacher') {
            setLoadingData(false);
            return;
        }

        setLoadingData(true);
        const qGrades = query(collection(db, "grades"));
        const unsubGrades = onSnapshot(qGrades, (snapshot) => {
            setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
            setLoadingData(false);
        });
        
        if (courseId) {
            const courseData = allCourses.find(c => c.id === courseId);
            setCourse(courseData || null);
            setNewEvalCourseId(courseId);
        } else {
            setCourse(null);
        }
        return () => { unsubGrades(); };
    }, [courseId, allCourses, user]);

    useEffect(() => {
        if (course) {
            const courseStudents = users.filter(user => 
                user.role === 'student' &&
                user.student?.fieldId === course.fieldId &&
                user.student?.level === course.level
            ).sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''));
            setStudents(courseStudents);
        } else {
            setStudents([]);
        }
    }, [course, users]);
    
    const evaluationColumns: EvaluationColumn[] = useMemo(() => {
        if (!course) return [];
        const courseGrades = grades.filter(g => g.courseId === course.id);
        const evalMap = new Map<string, {type: Grade['type'], total: number, coefficient: number, grades: Grade[]}>();

        courseGrades.forEach(grade => {
            // Unique key to group identical evaluation types
            const uniqueKey = `${grade.type}-${grade.total}-${grade.coefficient}`; 
            if (!evalMap.has(uniqueKey)) {
                evalMap.set(uniqueKey, {type: grade.type, total: grade.total, coefficient: grade.coefficient, grades: []});
            }
            evalMap.get(uniqueKey)!.grades.push(grade);
        });
        
        // Sort evaluations to have a consistent order
        return Array.from(evalMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, data], index) => ({
            id: key,
            name: `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} (/${data.total})`,
            ...data
        }));

    }, [grades, course]);
    
    const gradesByStudentAndEval = useMemo(() => {
        if (!course) return {};
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
    }, [students, evaluationColumns, course]);

    const averageByStudent = useMemo(() => {
        const averages: { [studentId: string]: { average: number } } = {};
        students.forEach(student => {
            const studentGrades = grades.filter(g => g.studentId === student.uid && g.courseId === course?.id);
            if (studentGrades.length > 0 && course) {
                const dc = studentGrades.find(g => g.type === 'devoir de classe');
                const dr = studentGrades.find(g => g.type === 'devoir de recherche');
                const exam = studentGrades.find(g => g.type === 'examen');
                
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

                const finalAverage = (nc * 0.4) + (examScore20 * 0.6);
                
                averages[student.uid] = { average: finalAverage };
            } else {
                averages[student.uid] = { average: 0 };
            }
        });
        return averages;
    }, [students, grades, course]);

    const handleAddNewEvaluation = async () => {
        const targetCourseId = courseId || newEvalCourseId;
        if (!targetCourseId) {
            toast({ variant: "destructive", title: "Erreur", description: "Veuillez sélectionner un cours." });
            return;
        }

        const targetCourse = allCourses.find(c => c.id === targetCourseId);
        if (!targetCourse) {
            toast({ variant: "destructive", title: "Erreur", description: "Cours introuvable." });
            return;
        }

        const targetStudents = users.filter(user => 
            user.role === 'student' &&
            user.student?.fieldId === targetCourse.fieldId &&
            user.student?.level === targetCourse.level
        );

        if (targetStudents.length === 0) {
            toast({ variant: "destructive", title: "Aucun étudiant", description: "Aucun étudiant n'est inscrit dans ce cours." });
            return;
        }

        const batch = writeBatch(db);
        targetStudents.forEach(student => {
            const newGradeRef = doc(collection(db, "grades"));
            const gradeData: Omit<Grade, 'id'> = {
                studentId: student.uid,
                courseId: targetCourseId,
                type: newEvalType,
                score: 0, // Default score
                total: newEvalTotal,
                coefficient: newEvalCoefficient,
                academicYear: settings?.academicYear || "2024-2025",
                createdAt: new Date().toISOString(),
            };
            batch.set(newGradeRef, gradeData);
        });
        try {
            await batch.commit();
            toast({ title: "Nouvelle évaluation ajoutée", description: "Vous pouvez maintenant saisir les notes." });
            if(!courseId) router.push(`/dashboard/grade-management?courseId=${targetCourseId}`);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ajouter l'évaluation." });
        } finally {
            setIsEvalDialogOpen(false);
        }
    };
    
    const handleScoreChange = (gradeId: string, newScore: string) => {
        const scoreValue = parseFloat(newScore);
        if (isNaN(scoreValue)) return;

        // Update local state immediately for instant UI feedback
        setGrades(currentGrades => currentGrades.map(g => g.id === gradeId ? { ...g, score: scoreValue } : g));
        
        // Debounce Firestore update
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        debounceTimeout.current = setTimeout(async () => {
            const gradeRef = doc(db, 'grades', gradeId);
            try {
                await updateDoc(gradeRef, { score: scoreValue });
            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Erreur de sauvegarde", description: "Impossible de mettre à jour la note." });
            }
        }, 500); // Wait 500ms after user stops typing
    }
    
    const handleDeleteEvaluation = (evaluation: EvaluationColumn) => {
        if (!evaluation) return;
        setEvalToDelete(evaluation);
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteEvaluation = async () => {
        if (!evalToDelete || !evalToDelete.grades) return;

        const batch = writeBatch(db);
        evalToDelete.grades.forEach(grade => {
            batch.delete(doc(db, "grades", grade.id));
        });

        try {
            await batch.commit();
            toast({ title: "Évaluation supprimée", description: `L'évaluation "${evalToDelete.name}" et toutes ses notes ont été supprimées.` });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'évaluation." });
        } finally {
            setIsDeleteDialogOpen(false);
            setEvalToDelete(null);
        }
    };
    
    const getExportData = () => {
        const headers = ["Étudiant", ...evaluationColumns.map(col => col.name), "Moyenne /20"];
        const data = students.map(student => {
            const row: (string | number)[] = [`${student.lastName} ${student.firstName}`];
            evaluationColumns.forEach(col => {
                const grade = gradesByStudentAndEval[student.uid]?.[col.id];
                row.push(grade ? grade.score : "-");
            });
            row.push(averageByStudent[student.uid]?.average.toFixed(2) || "0.00");
            return row;
        });
        return { headers, data };
    }

    const handleExportPDF = async () => {
        if (!course || !settings) return;

        const doc = new jsPDF({ orientation: "landscape" });
        const { headers, data } = getExportData();
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl || '/logo.png');
            if (logoDataUrl) {
                const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
                doc.addImage(logoDataUrl, logoExtension, 14, 10, 20, 20);
            }
        } catch (error) {
            console.error("Could not add logo to PDF, proceeding without it.", error);
        }

        doc.setFont("helvetica", "bold");
        doc.text(settings.schoolName, 40, 18);
        doc.setFont("helvetica", "normal");
        doc.text(`Relevé de notes - ${course.name}`, 40, 25);
        doc.setFontSize(10);
        doc.text(`Niveau: ${course.level} - Année: ${settings.academicYear}`, 14, 35);
        
        autoTable(doc, {
            head: [headers],
            body: data,
            startY: 40,
            theme: 'striped',
            styles: { fontSize: 8 },
        });

        doc.save(`notes_${course.name.replace(/\s/g, '_')}.pdf`);
        toast({ title: "Exportation PDF réussie" });
    };

    const handleExportXLSX = () => {
        if (!course) return;
        
        const { headers, data } = getExportData();
        const exportData = [headers, ...data];
        
        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Notes");
        XLSX.writeFile(workbook, `notes_${course.name.replace(/\s/g, '_')}.xlsx`);
        toast({ title: "Exportation Excel réussie" });
    };

    if (user?.role !== 'admin' && user?.role !== 'teacher') {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-destructive">Accès Refusé</CardTitle>
                    <CardDescription>
                        Vous n'avez pas les permissions nécessaires pour accéder à cette page.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if (usersLoading || loadingData) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!courseId) {
        return (
            <Card>
                 <CardHeader>
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className="text-2xl font-bold font-headline">Évaluations et Notes</CardTitle>
                            <CardDescription>Sélectionnez un cours pour voir ou gérer les notes, ou ajoutez une nouvelle évaluation.</CardDescription>
                        </div>
                         <AlertDialog open={isEvalDialogOpen} onOpenChange={setIsEvalDialogOpen}>
                            <AlertDialogTrigger asChild>
                                <Button><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une évaluation</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Ajouter une nouvelle évaluation</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Ceci créera une nouvelle colonne de notes pour tous les étudiants du cours sélectionné.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-4 py-4">
                                     <div className="space-y-2">
                                        <Label>Cours</Label>
                                         <Select value={newEvalCourseId} onValueChange={setNewEvalCourseId}>
                                            <SelectTrigger><SelectValue placeholder="Sélectionner un cours..."/></SelectTrigger>
                                            <SelectContent>
                                                {allCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.level})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-2">
                                        <Label>Type d'évaluation</Label>
                                        <Select value={newEvalType} onValueChange={(v: any) => setNewEvalType(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="devoir de classe">Devoir de Classe</SelectItem>
                                                <SelectItem value="devoir de recherche">Devoir de Recherche</SelectItem>
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
                                            <Input type="number" value={newEvalCoefficient} onChange={e => setNewEvalCoefficient(Number(e.target.value))} />
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
                   <p className="text-center text-muted-foreground py-10">Veuillez sélectionner un cours pour voir les notes.</p>
                </CardContent>
            </Card>
        );
    }
    
     if (!course) {
        return <div className="text-center text-destructive">Cours non trouvé.</div>;
    }

    const title = `Gestion des notes pour le cours: ${course.name}`;
    const description = `Entrez et modifiez les notes directement dans le tableau. Crédit de la matière: ${course.credit}`;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => router.back()}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <CardTitle className="text-2xl font-bold font-headline">{title}</CardTitle>
                                <CardDescription>{description}</CardDescription>
                            </div>
                        </div>
                        <div className='flex items-center gap-2'>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline"><FileDown className="mr-2 h-4 w-4"/> Exporter les notes</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={handleExportPDF}>Exporter en PDF</DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportXLSX}>Exporter en Excel</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                                                    <SelectItem value="devoir de classe">Devoir de Classe</SelectItem>
                                                    <SelectItem value="devoir de recherche">Devoir de Recherche</SelectItem>
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
                                                <Input type="number" value={newEvalCoefficient} onChange={e => setNewEvalCoefficient(Number(e.target.value))} />
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
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='w-[250px] sticky left-0 bg-card z-10'>Étudiant</TableHead>
                                    {evaluationColumns.map(col => (
                                        <TableHead key={col.id} className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <span>{col.name}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteEvaluation(col)}>
                                                    <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                                                </Button>
                                            </div>
                                        </TableHead>
                                    ))}
                                    <TableHead className="w-[150px] text-center sticky right-0 bg-card z-10">Moyenne /20</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.length > 0 ? students.map(student => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-medium sticky left-0 bg-card z-10">{`${student.lastName || ''} ${student.firstName || ''}`}</TableCell>
                                        {evaluationColumns.map(col => {
                                            const grade = gradesByStudentAndEval[student.uid]?.[col.id];
                                            return (
                                                <TableCell key={col.id} className="text-center">
                                                    {grade ? (
                                                        <Input
                                                            type="number"
                                                            defaultValue={grade.score}
                                                            onChange={(e) => handleScoreChange(grade.id, e.target.value)}
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
                                            {averageByStudent[student.uid]?.average.toFixed(2)}
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

             <UserDeleteDialog
                isOpen={isDeleteDialogOpen}
                setIsOpen={setIsDeleteDialogOpen}
                onConfirm={confirmDeleteEvaluation}
                item={{id: evalToDelete?.id || '', name: evalToDelete?.name || ''}}
                title="Supprimer cette évaluation ?"
                description={`Toutes les notes saisies pour "${evalToDelete?.name}" seront définitivement supprimées. Cette action est irréversible.`}
            />
        </div>
    )
}

export default function GradeManagementPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <GradeManagementContent />
        </Suspense>
    );
}

    