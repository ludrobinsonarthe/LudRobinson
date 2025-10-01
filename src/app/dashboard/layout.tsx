

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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SidebarTrigger,
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
  ArrowRightLeft,
  Archive,
  QrCode,
  History,
  Library,
  Menu,
} from "lucide-react";
import DashboardHeader from "@/components/dashboard-header";
import React, { useEffect, useState } from "react";
import { UserProvider, useUser } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { FirebaseErrorListener } from "@/components/FirebaseErrorListener";
import { AdminPermission } from "@/lib/types";
import { type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


function AppLogo() {
  const { settings, loading } = useUser();
  if (loading && !settings) {
    return <div className="flex items-center gap-2.5 h-10" />;
  }
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
       <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-card-foreground shrink-0">
         <Image src={settings?.logoUrl || "/logo.png"} alt="ISGI Logo" width={40} height={40} className="object-contain" unoptimized />
       </div>
      <h1 className="font-headline text-lg font-bold tracking-tight text-foreground truncate">
        {settings?.schoolName || 'ISGI'}
      </h1>
    </Link>
  );
}

type AdminMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: AdminPermission;
};

type AdminMenuGroup = {
  group: string;
  items: AdminMenuItem[];
};

function MainSidebar() {
  const pathname = usePathname();
  const { user, hasPermission } = useUser();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const menuItems = [
    { href: "/dashboard", label: "Annonces", icon: Home },
    { href: "/dashboard/messages", label: "Messagerie", icon: MessageSquare },
  ];

  const studentMenuItems = [
    { href: "/dashboard/courses", label: "Mes Cours", icon: BookOpen },
    { href: "/dashboard/all-courses", label: "Explorer les cours", icon: Library },
    { href: "/dashboard/grades", label: "Notes", icon: ClipboardList },
    { href: "/dashboard/schedule", label: "Emploi du temps", icon: CalendarDays },
    { href: "/dashboard/promotion", label: "Ma Promotion", icon: Users },
    { href: "/dashboard/documents", label: "Documents", icon: FileText },
    { href: "/dashboard/payments", label: "Paiements", icon: Wallet },
  ];
  
  const adminMenuGroups: AdminMenuGroup[] = [
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
        { href: "/dashboard/course-management", label: "Gestion Cours & Horaires", icon: BookMarked, permission: 'manage_course' },
        { href: "/dashboard/grade-management", label: "Évaluations et Notes", icon: ClipboardCheck, permission: 'manage_grades' },
        { href: "/dashboard/attendance", label: "Présences", icon: UserCheck, permission: 'manage_attendance' },
        { href: "/dashboard/certificates", label: "Certificats", icon: FileText, permission: 'manage_students' },
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
             { href: "/dashboard/annual-transition", label: "Transition Annuelle", icon: ArrowRightLeft, permission: 'manage_admin_settings' },
             { href: "/dashboard/academic-history", label: "Historique Académique", icon: Archive, permission: 'manage_admin_settings' },
             { href: "/dashboard/activity-history", label: "Historique Activités", icon: History, permission: 'manage_admin_settings' },
        ]
    }
  ];

  const showStudentMenu = user?.role === 'student' || user?.role === 'parent';
  const showTeacherMenu = user?.role === 'teacher';
  const showAdminMenu = user?.role === 'admin';

  const commonMenuItems = (
    <SidebarMenu>
        {menuItems.map((item) => (
        <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
            <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        ))}
        
        {showStudentMenu && studentMenuItems.map((item) => (
          <SidebarMenuItem key={item.href}>
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
        ))}

        {showTeacherMenu && (
          <>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/courses')} tooltip={"Mes Cours Assignés"}>
                <Link href={'/dashboard/courses'}><BookOpen/><span>Mes Cours Assignés</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/all-courses')} tooltip={"Explorer les cours"}>
                <Link href={'/dashboard/all-courses'}><Library/><span>Explorer les cours</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/grade-management')} tooltip={"Gestion des Notes"}>
                <Link href={'/dashboard/grade-management'}><ClipboardList/><span>Gestion des Notes</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/schedule')} tooltip={"Mon Emploi du Temps"}>
                <Link href={'/dashboard/schedule'}><CalendarDays/><span>Mon Emploi du Temps</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/my-salary')} tooltip={"Mes Salaires"}>
                <Link href={'/dashboard/my-salary'}><Banknote/><span>Mes Salaires</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </>
        )}

        {showAdminMenu && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/my-salary')} tooltip={"Mes Salaires"}>
                <Link href={'/dashboard/my-salary'}><Banknote/><span>Mes Salaires</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
        )}
        
        {showAdminMenu && adminMenuGroups.map(group => (
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
  );

  const commonFooter = (
      <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    isActive={pathname === "/dashboard/share-session"}
                    tooltip={"Partager la session"}
                >
                    <Link href={"/dashboard/share-session"}>
                        <QrCode />
                        <span>Partager la session</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
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
            <ThemeToggle />
            </SidebarMenuItem>
        </SidebarMenu>
  );


  return (
    <Sidebar>
        {/* Desktop Sidebar */}
        <SidebarHeader className="hidden md:flex">
            <AppLogo />
        </SidebarHeader>
        <SidebarContent className="hidden md:flex">
            {isMounted && commonMenuItems}
        </SidebarContent>
        <SidebarFooter className="hidden md:flex">
            {commonFooter}
        </SidebarFooter>

        {/* Mobile Sheet */}
        <Sheet>
            <SheetTrigger asChild>
                <div className="md:hidden">
                    {/* This is part of DashboardHeader now */}
                </div>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] flex flex-col">
                <SidebarHeader>
                    <AppLogo />
                </SidebarHeader>
                <SidebarContent>
                    {isMounted && commonMenuItems}
                </SidebarContent>
                <SidebarFooter>
                    {commonFooter}
                </SidebarFooter>
            </SheetContent>
        </Sheet>
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
            <FirebaseErrorListener />
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
