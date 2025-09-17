
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
  item: { id: string; firstName?: string; name?: string } | null;
  title?: string;
  description?: string;
}

export default function UserDeleteDialog({ isOpen, setIsOpen, onConfirm, item, title, description }: UserDeleteDialogProps) {
  if (!item) return null;

  const itemName = item.name || `${(item as User).firstName} ${(item as User).lastName}`;


  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || `Êtes-vous sûr de vouloir supprimer ${itemName} ?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || `Cette action est irréversible. L'élément "${itemName}" sera définitivement supprimé.`}
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
