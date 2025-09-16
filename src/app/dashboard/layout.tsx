
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
  SidebarGroup,
  SidebarGroupLabel,
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
  Building,
  UserCog,
  BookMarked,
  Receipt,
  Banknote,
  Landmark,
  FileCog,
  ClipboardCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProvider, useUser } from "@/hooks/use-user";
import DashboardHeader from "@/components/dashboard-header";
import React from "react";

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
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const studentMenuItems = [
    { href: "/dashboard/courses", label: "Cours", icon: BookOpen },
    { href: "/dashboard/grades", label: "Notes", icon: ClipboardList },
    { href: "/dashboard/schedule", label: "Emploi du temps", icon: CalendarDays },
    { href: "/dashboard/documents", label: "Documents", icon: FileText },
    { href: "/dashboard/payments", label: "Paiements", icon: Wallet },
  ];

  const adminManagementItems = [
    { href: "/dashboard/students", label: "Étudiants", icon: Users },
    { href: "/dashboard/teachers", label: "Professeurs", icon: GraduationCap },
    { href: "/dashboard/course-management", label: "Gestion Cours & Horaires", icon: BookMarked },
    { href: "/dashboard/tuition-management", label: "Scolarité", icon: Receipt },
    { href: "/dashboard/fee-management", label: "Gestion des frais", icon: FileCog },
    { href: "/dashboard/salary-management", label: "Salaires", icon: Banknote },
    { href: "/dashboard/attendance", label: "Suivi des Présences", icon: ClipboardCheck },
    { href: "/dashboard/cash-flow", label: "Suivi de caisse", icon: Landmark },
    { href: "/dashboard/users", label: "Utilisateurs", icon: UserCog },
    { href: "/dashboard/admin-management", label: "Administration", icon: Building },
  ]

  const menuItems = [
    { href: "/dashboard", label: "Annonces", icon: Home },
    { href: "/dashboard/messages", label: "Messagerie", icon: MessageSquare },
  ];
  
  const showStudentMenu = user?.role === 'student' || user?.role === 'admin' || user?.role === 'parent';
  const showAdminMenu = user?.role === 'admin';


  return (
    <Sidebar>
      <SidebarHeader>
        <AppLogo />
      </SidebarHeader>
      <SidebarContent>
        {isMounted && <SidebarMenu>
          
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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
          </SidebarGroup>

        {showStudentMenu && <SidebarGroup>
            <SidebarGroupLabel>Espace Personnel</SidebarGroupLabel>
             {studentMenuItems.map((item) => (
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
          </SidebarGroup>}

          {showAdminMenu && <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            {adminManagementItems.map((item) => (
              <SidebarMenuItem key={item.href + item.label}>
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
          </SidebarGroup>}

        </SidebarMenu>}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
           <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={pathname === "/dashboard/profile"}
                tooltip={"Profil"}
              >
                <Link href={"/dashboard/profile"}>
                  <UserIcon />
                  <span>Profil</span>
                </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
