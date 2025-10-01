

"use client";

import { useForm, useFieldArray } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course, User, Sector, Field, Cycle, ActivityLog } from "@/lib/types";
import { useEffect, useMemo, useState, useRef } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Separator } from "./ui/separator";
import { Loader2, PlusCircle, Trash2, File, Upload } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { doc, collection, writeBatch, setDoc, updateDoc } from 'firebase/firestore';


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

interface CourseFormDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  course: Course | null;
  teachers: User[];
  sectors: Sector[];
  fields: Field[];
}

const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];


export default function CourseFormDialog({ isOpen, setIsOpen, course: initialCourse, teachers, sectors, fields }: CourseFormDialogProps) {
  const { settings, user: adminUser } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const [currentCourse, setCurrentCourse] = useState<Course | null>(initialCourse);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
        name: '', description: '', teacherId: '', level: '',
        cycle: 'local', sectorId: '', fieldId: 'common_core',
        credit: 0, schedule: []
    }
  });

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
    setCurrentCourse(initialCourse);
    if (isOpen) {
        const courseToEdit = initialCourse || currentCourse;
        const courseSectorId = courseToEdit?.sectorId || fields.find(f => f.id === courseToEdit?.fieldId)?.sectorId || '';
        if (courseToEdit) {
          form.reset({
            name: courseToEdit.name,
            description: courseToEdit.description || '',
            teacherId: courseToEdit.teacherId,
            level: courseToEdit.level,
            cycle: courseToEdit.cycle,
            sectorId: courseSectorId,
            fieldId: courseToEdit.fieldId ? courseToEdit.fieldId : 'common_core',
            credit: courseToEdit.credit,
            schedule: courseToEdit.schedule || [],
          });
        } else {
          form.reset({
            name: '', description: '', teacherId: '', level: '',
            cycle: 'local', sectorId: '', fieldId: 'common_core',
            credit: 0, schedule: [],
          });
        }
    }
  }, [initialCourse, isOpen, form, fields]);
  
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
    try {
        const courseId = currentCourse?.id || doc(collection(db, 'courses')).id;
        
        const finalCourseData: Omit<Course, 'id'> = {
            name: data.name,
            description: data.description || "",
            teacherId: data.teacherId,
            level: data.level,
            cycle: data.cycle,
            credit: data.credit,
            schedule: data.schedule || [],
            documents: currentCourse?.documents || [],
            fieldId: (data.fieldId === 'common_core' || !data.fieldId) ? undefined : data.fieldId,
            sectorId: (data.fieldId === 'common_core' || !data.fieldId) ? data.sectorId : undefined,
        };

        const batch = writeBatch(db);
        const courseRef = doc(db, "courses", courseId);
        batch.set(courseRef, finalCourseData, { merge: true });

        const logRef = doc(collection(db, 'activityLogs'));
        const log: Omit<ActivityLog, 'id'> = {
            actorId: adminUser.uid,
            actorName: `${adminUser.lastName} ${adminUser.firstName}`,
            action: currentCourse ? 'course_updated' : 'course_created',
            entityType: 'course',
            entityId: courseId,
            timestamp: new Date().toISOString(),
            details: `${currentCourse ? 'A mis à jour le cours' : 'A créé le cours'}: "${finalCourseData.name}"`,
        };
        batch.set(logRef, log);
        
        await batch.commit();

        setCurrentCourse({ id: courseId, ...finalCourseData });
        toast({ title: currentCourse ? "Cours mis à jour" : "Cours créé", description: "Les informations du cours ont été enregistrées. Vous pouvez maintenant ajouter des documents."});
        
    } catch (error) {
        console.error("Error saving course data:", error);
        toast({ variant: "destructive", title: "Erreur de sauvegarde", description: "Impossible d'enregistrer les données du cours." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !currentCourse || !adminUser) {
        if (!currentCourse) toast({variant: "destructive", description: "Veuillez d'abord enregistrer les informations du cours."})
        return;
      };

      setIsUploading(true);
      try {
        const courseId = currentCourse.id;
        const filePath = `courses/${courseId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        const fileRef = ref(storage, filePath);
        
        await uploadBytes(fileRef, file);
        const newDocumentUrl = await getDownloadURL(fileRef);

        const updatedDocuments = [...(currentCourse.documents || []), newDocumentUrl];
        await updateDoc(doc(db, "courses", courseId), {
            documents: updatedDocuments
        });

        setCurrentCourse(prev => prev ? ({...prev, documents: updatedDocuments}) : null);
        
        toast({ title: "Téléversement réussi", description: "Le document a été ajouté au cours." });
      } catch (error) {
          console.error("Error uploading file:", error);
          toast({ variant: "destructive", title: "Erreur de téléversement", description: "Vérifiez vos permissions Firebase Storage." });
      } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
      }
  };

  const removeDocument = async (docUrl: string, index: number) => {
      if (!currentCourse) return;
      try {
        const fileRef = ref(storage, docUrl);
        await deleteObject(fileRef);
        
        const updatedDocs = (currentCourse.documents || []).filter((_, i) => i !== index);
        await updateDoc(doc(db, "courses", currentCourse.id), { documents: updatedDocs });
        setCurrentCourse(prev => prev ? ({...prev, documents: updatedDocs}) : null);

        toast({ title: "Document supprimé", description: "Le document a été retiré du cours." });
      } catch (error: any) {
         if (error.code === 'storage/object-not-found') {
            const updatedDocs = (currentCourse.documents || []).filter((_, i) => i !== index);
            await updateDoc(doc(db, "courses", currentCourse.id), { documents: updatedDocs });
            setCurrentCourse(prev => prev ? ({...prev, documents: updatedDocs}) : null);
            toast({ variant: 'default', title: 'Lien de document invalide retiré' });
         } else {
            console.error("Error deleting document from storage:", error);
            toast({ variant: "destructive", title: "Erreur de suppression", description: "Impossible de supprimer le document." });
         }
      }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-headline">
                {initialCourse ? "Modifier le cours et son emploi du temps" : "Ajouter un nouveau cours"}
              </DialogTitle>
              <DialogDescription>
                Remplissez le formulaire pour {initialCourse ? "modifier le cours." : "créer un nouveau cours. Enregistrez pour pouvoir ajouter des documents."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-6">
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
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {initialCourse ? "Enregistrer les modifications" : "Créer le cours"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        
        {currentCourse && (
            <>
                <Separator className="my-4" />
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Documents du cours (PDF)</h3>
                    {(currentCourse.documents || []).length > 0 ? (
                        (currentCourse.documents || []).map((docUrl, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted">
                                <File className="h-4 w-4 text-muted-foreground"/>
                                <span className="flex-1 truncate">
                                    <Link href={docUrl} target="_blank" className="underline hover:text-primary/80">
                                        {decodeURIComponent(docUrl.split('/').pop()?.split('?')[0].replace(/%20/g, ' ') || `Document ${index+1}`)}
                                    </Link>
                                </span>
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDocument(docUrl, index)}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">Aucun document pour ce cours.</p>
                    )}

                    <div className="flex items-center gap-2">
                        <Input 
                            type="file" 
                            accept=".pdf"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                        />
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            ) : (
                                <Upload className="mr-2 h-4 w-4"/>
                            )}
                            Ajouter un document
                        </Button>
                    </div>
                </div>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}
