
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Course, Field, Sector, Cycle, User, Settings } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

function AllCoursesContent() {
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [fields, setFields] = useState<Field[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [loading, setLoading] = useState(true);
    
    const searchParams = useSearchParams();
    const courseIdFilter = searchParams.get('courseId');
    
    // Filters state
    const [nameFilter, setNameFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [sectorFilter, setSectorFilter] = useState("all");
    const [fieldFilter, setFieldFilter] = useState("all");
    const [cycleFilter, setCycleFilter] = useState("all");

    useEffect(() => {
        setLoading(true);
        const unsubs: (()=>void)[] = [];
        unsubs.push(onSnapshot(collection(db, 'courses'), snap => setAllCourses(snap.docs.map(d => ({id: d.id, ...d.data()} as Course)))));
        unsubs.push(onSnapshot(collection(db, 'users'), snap => setAllUsers(snap.docs.map(d => d.data() as User))));
        unsubs.push(onSnapshot(collection(db, 'fields'), snap => setFields(snap.docs.map(d => ({id: d.id, ...d.data()} as Field)))));
        unsubs.push(onSnapshot(collection(db, 'sectors'), snap => setSectors(snap.docs.map(d => ({id: d.id, ...d.data()} as Sector)))));
        unsubs.push(onSnapshot(doc(db, 'settings', 'system'), snap => setSettings(snap.data() as Settings)));
        
        const timer = setTimeout(() => setLoading(false), 500);
        unsubs.push(() => clearTimeout(timer));

        return () => unsubs.forEach(unsub => unsub());
    }, []);
    
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
        return allCourses.filter(course => {
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
    }, [allCourses, nameFilter, levelFilter, sectorFilter, fieldFilter, cycleFilter, fieldsById]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                 <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Explorer les Cours</h1>
                    <p className="text-muted-foreground">
                        Découvrez tous les cours offerts par l'institut, par secteur, filière et niveau.
                    </p>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste de tous les cours</CardTitle>
                    <CardDescription>
                        Utilisez les filtres pour affiner votre recherche.
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
                                <TableHead className="hidden md:table-cell">Filière / Secteur</TableHead>
                                <TableHead>Niveau</TableHead>
                                <TableHead>Crédit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredCourses.length > 0 ? filteredCourses.map(course => {
                                const { fieldName, sectorName } = getFieldInfo(course);
                                return (
                                <TableRow key={course.id}>
                                    <TableCell className="font-medium">{course.name}</TableCell>
                                    <TableCell className="hidden sm:table-cell">{getTeacherName(course.teacherId)}</TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div>
                                            <p className="font-medium">{fieldName}</p>
                                            <p className="text-xs text-muted-foreground">{sectorName}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="secondary">{course.level}</Badge></TableCell>
                                    <TableCell>{course.credit}</TableCell>
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
        </div>
    );
}

export default function AllCoursesPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <AllCoursesContent />
        </Suspense>
    )
}
