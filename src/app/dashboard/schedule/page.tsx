
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Course, Field, Sector } from '@/lib/types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mockSectors, mockFields } from '@/lib/mock-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { format, startOfWeek, addDays, getDay, set } from 'date-fns';
import { fr } from 'date-fns/locale';

const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const timeSlots = Array.from({ length: 11 }, (_, i) => `${8 + i}:00`); // 8:00 to 18:00

function ScheduleContent() {
    const searchParams = useSearchParams();
    const fieldIdFilter = searchParams.get('fieldId');
    const levelFilter = searchParams.get('level');
    
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Filters state
    const [selectedFieldId, setSelectedFieldId] = useState(fieldIdFilter || 'all');
    const [selectedLevel, setSelectedLevel] = useState(levelFilter || 'all');

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
        return courses.filter(course => 
            (selectedFieldId === 'all' || course.fieldId === selectedFieldId)
        );
    }, [courses, selectedFieldId, selectedLevel]);


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
    const sectorsById = useMemo(() => mockSectors.reduce((acc, s) => ({ ...acc, [s.id]: s }), {} as Record<string, Sector>), []);

    const getFieldInfo = (fieldId: string) => {
        const field = fieldsById[fieldId];
        if (!field) return { fieldName: 'N/A', sectorName: 'N/A' };
        const sector = sectorsById[field.sectorId];
        return { fieldName: field.name, sectorName: sector?.name || 'N/A' };
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Emploi du Temps</h1>
                <p className="text-muted-foreground">
                    Consultez l'emploi du temps par filière et par niveau.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                         <div>
                            <CardTitle>Grille de la semaine</CardTitle>
                            <CardDescription>
                                Vue hebdomadaire des cours planifiés.
                            </CardDescription>
                         </div>
                        <div className="flex items-center gap-4">
                            <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                                <SelectTrigger className="w-[240px]">
                                    <SelectValue placeholder="Filtrer par filière" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes les filières</SelectItem>
                                    {mockFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, -7))}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold text-sm">
                                    {format(currentWeek, 'd MMMM yyyy', { locale: fr })}
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
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Heure</TableHead>
                                    {daysOfWeek.map((day, index) => (
                                        <TableHead key={day}>
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
                                    <TableRow key={slot} className="h-20">
                                        <TableCell className="font-medium align-top pt-3">{slot}</TableCell>
                                        {daysOfWeek.map(day => (
                                            <TableCell key={day} className="p-1 align-top">
                                                {scheduleGrid[day][slot].map(course => (
                                                     <div key={course.id} className="bg-muted p-2 rounded-lg text-xs mb-1">
                                                        <p className="font-semibold truncate">{course.name}</p>
                                                        <p className="text-muted-foreground">{getFieldInfo(course.fieldId).fieldName}</p>
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
