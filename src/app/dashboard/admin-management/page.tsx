
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef } from "react";
import { Loader2, PlusCircle, Trash2, UserCog, ShieldCheck, Upload } from "lucide-react";
import { Settings } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const settingsFormSchema = z.object({
  schoolName: z.string().min(3, "Le nom de l'école est requis."),
  logoUrl: z.string().url("L'URL du logo doit être valide.").optional().or(z.literal('')),
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
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: {
            schoolName: "",
            logoUrl: "",
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
                schoolName: settings.schoolName || "",
                logoUrl: settings.logoUrl || "",
                academicYear: settings.academicYear || "",
                currency: settings.currency || "",
                levels: settings.levels || [],
                sectors: settings.sectors || [],
            });
        }
    }, [settings, form]);
    
    const handleLogoUpload = async (file: File) => {
        if (!file) return;
        setUploadingLogo(true);
        try {
            const storageRef = ref(storage, `logos/logo-${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            const settingsRef = doc(db, "settings", "system");
            await updateDoc(settingsRef, { logoUrl: downloadURL });
            
            // Update local state in the hook for immediate feedback
            if(settings) {
                setSettings({...settings, logoUrl: downloadURL});
            }
            form.setValue("logoUrl", downloadURL, { shouldDirty: true });
            
            toast({ title: "Logo mis à jour", description: "Le nouveau logo a été enregistré et mis à jour sur la plateforme." });
        } catch (error) {
            console.error("Error uploading logo: ", error);
            toast({ variant: "destructive", title: "Erreur de téléversement", description: "Impossible de mettre à jour le logo. Vérifiez les règles de sécurité de Firebase Storage." });
        } finally {
            setUploadingLogo(false);
        }
    };
    
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleLogoUpload(file);
        }
         if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const onSubmit = async (data: SettingsFormValues) => {
        setSubmitting(true);
        try {
            const { logoUrl, ...restOfData } = data; // logoUrl is handled separately
            await setDoc(doc(db, "settings", "system"), restOfData, { merge: true });
            if(settings) {
                 setSettings({...settings, ...restOfData});
            }
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <FormField control={form.control} name="schoolName" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nom de l'établissement</FormLabel>
                                            <FormControl><Input placeholder="Institut Supérieur de Gestion et d'Ingénierie" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <div className="space-y-2">
                                        <FormLabel>Logo de l'établissement</FormLabel>
                                        <div className="flex items-center gap-4">
                                            <Image 
                                                src={form.watch('logoUrl') || `https://placehold.co/64x64/eee/ccc?text=${(settings?.schoolName || 'I').charAt(0)}`}
                                                alt="Logo"
                                                width={64}
                                                height={64}
                                                className="rounded-md object-contain border p-1"
                                            />
                                            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                                                {uploadingLogo ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Upload className="mr-2 h-4 w-4" />
                                                )}
                                                Téléverser le logo
                                            </Button>
                                            <Input
                                                type="file"
                                                className="hidden"
                                                ref={fileInputRef}
                                                onChange={onFileChange}
                                                accept="image/png, image/jpeg, image/svg+xml"
                                                disabled={uploadingLogo}
                                            />
                                        </div>
                                         <p className="text-xs text-muted-foreground">Téléversez le logo de votre école. Recommandé: .png transparent.</p>
                                    </div>
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
                            <Button type="submit" disabled={submitting || uploadingLogo}>
                                {(submitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                            <CardTitle>Rôles &amp; Permissions</CardTitle>
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
    