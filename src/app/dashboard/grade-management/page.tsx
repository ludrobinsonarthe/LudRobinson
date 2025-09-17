
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
import GradeFormDialog from '@/components/grade-form-dialog';
import UserDeleteDialog from '@/components/user-delete-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { db } from '@/lib/firebase';
import { collection, query, where, getDoc, doc, onSnapshot, addDoc, setDoc, deleteDoc } from 'firebase/firestore';

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

function GradeManagementContent() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');
    const studentIdParam = searchParams.get('studentId');
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
        if (!courseId && !studentIdParam) {
            setLoading(false);
            return;
        }

        setLoading(true);

        let unsubCourse: () => void = () => {};
        let unsubGrades: () => void = () => {};
        
        if (courseId) {
            unsubCourse = onSnapshot(doc(db, "courses", courseId), (doc) => {
                if (doc.exists()) {
                    const courseData = { id: doc.id, ...doc.data() } as Course;
                    setCourse(courseData);
                } else {
                    setCourse(null);
                }
            });
            const qGrades = query(collection(db, "grades"), where("courseId", "==", courseId));
            unsubGrades = onSnapshot(qGrades, (snapshot) => {
                setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
                setLoading(false);
            });
        } else if (studentIdParam) {
            const qGrades = query(collection(db, "grades"), where("studentId", "==", studentIdParam));
             unsubGrades = onSnapshot(qGrades, (snapshot) => {
                setGrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
                setLoading(false);
            });
        }
        
        return () => {
            unsubCourse();
            unsubGrades();
        };

    }, [courseId, studentIdParam, users, toast]);

    useEffect(() => {
        if (course) {
            const courseStudents = users.filter(user => 
                user.role === 'student' &&
                user.student?.fieldId === course.fieldId &&
                user.student?.level === course.level
            );
            setStudents(courseStudents);
        } else if (studentIdParam) {
             const student = users.find(user => user.uid === studentIdParam);
             setStudents(student ? [student] : []);
        } else {
            setStudents([]);
        }
    }, [course, studentIdParam, users]);

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

    const handleSaveGrade = async (data: Omit<Grade, 'id'>) => {
        try {
            if (selectedGrade) {
                await setDoc(doc(db, "grades", selectedGrade.id), data, { merge: true });
                toast({ title: "Note mise à jour" });
            } else {
                await addDoc(collection(db, "grades"), data);
                toast({ title: "Note ajoutée" });
            }
        } catch (error) {
            console.error("Error saving grade:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer la note.' });
        } finally {
            setIsFormOpen(false);
        }
    };

    const confirmDeleteGrade = async () => {
        if (!selectedGrade) return;
        try {
            await deleteDoc(doc(db, "grades", selectedGrade.id));
            toast({ title: "Note supprimée" });
        } catch (error) {
            console.error("Error deleting grade:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer la note.' });
        } finally {
            setIsDeleteOpen(false);
            setSelectedGrade(null);
        }
    };

    if (loading || usersLoading) {
        return <div className="text-center">Chargement...</div>;
    }

    if (!courseId && !studentIdParam) {
        return (
            <div className="text-center text-muted-foreground">
                Veuillez sélectionner un cours ou un étudiant pour voir ou gérer les notes.
            </div>
        );
    }
    
     if (courseId && !course) {
        return <div className="text-center text-destructive">Cours non trouvé.</div>;
    }

    const title = course
        ? `Gestion des notes pour le cours: ${course.name}`
        : `Gestion des notes pour: ${students[0]?.firstName} ${students[0]?.lastName}`;

    const description = course 
        ? `Entrez les notes pour les étudiants inscrits à ce cours.`
        : `Gérez toutes les notes de l'étudiant, tous cours confondus.`;


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-bold font-headline">{title}</CardTitle>
                    <CardDescription>
                       {description}
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
                                        <Button size="sm" onClick={() => handleAddGrade(student.uid)} disabled={!courseId}>
                                            <PlusCircle className="h-4 w-4 mr-2" /> Ajouter
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Aucun étudiant trouvé.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            {isFormOpen && courseId && selectedStudentId &&
                <GradeFormDialog 
                    isOpen={isFormOpen}
                    setIsOpen={setIsFormOpen}
                    onSave={handleSaveGrade}
                    grade={selectedGrade}
                    studentId={selectedStudentId}
                    courseId={courseId}
                />
            }
            {selectedGrade && (
                <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDeleteGrade}
                    item={{id: selectedGrade.id, name: `Note ${selectedGrade.score}/${selectedGrade.total}`}}
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
