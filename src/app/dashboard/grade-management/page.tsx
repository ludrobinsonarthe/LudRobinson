
"use client"

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Grade, Course, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GradeFormDialog from '@/components/grade-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

function GradeManagementContent() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');
    const { users, loading: usersLoading } = useUser();
    const { toast } = useToast();

    const [course, setCourse] = useState<Course | null>(null);
    const [students, setStudents] = useState<User[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    useEffect(() => {
        if (!courseId) {
            setLoading(false);
            return;
        }

        const fetchCourseAndGrades = async () => {
            setLoading(true);
            try {
                const courseRef = doc(db, "courses", courseId);
                const courseSnap = await getDoc(courseRef);

                if (courseSnap.exists()) {
                    const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
                    setCourse(courseData);

                    const courseStudents = users.filter(user => 
                        user.role === 'student' &&
                        user.student?.fieldId === courseData.fieldId &&
                        user.student?.level === courseData.level
                    );
                    setStudents(courseStudents);

                    const gradesQuery = query(collection(db, "grades"), where("courseId", "==", courseId));
                    const gradesSnapshot = await getDocs(gradesQuery);
                    const gradesData: Grade[] = [];
                    gradesSnapshot.forEach(doc => gradesData.push({ id: doc.id, ...doc.data() } as Grade));
                    setGrades(gradesData);
                } else {
                    setCourse(null);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                toast({ variant: 'destructive', title: "Erreur de chargement" });
            } finally {
                setLoading(false);
            }
        };

        if (users.length > 0) {
           fetchCourseAndGrades();
        }

    }, [courseId, users, toast]);

    const gradesByStudent = useMemo(() => {
        const map: { [studentId: string]: Grade[] } = {};
        students.forEach(s => map[s.uid] = []);
        grades.forEach(g => {
            if (map[g.studentId]) {
                map[g.studentId].push(g);
            }
        });
        return map;
    }, [students, grades]);

    const averageByStudent = useMemo(() => {
        const averages: { [studentId: string]: number } = {};
        Object.entries(gradesByStudent).forEach(([studentId, studentGrades]) => {
            if (studentGrades.length > 0) {
                const totalScore = studentGrades.reduce((acc, g) => acc + (g.score * g.coefficient), 0);
                const totalCoeff = studentGrades.reduce((acc, g) => acc + g.coefficient, 0);
                averages[studentId] = totalCoeff > 0 ? totalScore / totalCoeff : 0;
            } else {
                averages[studentId] = 0;
            }
        });
        return averages;
    }, [gradesByStudent]);
    
    const handleAddGrade = (studentId: string) => {
        setSelectedStudentId(studentId);
        setSelectedGrade(null);
        setIsFormOpen(true);
    };

    const handleEditGrade = (grade: Grade) => {
        setSelectedStudentId(grade.studentId);
        setSelectedGrade(grade);
        setIsFormOpen(true);
    };

    const handleDeleteGrade = (grade: Grade) => {
        setSelectedGrade(grade);
        setIsDeleteOpen(true);
    };

    const handleSaveGrade = async (data: Omit<Grade, 'id' | 'courseId' | 'studentId' | 'createdAt'>) => {
        if (!courseId || !selectedStudentId) return;
        try {
            if (selectedGrade) {
                const gradeRef = doc(db, "grades", selectedGrade.id);
                await updateDoc(gradeRef, data);
                setGrades(prev => prev.map(g => g.id === selectedGrade.id ? { ...g, ...data } : g));
                toast({ title: "Note mise à jour" });
            } else {
                const newGradeId = doc(collection(db, 'grades')).id;
                const newGrade: Grade = {
                    id: newGradeId,
                    courseId,
                    studentId: selectedStudentId,
                    createdAt: new Date().toISOString(),
                    ...data
                }
                await setDoc(doc(db, "grades", newGradeId), newGrade);
                setGrades(prev => [...prev, newGrade]);
                toast({ title: "Note ajoutée avec succès" });
            }
            setIsFormOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Erreur", description: "Impossible d'enregistrer la note." });
        }
    };

    const confirmDeleteGrade = async () => {
        if (!selectedGrade) return;
        try {
            await deleteDoc(doc(db, 'grades', selectedGrade.id));
            setGrades(prev => prev.filter(g => g.id !== selectedGrade.id));
            toast({ title: "Note supprimée" });
            setIsDeleteOpen(false);
            setSelectedGrade(null);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Erreur", description: "Impossible de supprimer la note." });
        }
    };

    if (loading || usersLoading) {
        return <div className="text-center">Chargement...</div>;
    }

    if (!courseId) {
        return (
            <div className="text-center text-muted-foreground">
                Veuillez sélectionner un cours depuis la page de gestion des cours pour voir ou gérer les notes.
            </div>
        );
    }
    
     if (!course) {
        return <div className="text-center text-destructive">Cours non trouvé.</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold font-headline">Gestion des notes pour le cours: {course.name}</CardTitle>
                    <CardDescription>
                        Entrez et modifiez les notes pour les étudiants de la filière {course.level} en {students.length > 0 ? students[0].student?.fieldId : ''}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-[250px]'>Étudiant</TableHead>
                                <TableHead>Notes (Devoirs / Examens)</TableHead>
                                <TableHead className="w-[150px] text-center">Moyenne</TableHead>
                                <TableHead className="w-[120px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.length > 0 ? students.map(student => (
                                <TableRow key={student.uid}>
                                    <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-2">
                                            {gradesByStudent[student.uid].length > 0 ? gradesByStudent[student.uid].map(grade => (
                                                 <DropdownMenu key={grade.id}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Badge variant={grade.type === 'examen' ? 'default' : 'secondary'} className="cursor-pointer">
                                                            {grade.score}/{grade.total} (c: {grade.coefficient})
                                                        </Badge>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => handleEditGrade(grade)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Modifier
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDeleteGrade(grade)} className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                 </DropdownMenu>
                                            )) : <span className="text-xs text-muted-foreground">Aucune note</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-lg">
                                        {averageByStudent[student.uid].toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => handleAddGrade(student.uid)}>
                                            <PlusCircle className="h-4 w-4 mr-2" /> Ajouter
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Aucun étudiant trouvé pour ce cours.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <GradeFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSaveGrade}
                grade={selectedGrade}
            />
            {selectedGrade && (
                <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDeleteGrade}
                    user={{uid: selectedGrade.id, firstName: `Note ${selectedGrade.score}/${selectedGrade.total}`, lastName: ''}}
                    title="Supprimer cette note ?"
                    description="Cette action est irréversible et supprimera définitivement la note."
                />
            )}

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

    