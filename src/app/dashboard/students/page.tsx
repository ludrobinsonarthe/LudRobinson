

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import { User, UserRole, Class, Sector, Field, Cycle, Payment } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, FileUp, FileDown, Receipt } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";
import { mockClasses, mockSectors, mockFields } from "@/lib/mock-data";
import StudentFormDialog from "@/components/student-form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, deleteDoc, updateDoc, collection, writeBatch, getDoc, serverTimestamp, onSnapshot, query } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

const levels = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"];
const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

export default function StudentsPage() {
    const { users, loading: loadingUsers } = useUser();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
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
    
    useEffect(() => {
        const q = query(collection(db, "payments"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const paymentsFromDb: Payment[] = [];
            snapshot.forEach((doc) => {
                paymentsFromDb.push({ id: doc.id, ...doc.data() } as Payment);
            });
            setPayments(paymentsFromDb);
            setLoadingPayments(false);
        });
        return () => unsubscribe();
    }, []);

    const studentsFromUsers = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const parents = useMemo(() => users.filter(u => u.role === 'parent'), [users]);
    const fieldsById = useMemo(() => mockFields.reduce((acc, f) => ({...acc, [f.id]: f}), {} as Record<string, Field>), []);
    const sectorsById = useMemo(() => mockSectors.reduce((acc, s) => ({...acc, [s.id]: s}), {} as Record<string, Sector>), []);

    const studentBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        studentsFromUsers.forEach(student => {
            const studentPayments = payments.filter(p => p.studentId === student.uid && p.status === 'validated');
            const totalPaid = studentPayments.reduce((acc, p) => acc + p.amountPaid, 0);
            const totalExpected = studentPayments.reduce((acc, p) => acc + p.amountExpected, 0);
            balances[student.uid] = totalExpected - totalPaid;
        });
        return balances;
    }, [payments, studentsFromUsers]);


    const availableFields = useMemo(() => {
        if (sectorFilter === 'all') return mockFields;
        return mockFields.filter(f => f.sectorId === sectorFilter);
    }, [sectorFilter]);

    useEffect(() => {
        setFieldFilter("all");
    }, [sectorFilter]);

    const filteredStudents = useMemo(() => {
        return studentsFromUsers.filter(student => {
            const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
            const studentField = student.student?.fieldId ? fieldsById[student.student.fieldId] : null;
            const studentSectorId = studentField?.sectorId;

            return (
                (nameFilter === "" || fullName.includes(nameFilter.toLowerCase())) &&
                (levelFilter === "all" || student.student?.level === levelFilter) &&
                (sectorFilter === "all" || studentSectorId === sectorFilter) &&
                (fieldFilter === "all" || student.student?.fieldId === fieldFilter)
            );
        });
    }, [studentsFromUsers, nameFilter, levelFilter, sectorFilter, fieldFilter, fieldsById]);

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

    const handleSave = async (studentData: Partial<User>, parentData?: Partial<User>, photoFile?: File) => {
        try {
            let studentUid = selectedStudent?.uid;
            if (!studentUid) {
                studentUid = doc(collection(db, "users")).id;
            }

            let photoUrl = studentData.photoUrl || selectedStudent?.photoUrl;
            if (photoFile && studentUid) {
                const storageRef = ref(storage, `profile-pictures/${studentUid}/${photoFile.name}`);
                const uploadResult = await uploadBytes(storageRef, photoFile);
                photoUrl = await getDownloadURL(uploadResult.ref);
            }
            
            const finalStudentData = { ...studentData, photoUrl: photoUrl || `https://picsum.photos/seed/${studentUid}/100/100` };

            if (selectedStudent) {
                // Edit existing student
                const studentRef = doc(db, "users", selectedStudent.uid);
                await updateDoc(studentRef, finalStudentData);
                toast({ title: "Étudiant mis à jour", description: "Les informations de l'étudiant ont été mises à jour." });
            } else {
                 // Add new student and potentially a new parent
                const batch = writeBatch(db);
                
                const newStudent: User = {
                    uid: studentUid,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    role: 'student',
                    ...finalStudentData,
                } as User;

                let newParentId: string | undefined;

                if (parentData && parentData.email) {
                    newParentId = doc(collection(db, "users")).id;
                    const newParent : User = {
                       uid: newParentId,
                       createdAt: new Date().toISOString(),
                       status: 'active',
                       role: 'parent',
                       ...parentData,
                       parent: { childrenUids: [newStudent.uid] }
                    } as User;
                    newStudent.student!.parentUid = newParent.uid;
                    batch.set(doc(db, "users", newParentId), newParent);

                } else if (studentData.student?.parentUid) {
                    const parentRef = doc(db, "users", studentData.student.parentUid);
                    const parentSnap = await getDoc(parentRef);
                    if(parentSnap.exists()) {
                        const parent = parentSnap.data() as User;
                        const childrenUids = [...(parent.parent?.childrenUids || []), newStudent.uid];
                        batch.update(parentRef, { "parent.childrenUids": childrenUids });
                    }
                }
                
                batch.set(doc(db, "users", studentUid), newStudent);
                await batch.commit();
                toast({ title: "Étudiant ajouté", description: "Le nouvel étudiant a été ajouté avec succès." });
            }
        } catch (error) {
            console.error("Error saving student:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'étudiant." });
        }
    }
    
    const confirmDelete = async () => {
        if(selectedStudent) {
            try {
                await deleteDoc(doc(db, "users", selectedStudent.uid));
                toast({ title: "Étudiant supprimé", description: "L'étudiant a été supprimé avec succès." });
                setIsDeleteOpen(false);
                setSelectedStudent(null);
            } catch (error) {
                console.error("Error deleting student: ", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'étudiant." });
            }
        }
    }
    
    const getParentName = (parentUid?: string) => {
        if (!parentUid) return 'N/A';
        const parent = parents.find(p => p.uid === parentUid);
        return parent ? `${parent.firstName} ${parent.lastName}` : 'Inconnu';
    };

    const getExportData = () => {
        return filteredStudents.map(student => {
            const parent = student.student?.parentUid ? parents.find(p => p.uid === student.student.parentUid) : null;
            return {
                "Prénom": student.firstName,
                "Nom": student.lastName,
                "Email": student.email,
                "Téléphone": student.phone,
                "Matricule": student.student?.matricule,
                "Niveau": student.student?.level,
                "Cycle": cycles.find(c => c.value === student.student?.cycle)?.label,
                "Filière": student.student?.fieldId ? fieldsById[student.student.fieldId]?.name : 'N/A',
                "Secteur": student.student?.fieldId ? sectorsById[fieldsById[student.student.fieldId]?.sectorId]?.name : 'N/A',
                "Date d'inscription": format(new Date(student.createdAt), 'd MMMM yyyy', { locale: fr }),
                "Solde Scolarité": studentBalances[student.uid] || 0,
                "Tuteur": parent ? `${parent.firstName} ${parent.lastName}` : 'N/A',
                "Email Tuteur": parent?.email,
                "Téléphone Tuteur": parent?.phone,
                "Lien Parental": student.student?.parentalLink
            };
        });
    }

    const handleExportPDF = () => {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.text("Liste des Étudiants", 14, 16);
        
        const exportData = getExportData();
        const tableColumn = Object.keys(exportData[0] || {});
        const tableRows = exportData.map(row => Object.values(row));

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            theme: 'striped',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
        });
        
        doc.save("liste_etudiants.pdf");
        toast({ title: "Exportation PDF réussie", description: `${filteredStudents.length} étudiants exportés.` });
    };
    
    const handleExportXLSX = () => {
        const exportData = getExportData();
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
                let importedCount = 0;
                
                for (const studentRow of importedStudentsData) {
                    const field = mockFields.find(f => f.name.toLowerCase() === studentRow['Filière']?.toLowerCase());
                    const newId = doc(collection(db, "users")).id;

                    const newUser: User = {
                        uid: newId,
                        firstName: studentRow['Prénom'] || '',
                        lastName: studentRow['Nom'] || '',
                        email: studentRow['Email'] || '',
                        phone: studentRow['Téléphone'] || '',
                        role: 'student',
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        photoUrl: `https://picsum.photos/seed/${newId}/100/100`,
                        student: {
                           matricule: studentRow['Matricule'] || `ISGI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                           level: studentRow['Niveau'],
                           fieldId: field?.id,
                           cycle: cycles.find(c => c.label.toLowerCase() === studentRow['Cycle']?.toLowerCase())?.value,
                           programId: 'prog01', 
                           enrollmentDate: new Date().toISOString(),
                           endDate: ''
                        }
                    };
                    batch.set(doc(db, "users", newId), newUser);
                    importedCount++;
                }
                
                await batch.commit();

                toast({ title: "Importation réussie", description: `${importedCount} étudiants ont été importés.` });
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
    
    const loading = loadingUsers || loadingPayments;

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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline"><FileDown className="mr-2 h-4 w-4" /> Exporter</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={handleExportPDF}>Exporter en PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportXLSX}>Exporter en Excel</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

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
                                {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={sectorFilter} onValueChange={setSectorFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par secteur" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les secteurs</SelectItem>
                                {mockSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fieldFilter} onValueChange={setFieldFilter} disabled={sectorFilter === 'all'}>
                            <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Filtrer par filière" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les filières</SelectItem>
                                {availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
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
                                return (
                                <TableRow key={student.uid}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={student.photoUrl} alt={student.firstName} />
                                                <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid gap-0.5">
                                                <span className="font-semibold">{student.firstName} {student.lastName}</span>
                                                <span className="text-sm text-muted-foreground">{student.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="secondary">{student.student?.level || 'N/A'}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <Badge variant={balance > 0 ? "destructive" : "default"} className={balance === 0 ? "bg-green-600" : ""}>
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
                                                    Modifier
                                               </DropdownMenuItem>
                                               <DropdownMenuItem>
                                                    <Receipt className="mr-2 h-4 w-4" />
                                                    Voir les paiements
                                               </DropdownMenuItem>
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
            />
            <UserDeleteDialog
                isOpen={isDeleteOpen}
                setIsOpen={setIsDeleteOpen}
                onConfirm={confirmDelete}
                user={selectedStudent}
            />
        </div>
    );
}


    
