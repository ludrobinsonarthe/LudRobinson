

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
import { Course, Field, Sector, Cycle, ActivityLog, User, Grade } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, ClipboardList, CalendarDays, Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, writeBatch, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

export default function CourseManagementPage() {
    const { user, hasPermission } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [fields, setFields] = useState<Field[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);

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
        if (!hasPermission('manage_course')) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsubs: (()=>void)[] = [];
        unsubs.push(onSnapshot(collection(db, 'courses'), snap => setCourses(snap.docs.map(d => ({id: d.id, ...d.data()} as Course)))));
        unsubs.push(onSnapshot(collection(db, 'users'), snap => setAllUsers(snap.docs.map(d => d.data() as User))));
        unsubs.push(onSnapshot(collection(db, 'fields'), snap => setFields(snap.docs.map(d => ({id: d.id, ...d.data()} as Field)))));
        unsubs.push(onSnapshot(collection(db, 'sectors'), snap => setSectors(snap.docs.map(d => ({id: d.id, ...d.data()} as Sector)))));
        unsubs.push(onSnapshot(doc(db, 'settings', 'system'), snap => setSettings(snap.data())));
        
        const timer = setTimeout(() => setLoading(false), 500);
        unsubs.push(() => clearTimeout(timer));

        return () => unsubs.forEach(unsub => unsub());
    }, [user, hasPermission]);

    const teachers = useMemo(() => allUsers.filter(u => u.role === 'teacher'), [allUsers]);
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

    const handleDelete = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteOpen(true);
    }
    
    const confirmDelete = async () => {
        if(!selectedCourse || !user) return;
        
        const batch = writeBatch(db);
        try {
            // 1. Delete course document
            const courseRef = doc(db, "courses", selectedCourse.id)
            batch.delete(courseRef);

            // 2. Query and delete all related grades
            const gradesQuery = query(collection(db, "grades"), where("courseId", "==", selectedCourse.id));
            const gradesSnapshot = await getDocs(gradesQuery);
            gradesSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // 3. Log the action
            const logRef = doc(collection(db, 'activityLogs'));
            const log: Omit<ActivityLog, 'id'> = {
                actorId: user.uid,
                actorName: `${user.lastName} ${user.firstName}`,
                action: 'course_deleted',
                entityType: 'course',
                entityId: selectedCourse.id,
                timestamp: new Date().toISOString(),
                details: `A supprimé le cours: "${selectedCourse.name}" et ${gradesSnapshot.size} notes associées.`,
            };
            batch.set(logRef, log);
            
            await batch.commit();
            toast({ title: "Cours et notes associées supprimés" });
        } catch (error) {
            console.error("Error deleting course: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le cours." });
        } finally {
            setIsDeleteOpen(false);
            setSelectedCourse(null);
        }
    }

    if (!hasPermission('manage_course')) {
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
            <div className="flex justify-between items-start flex-wrap gap-4">
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
                    <Button asChild>
                        <Link href="/dashboard/course-management/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Ajouter un cours
                        </Link>
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
                     <div className="flex flex-wrap items-center gap-2 mb-6">
                        <Input 
                            placeholder="Rechercher par nom..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrer par niveau" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les niveaux</SelectItem>
                                {(settings?.levels || []).map((l: any) => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={cycleFilter} onValueChange={setCycleFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrer par cycle" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les cycles</SelectItem>
                                {cycles.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={sectorFilter} onValueChange={setSectorFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrer par secteur" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les secteurs</SelectItem>
                                {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fieldFilter} onValueChange={setFieldFilter} disabled={sectorFilter === 'all'}>
                            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Filtrer par filière" /></SelectTrigger>
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
                                <TableHead className="hidden sm:table-cell">Professeur</TableHead>
                                <TableHead className="hidden md:table-cell">Filière / Tronc Commun</TableHead>
                                <TableHead>Crédit</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredCourses.length > 0 ? filteredCourses.map(course => {
                                const { fieldName } = getFieldInfo(course);
                                return (
                                <TableRow key={course.id}>
                                    <TableCell className="font-medium">{course.name}</TableCell>
                                    <TableCell className="hidden sm:table-cell">{getTeacherName(course.teacherId)}</TableCell>
                                    <TableCell className="hidden md:table-cell">{fieldName}</TableCell>
                                    <TableCell>{course.credit}</TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/course-management/${course.id}`}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Modifier
                                                    </Link>
                                               </DropdownMenuItem>
                                               {hasPermission('manage_grades') && (
                                                <DropdownMenuItem asChild>
                                                        <Link href={`/dashboard/grade-management?courseId=${course.id}`}>
                                                            <ClipboardList className="mr-2 h-4 w-4" />
                                                            Gérer les notes
                                                        </Link>
                                                    </DropdownMenuItem>
                                               )}
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
            
            {selectedCourse && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    item={{id: selectedCourse.id, name: selectedCourse.name}}
                    title="Supprimer ce cours ?"
                    description={`Le cours "${selectedCourse.name}" et toutes les notes associées seront définitivement supprimés. Cette action est irréversible.`}
                />
            )}
        </div>
    );
}
