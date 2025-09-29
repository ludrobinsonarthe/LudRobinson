

"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Course, Field, Sector } from '@/lib/types';
import { collection, getDocs, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, FileDown } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { imageToDataUrl } from '@/lib/utils';


const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const timeSlots = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`); // 08:00 to 18:00

function ScheduleContent() {
    const { user: currentUser, allUsers, loading: userLoading, settings, fields, sectors, allCourses } = useUser();
    const searchParams = useSearchParams();
    const fieldIdFromParams = searchParams.get('fieldId');
    const { toast } = useToast();
    
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Filters state
    const [selectedSectorId, setSelectedSectorId] = useState('all');
    const [selectedFieldId, setSelectedFieldId] = useState('all');
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [selectedTeacherId, setSelectedTeacherId] = useState('all');
    
    useEffect(() => {
        let studentFieldId: string | null = null;
        if(currentUser?.role === 'student' && currentUser.student) {
            studentFieldId = currentUser.student.fieldId || null;
            setSelectedLevel(currentUser.student.level || 'all');
            const studentField = fields.find(f => f.id === studentFieldId);
            if (studentField) {
                setSelectedSectorId(studentField.sectorId);
                setSelectedFieldId(studentField.id);
            }
        }
        if(fieldIdFromParams) {
             const field = fields.find(f => f.id === fieldIdFromParams);
             if (field) {
                setSelectedFieldId(field.id);
                setSelectedSectorId(field.sectorId);
             }
        }
    }, [fieldIdFromParams, currentUser, fields]);

    useEffect(() => {
        if (!userLoading) {
            setCourses(allCourses);
            setLoading(false);
        }
    }, [allCourses, userLoading]);
    
    const teachers = useMemo(() => allUsers.filter(u => u.role === 'teacher'), [allUsers]);
    const availableFields = useMemo(() => {
        if (selectedSectorId === 'all') return fields;
        return fields.filter(f => f.sectorId === selectedSectorId);
    }, [selectedSectorId, fields]);
    
    useEffect(() => {
        // Reset field filter if the selected sector changes and the field is no longer valid
        if (!availableFields.some(f => f.id === selectedFieldId)) {
            setSelectedFieldId('all');
        }
    }, [selectedSectorId, availableFields, selectedFieldId]);

    const filteredCourses = useMemo(() => {
        let filtered = courses;

        if (selectedTeacherId !== 'all') {
            return filtered.filter(course => course.teacherId === selectedTeacherId);
        }

        if (selectedLevel !== 'all') {
            filtered = filtered.filter(c => c.level === selectedLevel);
        }
        
        if (selectedSectorId !== 'all') {
             if (selectedFieldId !== 'all' && selectedFieldId !== 'common_core') {
                // Specific field selected
                filtered = filtered.filter(c => c.fieldId === selectedFieldId);
            } else {
                 // Sector selected, but not a specific field (or "all fields" in that sector)
                 const fieldsInSector = fields.filter(f => f.sectorId === selectedSectorId).map(f => f.id);
                 filtered = filtered.filter(c => 
                    (c.sectorId === selectedSectorId && !c.fieldId) || // Common core for the sector
                    (c.fieldId && fieldsInSector.includes(c.fieldId)) // Course in one of the sector's fields
                 );
                 
                 if(selectedFieldId === 'common_core') {
                     filtered = filtered.filter(c => !c.fieldId);
                 }
            }
        }
        
        return filtered;
    }, [courses, selectedTeacherId, selectedLevel, selectedSectorId, selectedFieldId, fields]);


    const scheduleGrid = useMemo(() => {
        const grid: { [key: string]: { [key: string]: Course[] } } = {};
        daysOfWeek.forEach(day => {
            grid[day] = {};
            timeSlots.forEach(slot => {
                grid[day][slot] = [];
            });
        });

        filteredCourses.forEach(course => {
            course.schedule?.forEach(slot => {
                const startTimeHour = parseInt(slot.start.split(':')[0]);
                const timeSlotKey = `${startTimeHour.toString().padStart(2, '0')}:00`;

                if (grid[slot.day] && grid[slot.day][timeSlotKey]) {
                    grid[slot.day][timeSlotKey].push(course);
                }
            });
        });
        return grid;
    }, [filteredCourses]);
    
    const fieldsById = useMemo(() => (fields || []).reduce((acc, f) => ({ ...acc, [f.id]: f }), {} as Record<string, Field>), [fields]);
    
    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.lastName[0]}. ${teacher.firstName}` : 'N/A';
    }
    
    const handleExportPDF = async () => {
        toast({
            variant: "destructive",
            title: "Fonctionnalité désactivée",
            description: "L'exportation PDF est temporairement désactivée pour des raisons de stabilité.",
        });
    };


    const isStudentView = currentUser?.role === 'student';
    const pageLoading = loading || userLoading;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Emploi du Temps</h1>
                <p className="text-muted-foreground">
                    Consultez l'emploi du temps de la semaine. Les cours sont automatiquement intégrés dès leur planification.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
                         <div>
                            <CardTitle>Grille de la semaine</CardTitle>
                            <CardDescription>
                               {isStudentView && currentUser.student ? `Emploi du temps pour ${currentUser.student.level}` : "Vue hebdomadaire des cours planifiés."}
                            </CardDescription>
                         </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            {!isStudentView && (
                                <>
                                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Filtrer par professeur" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les professeurs</SelectItem>
                                        {(teachers || []).map(t => <SelectItem key={t.uid} value={t.uid}>{t.lastName} {t.firstName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Filtrer par niveau" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les niveaux</SelectItem>
                                        {(settings?.levels || []).map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Filtrer par secteur" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les secteurs</SelectItem>
                                        {(sectors || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                 <Select value={selectedFieldId} onValueChange={setSelectedFieldId} disabled={selectedSectorId === 'all'}>
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue placeholder="Filtrer par filière" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les filières</SelectItem>
                                         <SelectItem value="common_core">Tronc Commun</SelectItem>
                                        {(availableFields || []).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                </>
                            )}
                             <Button variant="outline" onClick={handleExportPDF}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Exporter en PDF
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, -7))}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold text-sm text-center min-w-[180px]">
                                    Semaine du {format(currentWeek, 'd MMMM yyyy', { locale: fr })}
                                </span>
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, 7))}>
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                       {pageLoading ? (
                           <div className="space-y-2 p-4">
                               <Skeleton className="h-12 w-full" />
                               <Skeleton className="h-28 w-full" />
                               <Skeleton className="h-28 w-full" />
                               <Skeleton className="h-28 w-full" />
                           </div>
                       ) : (
                        <Table className="min-w-full border-collapse">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px] border-r">Heure</TableHead>
                                    {daysOfWeek.map((day, index) => (
                                        <TableHead key={day} className="border-r text-center">
                                            <div className="flex flex-col items-center">
                                                <span>{day}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(addDays(currentWeek, index), 'dd/MM')}
                                                </span>
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timeSlots.map(slot => (
                                    <TableRow key={slot} className="h-28">
                                        <TableCell className="font-medium align-top pt-3 border-r">{slot}</TableCell>
                                        {daysOfWeek.map(day => (
                                            <TableCell key={day} className="p-1 align-top border-r">
                                                {scheduleGrid[day][slot].map(course => {
                                                    const scheduleInfo = course.schedule?.find(s => s.day === day && s.start.startsWith(slot.slice(0, 2)));
                                                    return (
                                                     <div key={course.id} className="bg-primary/10 border border-primary/20 p-2 rounded-lg text-xs mb-1 hover:bg-primary/20 transition-colors">
                                                        <Link href={`/dashboard/course-management?courseId=${course.id}`}>
                                                            <p className="font-bold text-primary truncate">{course.name}</p>
                                                            <p className="text-muted-foreground">{getTeacherName(course.teacherId)}</p>
                                                             {scheduleInfo && <p className="text-muted-foreground">{scheduleInfo.start} - {scheduleInfo.end}</p>}
                                                            <p className="text-muted-foreground">Salle: {scheduleInfo?.room}</p>
                                                        </Link>
                                                     </div>
                                                    )
                                                })}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                       )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function SchedulePage() {
    return (
        <Suspense fallback={<div>Chargement de l'emploi du temps...</div>}>
            <ScheduleContent />
        </Suspense>
    );
}

    
