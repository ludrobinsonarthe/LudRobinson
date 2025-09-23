
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChromeIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { Settings } from "@/lib/types";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const { toast } = useToast();
  const router = useRouter();

   useEffect(() => {
    // Fetch settings to display school name
    const unsub = onSnapshot(doc(db, "settings", "system"), (settingsDoc) => {
        if (settingsDoc.exists()) {
            setSettings(settingsDoc.data() as Settings);
        }
    }, (error) => {
        console.error("Could not fetch school settings for login page", error);
    });

    return () => unsub();
  }, []);
  
  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
       toast({ title: "Connexion réussie", description: "Vérification des autorisations..." });
       router.push("/dashboard");
    } catch (error: any) {
       console.error("Google sign-in error:", error);
       toast({
        variant: "destructive",
        title: "Erreur de connexion Google",
        description: "Impossible de se connecter avec Google. Assurez-vous que les pop-ups sont autorisées et réessayez.",
      });
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-card text-card-foreground">
                    <Image src={settings?.logoUrl || "/logo.png"} alt="ISGI Logo" width={48} height={48} className="object-contain"/>
                </div>
                <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
                    {settings?.schoolName || "ISGI"}
                </h1>
            </div>
          <CardTitle className="text-2xl font-bold">Connexion au portail</CardTitle>
          <CardDescription>
            Utilisez votre compte Google pour accéder à votre tableau de bord.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChromeIcon className="mr-2 h-4 w-4" />}
                Se connecter avec Google
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
