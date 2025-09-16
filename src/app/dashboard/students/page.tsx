

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
import { User, UserRole, Class, Sector, Field, Cycle } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, FileUp, FileDown } from "lucide-react";
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
    const { users, setUsers } = useUser();
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
    
    const studentsFromUsers = useMemo(() => users.filter(u => u.role === 'student'), [users]);
    const parents = useMemo(() => users.filter(u => u.role === 'parent'), [users]);
    const fieldsById = useMemo(() => mockFields.reduce((acc, f) => ({...acc, [f.id]: f}), {} as Record<string, Field>), []);
    const sectorsById = useMemo(() => mockSectors.reduce((acc, s) => ({...acc, [s.id]: s}), {} as Record<string, Sector>), []);

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

    const handleSave = (studentData: Partial<User>, parentData?: Partial<User>) => {
        if (selectedStudent) {
            // Edit existing student
            const updatedUsers = users.map(u => u.uid === selectedStudent.uid ? { ...u, ...studentData } as User : u);
            setUsers(updatedUsers);
        } else {
            // Add new student and potentially a new parent
            const newStudent: User = {
                uid: `user${Date.now()}`,
                createdAt: new Date().toISOString(),
                status: 'active',
                role: 'student',
                ...studentData
            } as User;

            let newUsers = [...users, newStudent];
            
            if (parentData && parentData.email) {
                 const newParent : User = {
                    uid: `user${Date.now() + 1}`,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    role: 'parent',
                    ...parentData,
                    parent: { childrenUids: [newStudent.uid] }
                 } as User;
                 newStudent.student!.parentUid = newParent.uid;
                 newUsers.push(newParent);
            } else if (studentData.student?.parentUid) {
                // Link to existing parent
                const parentIndex = newUsers.findIndex(u => u.uid === studentData.student?.parentUid);
                if(parentIndex !== -1) {
                    const parent = newUsers[parentIndex];
                    parent.parent = {
                        childrenUids: [...(parent.parent?.childrenUids || []), newStudent.uid]
                    }
                    newUsers[parentIndex] = parent;
                }
            }
            setUsers(newUsers);
        }
    }
    
    const confirmDelete = () => {
        if(selectedStudent) {
            setUsers(users.filter(u => u.uid !== selectedStudent.uid));
            setIsDeleteOpen(false);
            setSelectedStudent(null);
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
        reader.onload = (event) => {
            try {
                const bstr = event.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                
                // Assuming header is in the first row
                const headers = data[0] as string[];
                const importedStudents = (data.slice(1) as string[][]).map(row => {
                    const studentRow: any = {};
                    headers.forEach((header, index) => {
                        studentRow[header] = row[index];
                    });
                    
                    const field = mockFields.find(f => f.name.toLowerCase() === studentRow['Filiere']?.toLowerCase());

                    const newUser: User = {
                        uid: `user${Date.now()}${Math.random()}`,
                        firstName: studentRow['Prenom'] || '',
                        lastName: studentRow['Nom'] || '',
                        email: studentRow['Email'] || '',
                        phone: studentRow['Téléphone'] || '',
                        role: 'student',
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        photoUrl: `https://picsum.photos/seed/${Date.now()}${Math.random()}/100/100`,
                        student: {
                           matricule: studentRow['Matricule'] || `ISGI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                           level: studentRow['Niveau'],
                           fieldId: field?.id,
                           cycle: cycles.find(c => c.label.toLowerCase() === studentRow['Cycle']?.toLowerCase())?.value,
                           programId: 'prog01', // Default programId
                           enrollmentDate: new Date().toISOString(),
                           endDate: ''
                        }
                    };
                    return newUser;
                });

                setUsers(prevUsers => [...prevUsers, ...importedStudents]);
                toast({ title: "Importation réussie", description: `${importedStudents.length} étudiants ont été importés.` });
            } catch (error) {
                console.error("Error importing file:", error);
                toast({ variant: "destructive", title: "Erreur d'importation", description: "Le fichier est peut-être corrompu ou mal formaté." });
            }
        };
        reader.readAsBinaryString(file);
        
        // Reset file input
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };


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
                                <TableHead className="hidden md:table-cell">Cycle</TableHead>
                                <TableHead className="hidden lg:table-cell">Tuteur</TableHead>
                                <TableHead className="hidden lg:table-cell">Date d'inscription</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStudents.length > 0 ? filteredStudents.map(student => (
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
                                        <Badge variant="secondary">{cycles.find(c => c.value === student.student?.cycle)?.label || 'Non défini'}</Badge>
                                    </TableCell>
                                     <TableCell className="hidden lg:table-cell">
                                        {getParentName(student.student?.parentUid)}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {format(new Date(student.createdAt), 'd MMMM yyyy', { locale: fr })}
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
                                               <DropdownMenuItem onClick={() => handleDelete(student)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
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

    

    