
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Course, User } from '@/lib/types';
import { useUser } from '@/hooks/use-user';
import { collection, query, where, onSnapshot, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BookOpenCheck, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function CoursesPage() {
    const { user: currentUser, users } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
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

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);

    const getTeacherName = (teacherId?: string) => {
        if (!teacherId) return "N/A";
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : "Inconnu";
    }

    useEffect(() => {
        if (!studentToView || !studentToView.student?.fieldId) {
            setLoading(false);
            setCourses([]);
            return;
        }

        setLoading(true);
        const q = query(collection(db, "courses"), where("fieldId", "==", studentToView.student.fieldId));
        
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
    }, [studentToView]);

    const handleChildChange = (studentId: string) => {
        setSelectedChildId(studentId);
    }
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Mes Cours</h1>
                <p className="text-muted-foreground">
                    Consultez la liste des cours inscrits pour l'année académique en cours.
                </p>
            </div>

            {currentUser?.role === 'parent' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sélection de l'enfant</CardTitle>
                        <CardDescription>
                            Choisissez l'enfant dont vous souhaitez consulter les cours.
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
                <CardHeader>
                    <CardTitle>Liste des cours</CardTitle>
                    <CardDescription>
                        Cliquez sur un cours pour voir les détails (à venir).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <p>Chargement des cours...</p>
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
                                {course.documents && course.documents.length > 0 && (
                                    <CardFooter>
                                        <Button asChild variant="secondary" className="w-full">
                                            <a href={course.documents[0]} target="_blank" rel="noopener noreferrer">
                                                <FileText className="mr-2 h-4 w-4" />
                                                Voir le document du cours
                                            </a>
                                        </Button>
                                    </CardFooter>
                                )}
                            </Card>
                        ))}
                    </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <h3 className="text-xl font-bold tracking-tight">Aucun cours trouvé</h3>
                        <p className="text-sm text-muted-foreground">
                           {currentUser?.role === 'parent' ? "Veuillez d'abord sélectionner un enfant." : "Aucun cours ne correspond à votre filière pour le moment ou vous n'êtes pas un étudiant."}
                        </p>
                    </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}
