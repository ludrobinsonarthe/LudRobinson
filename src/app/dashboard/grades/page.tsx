
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Grade, Course } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface CourseWithGrades extends Course {
    grades: Grade[];
    average: number;
}

export default function GradesPage() {
    const { user: currentUser } = useUser();
    const [grades, setGrades] = useState<Grade[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser || !currentUser.uid) {
            setLoading(false);
            return;
        }

        setLoading(true);
        // Fetch grades for the current student
        const gradesQuery = query(collection(db, "grades"), where("studentId", "==", currentUser.uid));
        const unsubscribeGrades = onSnapshot(gradesQuery, (snapshot) => {
            const studentGrades: Grade[] = [];
            snapshot.forEach((doc) => {
                studentGrades.push({ id: doc.id, ...doc.data() } as Grade);
            });
            setGrades(studentGrades);
        }, (error) => {
            console.error("Error fetching grades: ", error);
        });

        // Fetch all courses to get course names
        const coursesQuery = query(collection(db, "courses"));
        const unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
            const allCourses: Course[] = [];
            snapshot.forEach((doc) => {
                allCourses.push({ id: doc.id, ...doc.data() } as Course);
            });
            setCourses(allCourses);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching courses: ", error);
            setLoading(false);
        });

        return () => {
            unsubscribeGrades();
            unsubscribeCourses();
        };
    }, [currentUser]);

    const coursesWithGrades = useMemo((): CourseWithGrades[] => {
        if (grades.length === 0 || courses.length === 0) return [];

        const courseMap: { [key: string]: CourseWithGrades } = {};

        courses.forEach(course => {
            courseMap[course.id] = { ...course, grades: [], average: 0 };
        });

        grades.forEach(grade => {
            if (courseMap[grade.courseId]) {
                courseMap[grade.courseId].grades.push(grade);
            }
        });
        
        Object.values(courseMap).forEach(course => {
            if(course.grades.length > 0) {
                const totalScore = course.grades.reduce((acc, g) => acc + (g.score * g.coefficient), 0);
                const totalCoeff = course.grades.reduce((acc, g) => acc + g.coefficient, 0);
                course.average = totalCoeff > 0 ? totalScore / totalCoeff : 0;
            }
        });

        return Object.values(courseMap).filter(c => c.grades.length > 0);

    }, [grades, courses]);

    const overallAverage = useMemo((): number => {
        if (coursesWithGrades.length === 0) return 0;
        
        const totalWeightedScore = coursesWithGrades.reduce((acc, course) => acc + course.average, 0);
        
        return totalWeightedScore / coursesWithGrades.length;

    }, [coursesWithGrades]);


     if (currentUser?.role === 'parent') {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[calc(100vh-12rem)]">
                <h3 className="text-2xl font-bold tracking-tight">Accès non autorisé</h3>
                <p className="text-sm text-muted-foreground">
                    Cette section est réservée aux étudiants et administrateurs.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Mes Notes</h1>
                <p className="text-muted-foreground">
                    Consultez vos notes et résultats pour chaque matière.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Relevé de notes</CardTitle>
                    <CardDescription>
                        Voici le résumé de vos performances académiques.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {loading ? (
                       <div className="flex items-center justify-center h-48">
                            <p>Chargement de vos notes...</p>
                        </div>
                   ) : coursesWithGrades.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full" defaultValue={coursesWithGrades[0]?.id}>
                            {coursesWithGrades.map(course => (
                                <AccordionItem value={course.id} key={course.id}>
                                    <AccordionTrigger>
                                        <div className='flex justify-between items-center w-full pr-4'>
                                            <span className='font-semibold text-lg'>{course.name}</span>
                                            <div className='text-right'>
                                                <p className='text-sm text-muted-foreground'>Moyenne</p>
                                                <p className='font-bold text-xl'>{course.average.toFixed(2)}/20</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Note</TableHead>
                                                    <TableHead className="text-right">Coefficient</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {course.grades.map(grade => (
                                                    <TableRow key={grade.id}>
                                                        <TableCell><Badge variant="outline">{grade.type === 'devoir' ? 'Devoir' : 'Examen'}</Badge></TableCell>
                                                        <TableCell className='font-medium'>{grade.score}/{grade.total}</TableCell>
                                                        <TableCell className="text-right">{grade.coefficient}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                   ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <h3 className="text-xl font-bold tracking-tight">Aucune note disponible</h3>
                        <p className="text-sm text-muted-foreground">
                           Vos notes n'ont pas encore été publiées, ou vous n'êtes pas un étudiant.
                        </p>
                    </div>
                   )}
                </CardContent>
                {coursesWithGrades.length > 0 && (
                     <CardFooter className="flex justify-end">
                        <div className='text-right'>
                            <p className='text-lg text-muted-foreground'>Moyenne générale</p>
                            <p className='font-bold text-3xl text-primary'>{overallAverage.toFixed(2)}/20</p>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
