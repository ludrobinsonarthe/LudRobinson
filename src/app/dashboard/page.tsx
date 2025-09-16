
"use client";

import { useState, useEffect } from "react";
import AnnouncementCard from "@/components/announcement-card";
import { User, Message } from "@/lib/types";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle } from "lucide-react";
import AnnouncementDialog from "@/components/announcement-dialog";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function DashboardPage() {
    const { user: currentUser } = useUser();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Message | null>(null);
    const [announcements, setAnnouncements] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        // This logic will need to be adapted based on how classes/groups are stored for users.
        // For now, we fetch announcements for 'all' and for the user's role.
        // A more robust implementation would check for class/group IDs associated with the user.
        const targetReceivers = ['all', currentUser.role];
        
        // In a real app with classes, you'd add the user's class ID to `targetReceivers`
        // e.g., if (currentUser.student?.classId) targetReceivers.push(currentUser.student.classId);

        const q = query(
            collection(db, "announcements"), 
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allAnnouncements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            
            // Filter client-side as Firestore doesn't support 'OR' queries on different fields easily.
            // For admins, show all. For others, filter based on receiverId.
            const filtered = currentUser.role === 'admin' 
                ? allAnnouncements
                : allAnnouncements.filter(ann => targetReceivers.includes(ann.receiverId));

            setAnnouncements(filtered);
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
                        <AnnouncementCard key={announcement.id} announcement={announcement} onEdit={handleEditAnnouncement} />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                        <h3 className="text-2xl font-bold tracking-tight">Aucune annonce</h3>
                        <p className="text-sm text-muted-foreground">
                            Il n'y a pas d'annonces pour le moment.
                        </p>
                    </div>
                )}
            </div>
            <AnnouncementDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                announcement={editingAnnouncement}
            />
        </div>
    );
}
