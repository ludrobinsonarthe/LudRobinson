
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course, User, Sector, Field } from "@/lib/types";
import { useEffect, useMemo } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { mockSectors, mockFields } from "@/lib/mock-data";

const courseFormSchema = z.object({
  name: z.string().min(3, "Le nom du cours doit comporter au moins 3 caractères."),
  description: z.string().optional(),
  teacherId: z.string().min(1, "Veuillez sélectionner un professeur."),
  sectorId: z.string().min(1, "Le secteur est requis."),
  fieldId: z.string().min(1, "La filière est requise."),
  documentFile: z.any().optional(),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

interface CourseFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Partial<Course>) => void;
  course: Course | null;
  teachers: User[];
  sectors: Sector[];
  fields: Field[];
}

export default function CourseFormDialog({ isOpen, setIsOpen, onSave, course, teachers, sectors, fields }: CourseFormDialogProps) {
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
        name: '',
        description: '',
        teacherId: '',
        sectorId: '',
        fieldId: '',
    }
  });

  const selectedSector = form.watch('sectorId');

  const availableFields = useMemo(() => {
      if (!selectedSector) return [];
      return fields.filter(f => f.sectorId === selectedSector);
  }, [selectedSector, fields]);

  useEffect(() => {
    if (isOpen) {
        const courseSectorId = fields.find(f => f.id === course?.fieldId)?.sectorId || '';
        if (course) {
          form.reset({
            name: course.name,
            description: course.description,
            teacherId: course.teacherId,
            sectorId: courseSectorId,
            fieldId: course.fieldId,
          });
        } else {
          form.reset({
            name: '',
            description: '',
            teacherId: '',
            sectorId: '',
            fieldId: '',
          });
        }
    }
  }, [course, isOpen, form, fields]);
  
   useEffect(() => {
    if(!form.getValues('fieldId')) return;
    const currentField = fields.find(f => f.id === form.getValues('fieldId'));
    if(currentField && currentField.sectorId !== selectedSector) {
        form.setValue('fieldId', '');
    }
   }, [selectedSector, form, fields]);

  const onSubmit = (data: CourseFormValues) => {
    // NOTE: File upload logic is not implemented yet.
    // This will require setting up Firebase Storage and handling the upload.
    const { sectorId, documentFile, ...courseData} = data;
    const finalCourseData: Partial<Course> = {
        ...courseData,
        // When upload is implemented, the uploaded file URL will be saved here.
        documents: course?.documents || [] 
    };
    onSave(finalCourseData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                {course ? "Modifier le cours" : "Ajouter un nouveau cours"}
              </DialogTitle>
              <DialogDescription>
                {course
                  ? "Modifiez les informations du cours ci-dessous."
                  : "Remplissez le formulaire pour créer un nouveau cours."}
              </DialogDescription>
            </DialogHeader>
            
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                <FormLabel>Nom du cours</FormLabel>
                <FormControl><Input placeholder="Ex: Mathématiques Avancées" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}/>
             <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Brève description du cours..." {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}/>

             <FormField control={form.control} name="documentFile" render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                <FormLabel>Document du cours (PDF)</FormLabel>
                <FormControl>
                    <Input 
                        type="file" 
                        accept=".pdf"
                        onChange={(e) => onChange(e.target.files)}
                        {...rest}
                    />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}/>

            <FormField control={form.control} name="teacherId" render={({ field }) => (
                <FormItem>
                <FormLabel>Professeur</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un professeur..." /></SelectTrigger></FormControl>
                    <SelectContent>
                        {teachers.map(teacher => (
                            <SelectItem key={teacher.uid} value={teacher.uid}>{teacher.firstName} {teacher.lastName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}/>

            <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sectorId" render={({ field }) => (
                    <FormItem><FormLabel>Secteur</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Secteur..." /></SelectTrigger></FormControl>
                        <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="fieldId" render={({ field }) => (
                    <FormItem><FormLabel>Filière</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSector}>
                        <FormControl><SelectTrigger><SelectValue placeholder={!selectedSector ? "Sélectionnez d'abord un secteur" : "Filière..."} /></SelectTrigger></FormControl>
                        <SelectContent>{availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}/>
            </div>


            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
              <Button type="submit">{course ? "Enregistrer" : "Créer le cours"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
