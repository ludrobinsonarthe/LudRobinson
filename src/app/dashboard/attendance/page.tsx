

"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserCheck, CalendarOff, Banknote } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance, Field, StudentAttendance } from '@/lib/types';
import { collection, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import AttendanceDialog from '@/components/attendance-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

function AttendanceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
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

        // Combine loading states
        Promise.all([
            new Promise(res => unsubCourses.apply(res)),
            new Promise(res => unsubAttendances.apply(res)),
        ]).then(() => setLoadingData(false));
        
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
                validatedBy: user?.uid || 'system',
                createdAt: docSnap.exists() ? docSnap.data().createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            await setDoc(attendanceRef, newAttendanceRecord, { merge: true });
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

    const getStudentsForCourse = (course: Course) => {
        if(!course) return [];
        return students.filter(s => s.student?.fieldId === course.fieldId && s.student.level === course.level);
    }

    const studentsForSelectedCourse = useMemo(() => {
        if(!selectedCourse) return [];
        return getStudentsForCourse(selectedCourse);
    }, [selectedCourse, students]);

    const loading = usersLoading || loadingData;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline tracking-tight">Suivi des Présences</h1>
                        <p className="text-muted-foreground">Enregistrez la présence des professeurs pour chaque cours planifié.</p>
                    </div>
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
                                    {teachers.map(t => <SelectItem key={t.uid} value={t.uid}>{t.lastName} {t.firstName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {selectedTeacher !== 'all' && (
                                <Button variant="outline" asChild>
                                    <Link href={`/dashboard/salary-management?userId=${selectedTeacher}`}>
                                        <Banknote className="mr-2 h-4 w-4" />
                                        Gérer les salaires
                                    </Link>
                                </Button>
                            )}
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
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {loading ? (
                    Array.from({length: 3}).map((_, i) => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                            <CardContent className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </CardContent>
                        </Card>
                    ))
                ) : weekDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const coursesOnDay = scheduleByDay[dateStr] || [];

                    return (
                        <Card key={dateStr}>
                            <CardHeader>
                                <CardTitle className="capitalize">{format(day, 'EEEE d MMMM', { locale: fr })}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {coursesOnDay.length > 0 ? coursesOnDay.map((course: any) => {
                                    const attendanceRecord = getAttendanceForCourse(course.id, dateStr);
                                    const teacherStatus = attendanceRecord?.teacherStatus;
                                    const studentAttendances = getStudentsForCourse(course);
                                    const presentStudents = attendanceRecord?.studentAttendances.filter(sa => sa.status === 'present').length || 0;
                                    const totalStudents = studentAttendances.length;

                                    return (
                                        <div key={course.id + course.scheduleInfo.start} className="p-3 border rounded-lg space-y-3">
                                            <div>
                                                <p className="font-semibold">{course.name}</p>
                                                <p className="text-sm text-muted-foreground">{course.teacher?.lastName} {course.teacher?.firstName}</p>
                                                <p className="text-sm text-muted-foreground">Heure: {course.scheduleInfo.start} - {course.scheduleInfo.end}</p>
                                            </div>
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
                                                <Badge variant={teacherStatus === 'present' ? 'default' : teacherStatus === 'absent' ? 'destructive' : 'secondary'} className={`py-1 flex-1 justify-center ${teacherStatus === 'present' ? 'bg-green-600' : ''}`}>
                                                    Prof: {teacherStatus === 'present' ? 'Présent' : 'Absent'}
                                                </Badge>
                                                <Badge variant="outline" className="py-1 flex-1 justify-center">
                                                    Étu: {presentStudents}/{totalStudents}
                                                </Badge>
                                            </div>}
                                        </div>
                                    );
                                }) : (
                                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-24">
                                        <CalendarOff className="h-8 w-8 mb-2" />
                                        <p className="text-sm">Aucun cours planifié</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

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
        <Suspense fallback={<div className="flex items-center justify-center h-96"><Skeleton className="h-8 w-8 animate-spin" /></div>}>
            <AttendanceContent />
        </Suspense>
    );
}

    