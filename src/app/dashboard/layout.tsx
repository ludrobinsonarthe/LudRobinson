

"use client"
import Link from "next/link";
import { usePathname, redirect, useRouter } from "next/navigation";
import Image from "next/image";
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
  SidebarGroupContent,
  SidebarInput,
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
  BookUser,
  UserCheck,
  QrCode,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard-header";
import React, { useEffect, useState } from "react";
import { UserProvider, useUser } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";

function AppLogo() {
  const { settings, loading } = useUser();
  if (loading && !settings) {
    return <div className="flex items-center gap-2.5 h-10" />;
  }
  return (
    <Link href="/" className="flex items-center gap-2.5">
       <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-card-foreground">
         <Image src={settings?.logoUrl || "/logo.png"} alt="ISGI Logo" width={40} height={40} className="object-contain" />
       </div>
      <h1 className="font-headline text-lg font-bold tracking-tight text-foreground">
        {settings?.schoolName || 'ISGI'}
      </h1>
    </Link>
  );
}

function MainSidebar() {
  const pathname = usePathname();
  const { user, hasPermission } = useUser();
  const [isMounted, setIsMounted] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const menuItems = [
    { href: "/dashboard", label: "Annonces", icon: Home },
    { href: "/dashboard/messages", label: "Messagerie", icon: MessageSquare },
  ];

  const studentMenuItems = [
    { href: "/dashboard/courses", label: "Cours", icon: BookOpen },
    { href: "/dashboard/grades", label: "Notes", icon: ClipboardList },
    { href: "/dashboard/schedule", label: "Emploi du temps", icon: CalendarDays },
    { href: "/dashboard/promotion", label: "Ma Promotion", icon: Users },
    { href: "/dashboard/documents", label: "Documents", icon: FileText },
    { href: "/dashboard/payments", label: "Paiements", icon: Wallet },
  ];
  
  const adminMenuGroups = [
    {
        group: 'ANALYSE',
        items: [
             { href: "/dashboard/reporting", label: "Tableau de Bord", icon: LayoutDashboard, permission: 'view_reporting' },
        ]
    },
    {
      group: 'PÉDAGOGIE',
      items: [
        { href: "/dashboard/students", label: "Étudiants", icon: GraduationCap, permission: 'manage_students' },
        { href: "/dashboard/course-management", label: "Gestion Cours", icon: BookMarked, permission: 'manage_course' },
        { href: "/dashboard/grade-management", label: "Évaluations et Notes", icon: ClipboardCheck, permission: 'manage_grades' },
        { href: "/dashboard/attendance", label: "Suivi Présences", icon: UserCheck, permission: 'manage_attendance' },
      ],
    },
    {
        group: 'FINANCES',
        items: [
            { href: "/dashboard/tuition-management", label: "Scolarité", icon: Receipt, permission: 'manage_tuition' },
            { href: "/dashboard/salary-management", label: "Salaires", icon: Banknote, permission: 'manage_salaries' },
            { href: "/dashboard/cash-flow", label: "Suivi de caisse", icon: Landmark, permission: 'manage_cash_flow' },
        ]
    },
    {
        group: 'ADMINISTRATION',
        items: [
             { href: "/dashboard/fee-management", label: "Gestion Frais", icon: FileCog, permission: 'manage_fees' },
             { href: "/dashboard/users", label: "Personnel", icon: UserCog, permission: 'manage_users' },
             { href: "/dashboard/roles", label: "Rôles & Permissions", icon: ShieldCheck, permission: 'manage_roles' },
             { href: "/dashboard/admin-management", label: "Administration", icon: Building, permission: 'manage_admin_settings' },
        ]
    }
  ];

  const filteredMenuItems = menuItems.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredStudentMenuItems = studentMenuItems.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAdminMenuGroups = adminMenuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()))
  })).filter(group => group.items.length > 0);


  const showStudentMenu = user?.role === 'student' || user?.role === 'parent';
  const showAdminMenu = user?.role === 'admin';


  return (
      <Sidebar>
        <SidebarHeader>
          <AppLogo />
        </SidebarHeader>
        <SidebarContent>
          {isMounted && (
          <SidebarMenu>
            <SidebarInput 
              placeholder="Rechercher..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {filteredMenuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                  <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            
            {showStudentMenu && filteredStudentMenuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                  <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            {showAdminMenu && filteredAdminMenuGroups.map(group => (
              <SidebarGroup key={group.group}>
                <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  {group.items.map(item =>
                      hasPermission(item.permission) && (
                      <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                          <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                      )
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarMenu>
          )}
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
              <SidebarMenuButton asChild isActive={pathname === "/dashboard/share-session"} tooltip={"Partager la session"}>
                  <Link href="/dashboard/share-session">
                    <QrCode />
                    <span>Partager la session</span>
                  </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ThemeToggle />
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
    }, [authUser, authLoading, router]);
    
    if (authLoading || !authUser) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <UserProvider>
            <ProtectedContent>
                {children}
            </ProtectedContent>
        </UserProvider>
    );
}

function ProtectedContent({children}: {children: React.ReactNode}) {
    const { user, loading: userContextLoading } = useUser();
    
    if (userContextLoading || !user) {
         return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <SidebarProvider>
            <MainSidebar />
            <SidebarInset>
                <DashboardHeader />
                <main className="p-4 sm:p-6 lg:p-8">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    )
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
