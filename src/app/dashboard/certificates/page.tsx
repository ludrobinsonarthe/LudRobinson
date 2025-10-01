
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Field, Sector } from "@/lib/types";
import { Download, FileText, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-user";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};

export default function CertificatesPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Filters state
    const [nameFilter, setNameFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [fieldFilter, setFieldFilter] = useState("all");

    useEffect(() => {
        setLoading(true);
        const unsubs: (()=>void)[] = [];
        unsubs.push(onSnapshot(collection(db, 'users'), snap => setUsers(snap.docs.map(d => d.data() as User))));
        unsubs.push(onSnapshot(collection(db, 'fields'), snap => setFields(snap.docs.map(d => ({id: d.id, ...d.data()} as Field)))));
        unsubs.push(onSnapshot(doc(db, 'settings', 'system'), snap => setSettings(snap.data())));
        
        const timer = setTimeout(() => setLoading(false), 500);
        unsubs.push(() => clearTimeout(timer));

        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const studentsFromUsers = useMemo(() => {
        if (!users) return [];
        return users
            .filter(u => u.role === 'student')
            .sort((a, b) => {
                const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
                const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });
    }, [users]);

    const fieldsById = useMemo(() => fields.reduce((acc, f) => ({...acc, [f.id]: f}), {} as Record<string, Field>), [fields]);

    const filteredStudents = useMemo(() => {
        return studentsFromUsers.filter(student => {
            const fullName = `${student.lastName} ${student.firstName}`.toLowerCase();
            return (
                (nameFilter === "" || fullName.includes(nameFilter.toLowerCase())) &&
                (levelFilter === "all" || student.student?.level === levelFilter) &&
                (fieldFilter === "all" || student.student?.fieldId === fieldFilter)
            );
        });
    }, [studentsFromUsers, nameFilter, levelFilter, fieldFilter]);

    const createCertificatePdf = async (student: User) => {
        toast({
            variant: "destructive",
            title: "Fonctionnalité désactivée",
            description: "La génération de certificats PDF est temporairement désactivée.",
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Certificats de Scolarité</h1>
                <p className="text-muted-foreground">
                    Générez et téléchargez les certificats de scolarité pour les étudiants.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des étudiants</CardTitle>
                    <CardDescription>
                        Filtrez la liste et générez un certificat pour un étudiant spécifique.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-wrap items-center gap-2 mb-6">
                        <Input 
                            placeholder="Rechercher par nom..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrer par niveau" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les niveaux</SelectItem>
                                {settings?.levels.map((l: any) => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fieldFilter} onValueChange={setFieldFilter}>
                            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Filtrer par filière" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les filières</SelectItem>
                                {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead className="hidden md:table-cell">Niveau</TableHead>
                                <TableHead className="hidden lg:table-cell">Filière</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_,i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-10 w-48"/></TableCell>
                                        <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-24"/></TableCell>
                                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-32"/></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-36 ml-auto"/></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredStudents.length > 0 ? filteredStudents.map(student => (
                                <TableRow key={student.uid}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={student.photoUrl} alt={student.firstName} />
                                                <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid gap-0.5">
                                                <span className="font-semibold">{student.lastName} {student.firstName}</span>
                                                <span className="text-sm text-muted-foreground">{student.student?.matricule}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {student.student?.level || 'N/A'}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {student.student?.fieldId ? fieldsById[student.student.fieldId]?.name : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <Button variant="outline" size="sm" onClick={() => createCertificatePdf(student)}>
                                            <Download className="mr-2 h-4 w-4" />
                                            Générer le certificat
                                       </Button>
                                    </TableCell>
                                </TableRow>
                                )
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Aucun étudiant trouvé correspondant aux filtres.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
