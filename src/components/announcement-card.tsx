import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Paperclip, Pencil } from "lucide-react";
import type { Message } from "@/lib/types";
import { mockUsers } from "@/lib/mock-data";
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from "@/hooks/use-user";

interface AnnouncementCardProps {
  announcement: Message;
  onEdit: (announcement: Message) => void;
}

const roleTranslation: { [key: string]: string } = {
    admin: "Administration",
    teacher: "Enseignant",
    student: "Étudiant",
    parent: "Parent",
};

const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function AnnouncementCard({ announcement, onEdit }: AnnouncementCardProps) {
  const sender = mockUsers.find(user => user.uid === announcement.senderId);
  const { user: currentUser } = useUser();

  if (!sender) {
    return null;
  }

  const formattedDate = formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true, locale: fr });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border">
            <AvatarImage src={sender.photoUrl} alt={`${sender.firstName} ${sender.lastName}`} data-ai-hint="person face" />
            <AvatarFallback>{getInitials(sender.firstName, sender.lastName)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1 flex-1">
            <div className="flex items-center gap-2">
                <p className="font-semibold">{`${sender.firstName} ${sender.lastName}`}</p>
                <Badge variant="secondary">{roleTranslation[sender.role]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground" title={format(new Date(announcement.createdAt), 'PPpp', { locale: fr })}>
              {formattedDate}
            </p>
          </div>
           {currentUser?.role === 'admin' && (
            <Button variant="ghost" size="icon" onClick={() => onEdit(announcement)}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Modifier</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap">{announcement.content}</p>
      </CardContent>
      {announcement.attachments && announcement.attachments.length > 0 && (
        <CardFooter>
          <div className="flex flex-wrap gap-2">
            {announcement.attachments.map((url, index) => (
              <Button asChild variant="outline" size="sm" key={index}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Paperclip className="mr-2 h-4 w-4" />
                  Pièce jointe {index + 1}
                </a>
              </Button>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
