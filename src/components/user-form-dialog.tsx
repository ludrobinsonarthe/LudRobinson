
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User, UserRole } from "@/lib/types";
import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";

const roleOptions: {value: UserRole, label: string}[] = [
    { value: "admin", label: "Administrateur" },
    { value: "teacher", label: "Enseignant" },
    { value: "student", label: "Étudiant" },
    { value: "parent", label: "Parent" },
];

const userFormSchema = z.object({
  firstName: z.string().min(2, "Le prénom est requis."),
  lastName: z.string().min(2, "Le nom est requis."),
  email: z.string().email("Adresse e-mail invalide."),
  role: z.enum(["admin", "teacher", "student", "parent"]),
  photoUrl: z.string().url("L'URL de la photo est invalide.").optional().or(z.literal('')),
  specialty: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Partial<User>) => void;
  user: User | null;
  defaultRole?: UserRole;
  allowedRoles?: UserRole[];
}

export default function UserFormDialog({ isOpen, setIsOpen, onSave, user, defaultRole = 'student', allowedRoles }: UserFormDialogProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        role: defaultRole,
        photoUrl: '',
        specialty: '',
    }
  });

  const displayableRoles = allowedRoles ? roleOptions.filter(r => allowedRoles.includes(r.value)) : roleOptions;
  const showSpecialty = form.watch('role') === 'teacher';

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        photoUrl: user.photoUrl,
        specialty: user.teacher?.specialty,
      });
    } else {
      form.reset({
        firstName: '',
        lastName: '',
        email: '',
        role: defaultRole,
        photoUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
        specialty: '',
      });
    }
  }, [user, form.reset, isOpen, defaultRole]);

  const onSubmit = (data: UserFormValues) => {
    const userData: Partial<User> = {...data};
    if (data.role === 'teacher') {
        userData.teacher = { specialty: data.specialty || '', assignedCourses: user?.teacher?.assignedCourses || [] };
    }
    delete (userData as any).specialty;

    onSave(userData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                {user ? "Modifier l'utilisateur" : "Ajouter un nouvel utilisateur"}
              </DialogTitle>
              <DialogDescription>
                {user
                  ? "Modifiez les informations de l'utilisateur ci-dessous."
                  : "Remplissez le formulaire pour créer un nouveau compte."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                            <Input placeholder="Jean" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                            <Input placeholder="Dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Adresse e-mail</FormLabel>
                    <FormControl>
                        <Input type="email" placeholder="email@isgi.com" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Rôle</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={displayableRoles.length === 1}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un rôle..." />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {displayableRoles.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
            
            {showSpecialty && (
                 <FormField
                    control={form.control}
                    name="specialty"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Spécialité</FormLabel>
                        <FormControl>
                            <Input placeholder="Mathématiques, Physique..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}


            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {user ? "Enregistrer" : "Créer l'utilisateur"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
