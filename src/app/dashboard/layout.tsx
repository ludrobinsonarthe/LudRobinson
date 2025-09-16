"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  Home,
  MessageSquare,
  FileText,
  User as UserIcon,
  LogOut,
  Settings,
  Bot,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Wallet,
  Users,
  GraduationCap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProvider, useUser } from "@/hooks/use-user";
import DashboardHeader from "@/components/dashboard-header";

function AppLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Bot className="h-6 w-6" />
      </div>
      <h1 className="font-headline text-lg font-bold tracking-tight text-foreground">
        ISGI
      </h1>
    </Link>
  );
}

function MainSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const studentMenuItems = [
    { href: "/dashboard/courses", label: "Cours", icon: BookOpen },
    { href: "/dashboard/grades", label: "Notes", icon: ClipboardList },
    { href: "/dashboard/schedule", label: "Emploi du temps", icon: CalendarDays },
    { href: "/dashboard/documents", label: "Documents", icon: FileText },
    { href: "/dashboard/payments", label: "Paiements", icon: Wallet },
  ];

  const adminMenuItems = [
    { href: "/dashboard/students", label: "Étudiants", icon: Users },
    { href: "/dashboard/teachers", label: "Professeurs", icon: GraduationCap },
  ]

  const menuItems = [
    { href: "/dashboard", label: "Annonces", icon: Home },
    { href: "/dashboard/messages", label: "Messagerie", icon: MessageSquare },
    ...(user?.role === 'student' ? studentMenuItems : []),
    ...(user?.role === 'admin' ? adminMenuItems : []),
    ...(user?.role !== 'student' && user?.role !== 'parent' ? [{ href: "/dashboard/documents", label: "Documents", icon: FileText }] : []),
    { href: "/dashboard/profile", label: "Profil", icon: UserIcon },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <AppLogo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Paramètres">
              <Settings />
              <span>Paramètres</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <SidebarProvider>
        <MainSidebar />
        <SidebarInset>
          <DashboardHeader />
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </UserProvider>
  );
}
