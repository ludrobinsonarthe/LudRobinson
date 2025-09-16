
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
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { mockFields } from '@/lib/mock-data';
import AttendanceDialog from '@/components/attendance-dialog';
import { Badge } from '@/components/ui/badge';

function AttendanceContent() {
    const searchParams = useSearchParams();
    const teacherIdFilter = searchParams.get('teacherId');

    const { users, loading: usersLoading } = useUser();
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
        const unsubscribeCourses = onSnapshot(collection(db, 'courses'), snapshot => {
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
        });
        const unsubscribeAttendances = onSnapshot(collection(db, 'attendances'), snapshot => {
            setAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
            setLoadingData(false);
        });

        return () => {
            unsubscribeCourses();
            unsubscribeAttendances();
        }
    }, []);
    
    useEffect(() => {
        setSelectedTeacher(teacherIdFilter || 'all');
    }, [teacherIdFilter]);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const fieldsById = useMemo(() => mockFields.reduce((acc, f) => ({ ...acc, [f.id]: f }), {} as Record<string, Field>), []);


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
                    field: fieldsById[c.fieldId],
                }))
            ).sort((a,b) => a.scheduleInfo.start.localeCompare(b.scheduleInfo.start));
        });
        return schedule;
    }, [courses, weekDays, selectedTeacher, teachers, fieldsById]);

    const handleManageAttendance = (course: Course, date: string) => {
        setSelectedCourse(course);
        setSelectedDate(date);
        setIsDialogOpen(true);
    };

    const handleSaveAttendance = async (data: { teacherStatus: 'present' | 'absent', studentAttendances: StudentAttendance[]}) => {
        if (!selectedCourse || !selectedDate || !users.length) return;

        const adminUser = users.find(u => u.role === 'admin');
        if (!adminUser) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Aucun administrateur trouvé pour valider.' });
            return;
        }

        const attendanceId = `${selectedDate}-${selectedCourse.id}`;
        
        try {
            const docRef = doc(db, 'attendances', attendanceId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
            } else {
                const newAttendance: Attendance = {
                    id: attendanceId,
                    date: selectedDate,
                    courseId: selectedCourse.id,
                    teacherId: selectedCourse.teacherId,
                    teacherStatus: data.teacherStatus,
                    studentAttendances: data.studentAttendances,
                    validatedBy: adminUser.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await setDoc(docRef, newAttendance);
            }
            toast({ title: 'Présences enregistrées', description: 'Les fiches de présence ont été mises à jour.' });
            setIsDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de sauvegarder les présences.' });
        }
    };
    
    const getAttendanceForCourse = useCallback((courseId: string, date: string): Attendance | undefined => {
        const id = `${date}-${courseId}`;
        return attendances.find(a => a.id === id);
    }, [attendances]);


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
                                    <TableRow><TableCell colSpan={9} className="h-48 text-center">Chargement...</TableCell></TableRow>
                                ) : uniqueCourses.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="h-48 text-center">Aucun cours planifié pour cette semaine/ce filtre.</TableCell></TableRow>
                                ) : (
                                    uniqueCourses.map(course => (
                                        <TableRow key={`${course.id}-${course.scheduleInfo.start}`}>
                                            <TableCell className="font-semibold">{course.name}</TableCell>
                                            <TableCell>{course.teacher?.firstName} {course.teacher?.lastName}</TableCell>
                                            <TableCell>{course.field?.name || 'N/A'}</TableCell>
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

                                                const presentStudents = attendanceRecord?.studentAttendances.filter(sa => sa.status === 'present').length || 0;
                                                const totalStudents = students.filter(s => s.student?.fieldId === course.fieldId && s.student.level === course.level).length;


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
                                                            <div className="flex justify-between w-full text-xs mt-1">
                                                                <Badge variant={teacherStatus === 'present' ? 'default' : teacherStatus === 'absent' ? 'destructive' : 'secondary'} className="py-1">
                                                                    Prof: {teacherStatus === 'present' ? 'P' : 'A'}
                                                                </Badge>
                                                                <Badge variant="outline" className="py-1">
                                                                    Étu: {presentStudents}/{totalStudents}
                                                                </Badge>
                                                            </div>
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
                existingAttendance={selectedCourse && selectedDate ? getAttendanceForCourse(selectedCourse.id, selectedDate) : undefined}
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
