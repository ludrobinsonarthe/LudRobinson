import { mockMessages, mockUsers, mockClasses } from "@/lib/mock-data";
import AnnouncementCard from "@/components/announcement-card";
import { User, Message } from "@/lib/types";

// For demo, we'll hardcode the current user. In a real app, this would come from auth.
const getCurrentUser = async (): Promise<User> => {
  return mockUsers.find(u => u.role === 'student')!;
};

const getAnnouncements = async (currentUser: User): Promise<Message[]> => {
  const userClass = mockClasses.find(c => c.students.includes(currentUser.uid));
  
  return mockMessages
    .filter(message => {
      if (message.type !== 'announcement') return false;
      if (message.receiverId === 'all') return true;
      if (currentUser.role === 'student' && userClass && message.receiverId === userClass.id) return true;
      // Add more role-based logic if needed
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export default async function DashboardPage() {
    // In a real app, you'd get the user from an auth session
    const currentUser = mockUsers.find(u => u.role === 'student')!;

    const userClass = mockClasses.find(c => c.students.includes(currentUser.uid));
  
    const announcements = mockMessages
        .filter(message => {
        if (message.type !== 'announcement') return false;
        if (message.receiverId === 'all') return true;
        if (currentUser.role === 'student' && userClass && message.receiverId === userClass.id) return true;
        if (currentUser.role === 'teacher' && message.receiverId.startsWith('class')) return true; // Teachers see all class announcements
        if(currentUser.role === 'admin') return true; // Admins see all announcements
        return false;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Annonces</h1>
        <p className="text-muted-foreground">
          Les annonces importantes de l'école. Les plus récentes en premier.
        </p>
      </div>

      <div className="space-y-4">
        {announcements.length > 0 ? (
          announcements.map(announcement => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
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
    </div>
  );
}
