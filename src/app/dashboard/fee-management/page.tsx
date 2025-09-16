
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FeeStructure } from "@/lib/types";
import { Loader2 } from "lucide-react";

const feeFormSchema = z.object({
  registration: z.coerce.number().min(0, "Les frais d'inscription sont requis."),
  tuition: z.coerce.number().min(0, "Les frais de scolarité sont requis."),
});

type FeeFormValues = z.infer<typeof feeFormSchema>;

export default function FeeManagementPage() {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<FeeFormValues>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: {
      registration: 0,
      tuition: 0,
    },
  });

  useEffect(() => {
    const fetchFees = async () => {
      const feeRef = doc(db, "fees", "school_fees");
      const feeSnap = await getDoc(feeRef);
      if (feeSnap.exists()) {
        const feeData = feeSnap.data() as FeeStructure;
        form.reset({
          registration: feeData.registration,
          tuition: feeData.tuition,
        });
      }
      setLoading(false);
    };
    fetchFees();
  }, [form]);

  const onSubmit = async (data: FeeFormValues) => {
    try {
      setLoading(true);
      const feeRef = doc(db, "fees", "school_fees");
      const feeData: FeeStructure = {
        id: 'school_fees',
        ...data,
        currency: 'XAF',
      };
      await setDoc(feeRef, feeData, { merge: true });
      toast({
        title: "Frais mis à jour",
        description: "La structure des frais a été enregistrée avec succès.",
      });
    } catch (error) {
      console.error("Error saving fees:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer les frais.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Frais</h1>
        <p className="text-muted-foreground">
          Définissez les montants standards pour les frais d'inscription et de scolarité.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Structure des Frais Académiques</CardTitle>
          <CardDescription>
            Ces montants seront utilisés par défaut lors de la création de nouveaux paiements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !form.formState.isDirty ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="registration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frais d'inscription (XAF)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tuition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frais de scolarité mensuels (XAF)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="150000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer les modifications
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
