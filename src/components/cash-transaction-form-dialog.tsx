
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
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CashTransaction } from "@/lib/types";
import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.enum(['equipment', 'utilities', 'other']),
  description: z.string().min(5, "La description est requise."),
  amount: z.coerce.number().min(1, "Le montant est requis."),
  currency: z.string().default('XAF'),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface CashTransactionFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAdd: (newTransaction: CashTransaction) => void;
}

const categories = [
    { value: 'equipment', label: "Achat de matériel"},
    { value: 'utilities', label: "Factures & Services"},
    { value: 'other', label: "Autre"},
]

export default function CashTransactionFormDialog({ isOpen, setIsOpen, onAdd }: CashTransactionFormDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
        type: 'expense',
        category: 'other',
        description: '',
        amount: 0,
        currency: 'XAF',
    }
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
            type: 'expense',
            category: 'other',
            description: '',
            amount: 0,
            currency: 'XAF',
        });
    }
  }, [isOpen, form]);

  const onSubmit = (data: TransactionFormValues) => {
    if(!user) {
        toast({ variant: "destructive", title: "Erreur", description: "Vous devez être connecté pour effectuer cette action." });
        return;
    }
    
    const newTransaction: CashTransaction = {
        id: `cash_${Date.now()}`,
        date: new Date().toISOString(),
        createdBy: user.uid,
        ...data
    }
    onAdd(newTransaction);
    toast({ title: "Transaction enregistrée (Simulation)", description: "L'opération a été ajoutée localement à la caisse." });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                Ajouter une transaction manuelle
              </DialogTitle>
              <DialogDescription>
                Enregistrez une entrée ou une sortie de caisse pour les dépenses diverses.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="type" render={({ field }) => (
                        <FormItem><FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="expense">Dépense</SelectItem>
                                <SelectItem value="income">Revenu</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem><FormLabel>Catégorie</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )}/>
                </div>
                 <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" placeholder="50000" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Description de la transaction..." {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
