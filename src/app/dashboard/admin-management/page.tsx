
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Loader2, PlusCircle, Trash2, UserCog, ShieldCheck, Upload } from "lucide-react";
import { Settings } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { doc, setDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Image from "next/image";

const settingsFormSchema = z.object({
  schoolName: z.string().min(3, "Le nom de l'école est requis."),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Le format doit être AAAA-AAAA (ex: 2024-2025)."),
  currency: z.string().length(3, "La devise doit être un code de 3 lettres (ex: XAF)."),
  levels: z.array(z.object({ value: z.string().min(1, "Le niveau est requis.") })),
  sectors: z.array(z.object({ 
    id: z.string().min(1, "L'ID est requis."),
    name: z.string().min(1, "Le nom est requis.") 
  })),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function AdminManagementPage() {
    const { toast } = useToast();
    const { settings, loading: loadingSettings, setSettings } = useUser();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: {
            schoolName: "",
            academicYear: "",
            currency: "",
            levels: [],
            sectors: [],
        },
    });

    const { fields: levelFields, append: appendLevel, remove: removeLevel } = useFieldArray({
        control: form.control,
        name: "levels",
    });
     const { fields: sectorFields, append: appendSector, remove: removeSector } = useFieldArray({
        control: form.control,
        name: "sectors",
    });

    useEffect(() => {
        if(settings) {
            form.reset({
                ...settings,
            });
        }
    }, [settings, form]);
    
    const onSubmit = async (data: SettingsFormValues) => {
        setSubmitting(true);
        try {
            const settingsToSave: Settings = {
                id: 'system',
                ...settings,
                ...data,
            };

            await setDoc(doc(db, "settings", "system"), settingsToSave);
            
            // Update context
            setSettings(settingsToSave);

            toast({
                title: "Paramètres enregistrés",
                description: "Les paramètres globaux ont été mis à jour.",
            });
        } catch (error) {
            console.error("Error saving settings:", error);
             toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible d'enregistrer les paramètres.",
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingSettings) {
        return (
            <div className="flex items-center justify-center h-96">
               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    if (!settings && !loadingSettings) {
         return (
            <div className="flex flex-col items-center justify-center h-96 text-center">
               <p className="text-lg font-semibold text-muted-foreground">Impossible de charger les paramètres.</p>
               <p className="text-sm text-muted-foreground">Veuillez vérifier les règles de sécurité de votre base de données Firestore.</p>
            </div>
        );
    }


    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion Administrative</h1>
                <p className="text-muted-foreground">
                    Gérez les paramètres globaux et les accès de la plateforme de l'institut.
                </p>
            </div>
            
            <div className="space-y-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Paramètres Généraux</CardTitle>
                                <CardDescription>
                                    Configuration de l'année académique, du nom de l'établissement et d'autres paramètres essentiels.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-md" />
                                    <FormField control={form.control} name="schoolName" render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Nom de l'établissement</FormLabel>
                                            <FormControl><Input placeholder="Institut Supérieur de Gestion et d'Ingénierie" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                </div>
                                
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
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Niveaux Académiques</CardTitle>
                                <CardDescription>Gérez les niveaux d'études disponibles dans l'établissement.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {levelFields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <FormField
                                            control={form.control}
                                            name={`levels.${index}.value`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl><Input {...field} placeholder="Ex: Licence 1" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLevel(index)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendLevel({ value: '' })}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un niveau
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                             <CardHeader>
                                <CardTitle>Secteurs d'Activité</CardTitle>
                                <CardDescription>Gérez les grands secteurs de formation de votre institut.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {sectorFields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <FormField
                                            control={form.control}
                                            name={`sectors.${index}.id`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                     <FormControl><Input {...field} placeholder="ID (ex: technologie)" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`sectors.${index}.name`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl><Input {...field} placeholder="Nom (ex: TECHNOLOGIE)" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSector(index)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => appendSector({ id: '', name: '' })}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un secteur
                                </Button>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enregistrer les paramètres
                            </Button>
                        </div>
                    </form>
                </Form>
                
                <Separator className="my-8" />
                
                <div className="grid md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personnel Administratif</CardTitle>
                            <CardDescription>
                                Gérez les comptes et les permissions du personnel administratif de l'institut.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                        <Button asChild>
                            <Link href="/dashboard/users">
                                <UserCog className="mr-2 h-4 w-4" />
                                Gérer le personnel
                            </Link>
                        </Button>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Rôles & Permissions</CardTitle>
                            <CardDescription>
                                Définissez des rôles (ex: Comptable) et leurs permissions spécifiques dans l'application.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                        <Button asChild>
                            <Link href="/dashboard/roles">
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Gérer les rôles
                            </Link>
                        </Button>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}

    