

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User, Class, Sector, Field, Cycle } from "@/lib/types";
import { useEffect, useState, useMemo } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Separator } from "./ui/separator";
import { mockSectors, mockFields } from "@/lib/mock-data";


const studentFormSchema = z.object({
  // Student Info
  firstName: z.string().min(2, "Le prénom est requis."),
  lastName: z.string().min(2, "Le nom est requis."),
  email: z.string().email("Adresse e-mail invalide."),
  phone: z.string().optional(),
  photo: z.any().optional(),
  matricule: z.string().min(1, "Le matricule est requis."),
  level: z.string().min(1, "Le niveau est requis."),
  sectorId: z.string().min(1, "Le secteur est requis."),
  fieldId: z.string().min(1, "La filière est requise."),
  cycle: z.enum(['local', 'international', 'entrepreneur']),
  parentalLink: z.string().optional(),
  
  // Parent/Tutor Info
  parentSelection: z.enum(['existing', 'new']).default('existing'),
  parentUid: z.string().optional(),
  parentFirstName: z.string().optional(),
  parentLastName: z.string().optional(),
  parentEmail: z.string().optional(),
  parentPhone: z.string().optional(),
  parentAddress: z.string().optional(),
}).refine(data => {
    if (data.parentSelection === 'new') {
        return !!data.parentFirstName && !!data.parentLastName && !!data.parentEmail;
    }
    return true;
}, {
    message: "Les informations du nouveau tuteur sont requises.",
    path: ["parentFirstName"]
}).refine(data => {
    if (data.parentSelection === 'new' && data.parentEmail) {
        return z.string().email().safeParse(data.parentEmail).success;
    }
    return true;
},
{
    message: "L'e-mail du tuteur est invalide.",
    path: ["parentEmail"]
});


type StudentFormValues = z.infer<typeof studentFormSchema>;

interface StudentFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (studentData: Partial<User>, parentData?: Partial<User>) => void;
  student: User | null;
  parents: User[];
}

const levels = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"];
const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

export default function StudentFormDialog({ isOpen, setIsOpen, onSave, student, parents }: StudentFormDialogProps) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        matricule: '',
        level: '',
        sectorId: '',
        fieldId: '',
        cycle: 'local',
        parentSelection: 'existing',
        parentUid: '',
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentPhone: '',
        parentAddress: '',
        parentalLink: ''
    }
  });

  const parentSelection = form.watch('parentSelection');
  const selectedSector = form.watch('sectorId');

  const availableFields = useMemo(() => {
      if (!selectedSector) return [];
      return mockFields.filter(f => f.sectorId === selectedSector);
  }, [selectedSector]);

  useEffect(() => {
    if (isOpen) {
        const studentSectorId = mockFields.find(f => f.id === student?.student?.fieldId)?.sectorId || '';
        if (student) {
          form.reset({
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            phone: student.phone,
            matricule: student.student?.matricule,
            level: student.student?.level,
            sectorId: studentSectorId,
            fieldId: student.student?.fieldId,
            cycle: student.student?.cycle,
            parentUid: student.student?.parentUid,
            parentalLink: student.student?.parentalLink,
            parentSelection: student.student?.parentUid ? 'existing' : 'new'
          });
        } else {
          form.reset({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            matricule: `ISGI-${new Date().getFullYear()}-L1-${Math.floor(100 + Math.random() * 900)}`,
            level: '',
            sectorId: '',
            fieldId: '',
            cycle: 'local',
            parentSelection: 'existing',
            parentUid: '',
            parentFirstName: '',
            parentLastName: '',
            parentEmail: '',
            parentPhone: '',
            parentAddress: '',
            parentalLink: ''
          });
        }
    }
  }, [student, isOpen, form]);
  
   useEffect(() => {
    form.setValue('fieldId', '');
   }, [selectedSector, form]);


  const onSubmit = (data: StudentFormValues) => {
    const studentData: Partial<User> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        // photoUrl will be handled by the upload logic
        student: {
            ...(student?.student || {}),
            matricule: data.matricule,
            cycle: data.cycle,
            level: data.level,
            fieldId: data.fieldId,
            parentalLink: data.parentalLink,
            parentUid: data.parentSelection === 'existing' ? data.parentUid : undefined,
        }
    };
    
    let parentData : Partial<User> | undefined;
    if (data.parentSelection === 'new' && data.parentFirstName && data.parentLastName && data.parentEmail) {
        parentData = {
            firstName: data.parentFirstName,
            lastName: data.parentLastName,
            email: data.parentEmail,
            phone: data.parentPhone,
            address: data.parentAddress,
            photoUrl: `https://picsum.photos/seed/${Date.now()+1}/100/100`,
        }
    }

    onSave(studentData, parentData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                {student ? "Modifier l'étudiant" : "Ajouter un nouvel étudiant"}
              </DialogTitle>
              <DialogDescription>
                Remplissez les informations de l'étudiant et de son tuteur.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-6">
                <h3 className="text-lg font-semibold text-foreground">Informations de l'étudiant</h3>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input placeholder="Jean" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>

                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Adresse e-mail</FormLabel><FormControl><Input type="email" placeholder="email@isgi.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input placeholder="+242 XX XXX XX XX" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>


                <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="matricule" render={({ field }) => (
                        <FormItem><FormLabel>Matricule</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="level" render={({ field }) => (
                        <FormItem><FormLabel>Niveau</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un niveau..." /></SelectTrigger></FormControl>
                            <SelectContent>{levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="sectorId" render={({ field }) => (
                        <FormItem><FormLabel>Secteur</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un secteur..." /></SelectTrigger></FormControl>
                            <SelectContent>{mockSectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="fieldId" render={({ field }) => (
                        <FormItem><FormLabel>Filière</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!selectedSector}>
                            <FormControl><SelectTrigger><SelectValue placeholder={!selectedSector ? "Sélectionnez d'abord un secteur" : "Sélectionner une filière..."} /></SelectTrigger></FormControl>
                            <SelectContent>{availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                </div>
                
                 <FormField control={form.control} name="cycle" render={({ field }) => (
                    <FormItem><FormLabel>Cycle</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un cycle..." /></SelectTrigger></FormControl>
                        <SelectContent>{cycles.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}/>


                <Separator className="my-6"/>

                <h3 className="text-lg font-semibold text-foreground">Informations du tuteur</h3>
                
                <FormField control={form.control} name="parentalLink" render={({ field }) => (
                    <FormItem><FormLabel>Lien parental</FormLabel><FormControl><Input placeholder="Père, Mère, Tuteur légal..." {...field} /></FormControl><FormMessage /></FormItem>
                )}/>

                <FormField control={form.control} name="parentSelection" render={({ field }) => (
                    <FormItem>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="existing">Sélectionner un tuteur existant</SelectItem>
                            <SelectItem value="new">Créer un nouveau tuteur</SelectItem>
                        </SelectContent>
                    </Select>
                    </FormItem>
                )}/>

                {parentSelection === 'existing' && (
                    <FormField control={form.control} name="parentUid" render={({ field }) => (
                        <FormItem><FormLabel>Tuteur existant</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un tuteur..." /></SelectTrigger></FormControl>
                            <SelectContent>{parents.map(p => <SelectItem key={p.uid} value={p.uid}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                )}

                {parentSelection === 'new' && (
                    <div className="space-y-4 rounded-md border p-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="parentFirstName" render={({ field }) => (
                                <FormItem><FormLabel>Prénom du tuteur</FormLabel><FormControl><Input placeholder="Marie" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="parentLastName" render={({ field }) => (
                                <FormItem><FormLabel>Nom du tuteur</FormLabel><FormControl><Input placeholder="Dubois" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                         <FormField control={form.control} name="parentEmail" render={({ field }) => (
                            <FormItem><FormLabel>E-mail du tuteur</FormLabel><FormControl><Input type="email" placeholder="tuteur@email.com" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="parentPhone" render={({ field }) => (
                            <FormItem><FormLabel>Téléphone du tuteur</FormLabel><FormControl><Input placeholder="+242 XX XXX XX XX" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="parentAddress" render={({ field }) => (
                            <FormItem><FormLabel>Adresse du tuteur</FormLabel><FormControl><Input placeholder="Adresse complète" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
              <Button type="submit">{student ? "Enregistrer" : "Créer l'étudiant"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
