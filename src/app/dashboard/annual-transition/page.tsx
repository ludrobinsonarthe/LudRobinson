

"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from '@/hooks/use-user';
import { User, Grade, Course } from '@/lib/types';
import { ArrowRight, CheckCircle, GraduationCap, Loader2, Users, Repeat, FileDown, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { imageToDataUrl } from '@/lib/utils';


const PASSING_GRADE = 10;

type StudentWithAverage = User & { average: number; hasGrades: boolean };
type ListType = 'promus' | 'diplômés' | 'redoublants' | 'sans_notes';


export default function AnnualTransitionPage() {
    const { allUsers: users, loading, settings, setUsers, courses, grades } = useUser();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListDialogOpen, setIsListDialogOpen] = useState(false);
    const [listToShow, setListToShow] = useState<StudentWithAverage[]>([]);
    const [listTitle, setListTitle] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const activeStudents = useMemo(() => users.filter(u => u.role === 'student' && u.status === 'active'), [users]);
    
    const getOverallAverage = (studentId: string, studentCourses: Course[]): { average: number, hasGrades: boolean } => {
        const studentGrades = grades.filter(g => g.studentId === studentId);
        if (studentGrades.length === 0 || studentCourses.length === 0) return { average: 0, hasGrades: false };

        let totalWeightedAverage = 0;
        let totalCredits = 0;
        let hasAnyGrade = false;

        studentCourses.forEach(course => {
            const courseGrades = studentGrades.filter(g => g.courseId === course.id);
            if (courseGrades.length > 0) {
                 hasAnyGrade = true;
                const dc = courseGrades.find(g => g.type === 'devoir de classe');
                const dr = courseGrades.find(g => g.type === 'devoir de recherche');
                const exam = courseGrades.find(g => g.type === 'examen');
                
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

                const finalCourseAverage = (nc * 0.4) + (examScore20 * 0.6);
                
                totalWeightedAverage += finalCourseAverage * (course.credit || 1);
                totalCredits += (course.credit || 1);
            }
        });

        if (!hasAnyGrade) return { average: 0, hasGrades: false };

        const average = totalCredits > 0 ? totalWeightedAverage / totalCredits : 0;
        return { average, hasGrades: true };
    };
    
    const getNextLevel = (currentLevel: string): string | null => {
        if (!settings?.levels) return null;
        const currentIndex = settings.levels.findIndex(l => l.value === currentLevel);
        if (currentIndex > -1 && currentIndex < settings.levels.length - 1) {
            return settings.levels[currentIndex + 1].value;
        }
        return null; // This is the last level, student will graduate
    };

    const transitionPlan = useMemo(() => {
        const studentsToPromote: StudentWithAverage[] = [];
        const studentsToRepeat: StudentWithAverage[] = [];
        const studentsToGraduate: StudentWithAverage[] = [];
        const studentsWithNoGrades: StudentWithAverage[] = [];

        activeStudents.forEach(student => {
             if (student.student?.fieldId && student.student?.level) {
                const studentCourses = courses.filter(c => c.fieldId === student.student!.fieldId && c.level === student.student!.level);
                const { average, hasGrades } = getOverallAverage(student.uid, studentCourses);
                const studentWithAvg = { ...student, average, hasGrades };

                if (!hasGrades) {
                    studentsWithNoGrades.push(studentWithAvg);
                    return;
                }

                if (average >= PASSING_GRADE) {
                    const nextLevel = getNextLevel(student.student.level);
                    if (nextLevel) {
                        studentsToPromote.push(studentWithAvg);
                    } else {
                        studentsToGraduate.push(studentWithAvg);
                    }
                } else {
                    studentsToRepeat.push(studentWithAvg);
                }
            }
        });
        
        return { studentsToPromote, studentsToRepeat, studentsToGraduate, studentsWithNoGrades };

    }, [activeStudents, courses, grades, settings]);


    const handleShowList = (type: ListType) => {
        switch(type) {
            case 'promus':
                setListToShow(transitionPlan.studentsToPromote);
                setListTitle("Liste des étudiants promus");
                break;
            case 'diplômés':
                setListToShow(transitionPlan.studentsToGraduate);
                setListTitle("Liste des futurs diplômés");
                break;
            case 'redoublants':
                setListToShow(transitionPlan.studentsToRepeat);
                setListTitle("Liste des étudiants redoublants");
                break;
            case 'sans_notes':
                setListToShow(transitionPlan.studentsWithNoGrades);
                setListTitle("Liste des étudiants sans notes");
                break;
        }
        setIsListDialogOpen(true);
    };

    const handlePromoteStudents = async () => {
        setIsProcessing(true);
        const batch = writeBatch(db);

        const { studentsToPromote, studentsToGraduate } = transitionPlan;

        studentsToPromote.forEach(student => {
            const nextLevel = getNextLevel(student.student!.level!);
            const studentRef = doc(db, 'users', student.uid);
            batch.update(studentRef, { 'student.level': nextLevel });
        });

        studentsToGraduate.forEach(student => {
            const studentRef = doc(db, 'users', student.uid);
            batch.update(studentRef, { 'status': 'graduated' });
        });

        try {
            await batch.commit();

            // Manually update the local user state to reflect changes immediately
            setUsers(currentUsers => {
                const updatedUsersMap = new Map(currentUsers.map(u => [u.uid, u]));
                studentsToPromote.forEach(u => updatedUsersMap.set(u.uid, { ...u, student: { ...u.student!, level: getNextLevel(u.student!.level!)! } }));
                studentsToGraduate.forEach(u => updatedUsersMap.set(u.uid, { ...u, status: 'graduated' }));
                return Array.from(updatedUsersMap.values());
            });

            toast({
                title: "Transition réussie !",
                description: `${studentsToPromote.length} étudiants promus, ${studentsToGraduate.length} diplômés et ${transitionPlan.studentsToRepeat.length} redoublants.`,
            });
            
            router.refresh();

        } catch (error) {
            console.error("Error promoting students: ", error);
            toast({
                variant: 'destructive',
                title: "Erreur lors de la transition",
                description: "Une erreur s'est produite. Veuillez réessayer.",
            });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDownloadList = async () => {
        if (!settings || listToShow.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Erreur',
                description: 'Impossible de générer le PDF : aucune donnée à afficher ou paramètres manquants.',
            });
            return;
        }

        const doc = new jsPDF();
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if(logoDataUrl) {
                const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
                doc.addImage(logoDataUrl, logoExtension, 14, 10, 20, 20);
            }
        } catch (error) {
            console.error("Could not add logo to PDF, proceeding without it.", error);
        }
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(`${listTitle} - Année ${settings.academicYear}`, 40, 25);
        
        const tableColumn = ["NOM", "Prénom", "Matricule", "Moyenne /20"];
        const tableRows: (string | number)[][] = [];

        listToShow.forEach(student => {
            const studentData = [
                student.lastName,
                student.firstName,
                student.student?.matricule || 'N/A',
                student.hasGrades ? student.average.toFixed(2) : 'N/A',
            ];
            tableRows.push(studentData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
        });

        const fileName = `${listTitle.toLowerCase().replace(/ /g, '_')}_${settings.academicYear}.pdf`;
        doc.save(fileName);
        toast({ title: 'Téléchargement réussi', description: `Le fichier ${fileName} a été généré.` });
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Transition Annuelle</h1>
                <p className="text-muted-foreground">
                    Gérez le passage des étudiants à l'année académique suivante. Seuls les étudiants avec une moyenne de {PASSING_GRADE}/20 ou plus seront promus.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Aperçu de la Transition pour l'Année {settings?.academicYear}</CardTitle>
                    <CardDescription>
                        Prévisualisation des promotions, redoublements et diplômes basés sur les notes actuelles. Cliquez sur une carte pour voir la liste détaillée.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <button onClick={() => handleShowList('promus')} className="text-left">
                        <Card className="text-center bg-green-500/10 border-green-500 hover:bg-green-500/20 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center justify-center gap-2"><CheckCircle className="h-4 w-4" /> Promus</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{transitionPlan.studentsToPromote.length}</p>
                                <p className="text-xs text-muted-foreground">étudiants admis</p>
                            </CardContent>
                        </Card>
                     </button>
                     <button onClick={() => handleShowList('diplômés')} className="text-left">
                        <Card className="text-center bg-blue-500/10 border-blue-500 hover:bg-blue-500/20 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center justify-center gap-2"><GraduationCap className="h-4 w-4"/> Diplômés</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{transitionPlan.studentsToGraduate.length}</p>
                                <p className="text-xs text-muted-foreground">étudiants en fin de cycle</p>
                            </CardContent>
                        </Card>
                     </button>
                     <button onClick={() => handleShowList('redoublants')} className="text-left">
                        <Card className="text-center bg-orange-500/10 border-orange-500 hover:bg-orange-500/20 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center justify-center gap-2"><Repeat className="h-4 w-4"/> Redoublants</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{transitionPlan.studentsToRepeat.length}</p>
                                <p className="text-xs text-muted-foreground">étudiants non admis</p>
                            </CardContent>
                        </Card>
                    </button>
                    <button onClick={() => handleShowList('sans_notes')} className="text-left">
                        <Card className="text-center bg-gray-500/10 border-gray-500 hover:bg-gray-500/20 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center justify-center gap-2"><AlertTriangle className="h-4 w-4"/> En Attente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{transitionPlan.studentsWithNoGrades.length}</p>
                                <p className="text-xs text-muted-foreground">étudiants sans notes</p>
                            </CardContent>
                        </Card>
                    </button>
                </CardContent>
            </Card>

            <Card className="bg-destructive/10 border-destructive">
                <CardHeader>
                    <CardTitle>Action de Transition</CardTitle>
                    <CardDescription>
                        Cette opération mettra à jour le statut et/ou le niveau de chaque étudiant actif en fonction de sa moyenne annuelle. Cette action est irréversible pour l'année en cours.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isProcessing}>
                                {isProcessing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                )}
                                Lancer la transition des étudiants
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmer la transition annuelle ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est majeure et ne peut pas être annulée facilement.
                                    Les étudiants avec une moyenne supérieure ou égale à {PASSING_GRADE}/20 seront promus. Les autres redoubleront. Les étudiants en fin de cycle seront diplômés.
                                    <br/><br/>
                                    Assurez-vous que toutes les notes sont finalisées avant de continuer. Les étudiants sans notes ne seront pas affectés.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isProcessing}>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePromoteStudents} disabled={isProcessing}>
                                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Oui, confirmer et lancer la transition
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{listTitle}</DialogTitle>
                        <DialogDescription>
                            Liste des étudiants concernés par cette catégorie.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Étudiant</TableHead>
                                    <TableHead>Matricule</TableHead>
                                    <TableHead className="text-right">Moyenne</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {listToShow.length > 0 ? listToShow.map(student => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-medium">{student.lastName} {student.firstName}</TableCell>
                                        <TableCell>{student.student?.matricule}</TableCell>
                                        <TableCell className={`text-right font-bold ${!student.hasGrades ? 'text-muted-foreground' : ''}`}>
                                            {student.hasGrades ? `${student.average.toFixed(2)} / 20` : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">Aucun étudiant dans cette catégorie.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                     <DialogFooter>
                        <Button variant="outline" onClick={handleDownloadList} disabled={listToShow.length === 0}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Télécharger la liste (PDF)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
