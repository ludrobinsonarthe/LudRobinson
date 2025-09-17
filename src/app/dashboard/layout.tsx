"use client"
import Link from "next/link";
import { usePathname, redirect, useRouter } from "next/navigation";
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
  Building,
  UserCog,
  BookMarked,
  Receipt,
  Banknote,
  Landmark,
  FileCog,
  ClipboardCheck,
  LayoutDashboard,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard-header";
import React, { useEffect } from "react";
import { UserProvider, useUser } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";

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
  const { user, hasPermission } = useUser();
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
    { href: "/dashboard/reporting", label: "Tableau de Bord", icon: LayoutDashboard, permission: 'view_reporting' },
    { href: "/dashboard/students", label: "Étudiants", icon: Users, permission: 'manage_students' },
    { href: "/dashboard/teachers", label: "Professeurs", icon: GraduationCap, permission: 'manage_teachers' },
    { href: "/dashboard/course-management", label: "Gestion Cours & Horaires", icon: BookMarked, permission: 'manage_course' },
    { href: "/dashboard/grade-management", label: "Gestion des notes", icon: ClipboardList, permission: 'manage_grades' },
    { href: "/dashboard/tuition-management", label: "Scolarité", icon: Receipt, permission: 'manage_tuition' },
    { href: "/dashboard/fee-management", label: "Gestion des frais", icon: FileCog, permission: 'manage_fees' },
    { href: "/dashboard/salary-management", label: "Salaires", icon: Banknote, permission: 'manage_salaries' },
    { href: "/dashboard/attendance", label: "Suivi des Présences", icon: ClipboardCheck, permission: 'manage_attendance' },
    { href: "/dashboard/cash-flow", label: "Suivi de caisse", icon: Landmark, permission: 'manage_cash_flow' },
    { href: "/dashboard/users", label: "Utilisateurs", icon: UserCog, permission: 'manage_users' },
    { href: "/dashboard/roles", label: "Rôles & Permissions", icon: ShieldCheck, permission: 'manage_roles' },
    { href: "/dashboard/admin-management", label: "Administration", icon: Building, permission: 'manage_admin_settings' },
  ]

  const menuItems = [
    { href: "/dashboard", label: "Annonces", icon: Home },
    { href: "/dashboard/messages", label: "Messagerie", icon: MessageSquare },
  ];
  
  const showStudentMenu = user?.role === 'student' || user?.role === 'parent';
  const showAdminMenu = user?.role === 'admin';


  return (
    <Sidebar>
      <SidebarHeader>
        <AppLogo />
      </SidebarHeader>
      <SidebarContent>
        {isMounted && <SidebarMenu>
          
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
          
          {showStudentMenu && studentMenuItems.map((item) => (
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

          {showAdminMenu && adminManagementItems.map((item) => 
            hasPermission(item.permission) && (
              <SidebarMenuItem key={item.href + item.label}>
                  <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(item.href)}
                      tooltip={item.label}
                  >
                      <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                      </Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}

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

function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { user: authUser, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !authUser) {
            redirect('/login');
        }
    }, [authUser, authLoading]);

    if (authLoading || !authUser) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
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


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout>
      {children}
    </ProtectedLayout>
  );
}
