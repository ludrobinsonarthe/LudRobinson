

"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Course, User } from '@/lib/types';
import { useUser } from '@/hooks/use-user';
import { collection, query, where, getDocs, onSnapshot, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BookOpenCheck, FileText, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function CoursesPage() {
    const { user: currentUser, allUsers: users, allCourses, loading, fields } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [pageLoading, setPageLoading] = useState(true);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

    const children = useMemo(() => {
        if (currentUser?.role !== 'parent' || !users) return [];
        return users.filter(u => currentUser.parent?.childrenUids.includes(u.uid));
    }, [currentUser, users]);

    const userToView = useMemo(() => {
        if (!users) return null;
        if (currentUser?.role === 'student' || currentUser?.role === 'teacher') return currentUser;
        if (currentUser?.role === 'parent') return users.find(u => u.uid === selectedChildId);
        return null;
    }, [currentUser, users, selectedChildId]);
    
    useEffect(() => {
        if (currentUser?.role === 'parent' && children.length > 0 && !selectedChildId) {
            setSelectedChildId(children[0].uid);
        }
    }, [currentUser, children, selectedChildId]);

    const teachers = useMemo(() => (users || []).filter(u => u.role === 'teacher'), [users]);

    const getTeacherName = (teacherId?: string) => {
        if (!teacherId) return "N/A";
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.lastName} ${teacher.firstName}` : "Inconnu";
    }

    useEffect(() => {
        if (loading) return;

        if (!userToView) {
            setPageLoading(false);
            setCourses([]);
            return;
        }

        setPageLoading(true);
        let userCourses: Course[] = [];
        if (userToView.role === 'student' && userToView.student) {
            const studentField = fields.find(f => f.id === userToView.student!.fieldId);
            const studentSectorId = userToView.student.sectorId || studentField?.sectorId;
            userCourses = allCourses.filter(c => c.level === userToView.student!.level && (c.fieldId === userToView.student!.fieldId || (!c.fieldId && c.sectorId === studentSectorId)));
        } else if (userToView.role === 'teacher') {
            userCourses = allCourses.filter(c => c.teacherId === userToView.uid);
        }
        
        setCourses(userCourses);
        setPageLoading(false);
        
    }, [userToView, allCourses, loading, fields]);

    const handleChildChange = (studentId: string) => {
        setSelectedChildId(studentId);
    }
    
    const pageTitle = currentUser?.role === 'teacher' ? "Mes Cours Assignés" : "Mes Cours";
    const pageDescription = currentUser?.role === 'teacher' 
        ? "Consultez la liste des cours que vous enseignez."
        : "Consultez la liste des cours inscrits pour l'année académique en cours.";
    
    const emptyStateTitle = currentUser?.role === 'teacher' ? "Aucun cours assigné" : "Aucun cours trouvé";
    const emptyStateDescription = () => {
        switch(currentUser?.role) {
            case 'teacher':
                return "Aucun cours ne vous a été assigné pour le moment.";
            case 'parent':
                 return "Veuillez d'abord sélectionner un enfant.";
            case 'student':
                 return "Aucun cours ne correspond à votre filière pour le moment.";
            default:
                return "Pas de cours à afficher.";
        }
    }


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">{pageTitle}</h1>
                <p className="text-muted-foreground">
                    {pageDescription}
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
                                            {child.lastName} {child.firstName}
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
                   {pageLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                                        {currentUser?.role !== 'teacher' && `Prof: ${getTeacherName(course.teacherId)}`}
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
                        <h3 className="text-xl font-bold tracking-tight">{emptyStateTitle}</h3>
                        <p className="text-sm text-muted-foreground">
                           {emptyStateDescription()}
                        </p>
                    </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}
