

"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityLog, User } from "@/lib/types";
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/hooks/use-user';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { imageToDataUrl } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


const getInitials = (name: string = '') => {
    const parts = name.split(' ');
    if (parts.length > 1) {
        return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
    }
    return (name[0] || '').toUpperCase();
}


export default function ActivityHistoryPage() {
    const { allUsers, settings } = useUser();
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'));
        const unsub = onSnapshot(q, snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
            setLogs(data);
            setLoading(false);
        },
        (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'activityLogs', operation: 'list'}));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filteredLogs = useMemo(() => {
        if (!searchTerm) return logs;
        const lowercasedFilter = searchTerm.toLowerCase();
        return logs.filter(log =>
            log.details.toLowerCase().includes(lowercasedFilter) ||
            log.actorName?.toLowerCase().includes(lowercasedFilter) ||
            log.entityType.toLowerCase().includes(lowercasedFilter)
        );
    }, [logs, searchTerm]);
    
    const usersById = useMemo(() => {
        return allUsers.reduce((acc, user) => {
            acc[user.uid] = user;
            return acc;
        }, {} as Record<string, User>);
    }, [allUsers]);

    const handleExportPDF = async () => {
        if (!settings) {
            toast({ variant: 'destructive', title: 'Erreur', description: 'Les paramètres sont introuvables.' });
            return;
        }
        const { jsPDF } = await import('jspdf');
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
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Journal d'Activité - ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`, 14, 30);
        
        const tableColumn = ["Acteur", "Action", "Date"];
        const tableRows: string[][] = [];

        filteredLogs.forEach(log => {
            const logData = [
                log.actorName || 'Système',
                log.details,
                format(new Date(log.timestamp), 'd MMM yyyy, HH:mm', { locale: fr }),
            ];
            tableRows.push(logData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
        });

        doc.save(`historique_activites_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Téléchargement réussi', description: 'Le journal d\'activité a été exporté en PDF.' });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Historique des Activités</h1>
                <p className="text-muted-foreground">
                    Suivez toutes les actions importantes effectuées sur la plateforme en temps réel.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Journal d'audit</CardTitle>
                    <CardDescription>
                       Liste chronologique des activités des utilisateurs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="mb-4 flex items-center gap-4">
                        <Input
                            placeholder="Rechercher dans les activités..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                         <Button variant="outline" onClick={handleExportPDF}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Exporter en PDF
                        </Button>
                    </div>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Acteur</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredLogs.length > 0 ? filteredLogs.map(log => {
                                const actor = usersById[log.actorId];
                                return (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={actor?.photoUrl} alt={log.actorName} />
                                                <AvatarFallback>{getInitials(log.actorName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="font-medium">{log.actorName || 'Système'}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{log.details}</span>
                                            <span className="text-xs text-muted-foreground">
                                                Type: <Badge variant="secondary" className="mr-1">{log.entityType}</Badge>
                                                ID: {log.entityId}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: fr })}
                                    </TableCell>
                                </TableRow>
                            )}) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        Aucune activité trouvée.
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
