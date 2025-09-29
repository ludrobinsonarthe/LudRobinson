

"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from '@/hooks/use-user';
import { Payment, Grade, TeacherSalary, CashTransaction, OfficialDocument, User, Course } from '@/lib/types';
import { FileText, Receipt, Banknote, Landmark, Loader2, FileDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { imageToDataUrl } from '@/lib/utils';

type DataType = 'payments' | 'grades' | 'salaries' | 'transactions' | 'documents';

const categoryTitles: Record<DataType, string> = {
    payments: 'Scolarité',
    grades: 'Notes',
    salaries: 'Salaires',
    transactions: 'Transactions de Caisse',
    documents: 'Documents Officiels',
};

export default function AcademicHistoryPage() {
    const { settings, allUsers: users, allCourses } = useUser();
    const { toast } = useToast();
    const [allData, setAllData] = useState<{
        payments: Payment[],
        grades: Grade[],
        salaries: TeacherSalary[],
        transactions: CashTransaction[],
        documents: OfficialDocument[]
    }>({ payments: [], grades: [], salaries: [], transactions: [], documents: [] });
    
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(settings?.academicYear || '');
    const [activeView, setActiveView] = useState<DataType | null>(null);

    const academicYears = useMemo(() => {
        const years = new Set<string>();
        if(settings?.academicYear) years.add(settings.academicYear);
        allData.payments.forEach(p => years.add(p.year));
        allData.salaries.forEach(s => years.add(s.year));
        allData.grades.forEach(g => years.add(g.academicYear));
        return Array.from(years).sort((a,b) => b.localeCompare(a));
    }, [allData, settings]);

    useEffect(() => {
        if (!selectedYear) return;

        setLoading(true);
        const [startYear, endYear] = selectedYear.split('-').map(Number);
        const academicYearStartDate = new Date(startYear, 6, 1); // July 1st of start year
        const academicYearEndDate = new Date(endYear, 5, 30); // June 30th of end year

        const qPayments = query(collection(db, 'payments'), where("year", "==", selectedYear));
        const qGrades = query(collection(db, 'grades'), where("academicYear", "==", selectedYear));
        const qSalaries = query(collection(db, 'teacherSalaries'), where("year", "==", selectedYear));
       
        const unsubPayments = onSnapshot(qPayments, snap => setAllData(d => ({...d, payments: snap.docs.map(doc => doc.data() as Payment)})));
        const unsubGrades = onSnapshot(qGrades, snap => setAllData(d => ({...d, grades: snap.docs.map(doc => doc.data() as Grade)})));
        const unsubSalaries = onSnapshot(qSalaries, snap => setAllData(d => ({...d, salaries: snap.docs.map(doc => doc.data() as TeacherSalary)})));
        
        const unsubDocs = onSnapshot(collection(db, 'officialDocuments'), snap => {
            const filteredDocs = snap.docs.map(doc => doc.data() as OfficialDocument).filter(d => {
                const issuedDate = new Date(d.issuedAt);
                return issuedDate >= academicYearStartDate && issuedDate <= academicYearEndDate;
            });
            setAllData(d => ({...d, documents: filteredDocs}));
        });
        
        const unsubTransactions = onSnapshot(collection(db, 'cashTransactions'), snap => {
            const filteredTransac = snap.docs.map(doc => doc.data() as CashTransaction).filter(t => {
                const transacDate = new Date(t.date);
                return transacDate >= academicYearStartDate && transacDate <= academicYearEndDate;
            });
            setAllData(d => ({...d, transactions: filteredTransac}));
        });

        const timer = setTimeout(() => setLoading(false), 500);

        return () => {
            unsubPayments();
            unsubSalaries();
            unsubDocs();
            unsubGrades();
            unsubTransactions();
            clearTimeout(timer);
        }
    }, [selectedYear]);
    
    const usersById = useMemo(() => users.reduce((acc, u) => ({...acc, [u.uid]: u}), {} as Record<string, User>), [users]);
    const coursesById = useMemo(() => (allCourses || []).reduce((acc, c) => ({...acc, [c.id]: c}), {} as Record<string, Course>), [allCourses]);

    const handleExportPDF = async () => {
        if (!activeView || !settings || allData[activeView].length === 0) {
            toast({
                variant: 'destructive',
                title: 'Exportation impossible',
                description: 'Veuillez sélectionner une catégorie avec des données à exporter.',
            });
            return;
        }

        const { jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
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
        
        const title = `Historique: ${categoryTitles[activeView]} - ${selectedYear}`;
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(title, 40, 25);

        let tableColumn: string[] = [];
        let tableRows: any[][] = [];

        switch(activeView) {
            case 'payments':
                tableColumn = ["Étudiant", "Montant", "Mois", "Date"];
                tableRows = (allData.payments as Payment[]).map(item => [
                    usersById[item.studentId]?.lastName || 'N/A',
                    item.amountPaid,
                    item.month,
                    format(new Date(item.createdAt), 'dd/MM/yyyy')
                ]);
                break;
            case 'grades':
                tableColumn = ["Étudiant", "Cours", "Note", "Type"];
                tableRows = (allData.grades as Grade[]).map(item => [
                    usersById[item.studentId]?.lastName || 'N/A',
                    coursesById[item.courseId]?.name || 'N/A',
                    `${item.score}/${item.total}`,
                    item.type
                ]);
                break;
            case 'salaries':
                tableColumn = ["Professeur", "Montant", "Mois", "Statut"];
                tableRows = (allData.salaries as TeacherSalary[]).map(item => [
                    usersById[item.teacherId]?.lastName || 'N/A',
                    item.totalSalary,
                    item.month,
                    item.status
                ]);
                break;
            case 'documents':
                tableColumn = ["Étudiant", "Type", "Date"];
                tableRows = (allData.documents as OfficialDocument[]).map(item => [
                    usersById[item.studentId]?.lastName || 'N/A',
                    item.type,
                    format(new Date(item.issuedAt), 'dd/MM/yyyy')
                ]);
                break;
            case 'transactions':
                tableColumn = ["Description", "Montant", "Type", "Date"];
                tableRows = (allData.transactions as CashTransaction[]).map(item => [
                    item.description,
                    item.amount,
                    item.type,
                    format(new Date(item.date), 'dd/MM/yyyy')
                ]);
                break;
        }

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
        });

        const fileName = `historique_${activeView}_${selectedYear}.pdf`;
        doc.save(fileName);
        toast({ title: 'Téléchargement réussi', description: `Le fichier ${fileName} a été généré.` });
    };

    const renderContent = () => {
        if (loading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>;
        if (!activeView) return <p className="text-center text-muted-foreground">Sélectionnez une catégorie à afficher.</p>;
        
        const data = allData[activeView];
        if (data.length === 0) return <p className="text-center text-muted-foreground">Aucune donnée pour cette catégorie et cette année.</p>;
        
        switch (activeView) {
            case 'payments':
                return (
                    <Table>
                        <TableHeader><TableRow><TableHead>Étudiant</TableHead><TableHead>Montant</TableHead><TableHead>Mois</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {(data as Payment[]).map((item, index) => (
                                <TableRow key={`${item.id}-${index}`}><TableCell>{usersById[item.studentId]?.lastName || 'N/A'}</TableCell><TableCell>{item.amountPaid}</TableCell><TableCell>{item.month}</TableCell><TableCell>{format(new Date(item.createdAt), 'dd/MM/yyyy')}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                );
            case 'grades':
                return (
                     <Table>
                        <TableHeader><TableRow><TableHead>Étudiant</TableHead><TableHead>Cours</TableHead><TableHead>Note</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {(data as Grade[]).map((item, index) => (
                                <TableRow key={`${item.id}-${index}`}><TableCell>{usersById[item.studentId]?.lastName || 'N/A'}</TableCell><TableCell>{coursesById[item.courseId]?.name || 'N/A'}</TableCell><TableCell>{item.score}/{item.total}</TableCell><TableCell>{item.type}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )
            case 'salaries':
                return (
                     <Table>
                        <TableHeader><TableRow><TableHead>Professeur</TableHead><TableHead>Montant</TableHead><TableHead>Mois</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {(data as TeacherSalary[]).map((item, index) => (
                                <TableRow key={`${item.id}-${index}`}><TableCell>{usersById[item.teacherId]?.lastName || 'N/A'}</TableCell><TableCell>{item.totalSalary}</TableCell><TableCell>{item.month}</TableCell><TableCell>{item.status}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )
            case 'documents':
                 return (
                     <Table>
                        <TableHeader><TableRow><TableHead>Étudiant</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {(data as OfficialDocument[]).map((item, index) => (
                                <TableRow key={`${item.id}-${index}`}>
                                    <TableCell>{usersById[item.studentId]?.lastName || 'N/A'}</TableCell>
                                    <TableCell>{item.type}</TableCell>
                                    <TableCell>{format(new Date(item.issuedAt), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell><Button asChild variant="link"><a href={item.fileUrl} target="_blank" rel="noopener noreferrer">Voir</a></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )
            case 'transactions':
                return (
                     <Table>
                        <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Montant</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {(data as CashTransaction[]).map((item, index) => (
                                <TableRow key={`${item.id}-${index}`} className={item.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell>{item.amount}</TableCell>
                                    <TableCell>{item.type}</TableCell>
                                    <TableCell>{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Historique Académique</h1>
                <p className="text-muted-foreground">
                    Consultez les archives de l'établissement, année par année.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Archives de l'année</CardTitle>
                        <div className="flex items-center gap-2">
                             <Button variant="outline" onClick={handleExportPDF} disabled={!activeView}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Exporter en PDF
                            </Button>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Sélectionner une année..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {academicYears.map(year => (
                                        <SelectItem key={year} value={year}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <CardDescription>
                        Sélectionnez une année et une catégorie pour afficher les données archivées correspondantes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                        <div className="md:col-span-1 flex md:flex-col gap-2">
                             <Button variant={activeView === 'payments' ? 'default' : 'outline'} onClick={() => setActiveView('payments')} className="justify-start"><Receipt className="mr-2 h-4 w-4"/> Scolarité</Button>
                             <Button variant={activeView === 'salaries' ? 'default' : 'outline'} onClick={() => setActiveView('salaries')} className="justify-start"><Banknote className="mr-2 h-4 w-4"/> Salaires</Button>
                             <Button variant={activeView === 'grades' ? 'default' : 'outline'} onClick={() => setActiveView('grades')} className="justify-start"><FileText className="mr-2 h-4 w-4"/> Notes</Button>
                             <Button variant={activeView === 'documents' ? 'default' : 'outline'} onClick={() => setActiveView('documents')} className="justify-start"><FileText className="mr-2 h-4 w-4"/> Documents</Button>
                             <Button variant={activeView === 'transactions' ? 'default' : 'outline'} onClick={() => setActiveView('transactions')} className="justify-start"><Landmark className="mr-2 h-4 w-4"/> Caisse</Button>
                        </div>
                        <div className="md:col-span-4 border rounded-lg p-4 min-h-[300px]">
                            {renderContent()}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
