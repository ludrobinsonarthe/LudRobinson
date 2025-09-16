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
import { mockDocuments, mockUsers } from "@/lib/mock-data";
import { OfficialDocument, User, UserRole } from "@/lib/types";
import { Download } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// This would come from an auth context in a real app
const getCurrentUser = async (): Promise<User> => {
    return mockUsers.find(u => u.role === 'student')!;
}

const getDocumentsForStudent = async (studentId: string): Promise<OfficialDocument[]> => {
    return mockDocuments.filter(doc => doc.studentId === studentId);
}

const documentTypeTranslation: {[key: string]: string} = {
    'bulletin': 'Bulletin de notes',
    'certificat': 'Certificat de scolarité',
    'diplôme': 'Diplôme'
}


export default async function DocumentsPage() {
    const currentUser = await getCurrentUser();
    
    // For the demo, we are hardcoding a student user. Let's imagine this check for other roles.
    if (currentUser.role !== 'student') {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-[calc(100vh-12rem)]">
                <h3 className="text-2xl font-bold tracking-tight">Accès non autorisé</h3>
                <p className="text-sm text-muted-foreground">
                    Seuls les étudiants peuvent accéder à cette page.
                </p>
            </div>
        );
    }

    const documents = await getDocumentsForStudent(currentUser.uid);

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
                            {documents.length > 0 ? documents.map(doc => (
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
