
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
import type { Course, User, Program } from "@/lib/types";
import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";

const courseFormSchema = z.object({
  name: z.string().min(3, "Le nom du cours doit comporter au moins 3 caractères."),
  description: z.string().optional(),
  teacherId: z.string().min(1, "Veuillez sélectionner un professeur."),
  programId: z.string().min(1, "Veuillez sélectionner un programme."),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

interface CourseFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Partial<Course>) => void;
  course: Course | null;
  teachers: User[];
  programs: Pick<Program, 'id' | 'name'>[];
}

export default function CourseFormDialog({ isOpen, setIsOpen, onSave, course, teachers, programs }: CourseFormDialogProps) {
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
        name: '',
        description: '',
        teacherId: '',
        programId: '',
    }
  });

  useEffect(() => {
    if (course) {
      form.reset({
        name: course.name,
        description: course.description,
        teacherId: course.teacherId,
        programId: course.programId,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        teacherId: '',
        programId: '',
      });
    }
  }, [course, form.reset, isOpen]);

  const onSubmit = (data: CourseFormValues) => {
    onSave(data);
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

            <FormField control={form.control} name="programId" render={({ field }) => (
                <FormItem>
                <FormLabel>Programme</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un programme..." /></SelectTrigger></FormControl>
                    <SelectContent>
                        {programs.map(program => (
                            <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}/>

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
