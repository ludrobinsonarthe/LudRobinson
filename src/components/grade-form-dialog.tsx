
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
import { Grade } from "@/lib/types";
import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Textarea } from "./ui/textarea";

const gradeFormSchema = z.object({
  type: z.enum(['devoir', 'examen']),
  score: z.coerce.number().min(0, "La note est requise."),
  total: z.coerce.number().min(1, "Le total est requis."),
  coefficient: z.coerce.number().min(0.5, "Le coefficient est requis."),
  comment: z.string().optional(),
  academicYear: z.string().min(1, "L'année académique est requise."),
});

type GradeFormValues = z.infer<typeof gradeFormSchema>;

interface GradeFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Grade) => void;
  grade: Grade | null;
  studentId: string;
  courseId: string;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => `${currentYear - i}-${currentYear - i + 1}`);


export default function GradeFormDialog({ isOpen, setIsOpen, onSave, grade, studentId, courseId }: GradeFormDialogProps) {
  const form = useForm<GradeFormValues>({
    resolver: zodResolver(gradeFormSchema),
    defaultValues: {
      type: 'devoir',
      score: 0,
      total: 20,
      coefficient: 1,
      comment: '',
      academicYear: years[0],
    }
  });

  useEffect(() => {
    if (isOpen) {
        if(grade) {
            form.reset({
                type: grade.type,
                score: grade.score,
                total: grade.total,
                coefficient: grade.coefficient,
                comment: grade.comment,
                academicYear: grade.academicYear,
            });
        } else {
            form.reset({
              type: 'devoir',
              score: 0,
              total: 20,
              coefficient: 1,
              comment: '',
              academicYear: years[0],
            });
        }
    }
  }, [grade, isOpen, form]);

  const onSubmit = (data: GradeFormValues) => {
    const newGrade: Grade = {
      id: grade?.id || `grade_${Date.now()}`,
      studentId: grade?.studentId || studentId,
      courseId: grade?.courseId || courseId,
      createdAt: grade?.createdAt || new Date().toISOString(),
      ...data
    };
    onSave(newGrade);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                {grade ? "Modifier la note" : "Ajouter une nouvelle note"}
              </DialogTitle>
              <DialogDescription>
                Remplissez les informations de l'évaluation ci-dessous.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-6">
                <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Type d'évaluation</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="devoir">Devoir / Contrôle continu</SelectItem>
                            <SelectItem value="examen">Examen</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage /></FormItem>
                )}/>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="score" render={({ field }) => (
                        <FormItem><FormLabel>Note</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="total" render={({ field }) => (
                        <FormItem><FormLabel>Sur</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="coefficient" render={({ field }) => (
                        <FormItem><FormLabel>Coefficient</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                     <FormField control={form.control} name="academicYear" render={({ field }) => (
                        <FormItem><FormLabel>Année Académique</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                </div>
                 
                 <FormField control={form.control} name="comment" render={({ field }) => (
                    <FormItem><FormLabel>Commentaire (optionnel)</FormLabel><FormControl><Textarea placeholder="Commentaires sur la note..." {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
              <Button type="submit">{grade ? "Enregistrer" : "Ajouter la note"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
