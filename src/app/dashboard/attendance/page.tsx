
"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserCheck, CalendarOff, Banknote, FileDown, Users, Briefcase } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance, StudentAttendance } from '@/lib/types';
import { collection, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import AttendanceDialog from '@/components/attendance-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { imageToDataUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


function CourseAttendanceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const teacherIdFilter = searchParams.get('teacherId');

    const { users, loading: usersLoading, settings, courses, fields } = useUser();
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [selectedTeacher, setSelectedTeacher] = useState(teacherIdFilter || 'all');
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    useEffect(() => {
        setLoadingData(true);
        const unsubAttendances = onSnapshot(collection(db, 'attendances'), snapshot => {
            setAttendances(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Attendance));
            setLoadingData(false);
        });
        
        return () => unsubAttendances();
    }, []);
    
    useEffect(() => {
        setSelectedTeacher(teacherIdFilter || 'all');
    }, [teacherIdFilter]);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    
    const weekDays = eachDayOfInterval({ start: currentWeek, end: addDays(currentWeek, 5) });

    const scheduleByDay = useMemo(() => {
        const schedule: { [key: string]: any[] } = {};
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        
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

    const getStudentsForCourse = useCallback((course: Course | null): User[] => {
        if (!course) return [];
        // Handle common core courses linked to a sector
        if (course.sectorId && !course.fieldId) {
            const fieldsInSector = fields.filter(f => f.sectorId === course.sectorId).map(f => f.id);
            return students.filter(s => 
                s.student?.level === course.level &&
                fieldsInSector.includes(s.student?.fieldId || '')
            );
        }
        // Handle courses linked to a specific field
        return students.filter(s => 
            s.student?.fieldId === course.fieldId && 
            s.student.level === course.level
        );
    }, [students, fields]);

    const studentsForSelectedCourse = useMemo(() => {
        if(!selectedCourse) return [];
        return getStudentsForCourse(selectedCourse);
    }, [selectedCourse, getStudentsForCourse]);

    const handleExportPDF = async () => {
        if (!settings) {
            toast({ variant: "destructive", title: "Erreur", description: "Paramètres de l'école non chargés." });
            return;
        }

        const doc = new jsPDF({ orientation: 'landscape' });
        const teacher = teachers.find(t => t.uid === selectedTeacher);
        const title = `Rapport de Présence Hebdomadaire`;
        const subtitle = selectedTeacher === 'all'
            ? `Tous les professeurs`
            : `Professeur: ${teacher?.lastName} ${teacher?.firstName}`;
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if(logoDataUrl) {
                const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
                doc.addImage(logoDataUrl, logoExtension, 14, 10, 20, 20);
            }
        } catch (error) {
            console.error("Error adding logo to PDF", error);
        }
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(title, 40, 25);
        doc.setFontSize(10);
        doc.text(subtitle, 14, 40);
        doc.text(`Semaine du ${format(currentWeek, 'd MMMM yyyy', { locale: fr })}`, doc.internal.pageSize.getWidth() - 14, 40, { align: 'right' });

        const tableData: any[] = [];
        weekDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const coursesOnDay = scheduleByDay[dateStr] || [];
            
            if (coursesOnDay.length > 0) {
                coursesOnDay.forEach(course => {
                    const attendance = getAttendanceForCourse(course.id, dateStr);
                    const studentsForCourse = getStudentsForCourse(course);
                    const presentStudents = attendance?.studentAttendances.filter(s => s.status === 'present').length || 0;
                    const totalStudents = studentsForCourse.length;

                    tableData.push([
                        format(day, 'EEEE dd/MM', { locale: fr }),
                        `${course.scheduleInfo.start} - ${course.scheduleInfo.end}`,
                        course.name,
                        attendance?.teacherStatus === 'present' ? 'Présent' : (attendance ? 'Absent' : 'N/R'),
                        `${presentStudents} / ${totalStudents}`
                    ]);
                });
            } else {
                 tableData.push([format(day, 'EEEE dd/MM', { locale: fr }), '-', 'Aucun cours', '-', '-']);
            }
        });

        autoTable(doc, {
            head: [['Jour', 'Heure', 'Cours', 'Statut Professeur', 'Présence Étudiants']],
            body: tableData,
            startY: 45,
            theme: 'striped',
        });

        doc.save(`rapport_presence_${selectedTeacher}_${format(currentWeek, 'yyyy-MM-dd')}.pdf`);
        toast({ title: "Rapport PDF exporté", description: "Le rapport de présence a été téléchargé." });
    };

    const loading = usersLoading || loadingData;

    return (
        <div className="space-y-6">
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
                            <Button variant="outline" onClick={handleExportPDF}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Exporter PDF
                            </Button>
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
                                                <Badge variant={teacherStatus === 'present' ? 'default' : teacherStatus === 'absent' ? 'destructive' : 'secondary'} className={cn('py-1 flex-1 justify-center', teacherStatus === 'present' && 'bg-green-600')}>
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

function StaffAttendanceContent() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Suivi du Personnel</CardTitle>
                <CardDescription>Fonctionnalité en cours de développement.</CardDescription>
            </CardHeader>
            <CardContent className="h-48 flex items-center justify-center">
                 <p className="text-muted-foreground">Le suivi des présences du personnel administratif sera bientôt disponible ici.</p>
            </CardContent>
        </Card>
    );
}


function AttendancePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Suivi des Présences</h1>
                <p className="text-muted-foreground">Enregistrez et consultez la présence pour les cours et le personnel.</p>
            </div>
            
             <Tabs defaultValue="courses" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="courses"><Users className="mr-2 h-4 w-4"/> Cours (Étudiants/Professeurs)</TabsTrigger>
                    <TabsTrigger value="staff"><Briefcase className="mr-2 h-4 w-4"/> Personnel Administratif</TabsTrigger>
                </TabsList>
                <TabsContent value="courses">
                    <Suspense fallback={<div className="flex items-center justify-center h-96"><Skeleton className="h-8 w-8 animate-spin" /></div>}>
                        <CourseAttendanceContent />
                    </Suspense>
                </TabsContent>
                 <TabsContent value="staff">
                    <StaffAttendanceContent />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default AttendancePage;
