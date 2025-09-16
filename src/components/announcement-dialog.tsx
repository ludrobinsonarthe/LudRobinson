
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Message, AdminRole } from "@/lib/types";
import { useEffect, useState } from "react";
import { useUser } from "@/hooks/use-user";
import { collection, doc, setDoc, updateDoc, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";


const announcementSchema = z.object({
  receiverId: z.string().min(1, "Veuillez sélectionner un destinataire."),
  title: z.string().min(5, "Le titre doit comporter au moins 5 caractères.").optional().or(z.literal('')),
  content: z.string().min(10, "Le contenu doit comporter au moins 10 caractères."),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

interface AnnouncementDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  announcement: Message | null;
}

export default function AnnouncementDialog({ isOpen, setIsOpen, announcement }: AnnouncementDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [roles, setRoles] = useState<AdminRole[]>([]);

  const form = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
  });
  
  useEffect(() => {
    const q = query(collection(db, "admin_roles"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const rolesFromDb: AdminRole[] = [];
        snapshot.forEach((doc) => {
            rolesFromDb.push({ id: doc.id, ...doc.data() } as AdminRole);
        });
        setRoles(rolesFromDb);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen) {
        if (announcement) {
            form.reset({
                receiverId: announcement.receiverId,
                title: announcement.title,
                content: announcement.content,
            });
        } else {
            form.reset({
                receiverId: "all",
                title: "",
                content: "",
            });
        }
    }
  }, [announcement, form, isOpen]);

  if (user?.role !== 'admin') {
      return null;
  }

  const onSubmit = async (data: AnnouncementFormValues) => {
    if (!user) {
        toast({ variant: "destructive", title: "Erreur", description: "Utilisateur non authentifié."});
        return;
    }
    setSubmitting(true);
    try {
        const announcementData = {
            ...data,
            senderId: user.uid,
            type: 'announcement',
            createdAt: new Date().toISOString(),
        };

        if (announcement) {
            const docRef = doc(db, "announcements", announcement.id);
            await updateDoc(docRef, announcementData);
            toast({ title: "Annonce modifiée", description: "L'annonce a été mise à jour avec succès." });
        } else {
            const newDocRef = doc(collection(db, "announcements"));
            await setDoc(newDocRef, announcementData);
            toast({ title: "Annonce publiée", description: "La nouvelle annonce est maintenant visible." });
        }
        setIsOpen(false);
    } catch(error) {
        console.error("Error saving announcement: ", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder l'annonce."});
    } finally {
        setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
                <DialogTitle className="font-headline">
                {announcement ? "Modifier l'annonce" : "Nouvelle annonce"}
                </DialogTitle>
                <DialogDescription>
                {announcement
                    ? "Modifiez les détails de l'annonce ci-dessous."
                    : "Rédigez et publiez une nouvelle annonce pour les utilisateurs."}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <FormField control={form.control} name="receiverId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Destinataire</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner un destinataire..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                                <SelectItem value="student">Tous les étudiants</SelectItem>
                                <SelectItem value="teacher">Tous les professeurs</SelectItem>
                                <SelectItem value="parent">Tous les parents</SelectItem>
                                {roles.map(r => (
                                    <SelectItem key={r.id} value={r.id}>Personnel: {r.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Titre (Optionnel)</FormLabel>
                        <FormControl><Input placeholder="Titre de l'annonce" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="content" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contenu du message</FormLabel>
                         <FormControl>
                            <Textarea
                                placeholder="Écrivez votre annonce ici..."
                                className="min-h-[120px]"
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>

            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={submitting}>
                Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {announcement ? "Enregistrer" : "Publier"}
                </Button>
            </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
