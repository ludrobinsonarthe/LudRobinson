

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
import type { User, AdminRole } from "@/lib/types";
import { useEffect, useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import ImageCropperDialog from "./image-cropper-dialog";

const userFormSchema = z.object({
  firstName: z.string().min(2, "Le prénom est requis."),
  lastName: z.string().min(2, "Le nom est requis."),
  email: z.string().email("Adresse e-mail invalide."),
  photo: z.any().optional(),
  specialty: z.string().optional(),
  roleId: z.string().optional(),
  position: z.string().optional(),
  baseSalary: z.coerce.number().min(0, "Le salaire doit être un nombre positif.").optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Partial<User>, photoFile?: File | Blob) => void;
  user: User | null;
  userType: 'admin' | 'teacher';
  adminRoles?: AdminRole[];
}

export default function UserFormDialog({ isOpen, setIsOpen, onSave, user, userType, adminRoles }: UserFormDialogProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        specialty: '',
        roleId: '',
        position: '',
        baseSalary: 0,
    }
  });
  
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');

  const showSpecialty = userType === 'teacher';
  const showAdminFields = userType === 'admin';
  const dialogTitle = user 
    ? `Modifier ${userType === 'teacher' ? 'le professeur' : 'l\'administrateur'}` 
    : `Ajouter ${userType === 'teacher' ? 'un professeur' : 'un administrateur'}`;
  
  const dialogDescription = user
    ? "Modifiez les informations ci-dessous."
    : "Remplissez le formulaire pour créer un nouveau compte. Le compte sera créé comme 'Suspendu' et devra être activé.";


  useEffect(() => {
    if (isOpen) {
        if (user) {
        form.reset({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            specialty: user.teacher?.specialty || '',
            roleId: user.admin?.roleId || '',
            position: user.admin?.position || '',
            baseSalary: user.admin?.baseSalary || 0,
        });
        } else {
        form.reset({
            firstName: '',
            lastName: '',
            email: '',
            specialty: '',
            roleId: '',
            position: '',
            baseSalary: 0,
        });
        }
    }
  }, [user, form, isOpen]);
  
  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImgSrc(reader.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCroppedImage = (imageBlob: Blob | null) => {
    if (imageBlob) {
        form.setValue('photo', imageBlob);
    }
  }

  const onSubmit = (data: UserFormValues) => {
    const { photo, ...userDataValues } = data;
    const userData: Partial<User> = {
        firstName: userDataValues.firstName,
        lastName: userDataValues.lastName,
        email: userDataValues.email,
        role: userType,
        status: user ? user.status : 'suspended', // Set new users to suspended by default
    };
    if (userType === 'teacher') {
        userData.teacher = { specialty: userDataValues.specialty || '', assignedCourses: user?.teacher?.assignedCourses || [] };
    }
     if (userType === 'admin') {
        userData.admin = { 
            roleId: userDataValues.roleId || '', 
            position: userDataValues.position || '',
            baseSalary: userDataValues.baseSalary || 0
        };
    }
    
    onSave(userData, photo);
    setIsOpen(false);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
            
            <FormItem>
                <FormLabel>Photo de profil</FormLabel>
                <FormControl>
                    <Input type="file" accept="image/*" onChange={handlePhotoChange} />
                </FormControl>
                <FormMessage />
            </FormItem>

            <div className="grid grid-cols-2 gap-4">
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
                            <Input placeholder="Mathématiques, Physique..." {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            {showAdminFields && (
                <>
                    <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Poste occupé</FormLabel>
                            <FormControl>
                                <Input placeholder="Directeur des études, Comptable..." {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    {adminRoles && (
                        <FormField
                            control={form.control}
                            name="roleId"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Rôle (Permissions)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un rôle..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {adminRoles.map(role => (
                                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                    <FormField
                        control={form.control}
                        name="baseSalary"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Salaire de base mensuel</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="500000" {...field} value={field.value || 0} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </>
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
     <ImageCropperDialog
        isOpen={cropperOpen}
        setIsOpen={setCropperOpen}
        imgSrc={imgSrc}
        onCropped={handleCroppedImage}
    />
    </>
  );
}
