"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { LogOut, User, LifeBuoy, Settings } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

const roleTranslation: { [key: string]: string } = {
  admin: "Administrateur",
  teacher: "Enseignant",
  student: "Étudiant",
  parent: "Parent",
};

export default function DashboardHeader() {
  const { user, users, setUser } = useUser();

  if (!user) {
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        <SidebarTrigger className="sm:hidden" />
        <div className="ml-auto flex items-center gap-2">
            Loading...
        </div>
      </header>
    );
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 px-4 backdrop-blur-sm sm:px-6">
      <SidebarTrigger className="sm:hidden" />

      <div className="flex-1">
        {/* Can add search bar here later */}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="font-semibold">{`${user.firstName} ${user.lastName}`}</p>
          <Badge variant="outline" className="text-xs">
            {roleTranslation[user.role]}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={user.photoUrl} alt="User avatar" data-ai-hint="user avatar" />
                <AvatarFallback>
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{`${user.firstName} ${user.lastName}`}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <Link href="/dashboard/profile">
                    <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profil</span>
                    </DropdownMenuItem>
                </Link>
                <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Paramètres</span>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Changer d'utilisateur (Démo)</DropdownMenuLabel>
            {users.map(u => (
                 <DropdownMenuItem key={u.uid} onClick={() => setUser(u)}>
                    <div className="flex items-center">
                        <Avatar className="h-6 w-6 mr-2">
                            <AvatarImage src={u.photoUrl} />
                            <AvatarFallback>{getInitials(u.firstName, u.lastName)}</AvatarFallback>
                        </Avatar>
                        <span>{u.firstName} {u.lastName} ({roleTranslation[u.role]})</span>
                    </div>
                </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Se déconnecter</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
