
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@/lib/types";

interface NewMessageDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  users: User[];
  onSelectUser: (userId: string) => void;
}

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function NewMessageDialog({ isOpen, setIsOpen, users, onSelectUser }: NewMessageDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter(user =>
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserClick = (userId: string) => {
    onSelectUser(userId);
    setSearchTerm("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">Nouvelle discussion</DialogTitle>
          <DialogDescription>
            Recherchez un utilisateur pour démarrer une nouvelle conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            placeholder="Rechercher par nom ou par e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
                {filteredUsers.map(user => (
                <button
                    key={user.uid}
                    onClick={() => handleUserClick(user.uid)}
                    className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                >
                    <Avatar className="h-10 w-10 border">
                        <AvatarImage src={user.photoUrl} alt={user.firstName} />
                        <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-0.5">
                        <p className="font-semibold">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                </button>
                ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
