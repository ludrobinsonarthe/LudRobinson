
"use client";

import { useState, useEffect } from "react";
import AnnouncementCard from "@/components/announcement-card";
import { User, Message } from "@/lib/types";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle } from "lucide-react";
import AnnouncementDialog from "@/components/announcement-dialog";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, or, doc, setDoc, addDoc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import UserDeleteDialog from "@/components/user-delete-dialog";


export default function DashboardPage() {
    const { user: currentUser, userPermissions } = useUser();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Message | null>(null);
    const [announcements, setAnnouncements] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (!currentUser) return;
        
        setLoading(true);

        const targetReceivers: string[] = ['all', currentUser.role];
        if (currentUser.admin?.roleId) {
            targetReceivers.push(currentUser.admin.roleId);
        }
        
        const q = query(
            collection(db, "messages"), 
            where('type', '==', 'announcement'),
            where('receiverId', 'in', targetReceivers)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAnnouncements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            fetchedAnnouncements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAnnouncements(fetchedAnnouncements);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching announcements: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);


    const handleNewAnnouncement = () => {
        setEditingAnnouncement(null);
        setIsDialogOpen(true);
    };

    const handleEditAnnouncement = (announcement: Message) => {
        setEditingAnnouncement(announcement);
        setIsDialogOpen(true);
    };
    
    const handleDeleteAnnouncement = (announcement: Message) => {
        setEditingAnnouncement(announcement);
        setIsDeleteDialogOpen(true);
    };
    
    const confirmDelete = async () => {
        if (!editingAnnouncement) return;
        try {
            await deleteDoc(doc(db, "messages", editingAnnouncement.id));
            toast({ title: "Annonce supprimée" });
        } catch (error) {
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'annonce." });
        } finally {
            setIsDeleteDialogOpen(false);
        }
    }

    const handleSaveAnnouncement = async (data: Omit<Message, 'id' | 'createdAt' | 'senderId' | 'type'>) => {
        if (!currentUser) return;
        try {
            if (editingAnnouncement) {
                await setDoc(doc(db, "messages", editingAnnouncement.id), data, { merge: true });
                toast({ title: "Annonce modifiée" });
            } else {
                await addDoc(collection(db, "messages"), {
                    ...data,
                    senderId: currentUser.uid,
                    type: 'announcement',
                    createdAt: new Date().toISOString(),
                });
                toast({ title: "Annonce publiée" });
            }
        } catch (error) {
            console.error("Error saving announcement: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'annonce." });
        }
    }


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Annonces</h1>
                    <p className="text-muted-foreground">
                        Les annonces importantes de l'école. Les plus récentes en premier.
                    </p>
                </div>
                {currentUser?.role === 'admin' && (
                    <Button onClick={handleNewAnnouncement}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nouvelle Annonce
                    </Button>
                )}
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                       <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : announcements.length > 0 ? (
                    announcements.map(announcement => (
                        <AnnouncementCard key={announcement.id} announcement={announcement} onEdit={handleEditAnnouncement} onDelete={handleDeleteAnnouncement} />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <h3 className="text-2xl font-bold tracking-tight">Aucune annonce</h3>
                        <p className="text-muted-foreground">
                            Il n'y a pas d'annonces pour le moment.
                        </p>
                    </div>
                )}
            </div>
            <AnnouncementDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                announcement={editingAnnouncement}
                onSave={handleSaveAnnouncement}
            />
            {editingAnnouncement && (
                 <UserDeleteDialog
                    isOpen={isDeleteDialogOpen}
                    setIsOpen={setIsDeleteDialogOpen}
                    onConfirm={confirmDelete}
                    user={editingAnnouncement as Partial<User>} // Casting to fit the prop type
                    title="Supprimer cette annonce ?"
                    description={`L'annonce "${editingAnnouncement.title || 'Sans titre'}" sera définitivement supprimée.`}
                />
            )}
        </div>
    );
}
