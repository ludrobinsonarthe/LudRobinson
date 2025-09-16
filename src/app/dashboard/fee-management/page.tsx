
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, onSnapshot, query } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FeeStructure, Cycle } from "@/lib/types";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const levels = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"];
const cycles: { value: Cycle; label: string }[] = [
  { value: "local", label: "Cycle Local" },
  { value: "international", label: "Cycle International" },
  { value: "entrepreneur", label: "Cycle Entrepreneur" },
];

const feeStructureSchema = z.object({
  id: z.string(),
  cycle: z.nativeEnum({
    local: "local",
    international: "international",
    entrepreneur: "entrepreneur",
  }),
  level: z.string(),
  registration: z.coerce.number().min(0, "Les frais d'inscription sont requis."),
  tuition: z.coerce.number().min(0, "Les frais de scolarité sont requis."),
  currency: z.string().default("XAF"),
});

const feeManagementFormSchema = z.object({
  feeStructures: z.array(feeStructureSchema),
});

type FeeManagementFormValues = z.infer<typeof feeManagementFormSchema>;

export default function FeeManagementPage() {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<FeeManagementFormValues>({
    resolver: zodResolver(feeManagementFormSchema),
    defaultValues: {
      feeStructures: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "feeStructures",
  });

  useEffect(() => {
    const q = query(collection(db, "fee_structures"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        form.reset({ feeStructures: [] });
      } else {
        const structures: FeeStructure[] = [];
        snapshot.forEach((doc) => {
          structures.push({ id: doc.id, ...doc.data() } as FeeStructure);
        });
        form.reset({ feeStructures: structures });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [form]);

  const onSubmit = async (data: FeeManagementFormValues) => {
    try {
      setLoading(true);
      const batch = writeBatch(db);
      data.feeStructures.forEach((structure) => {
        const docRef = doc(db, "fee_structures", structure.id);
        batch.set(docRef, structure);
      });
      await batch.commit();
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
  
  const addNewFeeStructure = () => {
    const existingIds = fields.map(f => f.id);
    const newCycle = cycles[0].value;
    const newLevel = levels[0];
    let newId = `${newCycle}-${newLevel.toLowerCase().replace(" ", "_")}`;
    let counter = 1;
    while(existingIds.includes(newId)) {
        newId = `${newCycle}-${newLevel.toLowerCase().replace(" ", "_")}_${counter}`;
        counter++;
    }

    append({
        id: newId,
        cycle: newCycle,
        level: newLevel,
        registration: 0,
        tuition: 0,
        currency: 'XAF'
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Frais</h1>
        <p className="text-muted-foreground">
          Définissez les frais de scolarité et d'inscription par niveau et par cycle.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Structure des Frais Académiques</CardTitle>
          <CardDescription>
            Ces montants seront utilisés par défaut lors de la création de nouveaux paiements pour les étudiants correspondants.
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
                <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Cycle</TableHead>
                      <TableHead className="w-[200px]">Niveau</TableHead>
                      <TableHead>Frais d'inscription</TableHead>
                      <TableHead>Frais de scolarité</TableHead>
                      <TableHead className="w-[50px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`feeStructures.${index}.cycle`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {cycles.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                           <FormField
                            control={form.control}
                            name={`feeStructures.${index}.level`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {levels.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`feeStructures.${index}.registration`}
                            render={({ field }) => ( 
                                <div className="relative">
                                    <Input type="number" {...field} className="pl-8"/> 
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">XAF</span>
                                </div>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`feeStructures.${index}.tuition`}
                            render={({ field }) => (
                                <div className="relative">
                                     <Input type="number" {...field} className="pl-8"/> 
                                     <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">XAF</span>
                                </div>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                    <Button type="button" variant="outline" onClick={addNewFeeStructure}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Ajouter une ligne
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || loading}>
                        {(form.formState.isSubmitting || loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enregistrer les frais
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
