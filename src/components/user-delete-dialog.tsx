
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "./ui/button";
import type { User } from "@/lib/types";

interface UserDeleteDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onConfirm: () => void;
  user: Partial<User> | null;
  title?: string;
  description?: string;
}

export default function UserDeleteDialog({ isOpen, setIsOpen, onConfirm, user, title, description }: UserDeleteDialogProps) {
  if (!user) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || "Êtes-vous sûr de vouloir supprimer cet élément ?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || `Cette action est irréversible. L'élément "${user.firstName} ${user.lastName || ''}" sera définitivement supprimé.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
          >
            Confirmer la suppression
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
