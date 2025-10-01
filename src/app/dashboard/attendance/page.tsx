

"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, UserCheck, Briefcase, FileDown, Users, Check, X, Coffee, GraduationCap, Eye, UserX } from "lucide-react";
import { format, startOfWeek, addDays, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, getMonth, getYear, subMonths, addMonths, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import { Course, User, Attendance, StudentAttendance, Field, StudentAttendanceStatus, UnifiedSalary } from '@/lib/types';
import { collection, doc, getDoc, setDoc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
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
    const { user, allUsers, loading: usersLoading, settings, allCourses, fields, sectors, attendances } = useUser();
    const { toast } = useToast();

    // Filters state
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [selectedSectorId, setSelectedSectorId] = useState('all');
    const [selectedFieldId, setSelectedFieldId] = useState('all');
    const [nameFilter, setNameFilter] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [isReportOpen, setIsReportOpen] = useState(false);

    const students = useMemo(() => allUsers.filter(u => u.role === 'student'), [allUsers]);

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
        const studentFieldId = selectedStudent.student.fieldId;
        const studentSectorId = selectedStudent.student.sectorId || fields.find(f => f.id === studentFieldId)?.sectorId;
        return allCourses.filter(c => 
            c.level === selectedStudent.student!.level && (
                c.fieldId === studentFieldId || // Specific course for field
                (!c.fieldId && c.sectorId === studentSectorId) // Common core for sector
            )
        );
    }, [selectedStudent, allCourses, fields]);

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
                const newAttendance: Attendance = {
                    id: attendanceId, date: dateStr, courseId: course.id, teacherId: course.teacherId,
                    teacherStatus: 'present', studentAttendances: [{ studentId: selectedStudent.uid, status: newStatus }],
                    validatedBy: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                };
                await setDoc(attendanceRef, newAttendance);
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
                const dayName = format(day, 'EEEE', { locale: fr });
                if (course.schedule?.some(s => s.day === dayName)) {
                     course.schedule.filter(s => s.day === dayName).forEach(scheduleSlot => {
                        const status = getStudentAttendanceForSlot(course, day);
                        details.push({ date: day, courseName: `${course.name} (${scheduleSlot.start}-${scheduleSlot.end})`, status });
                        if (status === 'present') present++;
                        else if (status === 'absent') absent++;
                        else if (status === 'justified') justified++;
                    });
                }
            });
        });
        
        return { summary: { present, absent, justified }, details };
    }, [selectedStudent, studentSchedule, weekDays, attendances, getStudentAttendanceForSlot]);

    if (selectedStudent) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
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
                                {weekDays.map((day) => (
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
                                        {weekDays.map((day) => {
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
                            <TableHead className="hidden md:table-cell">Niveau</TableHead>
                            <TableHead className="hidden lg:table-cell">Filière</TableHead>
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
                                <TableCell className="hidden md:table-cell">{student.student?.level}</TableCell>
                                <TableCell className="hidden lg:table-cell">{fields.find(f => f.id === student.student?.fieldId)?.name || 'N/A'}</TableCell>
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
    const { user: currentUser, allUsers: users, loading: usersLoading, settings, allCourses, attendances } = useUser();
    const [loadingData, setLoadingData] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [isReportOpen, setIsReportOpen] = useState(false);
    const { toast } = useToast();
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher').sort((a,b) => (a.lastName || '').localeCompare(b.lastName || '')), [users]);
    const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);

    useEffect(() => {
        setLoadingData(true);
        const timer = setTimeout(() => setLoadingData(false), 300);
        return () => clearTimeout(timer);
    }, []);

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
            if (docSnap.exists()) {
                await updateDoc(attendanceRef, { teacherStatus: newStatus, updatedAt: new Date().toISOString() });
            } else {
                 const newAttendance: Attendance = {
                    id: attendanceId,
                    date: dateStr,
                    courseId: course.id,
                    teacherId: teacherId,
                    teacherStatus: newStatus,
                    studentAttendances: [], 
                    validatedBy: currentUser.uid,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                await setDoc(attendanceRef, newAttendance);
            }
            
            toast({ title: 'Présence du professeur mise à jour', duration: 2000 });
        } catch (error) {
            console.error("Error updating teacher attendance:", error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour la présence.' });
        }
    };

    const teacherSchedule = useMemo(() => {
        if (!selectedTeacher) return null;
        return allCourses.filter(c => c.teacherId === selectedTeacher.uid);
    }, [selectedTeacher, allCourses]);

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

    const weekDays = eachDayOfInterval({ start: currentWeek, end: addDays(currentWeek, 5) });

    if (selectedTeacher) {
        return (
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
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
                    <TableHeader><TableRow><TableHead>Professeur</TableHead><TableHead className="hidden sm:table-cell">Spécialité</TableHead></TableRow></TableHeader>
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
                                <TableCell className="hidden sm:table-cell">{teacher.teacher?.specialty || 'N/A'}</TableCell>
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
            </Tabs>
        </div>
    );
}

export default AttendancePage;
