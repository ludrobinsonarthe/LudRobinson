

"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Course, Field, Sector } from '@/lib/types';
import { collection, getDocs, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, FileDown } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from '@/hooks/use-user';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from '@/hooks/use-toast';
import { imageToDataUrl } from '@/lib/utils';


const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const timeSlots = Array.from({ length: 6 }, (_, i) => `${(8 + i * 2).toString().padStart(2, '0')}:00`); // 08:00, 10:00, ..., 18:00

function ScheduleContent() {
    const { user: currentUser, users, loading: userLoading, settings, fields } = useUser();
    const searchParams = useSearchParams();
    const fieldIdFromParams = searchParams.get('fieldId');
    const { toast } = useToast();
    
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Filters state
    const [selectedFieldId, setSelectedFieldId] = useState('all');
    const [selectedLevel, setSelectedLevel] = useState('all');
    
    useEffect(() => {
        let studentFieldId: string | null = null;
        if(currentUser?.role === 'student' && currentUser.student?.fieldId) {
            studentFieldId = currentUser.student.fieldId;
            setSelectedLevel(currentUser.student.level || 'all');
        }
        setSelectedFieldId(fieldIdFromParams || studentFieldId || 'all');
    }, [fieldIdFromParams, currentUser]);

    useEffect(() => {
        setLoading(true);
        const unsub = onSnapshot(collection(db, 'courses'), snapshot => {
            setCourses(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Course));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filteredCourses = useMemo(() => {
        return courses.filter(course => 
            (selectedFieldId === 'all' || course.fieldId === selectedFieldId) &&
            (selectedLevel === 'all' || course.level === selectedLevel)
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
                const startTimeHour = parseInt(slot.start.split(':')[0]);
                // Find the closest time slot (e.g., 8:30 falls into 08:00 slot)
                const timeSlotKey = `${(Math.floor(startTimeHour / 2) * 2).toString().padStart(2, '0')}:00`;

                if (grid[slot.day] && grid[slot.day][timeSlotKey]) {
                    grid[slot.day][timeSlotKey].push(course);
                }
            });
        });
        return grid;
    }, [filteredCourses]);
    
    const fieldsById = useMemo(() => (fields || []).reduce((acc, f) => ({ ...acc, [f.id]: f }), {} as Record<string, Field>), [fields]);
    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.firstName[0]}. ${teacher.lastName}` : 'N/A';
    }
    
    const handleExportPDF = async () => {
        if (!settings) return;
        const doc = new jsPDF({ orientation: "landscape" });
        const selectedFieldName = selectedFieldId === 'all' ? 'Toutes les filières' : fieldsById[selectedFieldId]?.name || '';
        const levelName = selectedLevel === 'all' ? '' : ` - ${selectedLevel}`;
        const weekStartDate = format(currentWeek, 'd MMMM', { locale: fr });
        const weekEndDate = format(addDays(currentWeek, 5), 'd MMMM yyyy', { locale: fr });
        
        const logoDataUrl = await imageToDataUrl(settings.logoUrl);
        const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();

        doc.addImage(logoDataUrl, logoExtension, 14, 10, 20, 20);
        doc.setFontSize(18);
        doc.text(`Emploi du Temps - ${selectedFieldName}${levelName}`, 40, 22);
        doc.setFontSize(12);
        doc.text(`Semaine du ${weekStartDate} au ${weekEndDate}`, 40, 30);
        
        const head = [['Heure', ...daysOfWeek.map((day, index) => `${day}\n${format(addDays(currentWeek, index), 'dd/MM')}`)]];
        const body = timeSlots.map(slot => {
            const row: string[] = [slot];
            daysOfWeek.forEach(day => {
                const coursesInSlot = scheduleGrid[day]?.[slot] || [];
                const cellContent = coursesInSlot.map(course => {
                    const scheduleInfo = course.schedule?.find(s => s.day === day && s.start.startsWith(slot.slice(0, 2)));
                    return [
                        `Cours: ${course.name}`,
                        `Prof: ${getTeacherName(course.teacherId)}`,
                        `Salle: ${scheduleInfo?.room || 'N/A'}`,
                        `(${scheduleInfo?.start} - ${scheduleInfo?.end})`
                    ].join('\n');
                }).join('\n\n');
                row.push(cellContent);
            });
            return row;
        });

        autoTable(doc, {
            head: head,
            body: body,
            startY: 40,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 2,
                valign: 'middle',
                halign: 'center'
            },
            headStyles: {
                fillColor: [25, 95, 53], // Primary color
                textColor: 255,
                fontStyle: 'bold',
            },
        });
        
        doc.save(`emploi_du_temps_${selectedFieldName.replace(/\s/g, '_')}_${format(currentWeek, 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Exportation PDF', description: 'Le fichier PDF de l\'emploi du temps a été généré.' });
    };


    const isStudentView = currentUser?.role === 'student';
    const pageLoading = loading || userLoading;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Emploi du Temps</h1>
                <p className="text-muted-foreground">
                    Consultez l'emploi du temps de la semaine. Les cours sont automatiquement intégrés dès leur planification.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
                         <div>
                            <CardTitle>Grille de la semaine</CardTitle>
                            <CardDescription>
                               {isStudentView ? `Emploi du temps pour ${fieldsById[selectedFieldId]?.name || ''} - ${selectedLevel}` : "Vue hebdomadaire des cours planifiés."}
                            </CardDescription>
                         </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            {!isStudentView && (
                                <>
                                 <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Filtrer par niveau" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les niveaux</SelectItem>
                                        {(settings?.levels || []).map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
                                    <SelectTrigger className="w-[240px]">
                                        <SelectValue placeholder="Filtrer par filière" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les filières</SelectItem>
                                        {(fields || []).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                </>
                            )}
                             <Button variant="outline" onClick={handleExportPDF}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Exporter en PDF
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addDays(currentWeek, -7))}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold text-sm text-center min-w-[180px]">
                                    Semaine du {format(currentWeek, 'd MMMM yyyy', { locale: fr })}
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
                       {pageLoading ? (
                           <div className="space-y-2 p-4">
                               <Skeleton className="h-12 w-full" />
                               <Skeleton className="h-28 w-full" />
                               <Skeleton className="h-28 w-full" />
                               <Skeleton className="h-28 w-full" />
                           </div>
                       ) : (
                        <Table className="min-w-full border-collapse">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px] border-r">Heure</TableHead>
                                    {daysOfWeek.map((day, index) => (
                                        <TableHead key={day} className="border-r text-center">
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
                                    <TableRow key={slot} className="h-28">
                                        <TableCell className="font-medium align-top pt-3 border-r">{slot}</TableCell>
                                        {daysOfWeek.map(day => (
                                            <TableCell key={day} className="p-1 align-top border-r">
                                                {scheduleGrid[day][slot].map(course => {
                                                    const scheduleInfo = course.schedule?.find(s => s.day === day && s.start.startsWith(slot.slice(0,2)));
                                                    return (
                                                     <div key={course.id} className="bg-primary/10 border border-primary/20 p-2 rounded-lg text-xs mb-1 hover:bg-primary/20 transition-colors">
                                                        <Link href={`/dashboard/course-management?courseId=${course.id}`}>
                                                            <p className="font-bold text-primary truncate">{course.name}</p>
                                                            <p className="text-muted-foreground">{getTeacherName(course.teacherId)}</p>
                                                             {scheduleInfo && <p className="text-muted-foreground">{scheduleInfo.start} - {scheduleInfo.end}</p>}
                                                            <p className="text-muted-foreground">Salle: {scheduleInfo?.room}</p>
                                                        </Link>
                                                     </div>
                                                    )
                                                })}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                       )}
                    </div>
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

    
