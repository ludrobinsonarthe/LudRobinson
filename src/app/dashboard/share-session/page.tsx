
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Smartphone } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Suspense } from "react";

function ShareSessionContent() {
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const { user } = useAuth();

  const validateSession = async () => {
    setLoading(true);
    if (!sessionId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "ID de session manquant. Veuillez rescanner le code QR.",
      });
      setLoading(false);
      return;
    }
    if (!user) {
        toast({
        variant: "destructive",
        title: "Erreur",
        description: "Vous devez être connecté pour valider une session.",
      });
      setLoading(false);
      return;
    }

    try {
      const sessionRef = doc(db, 'qr_sessions', sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
        throw new Error("Session invalide ou expirée.");
      }

      await updateDoc(sessionRef, {
        userId: user.uid,
        status: 'validated',
      });
      
      setValidated(true);
      toast({
        title: "Validation réussie",
        description: "L'autre appareil est maintenant en train de se connecter.",
      });

    } catch (error: any) {
      console.error("Validation error:", error);
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: error.message || "Impossible de valider la session.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (validated) {
    return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                <CardTitle className="mt-4">Connexion validée</CardTitle>
            </CardHeader>
            <CardContent>
                <p>L'autre appareil est maintenant connecté. Vous pouvez fermer cette page.</p>
            </CardContent>
        </Card>
    );
  }

  if (!sessionId) {
     return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CardTitle className="text-destructive">Session Invalide</CardTitle>
            </CardHeader>
            <CardContent>
                <p>L'ID de session est manquant. Veuillez scanner le code QR sur l'appareil que vous souhaitez connecter.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
            <Smartphone className="h-12 w-12 text-primary" />
            <CardTitle className="mt-4">Valider la connexion</CardTitle>
            <CardDescription>
                Confirmez que vous souhaitez connecter l'autre appareil en utilisant votre session actuelle.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-center text-muted-foreground mb-4">
                En cliquant sur "Valider", vous autorisez l'autre appareil à se connecter avec votre compte.
            </p>
            <button
                className="w-full inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                onClick={validateSession}
                disabled={loading}
            >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Valider et connecter l'autre appareil
            </button>
        </CardContent>
    </Card>
  );
}

export default function ShareSessionPage() {
    return (
        <div className="flex flex-col items-center justify-center">
             <div className="mb-6 text-center">
                <h1 className="text-3xl font-bold font-headline tracking-tight">Partager la Session</h1>
                <p className="text-muted-foreground">
                  Connectez-vous sur un autre appareil en scannant un code QR.
                </p>
            </div>
            <Suspense fallback={<Loader2 className="h-12 w-12 animate-spin text-primary" />}>
                <ShareSessionContent />
            </Suspense>
        </div>
    )
}
