
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
import { OfficialDocument } from "@/lib/types";
import { Download } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from "@/hooks/use-user";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const documentTypeTranslation: {[key: string]: string} = {
    'bulletin': 'Bulletin de notes',
    'certificat': 'Certificat de scolarité',
    'diplôme': 'Diplôme'
}


export default function DocumentsPage() {
    const { user: currentUser } = useUser();
    const [documents, setDocuments] = useState<OfficialDocument[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        if (!currentUser || !currentUser.uid) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(collection(db, "documents"), where("studentId", "==", currentUser.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const userDocuments: OfficialDocument[] = [];
            snapshot.forEach((doc) => {
                userDocuments.push({ id: doc.id, ...doc.data() } as OfficialDocument);
            });
            setDocuments(userDocuments.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching documents: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    if (currentUser?.role === 'parent') {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[calc(100vh-12rem)]">
                <h3 className="text-2xl font-bold tracking-tight">Accès non autorisé</h3>
                <p className="text-sm text-muted-foreground">
                    Cette section est réservée aux étudiants et administrateurs.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Documents Officiels</h1>
                <p className="text-muted-foreground">
                    Accédez à vos bulletins, certificats et autres documents importants.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Mes documents</CardTitle>
                    <CardDescription>
                        Liste de tous les documents officiels qui vous ont été délivrés.
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
                                        Aucun document trouvé.
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
