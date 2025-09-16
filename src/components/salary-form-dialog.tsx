
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
import type { User, TeacherSalary } from "@/lib/types";
import { useEffect, useCallback } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { getMonth } from "date-fns";

const salaryFormSchema = z.object({
  teacherId: z.string().min(1, "Veuillez sélectionner un professeur."),
  hourlyRate: z.coerce.number().min(1, "Le taux horaire est requis."),
  hoursWorked: z.coerce.number().min(0, "Le nombre d'heures est requis."),
  totalSalary: z.coerce.number(),
  month: z.string().min(1, "Le mois est requis."),
  year: z.string().min(4, "L'année est requise."),
  currency: z.string().min(1, "La devise est requise."),
});

type SalaryFormValues = z.infer<typeof salaryFormSchema>;

interface SalaryFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Omit<TeacherSalary, 'id' | 'createdAt' | 'status'>) => void;
  teachers: User[];
  salary?: TeacherSalary | null;
  initialTeacherId?: string | null;
  calculateHours: (teacherId: string, month: number, year: number) => number;
}

const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => `${currentYear - i}`);

export default function SalaryFormDialog({ isOpen, setIsOpen, onSave, teachers, salary, initialTeacherId, calculateHours }: SalaryFormDialogProps) {
  const form = useForm<SalaryFormValues>({
    resolver: zodResolver(salaryFormSchema),
    defaultValues: {
      teacherId: '',
      hourlyRate: 0,
      hoursWorked: 0,
      totalSalary: 0,
      month: months[new Date().getMonth()],
      year: `${currentYear}`,
      currency: 'XAF',
    }
  });

  const hourlyRate = form.watch('hourlyRate');
  const hoursWorked = form.watch('hoursWorked');
  const teacherId = form.watch('teacherId');
  const month = form.watch('month');
  const year = form.watch('year');

  useEffect(() => {
    const total = (hourlyRate || 0) * (hoursWorked || 0);
    form.setValue('totalSalary', total);
  }, [hourlyRate, hoursWorked, form]);

  const updateHours = useCallback(() => {
    if (teacherId && month && year) {
        const monthIndex = months.indexOf(month);
        const calculatedHours = calculateHours(teacherId, monthIndex, parseInt(year));
        form.setValue('hoursWorked', calculatedHours);
    }
  }, [teacherId, month, year, calculateHours, form]);

  useEffect(() => {
    if(isOpen) {
        updateHours();
    }
  }, [teacherId, month, year, isOpen, updateHours]);

  useEffect(() => {
    if (isOpen) {
        if(salary) {
            form.reset(salary);
        } else {
            form.reset({
                teacherId: initialTeacherId || '',
                hourlyRate: 0,
                hoursWorked: 0,
                totalSalary: 0,
                month: months[new Date().getMonth()],
                year: `${currentYear}`,
                currency: 'XAF',
            });
        }
    }
  }, [salary, isOpen, form, initialTeacherId]);

  const onSubmit = (data: SalaryFormValues) => {
    onSave(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[580px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                {salary ? "Modifier la fiche de paie" : "Générer une fiche de paie"}
              </DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous pour générer la fiche de paie. Les heures sont pré-calculées depuis le suivi des présences.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-6">
                <FormField control={form.control} name="teacherId" render={({ field }) => (
                    <FormItem><FormLabel>Professeur</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!initialTeacherId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un professeur..." /></SelectTrigger></FormControl>
                        <SelectContent>{teachers.map(t => <SelectItem key={t.uid} value={t.uid}>{t.firstName} {t.lastName}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage /></FormItem>
                )}/>
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="month" render={({ field }) => (
                        <FormItem><FormLabel>Mois</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un mois..." /></SelectTrigger></FormControl>
                            <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="year" render={({ field }) => (
                        <FormItem><FormLabel>Année</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une année..." /></SelectTrigger></FormControl>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="hoursWorked" render={({ field }) => (
                        <FormItem><FormLabel>Heures Travaillées</FormLabel><FormControl><Input type="number" placeholder="80" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                        <FormItem><FormLabel>Taux Horaire</FormLabel><FormControl><Input type="number" placeholder="5000" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                
                 <FormField control={form.control} name="totalSalary" render={({ field }) => (
                    <FormItem><FormLabel>Salaire Total</FormLabel>
                    <FormControl><Input type="number" {...field} readOnly className="font-bold bg-muted" /></FormControl>
                    <FormMessage /></FormItem>
                )}/>

            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
              <Button type="submit">{salary ? "Enregistrer" : "Générer la fiche"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
