
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, UserRole, Sector, Field, Cycle, Payment, OfficialDocument, Grade, Course, Attendance, FeeStructure, ActivityLog } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, FileUp, FileDown, Receipt, FileText, ClipboardList } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";
import StudentFormDialog from "@/components/student-form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, deleteDoc, updateDoc, collection, writeBatch, getDoc, serverTimestamp, getDocs, query, onSnapshot, addDoc, where } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};

const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

export default function StudentsPage() {
    const { user: adminUser, allUsers, loading: loadingUsers, setUsers, settings, fields, sectors, allCourses, grades, payments, feeStructures } = useUser();
    const [loadingData, setLoadingData] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filters state
    const [nameFilter, setNameFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [sectorFilter, setSectorFilter] = useState("all");
    const [fieldFilter, setFieldFilter] = useState("all");
    const [genderFilter, setGenderFilter] = useState("all");
    const [nationalityFilter, setNationalityFilter] = useState("all");
    
    useEffect(() => {
        setLoadingData(loadingUsers);
    }, [loadingUsers]);

    const studentsFromUsers = useMemo(() => {
        return (allUsers || [])
            .filter(u => u.role === 'student')
            .sort((a, b) => {
                const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
                const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });
    }, [allUsers]);

    const parents = useMemo(() => (allUsers || []).filter(u => u.role === 'parent'), [allUsers]);
    const fieldsById = useMemo(() => (fields || []).reduce((acc, f) => ({...acc, [f.id]: f}), {} as Record<string, Field>), [fields]);
    const sectorsById = useMemo(() => (sectors || []).reduce((acc, s) => ({...acc, [s.id]: s}), {} as Record<string, Sector>), [sectors]);

    const studentBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        studentsFromUsers.forEach(student => {
            const studentPayments = (payments || []).filter(p => p.studentId === student.uid && p.status === 'validated');
            const totalPaid = studentPayments.reduce((acc, p) => acc + p.amountPaid, 0);
            const totalExpected = studentPayments.reduce((acc, p) => acc + p.amountExpected, 0);
            balances[student.uid] = totalExpected - totalPaid;
        });
        return balances;
    }, [payments, studentsFromUsers]);


    const availableFields = useMemo(() => {
        if (sectorFilter === 'all') return fields;
        return (fields || []).filter(f => f.sectorId === sectorFilter);
    }, [sectorFilter, fields]);

    useEffect(() => {
        if (!availableFields.some(f => f.id === fieldFilter)) {
            setFieldFilter('all');
        }
    }, [sectorFilter, availableFields, fieldFilter]);
    
    const nationalities = useMemo(() => {
        const allNationalities = studentsFromUsers.map(s => s.nationality).filter((n): n is string => !!n);
        return Array.from(new Set(allNationalities));
    }, [studentsFromUsers]);


    const filteredStudents = useMemo(() => {
        return studentsFromUsers.filter(student => {
            const fullName = `${student.lastName} ${student.firstName}`.toLowerCase();
            const studentField = student.student?.fieldId ? fieldsById[student.student.fieldId] : null;
            const studentSectorId = studentField?.sectorId;

            return (
                (nameFilter === "" || fullName.includes(nameFilter.toLowerCase())) &&
                (levelFilter === "all" || student.student?.level === levelFilter) &&
                (sectorFilter === "all" || studentSectorId === sectorFilter) &&
                (fieldFilter === "all" || student.student?.fieldId === fieldFilter) &&
                (genderFilter === "all" || student.gender === genderFilter) &&
                (nationalityFilter === "all" || student.nationality === nationalityFilter)
            );
        });
    }, [studentsFromUsers, nameFilter, levelFilter, sectorFilter, fieldFilter, genderFilter, nationalityFilter, fieldsById]);

    const handleAdd = () => {
        setSelectedStudent(null);
        setIsFormOpen(true);
    }

    const handleEdit = (user: User) => {
        setSelectedStudent(user);
        setIsFormOpen(true);
    }

    const handleDelete = (user: User) => {
        setSelectedStudent(user);
        setIsDeleteOpen(true);
    }

    const generateAndStoreDocument = async (student: User, type: 'certificat' | 'bulletin') => {
        if(!adminUser) return;
        toast({
            variant: "destructive",
            title: "Fonctionnalité désactivée",
            description: `La génération de ${type}s est temporairement indisponible.`,
        });
    };
    

    const handleSave = async (studentData: Partial<User>, parentData?: Partial<User>, photoFile?: File | Blob) => {
        if (!adminUser) return;
        const batch = writeBatch(db);
        const isNewStudent = !selectedStudent;
        let studentUid = selectedStudent?.uid || doc(collection(db, "users")).id;
        let photoUrl = studentData.photoUrl || selectedStudent?.photoUrl;
        const studentFullName = `${studentData.lastName} ${studentData.firstName}`;

        try {
            if (photoFile && photoFile instanceof Blob) {
                const photoRef = ref(storage, `avatars/${studentUid}`);
                const snapshot = await uploadBytes(photoRef, photoFile);
                photoUrl = await getDownloadURL(snapshot.ref);
            }
            
            const finalStudentData: User = {
                ...(selectedStudent || {}),
                ...studentData,
                uid: studentUid,
                photoUrl: photoUrl || `https://picsum.photos/seed/${studentUid}/100/100`,
                role: 'student',
                status: selectedStudent?.status || 'active',
                createdAt: selectedStudent?.createdAt || new Date().toISOString(),
            } as User;
            
            const studentRef = doc(db, 'users', studentUid);

            if (parentData && parentData.email !== undefined) { // Create new parent
                const newParentId = doc(collection(db, "users")).id;
                const newParent: User = {
                   uid: newParentId,
                   createdAt: new Date().toISOString(),
                   status: 'active',
                   role: 'parent',
                   firstName: parentData.firstName!,
                   lastName: parentData.lastName!,
                   email: parentData.email,
                   phone: parentData.phone,
                   address: parentData.address,
                   photoUrl: `https://picsum.photos/seed/${newParentId}/100/100`,
                   parent: { childrenUids: [studentUid] }
                } as User;
                finalStudentData.student!.parentUid = newParentId;
                batch.set(doc(db, "users", newParentId), newParent);
            } else if (studentData.student?.parentUid) { // Link to existing parent
                const parentRef = doc(db, 'users', studentData.student.parentUid);
                const parentDoc = await getDoc(parentRef);
                if (parentDoc.exists()) {
                    const parent = parentDoc.data() as User;
                    const childrenUids = (parent.parent?.childrenUids || []).concat(studentUid);
                    const uniqueChildrenUids = Array.from(new Set(childrenUids));
                    batch.update(parentRef, { 'parent.childrenUids': uniqueChildrenUids });
                }
            } else {
                 if (finalStudentData.student) {
                    delete (finalStudentData.student as any).parentUid;
                 }
            }


            batch.set(studentRef, finalStudentData);
            
            // Activity Log
            const logRef = doc(collection(db, 'activityLogs'));
            const log: Omit<ActivityLog, 'id' | 'action'> & { action: string } = {
                actorId: adminUser.uid,
                actorName: `${adminUser.lastName} ${adminUser.firstName}`,
                action: isNewStudent ? 'student_created' : 'student_updated',
                entityType: 'student',
                entityId: studentUid,
                timestamp: new Date().toISOString(),
                details: `${isNewStudent ? 'A créé' : 'A mis à jour'} l'étudiant: ${studentFullName} (Matricule: ${finalStudentData.student?.matricule})`,
            };
            batch.set(logRef, log);

            if (isNewStudent && finalStudentData.student) {
                // Create the registration fee payment
                const feeStructure = (feeStructures || []).find(fs => fs.level === finalStudentData.student?.level && fs.cycle === finalStudentData.student?.cycle);
                if (feeStructure && feeStructure.registration > 0) {
                    const registrationPaymentRef = doc(collection(db, "payments"));
                    const cashTransactionRef = doc(collection(db, 'cashTransactions'));

                    const payment: Payment = {
                        id: registrationPaymentRef.id,
                        studentId: studentUid,
                        amountExpected: feeStructure.registration,
                        amountPaid: feeStructure.registration,
                        balance: 0,
                        month: "Inscription",
                        year: settings?.academicYear || new Date().getFullYear().toString(),
                        method: "cash",
                        status: "validated",
                        validatedBy: adminUser?.uid,
                        createdAt: new Date().toISOString(),
                        currency: feeStructure.currency,
                    };
                    batch.set(registrationPaymentRef, payment);

                    batch.set(cashTransactionRef, {
                        type: 'income',
                        category: 'tuition',
                        amount: payment.amountPaid,
                        currency: payment.currency,
                        description: `Inscription - ${finalStudentData.lastName} ${finalStudentData.firstName}`,
                        date: new Date().toISOString(),
                        createdBy: adminUser?.uid || 'system',
                        relatedDocId: payment.id,
                    });
                }
            }

            await batch.commit();
            toast({ title: selectedStudent ? "Étudiant mis à jour" : "Étudiant ajouté", description: isNewStudent ? "Les frais d'inscription ont été automatiquement générés." : "" });
            
        } catch (error) {
            console.error("Error saving student:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'étudiant." });
        }
    }
    
    const confirmDelete = async () => {
        if (!selectedStudent || !adminUser) return;
        
        const studentId = selectedStudent.uid;
        const studentName = `${selectedStudent.lastName} ${selectedStudent.firstName}`;
        const batch = writeBatch(db);
    
        try {
            // 1. Delete student document
            batch.delete(doc(db, "users", studentId));
    
            // 2. Query and delete related data in batches
            const collectionsToDelete = ['payments', 'grades', 'officialDocuments'];
            for (const coll of collectionsToDelete) {
                const q = query(collection(db, coll), where("studentId", "==", studentId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }

            // 3. Remove student from attendances
            const attendancesSnapshot = await getDocs(collection(db, 'attendances'));
            attendancesSnapshot.forEach(attendanceDoc => {
                const attendance = attendanceDoc.data() as Attendance;
                const studentAttendances = (attendance.studentAttendances || []).filter(sa => sa.studentId !== studentId);
                if (studentAttendances.length < attendance.studentAttendances.length) {
                    batch.update(attendanceDoc.ref, { studentAttendances });
                }
            });
            
            // 4. Unlink from parent
            if (selectedStudent.student?.parentUid) {
                const parentRef = doc(db, 'users', selectedStudent.student.parentUid);
                const parentDoc = await getDoc(parentRef);
                if (parentDoc.exists()) {
                    const parentData = parentDoc.data() as User;
                    const updatedChildren = parentData.parent?.childrenUids.filter(uid => uid !== studentId) || [];
                    batch.update(parentRef, { 'parent.childrenUids': updatedChildren });
                }
            }
            
            // 5. Delete avatar from storage
            if (selectedStudent.photoUrl && selectedStudent.photoUrl.includes('firebasestorage')) {
                 try {
                    const photoRef = ref(storage, selectedStudent.photoUrl);
                    await deleteObject(photoRef);
                } catch (storageError: any) {
                    if (storageError.code !== 'storage/object-not-found') {
                         console.error("Could not delete avatar from storage: ", storageError);
                    }
                }
            }

            // 6. Log the deletion
            const logRef = doc(collection(db, 'activityLogs'));
            const log: Omit<ActivityLog, 'id' | 'action'> & { action: string } = {
                actorId: adminUser.uid,
                actorName: `${adminUser.lastName} ${adminUser.firstName}`,
                action: 'student_deleted',
                entityType: 'student',
                entityId: studentId,
                timestamp: new Date().toISOString(),
                details: `A supprimé l'étudiant: ${studentName} (Matricule: ${selectedStudent.student?.matricule})`,
            };
            batch.set(logRef, log);
    
            await batch.commit();
            toast({ title: "Étudiant et données associées supprimés" });
    
        } catch (error) {
            console.error("Error deleting student and their data:", error);
            toast({ 
                variant: "destructive", 
                title: "Erreur de suppression", 
                description: "Impossible de supprimer l'étudiant et toutes ses données." 
            });
        } finally {
            setIsDeleteOpen(false);
            setSelectedStudent(null);
        }
    }
    
    const getParentName = (parentUid?: string) => {
        if (!parentUid) return 'N/A';
        const parent = parents.find(p => p.uid === parentUid);
        return parent ? `${parent.lastName} ${parent.firstName}` : 'Inconnu';
    };

    const getCoursesForStudent = (student: User) => {
        if (!student.student) return [];
        return (allCourses || []).filter(c => c.fieldId === student.student!.fieldId && c.level === student.student!.level);
    }

    const getExportData = () => {
        return filteredStudents.map(student => {
            const parent = student.student?.parentUid ? parents.find(p => p.uid === student.student!.parentUid) : null;
            return {
                "Nom": student.lastName,
                "Prénom": student.firstName,
                "Email": student.email,
                "Téléphone": student.phone,
                "Matricule": student.student?.matricule,
                "Niveau": student.student?.level,
                "Cycle": cycles.find(c => c.value === student.student?.cycle)?.label,
                "Filière": student.student?.fieldId ? fieldsById[student.student.fieldId]?.name : 'N/A',
                "Secteur": student.student?.fieldId && fieldsById[student.student.fieldId] ? sectorsById[fieldsById[student.student.fieldId].sectorId]?.name : 'N/A',
                "Date d'inscription": format(new Date(student.createdAt), 'd MMMM yyyy', { locale: fr }),
                "Solde Scolarité": studentBalances[student.uid] || 0,
                "Tuteur": parent ? `${parent.lastName} ${parent.firstName}` : 'N/A',
                "Email Tuteur": parent?.email,
                "Téléphone Tuteur": parent?.phone,
                "Lien Parental": student.student?.parentalLink
            };
        });
    }
    
    const handleExportXLSX = async () => {
        const XLSX = await import('xlsx');
        const exportData = getExportData();
        if (exportData.length === 0) {
            toast({ variant: "destructive", title: "Exportation impossible", description: "Aucun étudiant à exporter." });
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Étudiants");
        XLSX.writeFile(workbook, "liste_etudiants.xlsx");
        toast({ title: "Exportation XLSX réussie", description: `${filteredStudents.length} étudiants exportés.` });
    };


    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const XLSX = await import('xlsx');
                const bstr = event.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                
                const headers = data[0] as string[];
                const importedStudentsData = (data.slice(1) as string[][]).map(row => {
                    const studentRow: any = {};
                    headers.forEach((header, index) => {
                        studentRow[header] = row[index];
                    });
                    return studentRow;
                });
                
                const batch = writeBatch(db);

                for (const studentRow of importedStudentsData) {
                    const studentId = doc(collection(db, 'users')).id;
                    const fieldId = (fields || []).find(f => f.name.toLowerCase() === studentRow['Filière']?.toLowerCase())?.id;
                    const studentLevel = studentRow['Niveau'];

                    if (!fieldId || !studentLevel || !(settings?.levels || []).some(l => l.value === studentLevel)) {
                        console.warn(`Skipping student due to invalid field or level: ${studentRow['Nom']}`);
                        continue;
                    }

                    const studentCycle = cycles.find(c => c.label.toLowerCase() === studentRow['Cycle']?.toLowerCase())?.value || 'local';

                    const newUser: User = {
                        uid: studentId,
                        firstName: studentRow['Prénom'] || '',
                        lastName: studentRow['Nom'] || '',
                        email: studentRow['Email'] || `student${Date.now()}@isgi.com`,
                        phone: studentRow['Téléphone'] || '',
                        role: 'student',
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        photoUrl: `https://picsum.photos/seed/${studentId}/100/100`,
                        student: {
                           matricule: studentRow['Matricule'] || `ISGI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                           level: studentLevel,
                           fieldId: fieldId,
                           cycle: studentCycle,
                           enrollmentDate: new Date().toISOString(),
                           endDate: ''
                        }
                    };
                    const userDocRef = doc(db, 'users', studentId);
                    batch.set(userDocRef, newUser);

                     // Create registration fee payment
                    const feeStructure = (feeStructures || []).find(fs => fs.level === studentLevel && fs.cycle === studentCycle);
                    if (feeStructure && feeStructure.registration > 0) {
                        const registrationPaymentRef = doc(collection(db, "payments"));
                        const cashTransactionRef = doc(collection(db, 'cashTransactions'));
                        const payment: Payment = {
                            id: registrationPaymentRef.id,
                            studentId: studentId,
                            amountExpected: feeStructure.registration,
                            amountPaid: feeStructure.registration,
                            balance: 0,
                            month: "Inscription",
                            year: settings?.academicYear || new Date().getFullYear().toString(),
                            method: "cash",
                            status: "validated",
                            validatedBy: adminUser?.uid,
                            createdAt: new Date().toISOString(),
                            currency: feeStructure.currency,
                        };
                        batch.set(registrationPaymentRef, payment);
                        batch.set(cashTransactionRef, {
                            type: 'income',
                            category: 'tuition',
                            amount: payment.amountPaid,
                            currency: payment.currency,
                            description: `Inscription - ${newUser.lastName} ${newUser.firstName}`,
                            date: new Date().toISOString(),
                            createdBy: adminUser?.uid || 'system',
                            relatedDocId: payment.id,
                        });
                    }
                }
                
                await batch.commit();
                toast({ title: "Importation réussie", description: `${importedStudentsData.length} étudiants ont été ajoutés, avec leurs frais d'inscription.` });
            } catch (error) {
                console.error("Error importing file:", error);
                toast({ variant: "destructive", title: "Erreur d'importation", description: "Le fichier est peut-être corrompu ou mal formaté." });
            }
        };
        reader.readAsBinaryString(file);
        
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const loading = loadingUsers || loadingData;

    const formatCurrency = (amount: number, currency: string = 'XAF') => {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Étudiants</h1>
                    <p className="text-muted-foreground">
                        Consultez et gérez les informations des étudiants de l'institut.
                    </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" onClick={handleImportClick}>
                        <FileUp className="mr-2 h-4 w-4" /> Importer
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileImport}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <Button variant="outline" onClick={handleExportXLSX}>
                        <FileDown className="mr-2 h-4 w-4" /> Exporter
                    </Button>

                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Ajouter un étudiant
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des étudiants</CardTitle>
                    <CardDescription>
                        Filtrez, recherchez, ajoutez ou modifiez les profils des étudiants.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-wrap items-center gap-4 mb-6">
                        <Input 
                            placeholder="Rechercher par nom..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par niveau" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les niveaux</SelectItem>
                                {(settings?.levels || []).map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={genderFilter} onValueChange={setGenderFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par sexe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les sexes</SelectItem>
                                <SelectItem value="M">Masculin</SelectItem>
                                <SelectItem value="F">Féminin</SelectItem>
                            </SelectContent>
                        </Select>
                         <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par nationalité" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les nationalités</SelectItem>
                                {nationalities.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={sectorFilter} onValueChange={setSectorFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par secteur" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les secteurs</SelectItem>
                                {(sectors || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fieldFilter} onValueChange={setFieldFilter} disabled={sectorFilter === 'all'}>
                            <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Filtrer par filière" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les filières</SelectItem>
                                {(availableFields || []).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead className="hidden md:table-cell">Niveau</TableHead>
                                <TableHead className="hidden lg:table-cell">Solde Scolarité</TableHead>
                                <TableHead className="hidden lg:table-cell">Tuteur</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : filteredStudents.length > 0 ? filteredStudents.map(student => {
                                const balance = studentBalances[student.uid] || 0;
                                const studentCourses = getCoursesForStudent(student);
                                return (
                                <TableRow key={student.uid}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={student.photoUrl} alt={student.firstName} />
                                                <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid gap-0.5">
                                                <span className="font-semibold">{student.lastName} {student.firstName}</span>
                                                <span className="text-sm text-muted-foreground">{student.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="secondary">{student.student?.level || 'N/A'}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <Badge variant={balance > 0 ? "destructive" : "default"} className={balance <= 0 ? "bg-green-600" : ""}>
                                            {formatCurrency(balance, 'XAF')}
                                        </Badge>
                                    </TableCell>
                                     <TableCell className="hidden lg:table-cell">
                                        {getParentName(student.student?.parentUid)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem onClick={() => handleEdit(student)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifier le profil
                                               </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/tuition-management?studentId=${student.uid}`}>
                                                        <Receipt className="mr-2 h-4 w-4" />
                                                        Voir les paiements
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <ClipboardList className="mr-2 h-4 w-4" />
                                                        Gérer les notes
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent>
                                                            {(studentCourses || []).map(course => (
                                                                <DropdownMenuItem key={course.id} asChild>
                                                                    <Link href={`/dashboard/grade-management?courseId=${course.id}`}>
                                                                        {course.name}
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                               </DropdownMenuSub>
                                                <DropdownMenuItem asChild>
                                                     <Link href={`/dashboard/grades?studentId=${student.uid}`}>
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        Voir le relevé de notes
                                                    </Link>
                                                </DropdownMenuItem>
                                               <DropdownMenuSub>
                                                    <DropdownMenuSubTrigger>
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        Générer un document
                                                    </DropdownMenuSubTrigger>
                                                    <DropdownMenuPortal>
                                                        <DropdownMenuSubContent>
                                                            <DropdownMenuItem onClick={() => generateAndStoreDocument(student, 'certificat')}>Certificat de scolarité</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => generateAndStoreDocument(student, 'bulletin')}>Bulletin de notes</DropdownMenuItem>
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuPortal>
                                               </DropdownMenuSub>
                                                <DropdownMenuSeparator />
                                               <DropdownMenuItem onClick={() => handleDelete(student)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                )
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Aucun étudiant trouvé correspondant aux filtres.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <StudentFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                student={selectedStudent}
                parents={parents}
                students={studentsFromUsers}
            />
            {selectedStudent && <UserDeleteDialog
                isOpen={isDeleteOpen}
                setIsOpen={setIsDeleteOpen}
                onConfirm={confirmDelete}
                item={selectedStudent}
                title="Supprimer cet étudiant ?"
                description={`L'étudiant "${selectedStudent.lastName} ${selectedStudent.firstName}" et toutes ses données associées (notes, paiements, etc.) seront définitivement supprimés. Cette action est irréversible.`}
            />}
        </div>
    );
}
