
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { Grade, Course, User } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CourseWithGrades extends Course {
    grades: Grade[];
    average: number;
}

export default function GradesPage() {
    const { user: currentUser, users, courses: allCourses } = useUser();
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

     const children = useMemo(() => {
        if (currentUser?.role !== 'parent') return [];
        return users.filter(u => currentUser.parent?.childrenUids.includes(u.uid));
    }, [currentUser, users]);

    const studentToView = useMemo(() => {
        if (currentUser?.role === 'student') return currentUser;
        if (currentUser?.role === 'parent') return users.find(u => u.uid === selectedChildId);
        return null;
    }, [currentUser, users, selectedChildId]);
    
    useEffect(() => {
        if (currentUser?.role === 'parent' && children.length > 0 && !selectedChildId) {
            setSelectedChildId(children[0].uid);
        }
    }, [currentUser, children, selectedChildId]);

    useEffect(() => {
        if (!studentToView || !studentToView.uid) {
            setLoading(false);
            setGrades([]);
            return;
        }

        setLoading(true);
        const q = query(collection(db, "grades"), where("studentId", "==", studentToView.uid));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const studentGrades = snapshot.docs.map(doc => doc.data() as Grade);
            setGrades(studentGrades);
            setLoading(false);
        });

        return () => unsubscribe();
        
    }, [studentToView]);

    const coursesWithGrades = useMemo((): CourseWithGrades[] => {
        if (grades.length === 0 || allCourses.length === 0) return [];

        const courseMap: { [key: string]: CourseWithGrades } = {};

        // Group grades by course
        grades.forEach(grade => {
            if (!courseMap[grade.courseId]) {
                 const courseInfo = allCourses.find(c => c.id === grade.courseId);
                 if (courseInfo) {
                    courseMap[grade.courseId] = { ...courseInfo, grades: [], average: 0 };
                 }
            }
            if (courseMap[grade.courseId]) {
                courseMap[grade.courseId].grades.push(grade);
            }
        });
        
        // Calculate average for each course
        Object.values(courseMap).forEach(course => {
            if(course.grades.length > 0) {
                const dc = course.grades.find(g => g.type === 'devoir de classe');
                const dr = course.grades.find(g => g.type === 'devoir de recherche');
                const exam = course.grades.find(g => g.type === 'examen');
                
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

                const finalScoreOutOf20 = (nc * 0.4) + (examScore20 * 0.6);
                course.average = finalScoreOutOf20;
            }
        });

        return Object.values(courseMap).filter(c => c.grades.length > 0);

    }, [grades, allCourses]);

    const overallAverage = useMemo((): number => {
        if (coursesWithGrades.length === 0) return 0;
        
        const totalSum = coursesWithGrades.reduce((acc, course) => acc + course.average, 0);
        const totalCourses = coursesWithGrades.length;
        
        return totalCourses > 0 ? totalSum / totalCourses : 0;

    }, [coursesWithGrades]);


    const handleChildChange = (studentId: string) => {
        setSelectedChildId(studentId);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Mes Notes</h1>
                <p className="text-muted-foreground">
                    Consultez vos notes et résultats pour chaque matière.
                </p>
            </div>
             {currentUser?.role === 'parent' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sélection de l'enfant</CardTitle>
                        <CardDescription>
                            Choisissez l'enfant dont vous souhaitez consulter les notes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       {children.length > 0 ? (
                            <Select onValueChange={handleChildChange} value={selectedChildId || ""}>
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue placeholder="Sélectionner un enfant..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {children.map(child => (
                                        <SelectItem key={child.uid} value={child.uid}>
                                            {child.firstName} {child.lastName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                       ) : (
                           <p className="text-sm text-muted-foreground">Aucun enfant n'est associé à votre compte.</p>
                       )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Relevé de notes</CardTitle>
                        <CardDescription>
                            Voici le résumé de vos performances académiques.
                        </CardDescription>
                    </div>
                     {coursesWithGrades.length > 0 && (
                        <div className='text-right'>
                            <p className='text-lg text-muted-foreground'>Moyenne Générale</p>
                            <p className='font-bold text-3xl text-primary'>{overallAverage.toFixed(2)} / 20</p>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                   {loading ? (
                       <div className="flex items-center justify-center h-48">
                            <p>Chargement des notes...</p>
                        </div>
                   ) : coursesWithGrades.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {coursesWithGrades.map(course => (
                                <Card key={course.id} className="flex flex-col">
                                    <CardHeader>
                                        <div className='flex justify-between items-start'>
                                            <CardTitle className='font-semibold text-xl'>{course.name}</CardTitle>
                                            <div className='text-right'>
                                                <p className='text-sm text-muted-foreground'>Moyenne /20</p>
                                                <p className='font-bold text-2xl text-primary'>{course.average.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Type d'évaluation</TableHead>
                                                    <TableHead className="text-right">Note</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {course.grades.map(grade => (
                                                    <TableRow key={grade.id}>
                                                        <TableCell><Badge variant="outline" className="capitalize">{grade.type}</Badge></TableCell>
                                                        <TableCell className='font-medium text-right'>{grade.score}/{grade.total}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                    <CardFooter>
                                         <p className="text-xs text-muted-foreground">Crédit de la matière: {course.credit}</p>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                   ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[300px]">
                        <h3 className="text-xl font-bold tracking-tight">Aucune note disponible</h3>
                        <p className="text-sm text-muted-foreground">
                           {currentUser?.role === 'parent' ? "Veuillez d'abord sélectionner un enfant." : "Vos notes n'ont pas encore été publiées."}
                        </p>
                    </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}
