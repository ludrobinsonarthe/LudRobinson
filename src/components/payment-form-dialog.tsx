

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
import type { User, Payment, FeeStructure } from "@/lib/types";
import { useEffect, useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const paymentFormSchema = z.object({
  studentId: z.string().min(1, "Veuillez sélectionner un étudiant."),
  amountExpected: z.coerce.number().min(0, "Le montant attendu est requis."),
  amountPaid: z.coerce.number().min(1, "Le montant payé est requis."),
  month: z.string().min(1, "Le mois est requis."),
  year: z.string().min(1, "L'année est requise."),
  currency: z.string().min(1, "La devise est requise."),
  method: z.enum(['mobile_money', 'cash', 'card']),
  proofUrl: z.string().url().optional().or(z.literal('')),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: Omit<Payment, 'id' | 'createdAt' | 'status' | 'balance'>) => void;
  students: User[];
  payment?: Payment | null;
  initialStudentId?: string | null;
}

const academicMonths = ["Inscription", "Septembre", "Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => `${currentYear - i}-${currentYear - i + 1}`);

export default function PaymentFormDialog({ isOpen, setIsOpen, onSave, students, payment, initialStudentId }: PaymentFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const { settings } = useUser();
  
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      studentId: '',
      amountExpected: 0,
      amountPaid: 0,
      month: '',
      year: settings?.academicYear || years[0],
      currency: 'XAF',
      method: 'cash',
      proofUrl: '',
    }
  });
  
  const selectedStudentId = form.watch("studentId");
  const selectedMonth = form.watch("month");
  
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'feeStructures'), (snapshot) => {
        setFeeStructures(snapshot.docs.map(doc => doc.data() as FeeStructure));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (selectedStudentId && selectedMonth) {
        const student = students.find(s => s.uid === selectedStudentId);
        if (student?.student?.level && student?.student?.cycle) {
            const feeStructure = feeStructures.find(fs => fs.level === student.student?.level && fs.cycle === student.student?.cycle);
            if (feeStructure) {
                const amount = selectedMonth === 'Inscription' ? feeStructure.registration : feeStructure.tuition / 10;
                form.setValue('amountExpected', amount);
                form.setValue('amountPaid', amount);
            }
        }
    }
  }, [selectedStudentId, selectedMonth, students, feeStructures, form]);

  useEffect(() => {
    if (isOpen) {
        if(payment) {
            form.reset({
                studentId: payment.studentId,
                amountExpected: payment.amountExpected,
                amountPaid: payment.amountPaid,
                month: payment.month,
                year: payment.year,
                currency: payment.currency,
                method: payment.method,
                proofUrl: payment.proofUrl,
            });
        } else {
            form.reset({
                studentId: initialStudentId || '',
                amountExpected: 0,
                amountPaid: 0,
                month: '',
                year: settings?.academicYear || years[0],
                currency: 'XAF',
                method: 'cash',
                proofUrl: '',
            });
        }
    }
  }, [payment, isOpen, form, initialStudentId, settings]);

  const onSubmit = async (data: PaymentFormValues) => {
    setSubmitting(true);
    await onSave(data);
    setSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[580px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                {payment ? "Modifier le paiement" : "Enregistrer un nouveau paiement"}
              </DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous pour enregistrer un paiement. Le montant attendu est pré-rempli.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-6">
                <FormField control={form.control} name="studentId" render={({ field }) => (
                    <FormItem><FormLabel>Étudiant</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!initialStudentId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un étudiant..." /></SelectTrigger></FormControl>
                        <SelectContent>{students.map(s => <SelectItem key={s.uid} value={s.uid}>{s.firstName} {s.lastName} ({s.student?.matricule})</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage /></FormItem>
                )}/>
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="month" render={({ field }) => (
                        <FormItem><FormLabel>Motif / Mois</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un motif..." /></SelectTrigger></FormControl>
                            <SelectContent>{academicMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="year" render={({ field }) => (
                        <FormItem><FormLabel>Année Académique</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une année..." /></SelectTrigger></FormControl>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="amountExpected" render={({ field }) => (
                        <FormItem><FormLabel>Montant Attendu</FormLabel><FormControl><Input type="number" placeholder="150000" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="amountPaid" render={({ field }) => (
                        <FormItem><FormLabel>Montant Payé</FormLabel><FormControl><Input type="number" placeholder="150000" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </div>
                
                 <FormField control={form.control} name="method" render={({ field }) => (
                    <FormItem><FormLabel>Méthode de paiement</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner une méthode..." /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="cash">Espèces</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                            <SelectItem value="card">Carte bancaire</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage /></FormItem>
                )}/>

                {form.watch('method') !== 'cash' && (
                    <FormField control={form.control} name="proofUrl" render={({ field }) => (
                        <FormItem><FormLabel>Preuve de paiement (URL)</FormLabel><FormControl><Input placeholder="https://lien/vers/la/preuve.jpg" {...field} value={field.value || ''}/></FormControl><FormMessage /></FormItem>
                    )}/>
                )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={submitting}>Annuler</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {payment ? "Enregistrer" : "Enregistrer le paiement"}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

