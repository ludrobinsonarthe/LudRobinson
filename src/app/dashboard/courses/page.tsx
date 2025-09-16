
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Course, User } from '@/lib/types';
import { useUser } from '@/hooks/use-user';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BookOpenCheck } from 'lucide-react';


export default function CoursesPage() {
    const { user: currentUser, users } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);

    const getTeacherName = (teacherId?: string) => {
        if (!teacherId) return "N/A";
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : "Inconnu";
    }

    useEffect(() => {
        if (!currentUser || currentUser.role !== 'student' || !currentUser.student?.fieldId) {
            setLoading(false);
            setCourses([]);
            return;
        }

        setLoading(true);
        const q = query(collection(db, "courses"), where("fieldId", "==", currentUser.student.fieldId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const studentCourses: Course[] = [];
            snapshot.forEach((doc) => {
                studentCourses.push({ id: doc.id, ...doc.data() } as Course);
            });
            setCourses(studentCourses);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching student courses: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);


    if (currentUser?.role !== 'student') {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[calc(100vh-12rem)]">
                <h3 className="text-2xl font-bold tracking-tight">Accès non autorisé</h3>
                <p className="text-sm text-muted-foreground">
                    Seuls les étudiants peuvent accéder à cette page.
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Mes Cours</h1>
                <p className="text-muted-foreground">
                    Consultez la liste de vos cours inscrits pour l'année académique en cours.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des cours</CardTitle>
                    <CardDescription>
                        Cliquez sur un cours pour voir les détails (à venir).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <p>Chargement de vos cours...</p>
                        </div>
                   ) : courses.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {courses.map(course => (
                            <Card key={course.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-xl">{course.name}</CardTitle>
                                        <BookOpenCheck className="h-6 w-6 text-primary" />
                                    </div>
                                    <CardDescription>
                                        Prof: {getTeacherName(course.teacherId)}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {course.description || "Aucune description pour ce cours."}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <h3 className="text-xl font-bold tracking-tight">Aucun cours trouvé</h3>
                        <p className="text-sm text-muted-foreground">
                           Aucun cours ne correspond à votre filière pour le moment.
                        </p>
                    </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}
