
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course, User, Sector, Field, Cycle, ActivityLog } from "@/lib/types";
import { useEffect, useMemo, useState, useRef, Suspense, useTransition } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Loader2, PlusCircle, Trash2, File, Upload, ArrowLeft } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { doc, collection, writeBatch, setDoc, updateDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useParams, useRouter, revalidatePath } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";


const scheduleSchema = z.object({
    day: z.enum(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']),
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM invalide."),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM invalide."),
    room: z.string().min(1, "La salle est requise."),
});

const courseFormSchema = z.object({
  name: z.string().min(3, "Le nom du cours doit comporter au moins 3 caractères."),
  description: z.string().optional(),
  teacherId: z.string().min(1, "Veuillez sélectionner un professeur."),
  level: z.string().min(1, "Le niveau est requis."),
  cycle: z.enum(['local', 'international', 'entrepreneur']),
  sectorId: z.string().optional(),
  fieldId: z.string().optional(),
  credit: z.coerce.number().min(0, "Le crédit est requis."),
  schedule: z.array(scheduleSchema).optional(),
}).refine(data => data.sectorId || data.fieldId, {
    message: "Vous devez sélectionner un secteur ou une filière.",
    path: ["fieldId"],
});

type CourseFormValues = z.infer<typeof courseFormSchema>;


const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

function CourseForm() {
  const { settings, user: adminUser, allUsers, fields, sectors } = useUser();
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const isNewCourse = courseId === 'new';

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(!isNewCourse);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const teachers = useMemo(() => allUsers.filter(u => u.role === 'teacher'), [allUsers]);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
        name: '', description: '', teacherId: '', level: '',
        cycle: 'local', sectorId: '', fieldId: 'common_core',
        credit: 0, schedule: []
    }
  });
  
  useEffect(() => {
    if (isNewCourse) {
        setLoading(false);
        return;
    }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'courses', courseId), (doc) => {
        if(doc.exists()) {
            const courseData = { id: doc.id, ...doc.data() } as Course;
            setCourse(courseData);
            const courseSectorId = courseData.sectorId || fields.find(f => f.id === courseData.fieldId)?.sectorId || '';
            form.reset({
                name: courseData.name,
                description: courseData.description || '',
                teacherId: courseData.teacherId,
                level: courseData.level,
                cycle: courseData.cycle,
                sectorId: courseSectorId,
                fieldId: courseData.fieldId ? courseData.fieldId : 'common_core',
                credit: courseData.credit,
                schedule: courseData.schedule || [],
            });
        }
        setLoading(false);
    });
    return () => unsub();
  }, [courseId, isNewCourse, form, fields]);


  const { fields: scheduleFields, append, remove } = useFieldArray({
      control: form.control,
      name: "schedule"
  });

  const selectedSector = form.watch('sectorId');

  const availableFields = useMemo(() => {
      if (!selectedSector) return [];
      return fields.filter(f => f.sectorId === selectedSector);
  }, [selectedSector, fields]);

   useEffect(() => {
    if(!form.getValues('fieldId')) return;
    const currentFieldId = form.getValues('fieldId');
    if (currentFieldId === 'common_core') return;

    const currentField = fields.find(f => f.id === currentFieldId);
    if(currentField && currentField.sectorId !== selectedSector) {
        form.setValue('fieldId', 'common_core');
    }
   }, [selectedSector, form, fields]);

  const onSubmit = async (data: CourseFormValues) => {
    if (!adminUser) return;
    setIsSubmitting(true);
    
    const finalCourseId = isNewCourse ? doc(collection(db, 'courses')).id : courseId;
    
    try {
        const finalCourseData: Omit<Course, 'id' | 'documents'> = {
            name: data.name,
            description: data.description || "",
            teacherId: data.teacherId,
            level: data.level,
            cycle: data.cycle,
            credit: data.credit,
            schedule: data.schedule || [],
            fieldId: (data.fieldId === 'common_core' || !data.fieldId) ? "" : data.fieldId,
            sectorId: (data.fieldId === 'common_core' || !data.fieldId) ? data.sectorId : "",
        };

        const batch = writeBatch(db);
        const courseRef = doc(db, "courses", finalCourseId);
        
        batch.set(courseRef, {...finalCourseData, documents: course?.documents || []}, { merge: true });

        const logRef = doc(collection(db, 'activityLogs'));
        const log: Omit<ActivityLog, 'id'> = {
            actorId: adminUser.uid,
            actorName: `${adminUser.lastName} ${adminUser.firstName}`,
            action: isNewCourse ? 'course_created' : 'course_updated',
            entityType: 'course',
            entityId: finalCourseId,
            timestamp: new Date().toISOString(),
            details: `${isNewCourse ? 'A créé le cours' : 'A mis à jour le cours'}: "${finalCourseData.name}"`,
        };
        batch.set(logRef, log);
        
        await batch.commit();

        toast({ title: isNewCourse ? "Cours créé avec succès" : "Cours mis à jour", description: isNewCourse ? "Vous pouvez maintenant ajouter des documents." : ""});
        if(isNewCourse) {
            router.push(`/dashboard/course-management/${finalCourseId}`);
        }
        
    } catch (error) {
        console.error("Error saving course data:", error);
        toast({ variant: "destructive", title: "Erreur de sauvegarde", description: "Impossible d'enregistrer les données du cours." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const removeDocument = async (docUrl: string) => {
      if (!course) return;
      try {
        const fileRef = ref(storage, docUrl);
        await deleteObject(fileRef);
        
        const updatedDocs = (course.documents || []).filter(url => url !== docUrl);
        await updateDoc(doc(db, "courses", course.id), { documents: updatedDocs });

        toast({ title: "Document supprimé" });
      } catch (error: any) {
         if (error.code === 'storage/object-not-found') {
            const updatedDocs = (course.documents || []).filter(url => url !== docUrl);
            await updateDoc(doc(db, "courses", course.id), { documents: updatedDocs });
            toast({ variant: 'default', title: 'Lien de document invalide retiré' });
         } else {
            console.error("Error deleting document from storage:", error);
            toast({ variant: "destructive", title: "Erreur de suppression", description: "Impossible de supprimer le document." });
         }
      }
  }
  
  if (loading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-10 w-1/2" />
              <Card><CardContent className="p-6"><Skeleton className="h-64 w-full"/></CardContent></Card>
          </div>
      )
  }

  return (
      <div className="space-y-6">
           <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/course-management">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">{isNewCourse ? "Nouveau Cours" : "Modifier le Cours"}</h1>
                    <p className="text-muted-foreground">{isNewCourse ? "Créez un cours et définissez son emploi du temps." : `Modification de "${course?.name}"`}</p>
                </div>
            </div>
            <Card>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardContent className="p-6 space-y-6">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Nom du cours</FormLabel><FormControl><Input placeholder="Ex: Mathématiques Avancées" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Brève description du cours..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="teacherId" render={({ field }) => (
                                <FormItem><FormLabel>Professeur</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un professeur..." /></SelectTrigger></FormControl>
                                    <SelectContent>{teachers.map(teacher => (<SelectItem key={teacher.uid} value={teacher.uid}>{teacher.lastName} {teacher.firstName}</SelectItem>))}</SelectContent>
                                </Select>
                                <FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="level" render={({ field }) => (
                                    <FormItem><FormLabel>Niveau</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Niveau..." /></SelectTrigger></FormControl>
                                        <SelectContent>{(settings?.levels || []).map(l => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="cycle" render={({ field }) => (
                                    <FormItem><FormLabel>Cycle</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Cycle..." /></SelectTrigger></FormControl>
                                        <SelectContent>{cycles.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage /></FormItem>
                                )}/>
                            </div>
                            <FormField control={form.control} name="credit" render={({ field }) => (
                                <FormItem><FormLabel>Crédit de la matière</FormLabel><FormControl><Input type="number" placeholder="Ex: 5" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="sectorId" render={({ field }) => (
                                    <FormItem><FormLabel>Secteur</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Secteur..." /></SelectTrigger></FormControl>
                                        <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="fieldId" render={({ field }) => (
                                    <FormItem><FormLabel>Filière (ou Tronc Commun)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedSector}>
                                        <FormControl><SelectTrigger><SelectValue placeholder={!selectedSector ? "Sélectionnez d'abord un secteur" : "Filière..."} /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="common_core">Tronc Commun (Toutes les filières du secteur)</SelectItem>
                                            {availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )}/>
                            </div>
                            <Separator />
                            <div>
                                <h3 className="text-lg font-medium mb-2">Emploi du temps</h3>
                                <div className="space-y-4">
                                    {scheduleFields.map((field, index) => (
                                        <div key={field.id} className="grid grid-cols-5 gap-2 items-end p-3 border rounded-md relative">
                                            <FormField control={form.control} name={`schedule.${index}.day`} render={({ field }) => (
                                                <FormItem><FormLabel>Jour</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                                        <SelectContent>{daysOfWeek.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                                    </Select><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`schedule.${index}.start`} render={({ field }) => (
                                                <FormItem><FormLabel>Début</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`schedule.${index}.end`} render={({ field }) => (
                                                <FormItem><FormLabel>Fin</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                            <FormField control={form.control} name={`schedule.${index}.room`} render={({ field }) => (
                                                <FormItem><FormLabel>Salle</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                            )}/>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ day: 'Lundi', start: '08:00', end: '10:00', room: '' })}><PlusCircle className="mr-2 h-4 w-4" />Ajouter un créneau</Button>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    {isNewCourse ? "Créer le cours" : "Enregistrer les modifications"}
                                </Button>
                            </div>
                        </CardContent>
                    </form>
                </Form>

                {!isNewCourse && course && (
                    <>
                        <Separator />
                        <CardHeader>
                            <CardTitle>Documents du cours</CardTitle>
                            <CardDescription>Ajoutez des fichiers PDF (supports de cours, exercices, etc.)</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-4">
                                {(course.documents || []).length > 0 ? (
                                    (course.documents || []).map((docUrl) => (
                                        <div key={docUrl} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted">
                                            <File className="h-4 w-4 text-muted-foreground"/>
                                            <span className="flex-1 truncate">
                                                <Link href={docUrl} target="_blank" className="underline hover:text-primary/80">
                                                    {decodeURIComponent(docUrl.split('/').pop()?.split('?')[0].replace(/%20/g, ' ') || `Document`)}
                                                </Link>
                                            </span>
                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDocument(docUrl)}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">Aucun document pour ce cours.</p>
                                )}
                                
                                <form action={async (formData: FormData) => {
                                    startTransition(async () => {
                                        const file = formData.get('document') as File;
                                        if (!file || file.size === 0) {
                                            toast({ variant: "destructive", title: "Aucun fichier sélectionné" });
                                            return;
                                        }

                                        const result = await uploadCourseDocument(courseId, formData);

                                        if (result.success) {
                                            toast({ title: "Téléversement réussi", description: "Le document a été ajouté au cours." });
                                            if(fileInputRef.current) fileInputRef.current.value = "";
                                        } else {
                                            toast({ variant: "destructive", title: "Erreur de téléversement", description: result.error });
                                        }
                                    });
                                }}>
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            type="file" 
                                            name="document"
                                            accept=".pdf"
                                            ref={fileInputRef}
                                            disabled={isPending}
                                        />
                                        <Button type="submit" variant="outline" disabled={isPending}>
                                            {isPending ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                            ) : (
                                                <Upload className="mr-2 h-4 w-4"/>
                                            )}
                                            Ajouter
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </CardContent>
                    </>
                )}
            </Card>
      </div>
  );
}

async function uploadCourseDocument(courseId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    'use server';

    const file = formData.get('document') as File;

    if (!file) {
        return { success: false, error: 'Aucun fichier trouvé.' };
    }
     if (file.size === 0) {
        return { success: false, error: 'Le fichier est vide.' };
    }

    try {
        const filePath = `courses/${courseId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        const fileRef = ref(storage, filePath);
        
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        await uploadBytes(fileRef, fileBuffer, { contentType: file.type });
        const newDocumentUrl = await getDownloadURL(fileRef);

        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);
        if(!courseSnap.exists()) {
            return { success: false, error: 'Cours introuvable.' };
        }
        
        const courseData = courseSnap.data();
        const updatedDocuments = [...(courseData.documents || []), newDocumentUrl];
        await updateDoc(courseRef, { documents: updatedDocuments });
        
        revalidatePath(`/dashboard/course-management/${courseId}`);
        return { success: true };

    } catch (error) {
        console.error("Server Action - Error uploading file:", error);
        return { success: false, error: "Une erreur est survenue sur le serveur." };
    }
}


export default function CourseManagementEditPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <CourseForm />
        </Suspense>
    )
}
