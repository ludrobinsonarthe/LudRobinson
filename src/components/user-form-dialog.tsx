
"use client";

import { useForm } from "react-hook-form";
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
import type { User } from "@/lib/types";
import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";

const userFormSchema = z.object({
  firstName: z.string().min(2, "Le prénom est requis."),
  lastName: z.string().min(2, "Le nom est requis."),
  email: z.string().email("Adresse e-mail invalide."),
  photoUrl: z.string().url("L'URL de la photo est invalide.").optional().or(z.literal('')),
  specialty: z.string().optional(),
  position: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Partial<User>) => void;
  user: User | null;
  userType: 'admin' | 'teacher';
}

export default function UserFormDialog({ isOpen, setIsOpen, onSave, user, userType }: UserFormDialogProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        photoUrl: '',
        specialty: '',
        position: '',
    }
  });

  const showSpecialty = userType === 'teacher';
  const showPosition = userType === 'admin';
  const dialogTitle = user 
    ? `Modifier ${userType === 'teacher' ? 'le professeur' : 'l\'administrateur'}` 
    : `Ajouter ${userType === 'teacher' ? 'un professeur' : 'un administrateur'}`;
  
  const dialogDescription = user
    ? "Modifiez les informations ci-dessous."
    : "Remplissez le formulaire pour créer un nouveau compte.";


  useEffect(() => {
    if (isOpen) {
        if (user) {
        form.reset({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            photoUrl: user.photoUrl,
            specialty: user.teacher?.specialty,
            position: user.admin?.position,
        });
        } else {
        form.reset({
            firstName: '',
            lastName: '',
            email: '',
            photoUrl: `https://picsum.photos/seed/${Date.now()}/100/100`,
            specialty: '',
            position: '',
        });
        }
    }
  }, [user, form.reset, isOpen]);

  const onSubmit = (data: UserFormValues) => {
    const userData: Partial<User> = {...data};
    if (userType === 'teacher') {
        userData.teacher = { specialty: data.specialty || '', assignedCourses: user?.teacher?.assignedCourses || [] };
    }
     if (userType === 'admin') {
        userData.admin = { position: data.position || '' };
    }
    delete (userData as any).specialty;
    delete (userData as any).position;

    onSave(userData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
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

            {showPosition && (
                 <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Poste</FormLabel>
                        <FormControl>
                            <Input placeholder="Comptable, Secrétaire..." {...field} />
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
                {user ? "Enregistrer" : "Créer le compte"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
