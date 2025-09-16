
"use client";

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
import { OfficialDocument, User } from "@/lib/types";
import { Download } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from "@/hooks/use-user";
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockDocuments } from "@/lib/mock-data";

const documentTypeTranslation: {[key: string]: string} = {
    'bulletin': 'Bulletin de notes',
    'certificat': 'Certificat de scolarité',
    'diplôme': 'Diplôme'
}


export default function DocumentsPage() {
    const { user: currentUser, users } = useUser();
    const [documents, setDocuments] = useState<OfficialDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

    const children = useMemo(() => {
        if (currentUser?.role !== 'parent') return [];
        return users.filter(u => currentUser.parent?.childrenUids.includes(u.uid));
    }, [currentUser, users]);

    const studentToView = useMemo(() => {
        if (currentUser?.role === 'student') return currentUser;
        if (currentUser?.role === 'parent') return users.find(u => u.uid === selectedChildId);
        return null;
    }, [currentUser, users, selectedChildId]);

     useEffect(() => {
        if (currentUser?.role === 'parent' && children.length > 0 && !selectedChildId) {
            setSelectedChildId(children[0].uid);
        }
    }, [currentUser, children, selectedChildId]);
    
    useEffect(() => {
        setLoading(true);
        if (!studentToView || !studentToView.uid) {
            setDocuments([]);
        } else {
            const userDocuments = mockDocuments.filter(doc => doc.studentId === studentToView.uid);
            setDocuments(userDocuments.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()));
        }
        setLoading(false);
    }, [studentToView]);

     const handleChildChange = (studentId: string) => {
        setSelectedChildId(studentId);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Documents Officiels</h1>
                <p className="text-muted-foreground">
                    Accédez à vos bulletins, certificats et autres documents importants.
                </p>
            </div>
             {currentUser?.role === 'parent' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Sélection de l'enfant</CardTitle>
                        <CardDescription>
                            Choisissez l'enfant dont vous souhaitez consulter les documents.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       {children.length > 0 ? (
                            <Select onValueChange={handleChildChange} value={selectedChildId || ""}>
                                <SelectTrigger className="w-[280px]">
                                    <SelectValue placeholder="Sélectionner un enfant..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {children.map(child => (
                                        <SelectItem key={child.uid} value={child.uid}>
                                            {child.firstName} {child.lastName}
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
                    <CardTitle>Mes documents</CardTitle>
                    <CardDescription>
                        Liste de tous les documents officiels qui ont été délivrés.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type de document</TableHead>
                                <TableHead>Date de délivrance</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : documents.length > 0 ? documents.map(doc => (
                                <TableRow key={doc.id}>
                                    <TableCell className="font-medium">
                                        <Badge variant="secondary">{documentTypeTranslation[doc.type] || doc.type}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {format(new Date(doc.issuedAt), 'd MMMM yyyy', { locale: fr })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <a href={doc.fileUrl} download>
                                                <Download className="mr-2 h-4 w-4"/>
                                                Télécharger
                                            </a>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                         {currentUser?.role === 'parent' ? "Veuillez d'abord sélectionner un enfant." : "Aucun document trouvé."}
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

    
