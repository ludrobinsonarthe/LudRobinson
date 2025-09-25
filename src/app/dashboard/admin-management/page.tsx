

"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef, useMemo } from "react";
import { Loader2, PlusCircle, Trash2, UserCog, ShieldCheck, Upload, Users } from "lucide-react";
import { Settings, Field, Sector, User, ActivityLog } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { doc, setDoc, updateDoc, writeBatch, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserDeleteDialog from "@/components/user-delete-dialog";
import { Badge } from "@/components/ui/badge";


const settingsFormSchema = z.object({
  schoolName: z.string().min(3, "Le nom de l'école est requis."),
  logoUrl: z.string().url("L'URL du logo doit être valide.").optional().or(z.literal('')),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Le format doit être AAAA-AAAA (ex: 2024-2025)."),
  currency: z.string().length(3, "La devise doit être un code de 3 lettres (ex: XAF)."),
  levels: z.array(z.object({ value: z.string().min(1, "Le niveau est requis.") })),
});

const structureFormSchema = z.object({
    sectors: z.array(z.object({ 
        id: z.string().min(1, "L'ID est requis."),
        name: z.string().min(1, "Le nom est requis.") 
    })),
    fields: z.array(z.object({
        id: z.string(),
        name: z.string().min(3, "Le nom est requis."),
        sectorId: z.string().min(1, "Le secteur est requis.")
    }))
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;
type StructureFormValues = z.infer<typeof structureFormSchema>;

export default function AdminManagementPage() {
    const { toast } = useToast();
    const { settings, loading: loadingSettings, setSettings, fields: initialFields, sectors: initialSectors, user: adminUser } = useUser();
    const [submitting, setSubmitting] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fieldToDelete, setFieldToDelete] = useState<Field | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [students, setStudents] = useState<User[]>([]);
    
    useEffect(() => {
        const q = collection(db, 'users');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allUsers = snapshot.docs.map(doc => doc.data() as User);
            setStudents(allUsers.filter(u => u.role === 'student'));
        });
        return () => unsubscribe();
    }, []);

    const studentCountByField = useMemo(() => {
        const counts: Record<string, number> = {};
        students.forEach(student => {
            const fieldId = student.student?.fieldId;
            if (fieldId) {
                counts[fieldId] = (counts[fieldId] || 0) + 1;
            }
        });
        return counts;
    }, [students]);


    const settingsForm = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsFormSchema),
        defaultValues: {
            schoolName: "",
            logoUrl: "",
            academicYear: "",
            currency: "",
            levels: [],
        },
    });
    
    const structureForm = useForm<StructureFormValues>({
        resolver: zodResolver(structureFormSchema),
        defaultValues: {
            sectors: [],
            fields: []
        }
    });

    const { fields: levelFields, append: appendLevel, remove: removeLevel } = useFieldArray({
        control: settingsForm.control,
        name: "levels",
    });

    const { fields: sectorFields, append: appendSector, remove: removeSector, replace: replaceSectors } = useFieldArray({
        control: structureForm.control,
        name: "sectors",
    });
     const { fields: fieldFields, append: appendField, remove: removeField, replace: replaceFields } = useFieldArray({
        control: structureForm.control,
        name: "fields",
        keyName: "formId"
    });

    useEffect(() => {
        if(settings) {
            settingsForm.reset({
                schoolName: settings.schoolName || "",
                logoUrl: settings.logoUrl || "",
                academicYear: settings.academicYear || "",
                currency: settings.currency || "",
                levels: settings.levels || [],
            });
        }
        if (initialSectors) {
            replaceSectors(initialSectors);
        }
         if (initialFields) {
            replaceFields(initialFields);
        }
    }, [settings, initialSectors, initialFields, settingsForm, structureForm, replaceSectors, replaceFields]);

    
    const handleLogoUpload = async (file: File) => {
        if (!file) return;
        setUploadingLogo(true);
        try {
            const storageRef = ref(storage, `logos/logo-${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            const settingsRef = doc(db, "settings", "system");
            await updateDoc(settingsRef, { logoUrl: downloadURL });
            
            if(settings) {
                setSettings({...settings, logoUrl: downloadURL});
            }
            settingsForm.setValue("logoUrl", downloadURL, { shouldDirty: true });
            
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

    const onSettingsSubmit = async (data: SettingsFormValues) => {
        setSubmitting(true);
        try {
            const { logoUrl, ...restOfData } = data;
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

    const onStructureSubmit = async (data: StructureFormValues) => {
        setSubmitting(true);
        const batch = writeBatch(db);
        
        data.sectors.forEach(sector => {
            const sectorRef = doc(db, 'sectors', sector.id);
            batch.set(sectorRef, sector);
        })
        
        data.fields.forEach(field => {
            const fieldRef = doc(db, 'fields', field.id);
            batch.set(fieldRef, field);
        });

        try {
            await batch.commit();
            toast({ title: "Structure enregistrée", description: "Les secteurs et filières ont été mis à jour." });
        } catch (error) {
            console.error("Error saving structure: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer la structure." });
        } finally {
            setSubmitting(false);
        }
    };
    
    const addNewField = () => {
        appendField({
            id: `field_${Date.now()}`,
            name: '',
            sectorId: ''
        });
    }

    const handleDeleteField = async (index: number) => {
        const field = structureForm.getValues().fields[index];
        if (field.id.startsWith("field_")) {
            removeField(index);
        } else {
            setFieldToDelete(field as Field);
            setIsDeleteDialogOpen(true);
        }
    };
    
    const confirmDeleteField = async () => {
        if(!fieldToDelete || !adminUser) return;
        
        const batch = writeBatch(db);
        
        try {
            const fieldRef = doc(db, 'fields', fieldToDelete.id);
            batch.delete(fieldRef);

            const logRef = doc(collection(db, 'activityLogs'));
            const log: Omit<ActivityLog, 'id'> = {
                actorId: adminUser.uid,
                actorName: `${adminUser.lastName} ${adminUser.firstName}`,
                action: 'user_deleted', // Consider adding a 'field_deleted' action type
                entityType: 'field',
                entityId: fieldToDelete.id,
                timestamp: new Date().toISOString(),
                details: `A supprimé la filière: "${fieldToDelete.name}"`,
            };
            batch.set(logRef, log);

            await batch.commit();
            
            const fieldIndex = fieldFields.findIndex(f => f.id === fieldToDelete.id);
            if (fieldIndex > -1) {
                removeField(fieldIndex);
            }
            toast({ title: 'Filière supprimée' });
        } catch (error) {
            console.error('Error deleting field:', error);
            toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de supprimer la filière.' });
        } finally {
            setIsDeleteDialogOpen(false);
            setFieldToDelete(null);
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
                <Form {...settingsForm}>
                    <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Paramètres Généraux</CardTitle>
                                <CardDescription>
                                    Configuration de l'année académique, du nom de l'établissement et d'autres paramètres essentiels.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <FormField control={settingsForm.control} name="schoolName" render={({ field }) => (
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
                                                src={settingsForm.watch('logoUrl') || `https://placehold.co/64x64/eee/ccc?text=${(settings?.schoolName || 'I').charAt(0)}`}
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
                                    <FormField control={settingsForm.control} name="academicYear" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Année Académique</FormLabel>
                                            <FormControl><Input placeholder="2024-2025" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={settingsForm.control} name="currency" render={({ field }) => (
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
                                            control={settingsForm.control}
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

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={submitting || uploadingLogo}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enregistrer les paramètres
                            </Button>
                        </div>
                    </form>
                </Form>
                
                 <Form {...structureForm}>
                    <form onSubmit={structureForm.handleSubmit(onStructureSubmit)} className="space-y-8">
                         <Card>
                            <CardHeader>
                                <CardTitle>Secteurs et Filières</CardTitle>
                                <CardDescription>Gérez les grands secteurs et les filières de formation associées.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h4 className="font-medium mb-2 text-sm">Secteurs d'Activité</h4>
                                     {sectorFields.map((field, index) => (
                                        <div key={field.id} className="flex items-center gap-2 mb-2">
                                            <FormField
                                                control={structureForm.control}
                                                name={`sectors.${index}.id`}
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <FormControl><Input {...field} placeholder="ID (ex: technologie)" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={structureForm.control}
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
                                </div>
                                <Separator />
                                <div>
                                    <h4 className="font-medium mb-2 text-sm">Filières de Formation</h4>
                                     {fieldFields.map((field, index) => (
                                        <div key={field.formId} className="flex items-center gap-2 mb-2">
                                            <FormField
                                                control={structureForm.control}
                                                name={`fields.${index}.name`}
                                                render={({ field: formField }) => (
                                                    <FormItem className="flex-1">
                                                        <FormControl>
                                                            <div className="flex items-center gap-2">
                                                                <Input {...formField} placeholder="Nom de la filière (ex: Génie Logiciel)" />
                                                                <Badge variant="secondary" className="whitespace-nowrap">
                                                                    <Users className="w-3 h-3 mr-1.5" />
                                                                    {studentCountByField[field.id] || 0}
                                                                </Badge>
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={structureForm.control}
                                                name={`fields.${index}.sectorId`}
                                                render={({ field }) => (
                                                    <FormItem className="w-[200px]">
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue placeholder="Secteur..."/></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {structureForm.watch('sectors').map(sector => (
                                                                    <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                             <FormField
                                                control={structureForm.control}
                                                name={`fields.${index}.id`}
                                                render={({ field }) => (
                                                    <Input type="hidden" {...field} />
                                                )}
                                            />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteField(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addNewField}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une filière
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                         <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enregistrer la Structure
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
                
                 <UserDeleteDialog
                    isOpen={isDeleteDialogOpen}
                    setIsOpen={setIsDeleteDialogOpen}
                    onConfirm={confirmDeleteField}
                    item={fieldToDelete}
                    title="Supprimer cette filière ?"
                    description="La suppression est définitive. Assurez-vous qu'aucun étudiant ou cours n'est lié à cette filière avant de la supprimer."
                 />
            </div>
        </div>
    );
}
