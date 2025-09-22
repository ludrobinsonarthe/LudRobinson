
"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Paperclip, Pencil, Trash2 } from "lucide-react";
import type { Message, User } from "@/lib/types";
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUser } from "@/hooks/use-user";
import React, { useState, useEffect } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface AnnouncementCardProps {
  announcement: Message;
  onEdit: (announcement: Message) => void;
  onDelete: (announcement: Message) => void;
}

const roleTranslation: { [key: string]: string } = {
    admin: "Administration",
    teacher: "Enseignant",
    student: "Étudiant",
    parent: "Parent",
};

const getInitials = (firstName: string = '', lastName: string = '' ) => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};

export default function AnnouncementCard({ announcement, onEdit, onDelete }: AnnouncementCardProps) {
  const { user: currentUser, users } = useUser();
  const [sender, setSender] = useState<User | null>(null);

  const [formattedDate, setFormattedDate] = useState("");
  const [fullDate, setFullDate] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const date = new Date(announcement.createdAt);
    setFormattedDate(formatDistanceToNow(date, { addSuffix: true, locale: fr }));
    setFullDate(format(date, 'PPpp', { locale: fr }));
  }, [announcement.createdAt]);

  useEffect(() => {
      const foundSender = users.find(user => user.uid === announcement.senderId);
      setSender(foundSender || null);
  }, [users, announcement.senderId]);


  if (!sender) {
    return (
        <Card className="animate-pulse">
            <CardHeader>
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted"></div>
                    <div className="grid gap-2 flex-1">
                       <div className="h-5 w-32 bg-muted rounded-md"></div>
                       <div className="h-4 w-24 bg-muted rounded-md"></div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded-md"></div>
                    <div className="h-4 w-3/4 bg-muted rounded-md"></div>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border">
            <AvatarImage src={sender.photoUrl} alt={`${sender.lastName} ${sender.firstName}`} data-ai-hint="person face" />
            <AvatarFallback>{getInitials(sender.firstName, sender.lastName)}</AvatarFallback>
          </Avatar>
          <div className="grid gap-1 flex-1">
            <div className="flex items-center gap-2">
                <p className="font-semibold">{`${sender.lastName} ${sender.firstName}`}</p>
                <Badge variant="secondary">{roleTranslation[sender.role]}</Badge>
            </div>
            {isMounted ? (
                <p className="text-sm text-muted-foreground" title={fullDate}>
                {formattedDate}
                </p>
            ) : (
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            )}
          </div>
           {currentUser?.role === 'admin' && (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(announcement)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                    </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => onDelete(announcement)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                    </DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
          )}
        </div>
        {announcement.title && <CardTitle className="font-headline text-2xl pt-2">{announcement.title}</CardTitle>}
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

    