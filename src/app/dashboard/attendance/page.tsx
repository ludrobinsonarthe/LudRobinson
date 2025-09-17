

"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserCheck } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance, Field, StudentAttendance } from '@/lib/types';
import { collection, getDocs, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import AttendanceDialog from '@/components/attendance-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function AttendanceContent() {
    const searchParams = useSearchParams();
    const teacherIdFilter = searchParams.get('teacherId');

    const { users, loading: usersLoading, settings, fields } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [selectedTeacher, setSelectedTeacher] = useState(teacherIdFilter || 'all');
    const { toast } = useToast();

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    useEffect(() => {
        setLoadingData(true);
        const unsubCourses = onSnapshot(collection(db, 'courses'), snapshot => {
            setCourses(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Course));
        });
        const unsubAttendances = onSnapshot(collection(db, 'attendances'), snapshot => {
            setAttendances(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Attendance));
        });

        setLoadingData(false);
        return () => {
            unsubCourses();
            unsubAttendances();
        }
    }, []);
    
    useEffect(() => {
        setSelectedTeacher(teacherIdFilter || 'all');
    }, [teacherIdFilter]);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    
    const fieldsById = useMemo(() => {
        return fields.reduce((acc: Record<string, Field>, field) => {
            acc[field.id] = field;
            return acc;
        }, {});
    }, [fields]);


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

    const handleManageAttendance = (course: Course, date: string) => {
        setSelectedCourse(course);
        setSelectedDate(date);
        setIsDialogOpen(true);
    };

    const handleSaveAttendance = async (data: { teacherStatus: 'present' | 'absent', studentAttendances: StudentAttendance[]}) => {
        if (!selectedCourse || !selectedDate || !users.length) return;
        
        const attendanceId = `${selectedDate}-${selectedCourse.id}`;
        const user = users.find(u => u.role === 'admin');
        const attendanceRef = doc(db, 'attendances', attendanceId);
        
        try {
            const docSnap = await getDoc(attendanceRef);
            const newAttendanceRecord: Attendance = {
                ...data,
                id: attendanceId,
                date: selectedDate,
                courseId: selectedCourse.id,
                teacherId: selectedCourse.teacherId,
                validatedBy: user?.uid || 'admin',
                createdAt: docSnap.exists() ? docSnap.data().createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            await setDoc(attendanceRef, newAttendanceRecord);
            toast({ title: 'Présences enregistrées', description: 'La fiche de présence a été mise à jour.' });
        } catch (error) {
            console.error("Error saving attendance: ", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible d\'enregistrer la fiche de présence.' });
        } finally {
            setIsDialogOpen(false);
        }
    };
    
    const getAttendanceForCourse = useCallback((courseId: string, date: string): Attendance | undefined => {
        const id = `${date}-${courseId}`;
        return attendances.find(a => a.id === id);
    }, [attendances]);
    
    const existingAttendance = selectedCourse && selectedDate ? getAttendanceForCourse(selectedCourse.id, selectedDate) : undefined;

    const studentsForSelectedCourse = useMemo(() => {
        if(!selectedCourse) return [];
        return students.filter(s => s.student?.fieldId === selectedCourse.fieldId && s.student.level === selectedCourse.level);
    }, [selectedCourse, students]);

    const loading = usersLoading || loadingData;

    const uniqueCourses = useMemo(() => {
        return Object.values(scheduleByDay)
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
            );
    }, [scheduleByDay]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Suivi des Présences</h1>
                    <p className="text-muted-foreground">Enregistrez la présence des professeurs et des étudiants pour chaque cours.</p>
                </div>
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
                                    <TableHead className="w-[180px]">Cours</TableHead>
                                    <TableHead className="w-[180px]">Professeur</TableHead>
                                    <TableHead className="w-[180px]">Filière</TableHead>
                                    <TableHead className="w-[120px]">Heure</TableHead>
                                    {weekDays.map(day => (
                                        <TableHead key={day.toString()} className="text-center">
                                            {format(day, 'EEE d', { locale: fr })}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({length: 3}).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                            {Array.from({length: 6}).map((_, j) => <TableCell key={j}><Skeleton className="h-16 w-full" /></TableCell>)}
                                        </TableRow>
                                    ))
                                ) : uniqueCourses.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-48 text-center">Aucun cours planifié pour cette semaine/ce filtre.</TableCell></TableRow>
                                ) : (
                                    uniqueCourses.map(course => (
                                        <TableRow key={`${course.id}-${course.scheduleInfo.start}`}>
                                            <TableCell className="font-semibold">{course.name}</TableCell>
                                            <TableCell>{course.teacher?.firstName} {course.teacher?.lastName}</TableCell>
                                            <TableCell>{fieldsById[course.fieldId]?.name || 'N/A'}</TableCell>
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
                                                
                                                const attendanceRecord = getAttendanceForCourse(course.id, dateStr);
                                                const teacherStatus = attendanceRecord?.teacherStatus;
                                                const studentAttendances = studentsForSelectedCourse;
                                                const presentStudents = attendanceRecord?.studentAttendances.filter(sa => sa.status === 'present').length || 0;
                                                const totalStudents = studentAttendances.length;

                                                return (
                                                    <TableCell key={dateStr} className="text-center p-2">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <Button 
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleManageAttendance(course, dateStr)}
                                                                className="w-full"
                                                            >
                                                                <UserCheck className="mr-2 h-4 w-4" />
                                                                Gérer la présence
                                                            </Button>
                                                            {attendanceRecord && <div className="flex justify-between w-full text-xs mt-1 gap-1">
                                                                <Badge variant={teacherStatus === 'present' ? 'default' : teacherStatus === 'absent' ? 'destructive' : 'secondary'} className="py-1 flex-1 justify-center">
                                                                    Prof: {teacherStatus === 'present' ? 'P' : 'A'}
                                                                </Badge>
                                                                <Badge variant="outline" className="py-1 flex-1 justify-center">
                                                                    Étu: {presentStudents}/{totalStudents}
                                                                </Badge>
                                                            </div>}
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

            <AttendanceDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                onSave={handleSaveAttendance}
                course={selectedCourse}
                date={selectedDate}
                students={studentsForSelectedCourse}
                existingAttendance={existingAttendance}
            />
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
