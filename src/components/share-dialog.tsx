
"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCode from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { Copy, Mail } from "lucide-react";

interface ShareDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function ShareDialog({ isOpen, setIsOpen }: ShareDialogProps) {
  const [appUrl, setAppUrl] = useState("");
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppUrl(window.location.origin);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(appUrl);
    toast({ title: "Lien copié", description: "Le lien de l'application a été copié dans le presse-papiers." });
  };
  
  const handleEmailInvite = () => {
    if (email) {
        const subject = "Invitation à rejoindre la plateforme ISGI";
        const body = `Bonjour,\n\nVous êtes invité à rejoindre la plateforme de l'ISGI. Vous pouvez y accéder via ce lien : ${appUrl}\n\nCordialement,\nL'administration de l'ISGI`;
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
        toast({
            variant: "destructive",
            title: "Adresse e-mail manquante",
            description: "Veuillez saisir une adresse e-mail.",
        });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Partager l'application</DialogTitle>
          <DialogDescription>
            Partagez le lien de l'application par e-mail ou via un code QR.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Par E-mail</TabsTrigger>
            <TabsTrigger value="qr">Code QR</TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="pt-4 space-y-4">
             <div>
                <Label htmlFor="email" className="mb-2 block">
                    Adresse e-mail de l'invité
                </Label>
                <div className="flex space-x-2">
                    <Input
                    id="email"
                    type="email"
                    placeholder="nom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    />
                    <Button type="button" size="icon" onClick={handleEmailInvite}>
                        <Mail className="h-4 w-4" />
                        <span className="sr-only">Envoyer</span>
                    </Button>
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="link" className="mb-2 block">Ou copiez le lien direct</Label>
                <div className="flex space-x-2">
                <Input id="link" value={appUrl} readOnly />
                <Button type="button" size="icon" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copier</span>
                </Button>
                </div>
             </div>
          </TabsContent>
          <TabsContent value="qr">
            <div className="flex flex-col items-center justify-center p-4 space-y-2">
              <QRCode value={appUrl} size={200} />
              <p className="text-sm text-muted-foreground">Scannez ce code pour ouvrir l'application.</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
