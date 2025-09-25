

"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserCheck, CalendarOff, Briefcase, FileDown, Users, Check, X, Coffee, GraduationCap, Eye, UserX } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance, StudentAttendance, Field, StudentAttendanceStatus } from '@/lib/types';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
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
    const { users, loading: usersLoading, settings, courses, fields, sectors, attendances } = useUser();
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
        if (!selectedStudent) return;
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
                    teacherStatus: 'pending', studentAttendances: [{ studentId: selectedStudent.uid, status: newStatus }],
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
                            <Button variant="outline" onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4"/> Exporter PDF</Button>
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
                                                    <PopoverTrigger asChild>
                                                        <div className={cn("w-full h-full p-2 rounded-lg text-xs cursor-pointer", statusInfo?.className.replace('text-white', ''))}>
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

    const getAttendanceStatusForTeacher = (teacherId: string, day: Date): { status: 'present' | 'absent' | 'pending' | 'nocourse', course?: Course }[] => {
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
                     if (s.status === 'nocourse' || !s.course) return '-';
                     return `${statusText[s.status]} (${s.course.name.substring(0, 10)}...)`;
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
    const [staffAttendances, setStaffAttendances] = useState<any[]>([]);
    const { toast } = useToast();

    const adminStaff = useMemo(() => {
        return users.filter(u => u.role === 'admin').sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''));
    }, [users]);
    
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'staffAttendances'), snapshot => {
            setStaffAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any));
        });
        return () => unsub();
    }, []);
    
    const todaysAttendance = useMemo(() => {
        return staffAttendances.find(a => a.id === formattedDate);
    }, [staffAttendances, formattedDate]);

    const getStatusForStaff = (staffId: string): any['status'] => {
        return todaysAttendance?.staffStatus.find((s:any) => s.staffId === staffId)?.status || 'absent';
    }

    const handleStatusChange = async (staffId: string, status: any['status']) => {
        const newRecord: any = { staffId, status };
        
        try {
            const docRef = doc(db, 'staffAttendances', formattedDate);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const existingData = docSnap.data() as any;
                const existingIndex = existingData.staffStatus.findIndex((s:any) => s.staffId === staffId);
                const newStaffStatus = [...existingData.staffStatus];
                if (existingIndex > -1) {
                    newStaffStatus[existingIndex] = newRecord;
                } else {
                    newStaffStatus.push(newRecord);
                }
                await setDoc(docRef, { ...existingData, staffStatus: newStaffStatus, updatedAt: new Date().toISOString() }, { merge: true });
            } else {
                const newAttendanceRecord: any = {
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
        
        const statusTranslation: Record<any['status'], string> = {
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

    const statusOptions: { value: any['status']; label: string; icon: React.ElementType, className: string, hoverClassName: string }[] = [
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


    
