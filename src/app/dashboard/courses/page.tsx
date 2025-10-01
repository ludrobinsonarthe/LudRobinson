
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Course, User } from '@/lib/types';
import { useUser } from '@/hooks/use-user';
import { collection, query, where, getDocs, onSnapshot, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BookOpenCheck, Download, Loader2, Files, MoreHorizontal, ClipboardList, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export default function CoursesPage() {
    const { user: currentUser } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [fields, setFields] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsubs: (()=>void)[] = [];
        unsubs.push(onSnapshot(collection(db, 'users'), snap => setAllUsers(snap.docs.map(d => d.data() as User))));
        unsubs.push(onSnapshot(collection(db, 'courses'), snap => setCourses(snap.docs.map(d => ({id: d.id, ...d.data()} as Course)))));
        unsubs.push(onSnapshot(collection(db, 'fields'), snap => setFields(snap.docs.map(d => ({id: d.id, ...d.data()})))));

        const timer = setTimeout(() => setLoading(false), 500);
        unsubs.push(() => clearTimeout(timer));

        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const children = useMemo(() => {
        if (currentUser?.role !== 'parent' || !allUsers) return [];
        return allUsers.filter(u => currentUser.parent?.childrenUids.includes(u.uid));
    }, [currentUser, allUsers]);

    const userToView = useMemo(() => {
        if (!allUsers) return null;
        if (currentUser?.role === 'student' || currentUser?.role === 'teacher') return currentUser;
        if (currentUser?.role === 'parent') return allUsers.find(u => u.uid === selectedChildId);
        return null;
    }, [currentUser, allUsers, selectedChildId]);
    
    useEffect(() => {
        if (currentUser?.role === 'parent' && children.length > 0 && !selectedChildId) {
            setSelectedChildId(children[0].uid);
        }
    }, [currentUser, children, selectedChildId]);

    const userCourses = useMemo(() => {
        if (!userToView || courses.length === 0) return [];
        
        if (userToView.role === 'student' && userToView.student) {
            const studentField = fields.find(f => f.id === userToView.student!.fieldId);
            const studentSectorId = userToView.student.sectorId || studentField?.sectorId;
            return courses.filter(c => c.level === userToView.student!.level && (c.fieldId === userToView.student!.fieldId || (!c.fieldId && c.sectorId === studentSectorId)));
        } else if (userToView.role === 'teacher') {
            return courses.filter(c => c.teacherId === userToView.uid);
        }
        return [];
    }, [userToView, courses, fields]);

    const teachers = useMemo(() => (allUsers || []).filter(u => u.role === 'teacher'), [allUsers]);

    const getTeacherName = (teacherId?: string) => {
        if (!teacherId) return "N/A";
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.lastName} ${teacher.firstName}` : "Inconnu";
    }

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
                                <SelectTrigger className="w-full sm:w-[280px]">
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
                   {loading ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from({length:3}).map((_, i) => (
                                <Card key={i}>
                                    <CardHeader><Skeleton className="h-6 w-3/4"/></CardHeader>
                                    <CardContent><Skeleton className="h-10 w-full"/></CardContent>
                                </Card>
                            ))}
                        </div>
                   ) : userCourses.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {userCourses.map(course => (
                            <Card key={course.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <CardTitle className="text-xl">{course.name}</CardTitle>
                                         {currentUser?.role === 'teacher' ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/grade-management?courseId=${course.id}`}>
                                                            <ClipboardList className="mr-2 h-4 w-4" />
                                                            Gérer les notes
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/course-management/${course.id}`}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Modifier le cours
                                                        </Link>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <BookOpenCheck className="h-6 w-6 text-primary" />
                                        )}
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
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="secondary" className="w-full">
                                                    <Files className="mr-2 h-4 w-4" />
                                                    Voir les documents du cours ({course.documents.length})
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {course.documents.map((docUrl, index) => (
                                                    <DropdownMenuItem key={index} asChild>
                                                        <a href={docUrl} target="_blank" rel="noopener noreferrer">
                                                            <Download className="mr-2 h-4 w-4" />
                                                            {decodeURIComponent(docUrl.split('/').pop()?.split('?')[0].replace(/%20/g, ' ') || `Document ${index + 1}`)}
                                                        </a>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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
