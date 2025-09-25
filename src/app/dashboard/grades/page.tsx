
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { Grade, Course, User } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { FileDown, ArrowLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { imageToDataUrl } from '@/lib/utils';

interface CourseWithGrades extends Course {
    grades: Grade[];
    average: number;
}

export default function GradesPage() {
    const { user: currentUser, allUsers: users, allCourses, settings, fields } = useUser();
    const router = useRouter();
    const searchParams = useSearchParams();
    const studentIdFromParams = searchParams.get('studentId');
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const { toast } = useToast();
    
    const fieldsById = useMemo(() => (fields || []).reduce((acc, f) => ({ ...acc, [f.id]: f }), {} as Record<string, any>), [fields]);


     const children = useMemo(() => {
        if (currentUser?.role !== 'parent') return [];
        return (users || []).filter(u => currentUser.parent?.childrenUids.includes(u.uid));
    }, [currentUser, users]);

    const studentToView = useMemo(() => {
        if (currentUser?.role === 'student') return currentUser;
        if (currentUser?.role === 'admin' && studentIdFromParams) return (users || []).find(u => u.uid === studentIdFromParams);
        if (currentUser?.role === 'parent') return (users || []).find(u => u.uid === selectedStudentId);
        return null;
    }, [currentUser, users, selectedStudentId, studentIdFromParams]);
    
    useEffect(() => {
        if(studentIdFromParams) {
            setSelectedStudentId(studentIdFromParams);
        } else if (currentUser?.role === 'parent' && children.length > 0 && !selectedStudentId) {
            setSelectedStudentId(children[0].uid);
        }
    }, [currentUser, children, selectedStudentId, studentIdFromParams]);

    useEffect(() => {
        if (!studentToView || !studentToView.uid) {
            setLoading(false);
            setGrades([]);
            return;
        }

        setLoading(true);
        const q = query(collection(db, "grades"), where("studentId", "==", studentToView.uid));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const studentGrades = snapshot.docs.map(doc => ({id: doc.id, ...doc.data() } as Grade));
            setGrades(studentGrades);
            setLoading(false);
        });

        return () => unsubscribe();
        
    }, [studentToView]);

    const coursesWithGrades = useMemo((): CourseWithGrades[] => {
        if (grades.length === 0 || !allCourses || allCourses.length === 0) return [];

        const courseMap: { [key: string]: CourseWithGrades } = {};

        // Group grades by course
        grades.forEach(grade => {
            if (!courseMap[grade.courseId]) {
                 const courseInfo = allCourses.find(c => c.id === grade.courseId);
                 if (courseInfo) {
                    courseMap[grade.courseId] = { ...courseInfo, grades: [], average: 0 };
                 }
            }
            if (courseMap[grade.courseId]) {
                courseMap[grade.courseId].grades.push(grade);
            }
        });
        
        // Calculate average for each course
        Object.values(courseMap).forEach(course => {
            if(course.grades.length > 0) {
                const dc = course.grades.find(g => g.type === 'devoir de classe');
                const dr = course.grades.find(g => g.type === 'devoir de recherche');
                const exam = course.grades.find(g => g.type === 'examen');
                
                const getScoreOutOf20 = (grade: Grade | undefined) => grade ? (grade.score / grade.total) * 20 : 0;
                
                let nc = 0; // Note de classe out of 20
                const dcScore20 = dc ? getScoreOutOf20(dc) : null;
                const drScore20 = dr ? getScoreOutOf20(dr) : null;

                if (dcScore20 !== null && drScore20 !== null) {
                    nc = (dcScore20 + drScore20) / 2;
                } else if (dcScore20 !== null) {
                    nc = dcScore20;
                } else if (drScore20 !== null) {
                    nc = drScore20;
                }

                const examScore20 = getScoreOutOf20(exam);

                const finalScoreOutOf20 = (nc * 0.4) + (examScore20 * 0.6);
                course.average = finalScoreOutOf20;
            }
        });

        return Object.values(courseMap).filter(c => c.grades.length > 0);

    }, [grades, allCourses]);

    const overallAverage = useMemo((): number => {
        if (coursesWithGrades.length === 0) return 0;
        
        const totalSum = coursesWithGrades.reduce((acc, course) => {
            const credit = course.credit || 1;
            return acc + (course.average * credit);
        }, 0);
        const totalCredits = coursesWithGrades.reduce((acc, course) => acc + (course.credit || 1), 0);
        
        return totalCredits > 0 ? totalSum / totalCredits : 0;

    }, [coursesWithGrades]);


    const handleChildChange = (studentId: string) => {
        setSelectedStudentId(studentId);
    }
    
    const handleExportPDF = async () => {
        if (!studentToView || !settings) return;

        const doc = new jsPDF();
        const schoolName = settings.schoolName;
        const academicYear = settings.academicYear;
        const studentName = `${studentToView.lastName} ${studentToView.firstName}`;
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if (logoDataUrl) {
                const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
                doc.addImage(logoDataUrl, logoExtension, 14, 10, 20, 20);
            }
        } catch (error) {
            console.error("Error loading logo for PDF", error);
        }


        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(schoolName, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
        doc.setFontSize(14);
        doc.text(`Bulletin de Notes - ${academicYear}`, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

        // Student Info
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Étudiant(e): ${studentName}`, 14, 45);
        doc.text(`Matricule: ${studentToView.student?.matricule || 'N/A'}`, 14, 52);
        doc.text(`Niveau: ${studentToView.student?.level || 'N/A'}`, doc.internal.pageSize.getWidth() - 14, 45, { align: 'right' });
        doc.text(`Filière: ${studentToView.student?.fieldId && fieldsById[studentToView.student.fieldId] ? fieldsById[studentToView.student.fieldId].name : 'N/A'}`, doc.internal.pageSize.getWidth() - 14, 52, { align: 'right' });
        
        // Grades Table
        const tableColumn = ["Matière", "Crédit", "Devoir de Classe", "Devoir de Recherche", "Examen", "Moyenne /20"];
        const tableRows: (string | number)[][] = [];

        coursesWithGrades.forEach(course => {
            const dc = course.grades.find(g => g.type === 'devoir de classe');
            const dr = course.grades.find(g => g.type === 'devoir de recherche');
            const exam = course.grades.find(g => g.type === 'examen');

            tableRows.push([
                course.name,
                course.credit,
                dc ? `${dc.score}/${dc.total}` : 'N/A',
                dr ? `${dr.score}/${dr.total}` : 'N/A',
                exam ? `${exam.score}/${exam.total}` : 'N/A',
                course.average.toFixed(2),
            ]);
        });

        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 60, theme: 'grid' });

        // Footer
        const finalY = (doc as any).lastAutoTable.finalY || 100;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Moyenne Générale: ${overallAverage.toFixed(2)} / 20`, doc.internal.pageSize.getWidth() - 14, finalY + 20, { align: 'right' });
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Fait à ___________, le ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`, 14, doc.internal.pageSize.getHeight() - 30);
        doc.text("Signature de la Direction", doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 30, { align: 'right' });
        
        doc.save(`bulletin_${studentToView.lastName}_${studentToView.firstName}.pdf`);
        toast({ title: 'Bulletin de notes généré', description: `Le bulletin pour ${studentName} a été téléchargé.` });
    };

    const pageTitle = studentToView ? `Relevé de notes de ${studentToView.lastName} ${studentToView.firstName}` : "Mes Notes";
    const pageDescription = studentToView ? "Voici le résumé de ses performances académiques." : "Consultez vos notes et résultats pour chaque matière.";


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                 {currentUser?.role === 'admin' && studentIdFromParams && (
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                )}
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">{pageTitle}</h1>
                    <p className="text-muted-foreground">
                        {pageDescription}
                    </p>
                </div>
            </div>
             {currentUser?.role === 'parent' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sélection de l'enfant</CardTitle>
                        <CardDescription>
                            Choisissez l'enfant dont vous souhaitez consulter les notes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       {children.length > 0 ? (
                            <Select onValueChange={handleChildChange} value={selectedStudentId || ""}>
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue placeholder="Sélectionner un enfant..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {children.map(child => (
                                        <SelectItem key={child.uid} value={child.uid}>
                                            {child.lastName} {child.firstName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                       ) : (
                           <p className="text-sm text-muted-foreground">Aucun enfant n'est associé à votre compte.</p>
                       )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <div className="flex flex-row items-center justify-between">
                         <div>
                            <CardTitle>Relevé de notes</CardTitle>
                            <CardDescription>
                                Résumé des performances académiques.
                            </CardDescription>
                        </div>
                        <div className='flex items-center gap-4'>
                            {coursesWithGrades.length > 0 && studentToView && (
                                <Button variant="outline" onClick={handleExportPDF}>
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Exporter en PDF
                                </Button>
                            )}
                            {coursesWithGrades.length > 0 && (
                                <div className='text-right'>
                                    <p className='text-lg text-muted-foreground'>Moyenne Générale</p>
                                    <p className='font-bold text-3xl text-primary'>{overallAverage.toFixed(2)} / 20</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                   {loading ? (
                       <div className="flex items-center justify-center h-48">
                            <p>Chargement des notes...</p>
                        </div>
                   ) : coursesWithGrades.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {coursesWithGrades.map(course => (
                                <Card key={course.id} className="flex flex-col">
                                    <CardHeader>
                                        <div className='flex justify-between items-start'>
                                            <CardTitle className='font-semibold text-xl'>{course.name}</CardTitle>
                                            <div className='text-right'>
                                                <p className='text-sm text-muted-foreground'>Moyenne /20</p>
                                                <p className='font-bold text-2xl text-primary'>{course.average.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Type d'évaluation</TableHead>
                                                    <TableHead className="text-right">Note</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {course.grades.map(grade => (
                                                    <TableRow key={grade.id + '-' + grade.type}>
                                                        <TableCell><Badge variant="outline" className="capitalize">{grade.type}</Badge></TableCell>
                                                        <TableCell className='font-medium text-right'>{grade.score}/{grade.total}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                    <CardFooter>
                                         <p className="text-xs text-muted-foreground">Crédit de la matière: {course.credit}</p>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                   ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[300px]">
                        <h3 className="text-xl font-bold tracking-tight">Aucune note disponible</h3>
                        <p className="text-sm text-muted-foreground">
                           {!studentToView ? "Veuillez d'abord sélectionner un étudiant." : "Les notes de cet étudiant n'ont pas encore été publiées."}
                        </p>
                    </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}

    
