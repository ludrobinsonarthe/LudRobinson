
"use client";

import * as React from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  CornerUpLeft,
  Mic,
  Paperclip,
  Phone,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { User, Message } from "@/lib/types";
import { useUser } from "@/hooks/use-user";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import MessageSummarizer from "./message-summarizer";

interface ChatLayoutProps {
  defaultLayout: number[] | undefined;
  messages: Message[];
  users: User[];
}

export default function ChatLayout({
  defaultLayout = [320, 480],
  messages,
  users,
}: ChatLayoutProps) {
  const { user: currentUser } = useUser();
  const [selectedConversation, setSelectedConversation] = React.useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
  }

  const conversations = React.useMemo(() => {
    if (!currentUser || !isMounted) return [];
    
    const privateMessages = messages.filter(m => m.type === 'private');
    const conversationPartners = new Set<string>();

    privateMessages.forEach(msg => {
      if (msg.senderId === currentUser.uid) {
        conversationPartners.add(msg.receiverId);
      }
      if (msg.receiverId === currentUser.uid) {
        conversationPartners.add(msg.senderId);
      }
    });

    return Array.from(conversationPartners).map(partnerId => {
        const partner = users.find(u => u.uid === partnerId);
        const lastMessage = privateMessages
            .filter(m => (m.senderId === partnerId && m.receiverId === currentUser.uid) || (m.senderId === currentUser.uid && m.receiverId === partnerId))
            .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        return { partner, lastMessage };
    }).sort((a, b) => new Date(b.lastMessage?.createdAt || 0).getTime() - new Date(a.lastMessage?.createdAt || 0).getTime());
  }, [messages, currentUser, users, isMounted]);

  React.useEffect(() => {
    if(conversations.length > 0 && !selectedConversation) {
        setSelectedConversation(conversations[0].partner?.uid || null);
    }
  }, [conversations, selectedConversation]);

  const selectedMessages = React.useMemo(() => {
    if (!currentUser || !selectedConversation) return [];
    return messages.filter(
      (msg) =>
        msg.type === "private" &&
        ((msg.senderId === currentUser.uid && msg.receiverId === selectedConversation) ||
          (msg.senderId === selectedConversation && msg.receiverId === currentUser.uid))
    ).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, currentUser, selectedConversation]);

  const selectedUser = users.find(u => u.uid === selectedConversation);

  if (!isMounted) {
      return null;
  }

  return (
    <div className="z-10 h-[calc(100vh-12rem)] w-full text-sm lg:flex">
      <div
        className={cn(
          "min-w-[250px] border-r transition-all duration-300 ease-in-out",
          isCollapsed ? "w-0 p-0" : "w-full lg:w-[320px] p-2",
          "flex flex-col"
        )}
      >
        <div className={cn("flex flex-col bg-card rounded-lg border h-full", isCollapsed && "hidden")}>
          <div className="p-4">
            <h2 className="text-xl font-bold font-headline">Discussions</h2>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-4">
              {conversations.map(({ partner, lastMessage }) => partner && lastMessage && (
                <button
                  key={partner.uid}
                  className={cn(
                    "flex items-center gap-4 rounded-lg p-2 transition-colors",
                    selectedConversation === partner.uid
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  onClick={() => setSelectedConversation(partner.uid)}
                >
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage
                      src={partner.photoUrl}
                      alt={partner.firstName}
                      data-ai-hint="person face"
                    />
                    <AvatarFallback>{getInitials(`${partner.firstName} ${partner.lastName}`)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="font-semibold">{`${partner.firstName} ${partner.lastName}`}</div>
                    <p className={cn("text-xs truncate", selectedConversation === partner.uid ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {lastMessage.content}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="relative flex-1">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-card p-1.5 text-muted-foreground hover:bg-muted lg:flex hidden"
        >
          {isCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
        <div className="flex flex-col h-full bg-card rounded-lg border">
          {selectedUser ? (
            <>
              <div className="flex items-center gap-4 p-4 border-b">
                 <Avatar className="h-10 w-10 border">
                    <AvatarImage
                      src={selectedUser.photoUrl}
                      alt={selectedUser.firstName}
                       data-ai-hint="person face"
                    />
                    <AvatarFallback>{getInitials(`${selectedUser.firstName} ${selectedUser.lastName}`)}</AvatarFallback>
                  </Avatar>
                  <div className="font-semibold flex-1">{`${selectedUser.firstName} ${selectedUser.lastName}`}</div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                        <Phone className="h-5 w-5" />
                        <span className="sr-only">Appel vocal</span>
                    </Button>
                    <Button variant="ghost" size="icon">
                        <Video className="h-5 w-5" />
                        <span className="sr-only">Appel vidéo</span>
                    </Button>
                  </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedMessages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-end gap-2",
                        message.senderId === currentUser?.uid ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.senderId !== currentUser?.uid && (
                        <Avatar className="h-8 w-8 border">
                          <AvatarImage src={selectedUser.photoUrl} alt={selectedUser.firstName} />
                          <AvatarFallback>{getInitials(`${selectedUser.firstName} ${selectedUser.lastName}`)}</AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-xs rounded-lg p-3 md:max-w-md lg:max-w-lg",
                          message.senderId === currentUser?.uid
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        <p className="mt-1 text-right text-xs opacity-70">
                          {formatDistanceToNow(new Date(message.createdAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                        {message.content.length > 200 && <MessageSummarizer message={message.content} />}
                      </div>
                       {message.senderId === currentUser?.uid && currentUser && (
                        <Avatar className="h-8 w-8 border">
                          <AvatarImage src={currentUser.photoUrl} alt={currentUser.firstName} />
                          <AvatarFallback>{getInitials(`${currentUser.firstName} ${currentUser.lastName}`)}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="relative">
                  <Textarea
                    placeholder="Écrire un message..."
                    className="pr-32 resize-none"
                    rows={1}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button type="submit" size="icon" variant="ghost">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                     <Button type="submit" size="icon" variant="ghost">
                      <Mic className="h-5 w-5" />
                    </Button>
                    <Button type="submit" size="icon">
                      <CornerUpLeft className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">
                Sélectionnez une conversation pour commencer à discuter.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
