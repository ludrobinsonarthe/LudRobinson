
"use client";

import { useForm, Controller } from "react-hook-form";
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
import { mockClasses } from "@/lib/mock-data";
import type { Message } from "@/lib/types";
import { useEffect } from "react";
import { useUser } from "@/hooks/use-user";

const announcementSchema = z.object({
  receiverId: z.string().min(1, "Veuillez sélectionner un destinataire."),
  content: z.string().min(10, "Le contenu doit comporter au moins 10 caractères."),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

interface AnnouncementDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: AnnouncementFormValues) => void;
  announcement: Message | null;
}

export default function AnnouncementDialog({ isOpen, setIsOpen, onSave, announcement }: AnnouncementDialogProps) {
  const { user } = useUser();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
  });

  useEffect(() => {
    if (announcement) {
      reset({
        receiverId: announcement.receiverId,
        content: announcement.content,
      });
    } else {
      reset({
        receiverId: "all",
        content: "",
      });
    }
  }, [announcement, reset, isOpen]);

  if (user?.role !== 'admin') {
      return null;
  }

  const onSubmit = (data: AnnouncementFormValues) => {
    onSave(data);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
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
            <div className="grid gap-2">
              <Label htmlFor="receiverId">Destinataire</Label>
              <Controller
                name="receiverId"
                control={control}
                defaultValue={announcement?.receiverId || "all"}
                render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un destinataire..." />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Tous les utilisateurs</SelectItem>
                        {mockClasses.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                )}
              />
               {errors.receiverId && <p className="text-sm text-destructive">{errors.receiverId.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Contenu du message</Label>
              <Textarea
                id="content"
                placeholder="Écrivez votre annonce ici..."
                className="min-h-[120px]"
                {...register("content")}
              />
              {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">
                {announcement ? "Enregistrer les modifications" : "Publier l'annonce"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
