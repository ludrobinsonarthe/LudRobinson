
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
import { Download, FileText } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-user";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { imageToDataUrl } from "@/lib/utils";

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};

export default function CertificatesPage() {
    const { allUsers: users, loading: loadingUsers, settings, fields, sectors } = useUser();
    const { toast } = useToast();

    // Filters state
    const [nameFilter, setNameFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [fieldFilter, setFieldFilter] = useState("all");

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
            description: "L'exportation PDF est temporairement désactivée pour des raisons de stabilité.",
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
                                {settings?.levels.map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fieldFilter} onValueChange={setFieldFilter}>
                            <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Filtrer par filière" />
                            </SelectTrigger>
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
                            {loadingUsers ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
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
