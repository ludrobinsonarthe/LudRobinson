
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Course, Field, Sector } from '@/lib/types';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mockSectors, mockFields } from '@/lib/mock-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import Link from 'next/link';

const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const timeSlots = Array.from({ length: 6 }, (_, i) => `${8 + i * 2}:00`); // 8:00, 10:00, ..., 18:00

function ScheduleContent() {
    const { user: currentUser, users } = useUser();
    const searchParams = useSearchParams();
    const fieldIdFromParams = searchParams.get('fieldId');
    
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Filters state
    const [selectedFieldId, setSelectedFieldId] = useState('all');
    
    useEffect(() => {
        let studentFieldId: string | null = null;
        if(currentUser?.role === 'student' && currentUser.student?.fieldId) {
            studentFieldId = currentUser.student.fieldId;
        }
        setSelectedFieldId(fieldIdFromParams || studentFieldId || 'all');
    }, [fieldIdFromParams, currentUser]);

    useEffect(() => {
        const q = query(collection(db, "courses"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const coursesFromDb: Course[] = [];
            snapshot.forEach((doc) => {
                coursesFromDb.push({ id: doc.id, ...doc.data() } as Course);
            });
            setCourses(coursesFromDb);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const filteredCourses = useMemo(() => {
        if (selectedFieldId === 'all') return courses;
        return courses.filter(course => course.fieldId === selectedFieldId);
    }, [courses, selectedFieldId]);


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
                const startTime = slot.start.split(':')[0] + ':00';
                if (grid[slot.day] && grid[slot.day][startTime]) {
                    grid[slot.day][startTime].push(course);
                }
            });
        });
        return grid;
    }, [filteredCourses]);
    
    const fieldsById = useMemo(() => mockFields.reduce((acc, f) => ({ ...acc, [f.id]: f }), {} as Record<string, Field>), []);
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.firstName[0]}. ${teacher.lastName}` : 'N/A';
    }


    const isStudentView = currentUser?.role === 'student';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Emploi du Temps</h1>
                <p className="text-muted-foreground">
                    Consultez l'emploi du temps de la semaine.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                         <div>
                            <CardTitle>Grille de la semaine</CardTitle>
                            <CardDescription>
                               {isStudentView ? `Emploi du temps pour la filière ${fieldsById[selectedFieldId]?.name || ''}` : "Vue hebdomadaire des cours planifiés."}
                            </CardDescription>
                         </div>
                        <div className="flex items-center gap-4">
                            {!isStudentView && (
                                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue placeholder="Filtrer par filière" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les filières</SelectItem>
                                        {mockFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
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
                                                {scheduleGrid[day][slot].map(course => (
                                                     <div key={course.id} className="bg-primary/10 border border-primary/20 p-2 rounded-lg text-xs mb-1 hover:bg-primary/20 transition-colors">
                                                        <Link href={`/dashboard/courses`}>
                                                            <p className="font-bold text-primary truncate">{course.name}</p>
                                                            <p className="text-muted-foreground">{getTeacherName(course.teacherId)}</p>
                                                            <p className="text-muted-foreground">Salle: {course.schedule?.find(s => s.day === day)?.room}</p>
                                                        </Link>
                                                     </div>
                                                ))}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     {loading && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                           <p>Chargement de l'emploi du temps...</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}


export default function SchedulePage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <ScheduleContent />
        </Suspense>
    )
}
