

"use client";

import React, { useState, useMemo, useEffect } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Separator } from "./ui/separator";
import ImageCropperDialog from "./image-cropper-dialog";
import { useUser } from "@/hooks/use-user";


const studentFormSchema = z.object({
  // Student Info
  firstName: z.string().min(2, "Le prénom est requis."),
  lastName: z.string().min(2, "Le nom est requis."),
  email: z.string().email("Adresse e-mail invalide.").optional().or(z.literal('')),
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
  onSave: (studentData: Partial<User>, parentData?: Partial<User>, photoFile?: File | Blob) => void;
  student: User | null;
  parents: User[];
  students: User[];
}

const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

const StudentFormDialog = React.forwardRef<HTMLDivElement, StudentFormDialogProps>(
    ({ isOpen, setIsOpen, onSave, student, parents, students }, ref) => {
    const { settings, fields, sectors } = useUser();

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
  
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');

  const parentSelection = form.watch('parentSelection');
  const selectedSector = form.watch('sectorId');
  const selectedLevel = form.watch('level');

  const availableFields = useMemo(() => {
      if (!selectedSector) return [];
      return fields.filter(f => f.sectorId === selectedSector);
  }, [selectedSector, fields]);

  const generateMatricule = (level: string) => {
    if (!level) return '';
    const year = new Date().getFullYear();
    const levelCode = level.replace(' ', '').slice(-2).toUpperCase(); // L1, L2, M1...
    const studentsInLevel = students.filter(s => s.student?.level === level).length;
    const nextId = (studentsInLevel + 1).toString().padStart(4, '0');
    return `ISGI-${year}-${levelCode}-${nextId}`;
  };

  useEffect(() => {
    if (isOpen) {
        if (student) {
            const studentSectorId = fields.find(f => f.id === student.student?.fieldId)?.sectorId || '';
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
          // Reset and generate new matricule if level is already selected
          const initialLevel = settings?.levels[0]?.value || '';
          form.reset({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            matricule: generateMatricule(initialLevel),
            level: initialLevel,
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
  }, [student, isOpen, form, fields, settings]);
  
  useEffect(() => {
    if (isOpen && !student && selectedLevel) {
        form.setValue('matricule', generateMatricule(selectedLevel));
    }
  }, [selectedLevel, isOpen, student, form]);

   useEffect(() => {
    if(!form.getValues('fieldId')) return;
    const currentField = fields.find(f => f.id === form.getValues('fieldId'));
    if(currentField && currentField.sectorId !== selectedSector) {
        form.setValue('fieldId', '');
    }
   }, [selectedSector, form, fields]);


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

  const onSubmit = (data: StudentFormValues) => {
    const { photo, ...studentDataValues } = data;
    const studentData: Partial<User> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        student: {
            ...(student?.student || {} as any),
            matricule: data.matricule,
            cycle: data.cycle,
            level: data.level,
            fieldId: data.fieldId,
            parentalLink: data.parentalLink,
            parentUid: data.parentSelection === 'existing' ? data.parentUid : undefined,
            programId: student?.student?.programId || 'prog01', // Keep existing or default
            enrollmentDate: student?.student?.enrollmentDate || new Date().toISOString(),
            endDate: student?.student?.endDate || '',
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
        }
    }

    onSave(studentData, parentData, photo);
    setIsOpen(false);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl" ref={ref}>
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
                <FormItem>
                    <FormLabel>Photo de profil</FormLabel>
                    <FormControl>
                        <Input type="file" accept="image/*" onChange={handlePhotoChange} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
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
                        <FormItem><FormLabel>Adresse e-mail (Optionnel)</FormLabel><FormControl><Input type="email" placeholder="email@isgi.com" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input placeholder="+242 XX XXX XX XX" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>


                <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="matricule" render={({ field }) => (
                        <FormItem><FormLabel>Matricule</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="level" render={({ field }) => (
                        <FormItem><FormLabel>Niveau</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un niveau..." /></SelectTrigger></FormControl>
                            <SelectContent>{settings?.levels.map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}</SelectContent>
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
                            <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="fieldId" render={({ field }) => (
                        <FormItem><FormLabel>Filière</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSector}>
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
     <ImageCropperDialog
        isOpen={cropperOpen}
        setIsOpen={setCropperOpen}
        imgSrc={imgSrc}
        onCropped={handleCroppedImage}
    />
    </>
  );
});
StudentFormDialog.displayName = 'StudentFormDialog';
export default StudentFormDialog;
