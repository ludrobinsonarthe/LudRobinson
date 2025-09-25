

"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserCheck, CalendarOff, Briefcase, FileDown, Users, Check, X, Coffee, GraduationCap } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance, StudentAttendance, Field, StaffAttendance, StaffMemberAttendance } from '@/lib/types';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


function StudentAttendanceContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user: currentUser, users, loading: usersLoading, settings, courses, fields, sectors } = useUser();
    
    // States
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Filters state
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [selectedSectorId, setSelectedSectorId] = useState('all');
    const [selectedFieldId, setSelectedFieldId] = useState('all');

    useEffect(() => {
        setLoadingData(true);
        const unsubAttendances = onSnapshot(collection(db, 'attendances'), snapshot => {
            setAttendances(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Attendance));
            setLoadingData(false);
        });
        
        return () => unsubAttendances();
    }, []);
    

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const fieldsById = useMemo(() => fields.reduce((acc, f) => ({ ...acc, [f.id]: f }), {} as Record<string, Field>), [fields]);
    
    const availableFields = useMemo(() => {
        if (selectedSectorId === 'all') return fields;
        return fields.filter(f => f.sectorId === selectedSectorId);
    }, [selectedSectorId, fields]);

     useEffect(() => {
        if (!availableFields.some(f => f.id === selectedFieldId)) {
            setSelectedFieldId('all');
        }
    }, [selectedSectorId, availableFields, selectedFieldId]);

    
    const weekDays = eachDayOfInterval({ start: currentWeek, end: addDays(currentWeek, 5) });

    const filteredCourses = useMemo(() => {
        let filtered = courses;

        if (selectedLevel !== 'all') {
            filtered = filtered.filter(c => c.level === selectedLevel);
        }
        
        if (selectedSectorId !== 'all') {
            const fieldsInSector = fields.filter(f => f.sectorId === selectedSectorId).map(f => f.id);

            if (selectedFieldId === 'all') {
                // All courses in the sector (common core + specific fields)
                filtered = filtered.filter(c => 
                    (c.sectorId === selectedSectorId && !c.fieldId) || // Common core
                    (c.fieldId && fieldsInSector.includes(c.fieldId))  // Field in sector
                );
            } else if (selectedFieldId === 'common_core') {
                // Only common core courses
                filtered = filtered.filter(c => c.sectorId === selectedSectorId && !c.fieldId);
            } else {
                // Specific field
                filtered = filtered.filter(c => c.fieldId === selectedFieldId);
            }
        }
        
        return filtered;
    }, [courses, selectedLevel, selectedSectorId, selectedFieldId, fields]);


    const scheduleByDay = useMemo(() => {
        const schedule: { [key: string]: any[] } = {};
        
        weekDays.forEach(day => {
            const dayName = format(day, 'EEEE', { locale: fr });
            const coursesOnDay = filteredCourses.filter(c => 
                c.schedule?.some(s => s.day === dayName)
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
    }, [filteredCourses, weekDays, teachers]);

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
            toast({ variant: "destructive", title: 'Erreur', description: 'Impossible d\'enregistrer la fiche de présence.' });
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
        const teacher = teachers.find(t => t.uid === 'all'); // Changed to avoid error, logic needs review
        const title = `Rapport de Présence Hebdomadaire`;
        
        let subtitle = `Semaine du ${format(currentWeek, 'd MMMM yyyy', { locale: fr })}`;
        if(selectedLevel !== 'all') subtitle += ` | Niveau: ${selectedLevel}`;
        if(selectedSectorId !== 'all') subtitle += ` | Secteur: ${sectors.find(s=>s.id === selectedSectorId)?.name}`;
        if(selectedFieldId !== 'all') subtitle += ` | Filière: ${fields.find(f=>f.id === selectedFieldId)?.name}`;


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
                    const teacher = users.find(u => u.uid === course.teacherId);

                    tableData.push([
                        format(day, 'EEEE dd/MM', { locale: fr }),
                        `${course.scheduleInfo.start} - ${course.scheduleInfo.end}`,
                        course.name,
                        teacher ? `${teacher.lastName} ${teacher.firstName}` : 'N/A',
                        attendance?.teacherStatus === 'present' ? 'Présent' : (attendance ? 'Absent' : 'N/R'),
                        `${presentStudents} / ${totalStudents}`
                    ]);
                });
            } else {
                 tableData.push([format(day, 'EEEE dd/MM', { locale: fr }), '-', 'Aucun cours', '-', '-', '-']);
            }
        });

        autoTable(doc, {
            head: [['Jour', 'Heure', 'Cours', 'Professeur', 'Statut Professeur', 'Présence Étudiants']],
            body: tableData,
            startY: 45,
            theme: 'striped',
        });

        doc.save(`rapport_presence_${format(currentWeek, 'yyyy-MM-dd')}.pdf`);
        toast({ title: "Rapport PDF exporté", description: "Le rapport de présence a été téléchargé." });
    };

    const loading = usersLoading || loadingData;

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                   <div className="flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Niveau..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les Niveaux</SelectItem>
                                    {settings?.levels?.map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Secteur..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les Secteurs</SelectItem>
                                    {sectors?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                             <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Filière..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes les filières</SelectItem>
                                     <SelectItem value="common_core">Tronc Commun</SelectItem>
                                    {availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
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

function TeacherAttendanceContent() {
    const { user: currentUser, users, loading: usersLoading, settings, courses } = useUser();
    const [attendances, setAttendances] = useState<Attendance[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const { toast } = useToast();
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const weekDays = eachDayOfInterval({ start: currentWeek, end: addDays(currentWeek, 5) });
    
    useEffect(() => {
        setLoadingData(true);
        const unsubAttendances = onSnapshot(collection(db, 'attendances'), snapshot => {
            setAttendances(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Attendance));
            setLoadingData(false);
        });
        return () => unsubAttendances();
    }, []);

    const coursesById = useMemo(() => courses.reduce((acc, c) => ({...acc, [c.id]: c}), {} as Record<string, Course>), [courses]);

    const getAttendanceStatusForTeacher = (teacherId: string, day: Date): { status: 'present' | 'absent' | 'nocourse' | 'pending', course?: Course }[] => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const teacherCoursesOnDay = courses.filter(c => c.teacherId === teacherId && c.schedule?.some(s => s.day === format(day, 'EEEE', { locale: fr })));
        
        if (teacherCoursesOnDay.length === 0) return [{ status: 'nocourse' }];

        return teacherCoursesOnDay.map(course => {
            const attendance = attendances.find(a => a.date === dateStr && a.courseId === course.id);
            if (attendance) {
                return { status: attendance.teacherStatus, course: course };
            }
            return { status: 'pending', course: course };
        });
    };

    const handleTeacherStatusChange = async (teacherId: string, course: Course, day: Date, newStatus: 'present' | 'absent') => {
        if (!currentUser) return;
        
        const dateStr = format(day, 'yyyy-MM-dd');
        const attendanceId = `${dateStr}-${course.id}`;
        const attendanceRef = doc(db, 'attendances', attendanceId);

        try {
            const docSnap = await getDoc(attendanceRef);
            let updatedData: Partial<Attendance>;

            if (docSnap.exists()) {
                updatedData = { teacherStatus: newStatus, updatedAt: new Date().toISOString() };
            } else {
                updatedData = {
                    id: attendanceId,
                    date: dateStr,
                    courseId: course.id,
                    teacherId: teacherId,
                    teacherStatus: newStatus,
                    studentAttendances: [], // Leave students empty for now
                    validatedBy: currentUser.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
            }
            
            await setDoc(attendanceRef, updatedData, { merge: true });
            toast({ title: 'Présence du professeur mise à jour', duration: 2000 });
        } catch (error) {
            console.error("Error updating teacher attendance:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour la présence.' });
        }
    };
    
    const handleExportPDF = async () => {
        if (!settings) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer le PDF : paramètres manquants.' });
            return;
        }

        const doc = new jsPDF({ orientation: 'landscape' });
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if (logoDataUrl) doc.addImage(logoDataUrl, logoDataUrl.split(';')[0].split('/')[1].toUpperCase(), 14, 10, 20, 20);
        } catch (error) { console.error("Error adding logo to PDF", error); }

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Rapport de Présence des Professeurs', 40, 25);
        doc.setFontSize(10);
        doc.text(`Semaine du ${format(currentWeek, 'd MMMM yyyy', { locale: fr })}`, doc.internal.pageSize.getWidth() - 14, 30, { align: 'right' });

        const statusText: Record<'present'|'absent'|'pending'|'nocourse', string> = { present: 'Présent', absent: 'Absent', pending: 'En attente', nocourse: '-' };
        const tableColumn = ['Professeur', ...weekDays.map(day => format(day, 'eeee d', { locale: fr }))];
        const tableRows = teachers.map(teacher => {
            const row = [`${teacher.lastName} ${teacher.firstName}`];
            weekDays.forEach(day => {
                const statuses = getAttendanceStatusForTeacher(teacher.uid, day);
                const cellText = statuses.map(s => {
                     if (s.status === 'nocourse') return '-';
                     return `${statusText[s.status]} (${s.course?.name.substring(0, 10)}...)`;
                }).join('\n');
                row.push(cellText);
            });
            return row;
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid',
            styles: { fontSize: 8 }
        });

        doc.save(`rapport_presence_professeurs_${format(currentWeek, 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Exportation PDF', description: 'Le rapport des présences a été téléchargé.' });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Présence des Professeurs</CardTitle>
                        <CardDescription>Vue hebdomadaire de l'assiduité des enseignants.</CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4" /> Exporter PDF</Button>
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
                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px] font-semibold">Professeur</TableHead>
                                {weekDays.map(day => <TableHead key={day.toISOString()} className="text-center">{format(day, 'EEEE d', { locale: fr })}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teachers.map(teacher => (
                                <TableRow key={teacher.uid}>
                                    <TableCell className="font-medium">{teacher.lastName} {teacher.firstName}</TableCell>
                                    {weekDays.map(day => (
                                        <TableCell key={day.toISOString()} className="text-center p-1">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                {getAttendanceStatusForTeacher(teacher.uid, day).map(({ status, course }, i) => {
                                                    if (status === 'nocourse' || !course) {
                                                        return <div key={i} className="h-10 flex items-center justify-center"><span className="text-muted-foreground text-xs">-</span></div>;
                                                    }

                                                    const statusMap = {
                                                        present: { text: "Présent", className: "bg-green-100 text-green-800 border-green-200" },
                                                        absent: { text: "Absent", className: "bg-red-100 text-red-800 border-red-200" },
                                                        pending: { text: "En attente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" }
                                                    };
                                                    
                                                    return (
                                                        <Popover key={`${course.id}-${i}`}>
                                                            <PopoverTrigger asChild>
                                                                <button className={cn("w-full text-xs p-1 rounded-md text-left hover:bg-muted/50", statusMap[status]?.className)}>
                                                                    <p className="font-semibold truncate">{course.name}</p>
                                                                    <p>{statusMap[status].text}</p>
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-2">
                                                                <div className="flex gap-2">
                                                                    <Button size="sm" variant="outline" className="bg-green-500 hover:bg-green-600 text-white flex-1" onClick={() => handleTeacherStatusChange(teacher.uid, course!, day, 'present')}>
                                                                        <Check className="h-4 w-4 mr-2" /> Présent
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" className="bg-red-500 hover:bg-red-600 text-white flex-1" onClick={() => handleTeacherStatusChange(teacher.uid, course!, day, 'absent')}>
                                                                        <X className="h-4 w-4 mr-2" /> Absent
                                                                    </Button>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    )
                                                })}
                                            </div>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function StaffAttendanceContent() {
    const { user: currentUser, users, loading: usersLoading, settings } = useUser();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [staffAttendances, setStaffAttendances] = useState<StaffAttendance[]>([]);
    const { toast } = useToast();

    const adminStaff = useMemo(() => {
        return users.filter(u => u.role === 'admin').sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''));
    }, [users]);
    
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'staffAttendances'), snapshot => {
            setStaffAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as StaffAttendance));
        });
        return () => unsub();
    }, []);
    
    const todaysAttendance = useMemo(() => {
        return staffAttendances.find(a => a.id === formattedDate);
    }, [staffAttendances, formattedDate]);

    const getStatusForStaff = (staffId: string): StaffMemberAttendance['status'] => {
        return todaysAttendance?.staffStatus.find(s => s.staffId === staffId)?.status || 'absent';
    }

    const handleStatusChange = async (staffId: string, status: StaffMemberAttendance['status']) => {
        const newRecord: StaffMemberAttendance = { staffId, status };
        
        try {
            const docRef = doc(db, 'staffAttendances', formattedDate);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const existingData = docSnap.data() as StaffAttendance;
                const existingIndex = existingData.staffStatus.findIndex(s => s.staffId === staffId);
                const newStaffStatus = [...existingData.staffStatus];
                if (existingIndex > -1) {
                    newStaffStatus[existingIndex] = newRecord;
                } else {
                    newStaffStatus.push(newRecord);
                }
                await setDoc(docRef, { ...existingData, staffStatus: newStaffStatus, updatedAt: new Date().toISOString() }, { merge: true });
            } else {
                const newAttendanceRecord: StaffAttendance = {
                    id: formattedDate,
                    date: formattedDate,
                    staffStatus: [newRecord],
                    validatedBy: currentUser?.uid || 'system',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await setDoc(docRef, newAttendanceRecord);
            }
             toast({ title: 'Présence mise à jour', duration: 2000 });
        } catch (error) {
            console.error("Error updating staff attendance:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour la présence.' });
        }
    };
    
    const handleExportPDF = async () => {
        if (!settings || usersLoading) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Données non prêtes pour l\'exportation.' });
            return;
        }

        const doc = new jsPDF();
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if (logoDataUrl) {
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
        doc.text(`Rapport de Présence du Personnel`, 40, 25);
        doc.setFontSize(12);
        doc.text(`Date: ${format(selectedDate, 'd MMMM yyyy', { locale: fr })}`, 14, 35);
        
        const statusTranslation: Record<StaffMemberAttendance['status'], string> = {
            present: 'Présent(e)',
            absent: 'Absent(e)',
            leave: 'En Congé'
        };

        const tableColumn = ["Personnel", "Statut"];
        const tableRows = adminStaff.map(staff => [
            `${staff.lastName} ${staff.firstName}`,
            statusTranslation[getStatusForStaff(staff.uid)]
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'striped',
        });

        doc.save(`presence_personnel_${formattedDate}.pdf`);
        toast({ title: "Exportation réussie", description: "Le rapport de présence du personnel a été téléchargé." });
    };

    const statusOptions: { value: StaffMemberAttendance['status']; label: string; icon: React.ElementType, className: string, hoverClassName: string }[] = [
        { value: 'present', label: 'Présent', icon: Check, className: 'bg-green-600 text-white', hoverClassName: 'hover:bg-green-700' },
        { value: 'absent', label: 'Absent', icon: X, className: 'bg-red-500 text-white', hoverClassName: 'hover:bg-red-600' },
        { value: 'leave', label: 'Congé', icon: Coffee, className: 'bg-yellow-500 text-white', hoverClassName: 'hover:bg-yellow-600' },
    ];


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <CardTitle>Suivi du Personnel Administratif</CardTitle>
                        <CardDescription>Enregistrez la présence journalière de l'équipe administrative.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleExportPDF}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Exporter en PDF
                        </Button>
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                "w-[280px] justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: fr }) : <span>Choisir une date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(day) => setSelectedDate(day || new Date())}
                                initialFocus
                                locale={fr}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr className="border-b">
                                <th className="text-left p-4 font-medium">Personnel</th>
                                <th className="text-center p-4 font-medium">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersLoading ? (
                                <tr><td colSpan={2} className="p-4 text-center">Chargement...</td></tr>
                            ) : adminStaff.map(staff => (
                                <tr key={staff.uid} className="border-b">
                                    <td className="p-4 font-medium">{staff.lastName} {staff.firstName}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            {statusOptions.map(option => (
                                                <Button 
                                                    key={option.value}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleStatusChange(staff.uid, option.value)}
                                                    className={cn(
                                                        "transition-all",
                                                        getStatusForStaff(staff.uid) === option.value ? option.className : 'text-foreground',
                                                        getStatusForStaff(staff.uid) === option.value ? '' : option.hoverClassName.replace('hover:', 'hover:bg-opacity-20 hover:'),
                                                        getStatusForStaff(staff.uid) === option.value ? '' : `hover:text-white`
                                                    )}
                                                >
                                                    <option.icon className="mr-2 h-4 w-4" />
                                                    {option.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}


function AttendancePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Suivi des Présences</h1>
                <p className="text-muted-foreground">Enregistrez et consultez la présence pour les cours, les professeurs et le personnel.</p>
            </div>
            
             <Tabs defaultValue="students" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="students"><Users className="mr-2 h-4 w-4"/> Étudiants par Cours</TabsTrigger>
                    <TabsTrigger value="teachers"><GraduationCap className="mr-2 h-4 w-4"/> Professeurs</TabsTrigger>
                    <TabsTrigger value="staff"><Briefcase className="mr-2 h-4 w-4"/> Personnel Administratif</TabsTrigger>
                </TabsList>
                <TabsContent value="students">
                    <Suspense fallback={<div className="flex items-center justify-center h-96"><Skeleton className="h-8 w-8 animate-spin" /></div>}>
                        <StudentAttendanceContent />
                    </Suspense>
                </TabsContent>
                <TabsContent value="teachers">
                    <Suspense fallback={<div className="flex items-center justify-center h-96"><Skeleton className="h-8 w-8 animate-spin" /></div>}>
                        <TeacherAttendanceContent />
                    </Suspense>
                </TabsContent>
                 <TabsContent value="staff">
                    <Suspense fallback={<div className="flex items-center justify-center h-96"><Skeleton className="h-8 w-8 animate-spin" /></div>}>
                        <StaffAttendanceContent />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default AttendancePage;


    
