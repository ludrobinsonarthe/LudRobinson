"use client";

import { useState } from "react";
import { mockMessages, mockUsers, mockClasses } from "@/lib/mock-data";
import AnnouncementCard from "@/components/announcement-card";
import { User, Message } from "@/lib/types";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import AnnouncementDialog from "@/components/announcement-dialog";

export default function DashboardPage() {
    const { user: currentUser } = useUser();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Message | null>(null);

    // This would be state in a real app, updated via API calls
    const [announcements, setAnnouncements] = useState<Message[]>(() => {
        if (!currentUser) return [];
        const userClass = mockClasses.find(c => c.students.includes(currentUser.uid));
        return mockMessages
            .filter(message => {
                if (message.type !== 'announcement') return false;
                if (message.receiverId === 'all') return true;
                if (currentUser.role === 'student' && userClass && message.receiverId === userClass.id) return true;
                if (currentUser.role === 'teacher' && message.receiverId.startsWith('class')) return true; // Teachers see all class announcements
                if(currentUser.role === 'admin') return true; // Admins see all announcements
                return false;
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    const handleNewAnnouncement = () => {
        setEditingAnnouncement(null);
        setIsDialogOpen(true);
    };

    const handleEditAnnouncement = (announcement: Message) => {
        setEditingAnnouncement(announcement);
        setIsDialogOpen(true);
    };

    const handleSaveAnnouncement = (announcementData: Omit<Message, 'id' | 'createdAt' | 'senderId' | 'type'>) => {
        if (!currentUser) return;

        if (editingAnnouncement) {
            // Edit existing announcement
            setAnnouncements(announcements.map(ann => 
                ann.id === editingAnnouncement.id 
                ? { ...ann, ...announcementData, createdAt: new Date().toISOString() } 
                : ann
            ));
        } else {
            // Add new announcement
            const newAnnouncement: Message = {
                id: `msg${Date.now()}`,
                senderId: currentUser.uid,
                type: 'announcement',
                createdAt: new Date().toISOString(),
                ...announcementData
            };
            setAnnouncements([newAnnouncement, ...announcements]);
        }
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
        {announcements.length > 0 ? (
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
        onSave={handleSaveAnnouncement}
        announcement={editingAnnouncement}
      />
    </div>
  );
}
