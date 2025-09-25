

"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserCheck, Briefcase, FileDown, Users, Check, X, Coffee, GraduationCap, Eye, UserX } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, eachDayOf, getMonth, getYear, subMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance, StudentAttendance, Field, StudentAttendanceStatus, StaffAttendance, StaffMemberAttendance } from '@/lib/types';
import { collection, doc, getDoc, setDoc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { imageToDataUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};
const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const timeSlots = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`); // 08:00 to 18:00


function StudentAttendanceContent() {
    const { user, users, loading: usersLoading, settings, courses, fields, sectors, attendances } = useUser();
    const { toast } = useToast();

    // Filters state
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [selectedSectorId, setSelectedSectorId] = useState('all');
    const [selectedFieldId, setSelectedFieldId] = useState('all');
    const [nameFilter, setNameFilter] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [isReportOpen, setIsReportOpen] = useState(false);

    const students = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const coursesById = useMemo(() => courses.reduce((acc, c) => ({...acc, [c.id]: c}), {} as Record<string, Course>), [courses]);

    const availableFields = useMemo(() => {
        if (selectedSectorId === 'all') return fields;
        return fields.filter(f => f.sectorId === selectedSectorId);
    }, [selectedSectorId, fields]);

     useEffect(() => {
        if (!availableFields.some(f => f.id === selectedFieldId)) {
            setSelectedFieldId('all');
        }
    }, [selectedSectorId, availableFields, selectedFieldId]);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const studentField = s.student?.fieldId ? fields.find(f => f.id === s.student!.fieldId) : null;
            const studentSector = studentField ? sectors.find(sec => sec.id === studentField.sectorId) : null;
            return (
                (nameFilter === '' || `${s.lastName} ${s.firstName}`.toLowerCase().includes(nameFilter.toLowerCase())) &&
                (selectedLevel === 'all' || s.student?.level === selectedLevel) &&
                (selectedSectorId === 'all' || studentSector?.id === selectedSectorId) &&
                (selectedFieldId === 'all' || s.student?.fieldId === selectedFieldId)
            );
        }).sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''));
    }, [students, nameFilter, selectedLevel, selectedSectorId, selectedFieldId, fields, sectors]);
    
    
    const studentSchedule = useMemo(() => {
        if (!selectedStudent || !selectedStudent.student) return null;
        return courses.filter(c => c.fieldId === selectedStudent.student!.fieldId && c.level === selectedStudent.student!.level);
    }, [selectedStudent, courses]);

    const scheduleGrid = useMemo(() => {
        const grid: { [key: string]: { [key: string]: Course | null } } = {};
        daysOfWeek.forEach(day => {
            grid[day] = {};
            timeSlots.forEach(slot => grid[day][slot] = null);
        });

        studentSchedule?.forEach(course => {
            course.schedule?.forEach(slot => {
                const startTimeHour = parseInt(slot.start.split(':')[0]);
                const timeSlotKey = `${startTimeHour.toString().padStart(2, '0')}:00`;
                if (grid[slot.day] && grid[slot.day][timeSlotKey] === null) {
                    grid[slot.day][timeSlotKey] = course;
                }
            });
        });
        return grid;
    }, [studentSchedule]);
    
    const getStudentAttendanceForSlot = (course: Course, day: Date): StudentAttendanceStatus => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const attendance = attendances.find(a => a.date === dateStr && a.courseId === course.id);
        const studentStatus = attendance?.studentAttendances.find(sa => sa.studentId === selectedStudent?.uid);
        return studentStatus?.status || 'absent';
    }
    
    const handleStudentStatusChange = async (course: Course, day: Date, newStatus: StudentAttendanceStatus) => {
        if (!selectedStudent || user?.role !== 'admin') {
            toast({ variant: 'destructive', title: 'Action non autorisée', description: "Vous n'avez pas les droits pour modifier la présence." });
            return;
        }

        const dateStr = format(day, 'yyyy-MM-dd');
        const attendanceId = `${dateStr}-${course.id}`;
        const attendanceRef = doc(db, 'attendances', attendanceId);

        try {
            const docSnap = await getDoc(attendanceRef);
            if (docSnap.exists()) {
                const existingData = docSnap.data() as Attendance;
                const studentAttendances = existingData.studentAttendances.filter(sa => sa.studentId !== selectedStudent.uid);
                studentAttendances.push({ studentId: selectedStudent.uid, status: newStatus });
                await updateDoc(attendanceRef, { studentAttendances, updatedAt: new Date().toISOString() });
            } else {
                const batch = writeBatch(db);
                const newAttendance: Attendance = {
                    id: attendanceId, date: dateStr, courseId: course.id, teacherId: course.teacherId,
                    teacherStatus: 'present', studentAttendances: [{ studentId: selectedStudent.uid, status: newStatus }],
                    validatedBy: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                };
                batch.set(attendanceRef, newAttendance);
                await batch.commit();
            }
            toast({ title: 'Présence mise à jour', duration: 1500 });
        } catch (error) {
            console.error("Error updating student attendance:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour la présence.' });
        }
    };
    
    const weekDays = eachDayOfInterval({ start: currentWeek, end: addDays(currentWeek, 5) });
    const statusOptions: { value: StudentAttendanceStatus; label: string; icon: React.ElementType, className: string }[] = [
        { value: 'present', label: 'Présent', icon: Check, className: 'bg-green-500 hover:bg-green-600 text-white' },
        { value: 'absent', label: 'Absent', icon: X, className: 'bg-red-500 hover:bg-red-600 text-white' },
        { value: 'justified', label: 'Justifié', icon: UserX, className: 'bg-gray-400 hover:bg-gray-500 text-white' },
    ];
    
    const weeklyReportData = useMemo(() => {
        if (!selectedStudent || !studentSchedule) return { summary: { present: 0, absent: 0, justified: 0 }, details: [] };
        
        const details: {date: Date, courseName: string, status: StudentAttendanceStatus}[] = [];
        let present = 0, absent = 0, justified = 0;

        weekDays.forEach(day => {
            studentSchedule.forEach(course => {
                if (course.schedule?.some(s => s.day === format(day, 'EEEE', { locale: fr }))) {
                    const status = getStudentAttendanceForSlot(course, day);
                    details.push({ date: day, courseName: course.name, status });
                    if (status === 'present') present++;
                    else if (status === 'absent') absent++;
                    else if (status === 'justified') justified++;
                }
            });
        });
        
        return { summary: { present, absent, justified }, details };
    }, [selectedStudent, studentSchedule, weekDays, attendances]);

    const handleExportPDF = async () => {
        if (!selectedStudent || !settings) return;

        const doc = new jsPDF();
        const studentName = `${selectedStudent.lastName} ${selectedStudent.firstName}`;
        const weekStartDate = format(currentWeek, 'd MMMM', { locale: fr });
        const weekEndDate = format(addDays(currentWeek, 5), 'd MMMM yyyy', { locale: fr });

        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if(logoDataUrl) doc.addImage(logoDataUrl, logoDataUrl.split(';')[0].split('/')[1].toUpperCase(), 14, 10, 20, 20);
        } catch (error) { console.error(error); }
        
        doc.setFontSize(18); doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(14); doc.text(`Rapport de Présence Hebdomadaire`, 40, 25);
        doc.setFontSize(12);
        doc.text(`Étudiant: ${studentName} (${selectedStudent.student?.matricule})`, 14, 40);
        doc.text(`Semaine du ${weekStartDate} au ${weekEndDate}`, 14, 47);

        const statusText: Record<StudentAttendanceStatus, string> = { present: 'Présent(e)', absent: 'Absent(e)', justified: 'Absence justifiée' };
        
        const tableColumn = ["Date", "Cours", "Statut"];
        const tableRows = weeklyReportData.details.map(att => [
            format(att.date, 'eeee d MMMM', { locale: fr }),
            att.courseName,
            statusText[att.status],
        ]);

        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 55 });
        
        const finalY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFontSize(12);
        doc.text(`Total Présences: ${weeklyReportData.summary.present}`, 14, finalY + 10);
        doc.text(`Total Absences: ${weeklyReportData.summary.absent}`, 14, finalY + 17);
        doc.text(`Total Justifiées: ${weeklyReportData.summary.justified}`, 14, finalY + 24);

        doc.save(`rapport_presence_${selectedStudent.lastName}_${format(currentWeek, 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Exportation PDF réussie' });
        setIsReportOpen(false);
    }

    if (selectedStudent) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => setSelectedStudent(null)}><ArrowLeft className="h-4 w-4"/></Button>
                            <div>
                                <CardTitle>Présence de {selectedStudent.lastName} {selectedStudent.firstName}</CardTitle>
                                <CardDescription>Emploi du temps interactif de la semaine.</CardDescription>
                            </div>
                        </div>
                         <div className="flex items-center gap-2">
                             <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline"><Eye className="mr-2 h-4 w-4"/> Aperçu du Rapport</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Rapport de présence de {selectedStudent.lastName}</DialogTitle>
                                        <DialogDescription>Semaine du {format(currentWeek, 'd MMMM yyyy', { locale: fr })}</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid grid-cols-3 gap-4 text-center my-4">
                                        <div className="bg-green-100 p-2 rounded-lg"><p className="font-bold text-lg">{weeklyReportData.summary.present}</p><p className="text-sm text-green-800">Présences</p></div>
                                        <div className="bg-red-100 p-2 rounded-lg"><p className="font-bold text-lg">{weeklyReportData.summary.absent}</p><p className="text-sm text-red-800">Absences</p></div>
                                        <div className="bg-gray-100 p-2 rounded-lg"><p className="font-bold text-lg">{weeklyReportData.summary.justified}</p><p className="text-sm text-gray-800">Justifiées</p></div>
                                    </div>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Cours</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {weeklyReportData.details.map((item, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{format(item.date, 'eeee dd/MM', { locale: fr })}</TableCell>
                                                    <TableCell>{item.courseName}</TableCell>
                                                    <TableCell><Badge variant={item.status === 'present' ? 'default' : item.status === 'absent' ? 'destructive' : 'secondary'} className={cn(item.status === 'present' && 'bg-green-600')}>{item.status}</Badge></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsReportOpen(false)}>Fermer</Button>
                                        <Button onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4"/> Télécharger en PDF</Button>
                                    </DialogFooter>
                                </DialogContent>
                             </Dialog>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, -7))}><ArrowLeft className="h-4 w-4" /></Button>
                                <span>{format(currentWeek, 'd MMM', { locale: fr })}</span>
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, 7))}><ArrowRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-lg overflow-hidden">
                        <Table className="min-w-full border-collapse">
                            <TableHeader><TableRow>
                                <TableHead className="w-[100px] border-r">Heure</TableHead>
                                {weekDays.map((day, index) => (
                                    <TableHead key={day.toISOString()} className="border-r text-center p-1">
                                        <div className="flex flex-col items-center">
                                            <span>{format(day, 'EEEE', { locale: fr })}</span>
                                            <span className="text-xs text-muted-foreground">{format(day, 'dd/MM')}</span>
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow></TableHeader>
                            <TableBody>
                                {timeSlots.map(slot => (
                                    <TableRow key={slot} className="h-28"><TableCell className="font-medium align-top pt-3 border-r">{slot}</TableCell>
                                        {weekDays.map((day, dayIndex) => {
                                            const course = scheduleGrid[format(day, 'EEEE', { locale: fr })]?.[slot];
                                            if (!course) return <TableCell key={day.toISOString()} className="p-1 align-top border-r"></TableCell>;
                                            
                                            const status = getStudentAttendanceForSlot(course, day);
                                            const statusInfo = statusOptions.find(o => o.value === status);
                                            
                                            return (
                                            <TableCell key={day.toISOString()} className="p-1 align-top border-r">
                                                 <Popover>
                                                    <PopoverTrigger asChild disabled={user?.role !== 'admin'}>
                                                        <div className={cn("w-full h-full p-2 rounded-lg text-xs", user?.role === 'admin' && 'cursor-pointer', statusInfo?.className.replace('text-white', ''))}>
                                                            <p className="font-bold truncate">{course.name}</p>
                                                            <p>{statusInfo?.label}</p>
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-2">
                                                        <div className="flex flex-col gap-2">
                                                            {statusOptions.map(option => (
                                                                <Button key={option.value} size="sm" variant="outline" className={option.className} onClick={() => handleStudentStatusChange(course, day, option.value)}>
                                                                    <option.icon className="mr-2 h-4 w-4" /> {option.label}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </PopoverContent>
                                                 </Popover>
                                            </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Liste des Étudiants</CardTitle>
                <CardDescription>Sélectionnez un étudiant pour voir et gérer son assiduité hebdomadaire.</CardDescription>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                    <Input placeholder="Rechercher par nom..." value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="max-w-sm"/>
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
                     <Select value={selectedFieldId} onValueChange={setSelectedFieldId} disabled={selectedSectorId === 'all'}>
                        <SelectTrigger className="w-[240px]"><SelectValue placeholder="Filière..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes les filières</SelectItem>
                            {availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Étudiant</TableHead>
                            <TableHead>Niveau</TableHead>
                            <TableHead>Filière</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {usersLoading ? (
                            Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                        ) : filteredStudents.length > 0 ? filteredStudents.map(student => (
                             <TableRow key={student.uid} onClick={() => setSelectedStudent(student)} className="cursor-pointer">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={student.photoUrl} alt={student.firstName} />
                                            <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-medium">{student.lastName} {student.firstName}</div>
                                    </div>
                                </TableCell>
                                <TableCell>{student.student?.level}</TableCell>
                                <TableCell>{fields.find(f => f.id === student.student?.fieldId)?.name || 'N/A'}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={3} className="text-center h-24">Aucun étudiant trouvé pour les filtres sélectionnés.</TableCell></TableRow>
                        )}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
    )
}

function TeacherAttendanceContent() {
    const { user: currentUser, users, loading: usersLoading, settings, courses, attendances } = useUser();
    const [loadingData, setLoadingData] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [isReportOpen, setIsReportOpen] = useState(false);
    const { toast } = useToast();
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher').sort((a,b) => (a.lastName || '').localeCompare(b.lastName || '')), [users]);
    const weekDays = eachDayOfInterval({ start: currentWeek, end: addDays(currentWeek, 5) });
    const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

    useEffect(() => {
        setLoadingData(true);
        // Data is already being loaded by the parent or hook, just handle local loading state
        const timer = setTimeout(() => setLoadingData(false), 300);
        return () => clearTimeout(timer);
    }, []);

    const coursesById = useMemo(() => courses.reduce((acc, c) => ({...acc, [c.id]: c}), {} as Record<string, Course>), [courses]);

    const getAttendanceStatusForTeacher = (teacherId: string, day: Date): { status: 'present' | 'absent' | 'nocourse', course?: Course }[] => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const teacherCoursesOnDay = courses.filter(c => c.teacherId === teacherId && c.schedule?.some(s => s.day === format(day, 'EEEE', { locale: fr })));
        
        if (teacherCoursesOnDay.length === 0) return [{ status: 'nocourse' }];

        return teacherCoursesOnDay.map(course => {
            const attendance = attendances.find(a => a.date === dateStr && a.courseId === course.id);
            return { status: attendance?.teacherStatus || 'absent', course: course };
        });
    };

    const handleTeacherStatusChange = async (teacherId: string, course: Course, day: Date, newStatus: 'present' | 'absent') => {
        if (!currentUser || currentUser.role !== 'admin') {
            toast({ variant: 'destructive', title: 'Action non autorisée', description: "Vous n'avez pas les droits pour modifier la présence." });
            return;
        }
        
        const dateStr = format(day, 'yyyy-MM-dd');
        const attendanceId = `${dateStr}-${course.id}`;
        const attendanceRef = doc(db, 'attendances', attendanceId);

        try {
            const docSnap = await getDoc(attendanceRef);
            let updatedData: Partial<Attendance>;

            if (docSnap.exists()) {
                updatedData = { teacherStatus: newStatus, updatedAt: new Date().toISOString() };
                await updateDoc(attendanceRef, updatedData);
            } else {
                 updatedData = {
                    teacherStatus: newStatus,
                    updatedAt: new Date().toISOString(),
                    id: attendanceId,
                    date: dateStr,
                    courseId: course.id,
                    teacherId: teacherId,
                    studentAttendances: [], 
                    validatedBy: currentUser.uid,
                    createdAt: new Date().toISOString(),
                };
                await setDoc(attendanceRef, updatedData);
            }
            
            toast({ title: 'Présence du professeur mise à jour', duration: 2000 });
        } catch (error) {
            console.error("Error updating teacher attendance:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour la présence.' });
        }
    };

    const teacherSchedule = useMemo(() => {
        if (!selectedTeacher) return null;
        return courses.filter(c => c.teacherId === selectedTeacher.uid);
    }, [selectedTeacher, courses]);

    const scheduleGrid = useMemo(() => {
        const grid: { [key: string]: { [key: string]: Course | null } } = {};
        daysOfWeek.forEach(day => {
            grid[day] = {};
            timeSlots.forEach(slot => grid[day][slot] = null);
        });

        teacherSchedule?.forEach(course => {
            course.schedule?.forEach(slot => {
                const startTimeHour = parseInt(slot.start.split(':')[0]);
                const timeSlotKey = `${startTimeHour.toString().padStart(2, '0')}:00`;
                if (grid[slot.day] && grid[slot.day][timeSlotKey] === null) {
                    grid[slot.day][timeSlotKey] = course;
                }
            });
        });
        return grid;
    }, [teacherSchedule]);

    const getTeacherAttendanceForSlot = (course: Course, day: Date): 'present' | 'absent' => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const attendance = attendances.find(a => a.date === dateStr && a.courseId === course.id);
        return attendance?.teacherStatus || 'absent';
    };

    const handleExportPDF = async () => {
        if (!selectedTeacher || !settings) return;

        const doc = new jsPDF();
        const teacherName = `${selectedTeacher.lastName} ${selectedTeacher.firstName}`;
        const weekStartDate = format(currentWeek, 'd MMMM', { locale: fr });
        const weekEndDate = format(addDays(currentWeek, 5), 'd MMMM yyyy', { locale: fr });
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if(logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 14, 10, 20, 20);
        } catch (error) { console.error("Could not add logo to PDF, proceeding without it.", error); }

        doc.setFontSize(18); doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(14); doc.text(`Rapport de Présence - ${teacherName}`, 40, 25);
        doc.setFontSize(12);
        doc.text(`Semaine du ${weekStartDate} au ${weekEndDate}`, 14, 40);

        const statusText = { present: 'Présent(e)', absent: 'Absent(e)' };
        const tableColumn = ["Date", "Cours", "Statut"];
        const tableRows: string[][] = [];

        weekDays.forEach(day => {
            const coursesOnDay = teacherSchedule?.filter(c => c.schedule?.some(s => s.day === format(day, 'EEEE', { locale: fr })));
            coursesOnDay?.forEach(course => {
                const status = getTeacherAttendanceForSlot(course, day);
                tableRows.push([format(day, 'eeee d MMMM', { locale: fr }), course.name, statusText[status]]);
            });
        });
        
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 50 });
        doc.save(`rapport_presence_${selectedTeacher.lastName}_${format(currentWeek, 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Exportation PDF réussie' });
        setIsReportOpen(false);
    };

    if (selectedTeacher) {
        return (
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => setSelectedTeacher(null)}><ArrowLeft className="h-4 w-4"/></Button>
                            <div>
                                <CardTitle>Présence de {selectedTeacher.lastName} {selectedTeacher.firstName}</CardTitle>
                                <CardDescription>Emploi du temps interactif de la semaine.</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                                <DialogTrigger asChild><Button variant="outline"><Eye className="mr-2 h-4 w-4"/> Aperçu du Rapport</Button></DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Rapport de présence de {selectedTeacher.lastName}</DialogTitle>
                                        <DialogDescription>Semaine du {format(currentWeek, 'd MMMM yyyy', { locale: fr })}</DialogDescription>
                                    </DialogHeader>
                                     <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Cours</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                             {weekDays.flatMap(day => 
                                                (teacherSchedule || [])
                                                    .filter(c => c.schedule?.some(s => s.day === format(day, 'EEEE', { locale: fr })))
                                                    .map(course => {
                                                        const status = getTeacherAttendanceForSlot(course, day);
                                                        return (
                                                            <TableRow key={`${day.toISOString()}-${course.id}`}>
                                                                <TableCell>{format(day, 'eeee dd/MM', { locale: fr })}</TableCell>
                                                                <TableCell>{course.name}</TableCell>
                                                                <TableCell><Badge variant={status === 'present' ? 'default' : 'destructive'} className={cn(status === 'present' && 'bg-green-600')}>{status}</Badge></TableCell>
                                                            </TableRow>
                                                        )
                                                    })
                                            )}
                                        </TableBody>
                                    </Table>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsReportOpen(false)}>Fermer</Button>
                                        <Button onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4"/> Télécharger en PDF</Button>
                                    </DialogFooter>
                                </DialogContent>
                             </Dialog>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, -7))}><ArrowLeft className="h-4 w-4" /></Button>
                                <span>{format(currentWeek, 'd MMM', { locale: fr })}</span>
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, 7))}><ArrowRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-lg overflow-hidden">
                        <Table className="min-w-full border-collapse">
                             <TableHeader><TableRow>
                                <TableHead className="w-[100px] border-r">Heure</TableHead>
                                {weekDays.map(day => <TableHead key={day.toISOString()} className="border-r text-center">{format(day, 'EEEE dd/MM', { locale: fr })}</TableHead>)}
                            </TableRow></TableHeader>
                            <TableBody>
                                {timeSlots.map(slot => (
                                    <TableRow key={slot} className="h-28">
                                        <TableCell className="font-medium align-top pt-3 border-r">{slot}</TableCell>
                                        {weekDays.map(day => {
                                            const course = scheduleGrid[format(day, 'EEEE', { locale: fr })]?.[slot];
                                            if (!course) return <TableCell key={day.toISOString()} className="p-1 align-top border-r"></TableCell>;
                                            
                                            const status = getTeacherAttendanceForSlot(course, day);
                                            const statusInfo = {
                                                present: { label: 'Présent', className: 'bg-green-100 text-green-800' },
                                                absent: { label: 'Absent', className: 'bg-red-100 text-red-800' }
                                            }[status];
                                            
                                            return (
                                            <TableCell key={day.toISOString()} className="p-1 align-top border-r">
                                                 <Popover>
                                                    <PopoverTrigger asChild disabled={currentUser?.role !== 'admin'}>
                                                        <div className={cn("w-full h-full p-2 rounded-lg text-xs", currentUser?.role === 'admin' && 'cursor-pointer', statusInfo.className)}>
                                                            <p className="font-bold truncate">{course.name}</p>
                                                            <p>{statusInfo.label}</p>
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-2">
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant="outline" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => handleTeacherStatusChange(selectedTeacher.uid, course, day, 'present')}><Check className="h-4 w-4 mr-2" /> Présent</Button>
                                                            <Button size="sm" variant="outline" className="bg-red-500 hover:bg-red-600 text-white" onClick={() => handleTeacherStatusChange(selectedTeacher.uid, course, day, 'absent')}><X className="h-4 w-4 mr-2" /> Absent</Button>
                                                        </div>
                                                    </PopoverContent>
                                                 </Popover>
                                            </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Liste des Professeurs</CardTitle>
                <CardDescription>Sélectionnez un professeur pour gérer sa présence.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Professeur</TableHead><TableHead>Spécialité</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {usersLoading ? (
                             Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={2}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                        ) : teachers.map(teacher => (
                            <TableRow key={teacher.uid} onClick={() => setSelectedTeacher(teacher)} className="cursor-pointer">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={teacher.photoUrl} alt={teacher.firstName} />
                                            <AvatarFallback>{getInitials(teacher.firstName, teacher.lastName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-medium">{teacher.lastName} {teacher.firstName}</div>
                                    </div>
                                </TableCell>
                                <TableCell>{teacher.teacher?.specialty || 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function StaffAttendanceContent() {
    const { user: currentUser, users, loading: usersLoading, settings } = useUser();
    const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
    const [staffAttendances, setStaffAttendances] = useState<StaffAttendance[]>([]);
    const { toast } = useToast();

    const adminStaff = useMemo(() => {
        return users.filter(u => u.role === 'admin').sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''));
    }, [users]);
    
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'staffAttendances'), snapshot => {
            setStaffAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as StaffAttendance));
        });
        return () => unsub();
    }, []);
    
    const getStatusForDay = (staffId: string, day: Date): StaffMemberAttendance['status'] | 'weekend' => {
        const dayOfWeek = getMonth(day);
        if (dayOfWeek === 0) return 'weekend'; // Sunday
        
        const dateStr = format(day, 'yyyy-MM-dd');
        const attendanceRecord = staffAttendances.find(a => a.id === dateStr);
        const staffStatus = attendanceRecord?.staffStatus.find(s => s.staffId === staffId);
        return staffStatus?.status || 'absent';
    }

    const handleStatusChange = async (staffId: string, day: Date, status: StaffMemberAttendance['status']) => {
        if (!currentUser || currentUser.role !== 'admin') {
            toast({ variant: 'destructive', title: 'Action non autorisée', description: "Vous n'avez pas les droits pour modifier la présence." });
            return;
        }

        const dateStr = format(day, 'yyyy-MM-dd');
        const newRecord: StaffMemberAttendance = { staffId, status };
        
        try {
            const docRef = doc(db, 'staffAttendances', dateStr);
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
                    id: dateStr,
                    date: dateStr,
                    staffStatus: [newRecord],
                    validatedBy: currentUser.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await setDoc(docRef, newAttendanceRecord);
            }
             toast({ title: 'Présence mise à jour', duration: 1500 });
        } catch (error) {
            console.error("Error updating staff attendance:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour la présence.' });
        }
    };

    const handleExportPDF = async () => {
        if (!settings || !selectedStaff) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Employé ou paramètres non disponibles.' });
            return;
        }

        const doc = new jsPDF();
        const monthName = format(currentMonthDate, 'MMMM yyyy', { locale: fr });
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 14, 10, 20, 20);
        } catch (error) { console.error(error); }

        doc.setFontSize(18); doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(14); doc.text(`Rapport de Présence - ${selectedStaff.lastName} ${selectedStaff.firstName}`, 40, 25);
        doc.setFontSize(12); doc.text(`Mois: ${monthName}`, 14, 40);
        
        const statusTranslation: Record<StaffMemberAttendance['status'], string> = { present: 'Présent(e)', absent: 'Absent(e)', leave: 'En Congé' };
        
        const tableColumn = ["Date", "Statut"];
        const tableRows = monthDays.map(day => [
            format(day, 'eeee d MMMM yyyy', { locale: fr }),
            statusTranslation[getStatusForDay(selectedStaff.uid, day) as StaffMemberAttendance['status']] || 'Weekend'
        ]);

        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 50 });
        doc.save(`presence_${selectedStaff.lastName}_${format(currentMonthDate, 'yyyy-MM')}.pdf`);
        toast({ title: "Rapport PDF généré" });
    };

    const statusOptions: { value: StaffMemberAttendance['status']; label: string; icon: React.ElementType, className: string }[] = [
        { value: 'present', label: 'Présent', icon: Check, className: 'bg-green-500 hover:bg-green-600 text-white' },
        { value: 'absent', label: 'Absent', icon: X, className: 'bg-red-500 hover:bg-red-600 text-white' },
        { value: 'leave', label: 'Congé', icon: Coffee, className: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
    ];
    
    const monthDays = eachDayOfInterval({ start: startOfMonth(currentMonthDate), end: endOfMonth(currentMonthDate) });
    
    if (selectedStaff) {
        return (
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => setSelectedStaff(null)}><ArrowLeft className="h-4 w-4"/></Button>
                            <div>
                                <CardTitle>Présence de {selectedStaff.lastName} {selectedStaff.firstName}</CardTitle>
                                <CardDescription>Vue mensuelle de la présence.</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <Button variant="outline" onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4"/> Exporter en PDF</Button>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}><ArrowLeft className="h-4 w-4" /></Button>
                                <span className='font-semibold text-sm'>{format(currentMonthDate, 'MMMM yyyy', { locale: fr })}</span>
                                <Button variant="outline" size="icon" onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}><ArrowRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {monthDays.map(day => {
                            const status = getStatusForDay(selectedStaff.uid, day);
                            const statusInfo = statusOptions.find(o => o.value === status);
                            const isWeekend = status === 'weekend';
                            return (
                                <Popover key={day.toString()}>
                                    <PopoverTrigger asChild disabled={isWeekend || currentUser?.role !== 'admin'}>
                                        <div className={cn("p-2 rounded-lg border text-center", 
                                            isWeekend ? 'bg-muted/50' : (currentUser?.role === 'admin' ? 'cursor-pointer hover:bg-muted' : ''),
                                            status === 'present' && 'bg-green-100 border-green-200',
                                            status === 'absent' && 'bg-red-100 border-red-200',
                                            status === 'leave' && 'bg-yellow-100 border-yellow-200'
                                        )}>
                                            <p className="font-bold">{format(day, 'd')}</p>
                                            <p className="text-xs text-muted-foreground">{format(day, 'eee', { locale: fr })}</p>
                                        </div>
                                    </PopoverTrigger>
                                     {!isWeekend && (
                                        <PopoverContent className="w-auto p-2">
                                            <div className="flex flex-col gap-2">
                                                {statusOptions.map(option => (
                                                    <Button key={option.value} size="sm" variant={status === option.value ? 'default' : 'outline'} className={status === option.value ? option.className : ''} onClick={() => handleStatusChange(selectedStaff.uid, day, option.value)}>
                                                        <option.icon className="mr-2 h-4 w-4" /> {option.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                     )}
                                </Popover>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Suivi du Personnel Administratif</CardTitle>
                <CardDescription>Sélectionnez un membre du personnel pour voir et gérer sa présence mensuelle.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Personnel</TableHead>
                            <TableHead>Poste</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {usersLoading ? (
                             Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={2}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                        ) : adminStaff.map(staff => (
                            <TableRow key={staff.uid} onClick={() => setSelectedStaff(staff)} className="cursor-pointer">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={staff.photoUrl} alt={staff.firstName} />
                                            <AvatarFallback>{getInitials(staff.firstName, staff.lastName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-medium">{staff.lastName} {staff.firstName}</div>
                                    </div>
                                </TableCell>
                                <TableCell>{staff.admin?.position || 'N/A'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
                    <TabsTrigger value="students"><Users className="mr-2 h-4 w-4"/> Étudiants</TabsTrigger>
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
