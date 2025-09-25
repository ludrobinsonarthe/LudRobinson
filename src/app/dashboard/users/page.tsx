

"use client";

import { useState, useMemo, useEffect }from "react";
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, UserRole, AdminRole, TeacherSalary, ActivityLog } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, Banknote, FileDown } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserFormDialog from "@/components/user-form-dialog";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, deleteDoc, addDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db, storage, auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { imageToDataUrl } from '@/lib/utils';


const statusVariant: { [key: string]: "default" | "secondary" | "destructive" } = {
    active: "default",
    suspended: "destructive",
}

const statusTranslation: { [key: string]: string } = {
    active: "Actif",
    suspended: "Suspendu",
}

const roleTranslation: { [key: string]: string } = {
    admin: "Admin",
    teacher: "Professeur",
}


const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};

export default function UsersPage() {
    const { allUsers, loading, roles, settings, user: adminUser } = useUser();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userType, setUserType] = useState<'admin' | 'teacher'>('admin');
    const { toast } = useToast();

    // Filters
    const [nameFilter, setNameFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    
    const employees = useMemo(() => {
        return allUsers.filter(user => user.role === 'admin' || user.role === 'teacher');
    }, [allUsers]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(employee => 
            (`${employee.lastName} ${employee.firstName}`.toLowerCase().includes(nameFilter.toLowerCase())) &&
            (roleFilter === 'all' || employee.role === roleFilter)
        )
    }, [employees, nameFilter, roleFilter]);
    
    const rolesById = useMemo(() => {
        return roles.reduce((acc, role) => {
            acc[role.id] = role;
            return acc;
        }, {} as Record<string, AdminRole>);
    }, [roles]);

    const handleAdd = (type: 'admin' | 'teacher') => {
        setSelectedUser(null);
        setUserType(type);
        setIsFormOpen(true);
    }

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setUserType(user.role as 'admin' | 'teacher');
        setIsFormOpen(true);
    }

    const handleDelete = (user: User) => {
        setSelectedUser(user);
        setIsDeleteOpen(true);
    }

    const handleSave = async (userData: Partial<User>, photoFile?: File | Blob) => {
        if (!userData.email || !adminUser) {
            toast({ variant: "destructive", title: "Erreur", description: "L'e-mail est requis et vous devez être administrateur." });
            return;
        }

        try {
            const batch = writeBatch(db);
            const logRef = doc(collection(db, 'activityLogs'));
            let userName = `${userData.lastName} ${userData.firstName}`;

            if (selectedUser) {
                // --- UPDATE EXISTING USER ---
                let photoUrl = selectedUser.photoUrl;
                if (photoFile) {
                    const photoRef = ref(storage, `avatars/${selectedUser.uid}`);
                    await uploadBytes(photoRef, photoFile);
                    photoUrl = await getDownloadURL(photoRef);
                }

                const updatedUser: User = { ...selectedUser, ...userData, photoUrl: photoUrl || selectedUser.photoUrl } as User;
                
                const userDocRef = doc(db, "users", selectedUser.uid);
                batch.update(userDocRef, updatedUser);

                const log: Omit<ActivityLog, 'id'> = {
                    actorId: adminUser.uid, actorName: `${adminUser.lastName} ${adminUser.firstName}`, action: 'user_updated',
                    entityType: 'user', entityId: selectedUser.uid, timestamp: new Date().toISOString(),
                    details: `A mis à jour le profil de: ${userName}`,
                };
                batch.set(logRef, log);
                toast({ title: "Profil mis à jour" });

            } else {
                // --- CREATE NEW USER ---
                const defaultPassword = "password";
                // This part should ideally be a backend function for security reasons
                const userCredential = await createUserWithEmailAndPassword(auth, userData.email, defaultPassword);
                const uid = userCredential.user.uid;
    
                let photoUrl = `https://picsum.photos/seed/${uid}/100/100`;
                if (photoFile) {
                    const photoRef = ref(storage, `avatars/${uid}`);
                    await uploadBytes(photoRef, photoFile);
                    photoUrl = await getDownloadURL(photoRef);
                }
    
                const newUser: User = {
                    ...userData, uid, photoUrl, role: userData.role as UserRole,
                    createdAt: new Date().toISOString(), status: 'active',
                } as User;
                
                batch.set(doc(db, "users", uid), newUser);
                
                const log: Omit<ActivityLog, 'id'> = {
                    actorId: adminUser.uid, actorName: `${adminUser.lastName} ${adminUser.firstName}`, action: 'user_created',
                    entityType: 'user', entityId: uid, timestamp: new Date().toISOString(),
                    details: `A créé un nouveau compte pour: ${userName} (Rôle: ${userData.role})`,
                };
                batch.set(logRef, log);

                toast({ title: "Utilisateur créé", description: "Le compte a été créé avec le mot de passe par défaut 'password'." });
            }
            await batch.commit();
        } catch (error: any) {
            console.error("Error saving user:", error);
            if (error.code === 'auth/email-already-in-use') {
                toast({
                    variant: "destructive", title: "Erreur : E-mail déjà utilisé",
                    description: "Cette adresse e-mail est déjà associée à un compte. Veuillez en utiliser une autre.",
                });
            } else {
                toast({ variant: "destructive", title: "Erreur de sauvegarde", description: error.message || "Impossible de sauvegarder l'utilisateur." });
            }
        }
    };
    
    const confirmDelete = async () => {
        if(!selectedUser || !adminUser) return;
        
        const userId = selectedUser.uid;
        const userName = `${selectedUser.lastName} ${selectedUser.firstName}`;
        const batch = writeBatch(db);
        
        try {
            // Note: Deleting from Auth should be done in a secure backend environment
            batch.delete(doc(db, "users", userId));

            // Log the deletion
            const logRef = doc(collection(db, 'activityLogs'));
            const log: Omit<ActivityLog, 'id'> = {
                actorId: adminUser.uid, actorName: `${adminUser.lastName} ${adminUser.firstName}`,
                action: 'user_deleted', entityType: 'user', entityId: userId,
                timestamp: new Date().toISOString(), details: `A supprimé le compte de: ${userName}`,
            };
            batch.set(logRef, log);

            // Query and delete related data if they are a teacher
            if (selectedUser.role === 'teacher') {
                const qSalaries = query(collection(db, "teacherSalaries"), where("teacherId", "==", userId));
                const salariesSnapshot = await getDocs(qSalaries);
                salariesSnapshot.forEach(doc => batch.delete(doc.ref));
                
                const qAttendances = query(collection(db, "attendances"), where("teacherId", "==", userId));
                const attendancesSnapshot = await getDocs(qAttendances);
                attendancesSnapshot.forEach(doc => batch.delete(doc.ref));
            }
            
            // Delete avatar from storage
             if (selectedUser.photoUrl && selectedUser.photoUrl.includes('firebasestorage')) {
                 try {
                    const photoRef = ref(storage, selectedUser.photoUrl);
                    await deleteObject(photoRef);
                } catch (storageError: any) {
                    if (storageError.code !== 'storage/object-not-found') {
                         console.error("Could not delete avatar: ", storageError);
                    }
                }
            }

            await batch.commit();
            toast({ title: "Utilisateur supprimé de la base de données", description: "Le compte de connexion doit être supprimé manuellement via la console Firebase." });

        } catch(error) {
            console.error("Error deleting user:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'utilisateur et ses données associées." });
        } finally {
             setIsDeleteOpen(false);
             setSelectedUser(null);
        }
    }

    const handleExportPDF = async () => {
        if (!settings) return;
        const doc = new jsPDF();
        
        try {
            const logoDataUrl = await imageToDataUrl(settings.logoUrl);
            if(logoDataUrl) {
                const logoExtension = logoDataUrl.split(';')[0].split('/')[1].toUpperCase();
                doc.addImage(logoDataUrl, logoExtension, 14, 10, 20, 20);
            }
        } catch (error) {
            console.error("Could not add logo to PDF, proceeding without it.", error);
        }
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(settings.schoolName, 40, 18);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Liste du Personnel - ${format(new Date(), 'd MMMM yyyy', { locale: fr })}`, 14, 30);

        const tableColumn = ["Nom", "Email", "Rôle", "Spécificité"];
        const tableRows: string[][] = [];

        filteredEmployees.forEach(user => {
            const userData = [
                `${user.lastName} ${user.firstName}`,
                user.email,
                roleTranslation[user.role],
                user.role === 'teacher' ? user.teacher?.specialty || 'N/A' : rolesById[user.admin?.roleId || '']?.name || 'N/A',
            ];
            tableRows.push(userData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
        });

        doc.save(`liste_personnel_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast({ title: 'Téléchargement réussi', description: 'Le fichier PDF du personnel a été généré.' });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion du Personnel</h1>
                    <p className="text-muted-foreground">
                        Gérez les comptes des professeurs et du personnel administratif.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                     <Button variant="outline" onClick={handleExportPDF}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Exporter
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Ajouter du personnel
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleAdd('teacher')}>Ajouter un Professeur</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAdd('admin')}>Ajouter un Administrateur</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste du personnel</CardTitle>
                    <CardDescription>
                        Recherchez, ajoutez, ou modifiez les profils du personnel.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex items-center gap-4 mb-4">
                        <Input
                            placeholder="Rechercher par nom..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les rôles</SelectItem>
                                <SelectItem value="teacher">Professeurs</SelectItem>
                                <SelectItem value="admin">Administrateurs</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead>Rôle</TableHead>
                                <TableHead className="hidden md:table-cell">Spécificité</TableHead>
                                <TableHead className="hidden lg:table-cell">Statut</TableHead>
                                <TableHead className="hidden lg:table-cell">Date d'ajout</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : filteredEmployees.length > 0 ? filteredEmployees.map(user => (
                                <TableRow key={user.uid}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={user.photoUrl} alt={user.firstName} />
                                                <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="grid gap-0.5">
                                                <span className="font-semibold">{user.lastName} {user.firstName}</span>
                                                <span className="text-sm text-muted-foreground">{user.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{roleTranslation[user.role]}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {user.role === 'teacher' ? user.teacher?.specialty : rolesById[user.admin?.roleId || '']?.name || 'N/A'}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <Badge variant={statusVariant[user.status]}>{statusTranslation[user.status]}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {format(new Date(user.createdAt), 'd MMMM yyyy', { locale: fr })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifier
                                            </DropdownMenuItem>
                                             {user.role === 'teacher' && (
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/salary-management?userId=${user.uid}`}>
                                                        <Banknote className="mr-2 h-4 w-4" />
                                                        Voir les salaires
                                                    </Link>
                                                </DropdownMenuItem>
                                             )}
                                            <DropdownMenuItem onClick={() => handleDelete(user)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Aucun personnel trouvé.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <UserFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                user={selectedUser}
                userType={userType}
                adminRoles={roles}
            />
            <UserDeleteDialog
                isOpen={isDeleteOpen}
                setIsOpen={setIsDeleteOpen}
                onConfirm={confirmDelete}
                item={selectedUser}
                title={`Supprimer ${selectedUser?.role === 'teacher' ? 'ce professeur' : 'cet admin'} ?`}
                description={`L'utilisateur "${selectedUser?.lastName} ${selectedUser?.firstName}" et toutes ses données associées (salaires, etc.) seront définitivement supprimés. Cette action est irréversible.`}
            />
        </div>
    );
}
