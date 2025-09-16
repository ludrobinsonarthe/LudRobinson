
"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance } from '@/lib/types';
import { collection, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

function AttendanceContent() {
    const searchParams = useSearchParams();
    const teacherIdFilter = searchParams.get('teacherId');

    const { users, loading: usersLoading } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [selectedTeacher, setSelectedTeacher] = useState(teacherIdFilter || 'all');
    const [changes, setChanges] = useState<any>({});
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribeCourses = onSnapshot(collection(db, 'courses'), snapshot => {
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
        });
        const unsubscribeAttendances = onSnapshot(collection(db, 'attendances'), snapshot => {
            setAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
        });

        setLoadingData(false);

        return () => {
            unsubscribeCourses();
            unsubscribeAttendances();
        }
    }, []);
    
    useEffect(() => {
        setSelectedTeacher(teacherIdFilter || 'all');
    }, [teacherIdFilter]);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);

    const weekDays = eachDayOfInterval({ start: currentWeek, end: addDays(currentWeek, 5) });

    const scheduleByDay = useMemo(() => {
        const schedule: { [key: string]: any[] } = {};
        weekDays.forEach(day => {
            const dayName = format(day, 'EEEE', { locale: fr });
            const coursesOnDay = courses.filter(c => 
                c.schedule?.some(s => s.day === dayName) &&
                (selectedTeacher === 'all' || c.teacherId === selectedTeacher)
            );
            
            schedule[format(day, 'yyyy-MM-dd')] = coursesOnDay.flatMap(c => 
                c.schedule!.filter(s => s.day === dayName).map(s => ({
                    ...c,
                    scheduleInfo: s,
                    teacher: teachers.find(t => t.uid === c.teacherId),
                }))
            ).sort((a,b) => a.scheduleInfo.start.localeCompare(b.scheduleInfo.start));
        });
        return schedule;
    }, [courses, weekDays, selectedTeacher, teachers]);

    const handleAttendanceChange = (courseId: string, teacherId: string, date: string, status: 'present' | 'absent') => {
        const id = `${date}-${courseId}`;
        setChanges(prev => ({
            ...prev,
            [id]: {
                date,
                courseId,
                teacherId,
                status,
                studentIds: [], // For now, we only track teacher attendance
                validatedBy: 'admin-uid' // replace with actual admin UID
            }
        }));
    };

    const handleSave = async () => {
        if(Object.keys(changes).length === 0) return;
        const batch = writeBatch(db);
        Object.entries(changes).forEach(([id, data]: [string, any]) => {
            const docRef = doc(db, 'attendances', id);
            batch.set(docRef, data, { merge: true });
        });
        try {
            await batch.commit();
            setChanges({});
            toast({ title: 'Présences enregistrées', description: 'Les modifications ont été sauvegardées.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder les présences.' });
        }
    }
    
    const getAttendanceStatus = (courseId: string, date: string): 'present' | 'absent' | undefined => {
        const id = `${date}-${courseId}`;
        if (changes[id]) return changes[id].status;
        const attendance = attendances.find(a => a.id === id);
        return attendance?.status;
    }


    const loading = usersLoading || loadingData;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Suivi des Présences</h1>
                    <p className="text-muted-foreground">Enregistrez la présence des professeurs pour chaque cours.</p>
                </div>
                <Button onClick={handleSave} disabled={Object.keys(changes).length === 0}>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer les modifications
                </Button>
            </div>

            <Card>
                <CardHeader>
                   <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                                <SelectTrigger className="w-[240px]">
                                    <SelectValue placeholder="Filtrer par professeur" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les professeurs</SelectItem>
                                    {teachers.map(t => <SelectItem key={t.uid} value={t.uid}>{t.firstName} {t.lastName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, -7))}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <span className="font-semibold text-sm text-center min-w-[200px]">
                                Semaine du {format(currentWeek, 'd MMMM', { locale: fr })}
                            </span>
                            <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, 7))}>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                   </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Cours</TableHead>
                                    <TableHead className="w-[200px]">Professeur</TableHead>
                                    <TableHead className="w-[150px]">Heure</TableHead>
                                    {weekDays.map(day => (
                                        <TableHead key={day.toString()} className="text-center">
                                            {format(day, 'EEE d', { locale: fr })}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={8} className="h-48 text-center">Chargement...</TableCell></TableRow>
                                ) : Object.values(scheduleByDay).flat().length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="h-48 text-center">Aucun cours planifié pour cette semaine/ce filtre.</TableCell></TableRow>
                                ) : (
                                    Object.values(scheduleByDay)
                                        .flat()
                                        .sort((a, b) => {
                                            const timeA = a.scheduleInfo.start;
                                            const timeB = b.scheduleInfo.start;
                                            if (timeA < timeB) return -1;
                                            if (timeA > timeB) return 1;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .filter((course, index, self) => 
                                            index === self.findIndex(c => c.id === course.id && c.scheduleInfo.start === course.scheduleInfo.start)
                                        )
                                        .map(course => (
                                            <TableRow key={`${course.id}-${course.scheduleInfo.start}`}>
                                                <TableCell className="font-semibold">{course.name}</TableCell>
                                                <TableCell>{course.teacher?.firstName} {course.teacher?.lastName}</TableCell>
                                                <TableCell>{course.scheduleInfo.start} - {course.scheduleInfo.end}</TableCell>
                                                {weekDays.map(day => {
                                                    const dateStr = format(day, 'yyyy-MM-dd');
                                                    const dayName = format(day, 'EEEE', { locale: fr });
                                                    const courseOnThisDay = scheduleByDay[dateStr]?.find(c => 
                                                        c.id === course.id && 
                                                        c.scheduleInfo.start === course.scheduleInfo.start &&
                                                        c.scheduleInfo.day === dayName
                                                    );
                                                    
                                                    if (!courseOnThisDay) return <TableCell key={dateStr} className="p-2" />;
                                                    
                                                    const status = getAttendanceStatus(course.id, dateStr);

                                                    return (
                                                        <TableCell key={dateStr} className="text-center p-2">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={status === 'present' ? 'default' : 'outline'}
                                                                    onClick={() => handleAttendanceChange(course.id, course.teacherId, dateStr, 'present')}
                                                                    className={`w-20 ${status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                                                >
                                                                    Présent
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={status === 'absent' ? 'destructive' : 'outline'}
                                                                    onClick={() => handleAttendanceChange(course.id, course.teacherId, dateStr, 'absent')}
                                                                    className="w-20"
                                                                >
                                                                    Absent
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AttendancePage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <AttendanceContent />
        </Suspense>
    );
}
