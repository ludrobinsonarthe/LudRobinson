

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Course, Field, Sector, Cycle, ActivityLog } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, ClipboardList, CalendarDays, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import UserDeleteDialog from "@/components/user-delete-dialog";
import CourseFormDialog from "@/components/course-form-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

export default function CourseManagementPage() {
    const { allUsers: users, settings, loading, fields, sectors, user } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const { toast } = useToast();

    // Filters state
    const [nameFilter, setNameFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [sectorFilter, setSectorFilter] = useState("all");
    const [fieldFilter, setFieldFilter] = useState("all");
    const [cycleFilter, setCycleFilter] = useState("all");
    
    useEffect(() => {
        if (user?.role !== 'admin') {
            setLoadingCourses(false);
            return;
        }
        setLoadingCourses(true);
        const unsub = onSnapshot(collection(db, 'courses'), snapshot => {
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
            setLoadingCourses(false);
        });
        return () => unsub();
    }, [user]);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const fieldsById = useMemo(() => (fields || []).reduce((acc, f) => ({...acc, [f.id]: f}), {} as Record<string, Field>), [fields]);
    const sectorsById = useMemo(() => (sectors || []).reduce((acc, s) => ({...acc, [s.id]: s}), {} as Record<string, Sector>), [sectors]);

    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.lastName} ${teacher.firstName}` : 'Non assigné';
    }

    const getFieldInfo = (course: Course) => {
        if (course.fieldId) {
            const field = fieldsById[course.fieldId];
            if (!field) return { fieldName: 'N/A', sectorName: 'N/A' };
            const sector = sectorsById[field.sectorId];
            return { fieldName: field.name, sectorName: sector?.name || 'N/A' };
        }
        if (course.sectorId) {
            const sector = sectorsById[course.sectorId];
            return { fieldName: 'Tronc Commun', sectorName: sector?.name || 'N/A' };
        }
        return { fieldName: 'N/A', sectorName: 'N/A' };
    }
    
    const availableFields = useMemo(() => {
        if (sectorFilter === 'all') return fields;
        return (fields || []).filter(f => f.sectorId === sectorFilter);
    }, [sectorFilter, fields]);

    useEffect(() => {
        if (!availableFields.some(f => f.id === fieldFilter)) {
            setFieldFilter("all");
        }
    }, [sectorFilter, availableFields, fieldFilter]);

    const filteredCourses = useMemo(() => {
        return courses.filter(course => {
            const courseField = course.fieldId ? fieldsById[course.fieldId] : null;
            const courseSectorId = course.sectorId || courseField?.sectorId;
    
            return (
                (nameFilter === "" || course.name.toLowerCase().includes(nameFilter.toLowerCase())) &&
                (levelFilter === "all" || course.level === levelFilter) &&
                (cycleFilter === "all" || course.cycle === cycleFilter) &&
                (sectorFilter === "all" || courseSectorId === sectorFilter) &&
                (fieldFilter === "all" || 
                    (fieldFilter === "common_core" && !course.fieldId && courseSectorId === sectorFilter) ||
                    (course.fieldId === fieldFilter)
                )
            );
        });
    }, [courses, nameFilter, levelFilter, sectorFilter, fieldFilter, cycleFilter, fieldsById]);

    const handleAdd = () => {
        setSelectedCourse(null);
        setIsFormOpen(true);
    }

    const handleEdit = (course: Course) => {
        setSelectedCourse(course);
        setIsFormOpen(true);
    }

    const handleDelete = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteOpen(true);
    }

    const handleSave = async (courseData: Partial<Course>) => {
        try {
            const batch = writeBatch(db);
            const logRef = doc(collection(db, 'activityLogs'));
            let action: 'course_created' | 'course_updated' = 'course_created';
            let courseId: string;

            if (selectedCourse) {
                action = 'course_updated';
                courseId = selectedCourse.id;
                const courseRef = doc(db, "courses", courseId);
                batch.set(courseRef, courseData, { merge: true });
                toast({ title: "Cours mis à jour", description: "Les informations du cours ont été mises à jour."});
            } else {
                const newCourseRef = doc(collection(db, "courses"));
                courseId = newCourseRef.id;
                batch.set(newCourseRef, courseData);
                toast({ title: "Cours ajouté", description: "Le nouveau cours a été créé."});
            }
            
            if (user) {
                const log: Omit<ActivityLog, 'id'> = {
                    actorId: user.uid,
                    actorName: `${user.lastName} ${user.firstName}`,
                    action: action,
                    entityType: 'course',
                    entityId: courseId,
                    timestamp: new Date().toISOString(),
                    details: `${action === 'course_created' ? 'A créé le cours' : 'A mis à jour le cours'}: "${courseData.name}"`,
                };
                batch.set(logRef, log);
            }
            
            await batch.commit();

        } catch(error) {
            console.error("Error saving course: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le cours." });
        } finally {
            setIsFormOpen(false);
        }
    }
    
    const confirmDelete = async () => {
        if(!selectedCourse || !user) return;
        
        const batch = writeBatch(db);
        try {
            const courseRef = doc(db, "courses", selectedCourse.id)
            batch.delete(courseRef);
            
            const logRef = doc(collection(db, 'activityLogs'));
            const log: Omit<ActivityLog, 'id'> = {
                actorId: user.uid,
                actorName: `${user.lastName} ${user.firstName}`,
                action: 'course_deleted',
                entityType: 'course',
                entityId: selectedCourse.id,
                timestamp: new Date().toISOString(),
                details: `A supprimé le cours: "${selectedCourse.name}"`,
            };
            batch.set(logRef, log);
            
            await batch.commit();
            toast({ title: "Cours supprimé" });
        } catch (error) {
            console.error("Error deleting course: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le cours." });
        } finally {
            setIsDeleteOpen(false);
            setSelectedCourse(null);
        }
    }

    const pageIsLoading = loading || loadingCourses;

    if (user?.role !== 'admin') {
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                 <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Cours et Horaires</h1>
                    <p className="text-muted-foreground">
                        Créez, modifiez et gérez les cours de l'institut et leurs emplois du temps.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/schedule">
                            <CalendarDays className="mr-2 h-4 w-4" />
                            Voir l'emploi du temps
                        </Link>
                    </Button>
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Ajouter un cours
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des cours</CardTitle>
                    <CardDescription>
                        Filtrez, recherchez, ajoutez ou modifiez les informations et les horaires des cours.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-wrap items-center gap-4 mb-6">
                        <Input 
                            placeholder="Rechercher par nom..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par niveau" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les niveaux</SelectItem>
                                {(settings?.levels || []).map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={cycleFilter} onValueChange={setCycleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par cycle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les cycles</SelectItem>
                                {cycles.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={sectorFilter} onValueChange={setSectorFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par secteur" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les secteurs</SelectItem>
                                {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fieldFilter} onValueChange={setFieldFilter} disabled={sectorFilter === 'all'}>
                            <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Filtrer par filière" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les filières</SelectItem>
                                <SelectItem value="common_core">Tronc Commun</SelectItem>
                                {availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom du cours</TableHead>
                                <TableHead>Professeur</TableHead>
                                <TableHead>Filière / Tronc Commun</TableHead>
                                <TableHead>Crédit</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageIsLoading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredCourses.length > 0 ? filteredCourses.map(course => {
                                const { fieldName } = getFieldInfo(course);
                                return (
                                <TableRow key={course.id}>
                                    <TableCell className="font-medium">{course.name}</TableCell>
                                    <TableCell>{getTeacherName(course.teacherId)}</TableCell>
                                    <TableCell>{fieldName}</TableCell>
                                    <TableCell>{course.credit}</TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem onClick={() => handleEdit(course)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifier
                                               </DropdownMenuItem>
                                               <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/grade-management?courseId=${course.id}`}>
                                                        <ClipboardList className="mr-2 h-4 w-4" />
                                                        Gérer les notes
                                                    </Link>
                                                </DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => handleDelete(course)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Aucun cours trouvé pour les filtres actuels.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CourseFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                course={selectedCourse}
                teachers={teachers}
                sectors={sectors}
                fields={fields}
            />
            {selectedCourse && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    item={{id: selectedCourse.id, name: selectedCourse.name}}
                    title="Supprimer ce cours ?"
                />
            )}
        </div>
    );
}
