
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Settings } from "@/lib/types";

const settingsFormSchema = z.object({
  schoolName: z.string().min(3, "Le nom de l'école est requis."),
  logoUrl: z.string().url("L'URL du logo doit être valide.").or(z.literal("")),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Le format doit être AAAA-AAAA (ex: 2024-2025)."),
  currency: z.string().length(3, "La devise doit être un code de 3 lettres (ex: XAF)."),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function AdminManagementPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: {
            schoolName: "",
            logoUrl: "",
            academicYear: "",
            currency: "XAF",
        },
    });

    useEffect(() => {
        const settingsRef = doc(db, "settings", "system");
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                form.reset(docSnap.data() as Settings);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [form]);

    const onSubmit = async (data: SettingsFormValues) => {
        try {
            setLoading(true);
            const settingsRef = doc(db, "settings", "system");
            await setDoc(settingsRef, { id: 'system', ...data }, { merge: true });
            toast({
                title: "Paramètres enregistrés",
                description: "Les informations de l'établissement ont été mises à jour.",
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible d'enregistrer les paramètres.",
            });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion Administrative</h1>
                <p className="text-muted-foreground">
                    Gérez les paramètres globaux de la plateforme de l'institut.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Paramètres Généraux</CardTitle>
                    <CardDescription>
                        Configuration de l'année académique, du nom de l'établissement et d'autres paramètres essentiels.
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
                                <FormField control={form.control} name="schoolName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom de l'établissement</FormLabel>
                                        <FormControl><Input placeholder="Institut Supérieur de Gestion et d'Ingénierie" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                 <FormField control={form.control} name="logoUrl" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>URL du logo</FormLabel>
                                        <FormControl><Input placeholder="https://example.com/logo.png" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <div className="grid grid-cols-2 gap-8">
                                    <FormField control={form.control} name="academicYear" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Année Académique</FormLabel>
                                            <FormControl><Input placeholder="2024-2025" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="currency" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Devise par défaut</FormLabel>
                                            <FormControl><Input placeholder="XAF" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={loading}>
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enregistrer les paramètres
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
