
"use client";

import { useState, useEffect } from "react";
import AnnouncementCard from "@/components/announcement-card";
import { User, Message } from "@/lib/types";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle } from "lucide-react";
import AnnouncementDialog from "@/components/announcement-dialog";
import { mockMessages } from "@/lib/mock-data";

export default function DashboardPage() {
    const { user: currentUser, userPermissions } = useUser();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Message | null>(null);
    const [announcements, setAnnouncements] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        
        setLoading(true);
        const targetReceivers = ['all', currentUser.role];
        if (currentUser.admin?.roleId) {
            targetReceivers.push(currentUser.admin.roleId);
        }
        
        const fetchedAnnouncements = mockMessages.filter(m => m.type === 'announcement' && targetReceivers.includes(m.receiverId))
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setAnnouncements(fetchedAnnouncements);
        setLoading(false);

    }, [currentUser]);


    const handleNewAnnouncement = () => {
        setEditingAnnouncement(null);
        setIsDialogOpen(true);
    };

    const handleEditAnnouncement = (announcement: Message) => {
        setEditingAnnouncement(announcement);
        setIsDialogOpen(true);
    };
    
    const handleSaveAnnouncement = (message: Message) => {
        if (editingAnnouncement) {
            setAnnouncements(prev => prev.map(a => a.id === message.id ? message : a));
        } else {
            setAnnouncements(prev => [message, ...prev]);
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
                        <AnnouncementCard key={announcement.id} announcement={announcement} onEdit={handleEditAnnouncement} />
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
        </div>
    );
}
