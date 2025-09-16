"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";
import { summarizeMessageAction } from "@/lib/actions";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

export default function MessageSummarizer({ message }: { message: string }) {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSummarize = () => {
    setIsOpen(true);
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await summarizeMessageAction(message);
      if (result.error) {
        setError(result.error);
      } else {
        setSummary(result.summary);
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 h-auto p-1 text-xs"
        onClick={handleSummarize}
      >
        <Sparkles className="mr-1 h-3 w-3" />
        Résumer avec l'IA
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Résumé du message
            </DialogTitle>
            <DialogDescription>
              Voici un résumé du message généré par l'IA.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {isPending && (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-muted-foreground">Génération du résumé...</span>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {summary && (
              <div className="prose prose-sm max-w-none rounded-md border bg-muted/50 p-4">
                <p>{summary}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
