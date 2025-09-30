
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { Settings } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    setSettingsLoading(true);
    const unsub = onSnapshot(doc(db, "settings", "system"), (settingsDoc) => {
        if (settingsDoc.exists()) {
            setSettings(settingsDoc.data() as Settings);
        }
        setSettingsLoading(false);
    }, (error) => {
        console.error("Could not fetch school settings for login page", error);
        setSettingsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Champs requis",
        description: "Veuillez saisir votre e-mail et votre mot de passe.",
      });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Connexion réussie" });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Sign-in error:", error);
      let description = "Une erreur est survenue. Veuillez réessayer.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "Identifiants incorrects ou compte non activé. Veuillez vérifier vos informations ou contacter un administrateur.";
      }
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description,
      });
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = settings?.logoUrl || "/logo.png";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-card text-card-foreground">
                    {settingsLoading ? <Skeleton className="h-12 w-12 rounded-lg" /> : <img src={logoSrc} alt="Logo" width={48} height={48} className="object-contain" />}
                </div>
                {settingsLoading ? <Skeleton className="h-9 w-40" /> : 
                  <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
                      {settings?.schoolName || "ISGI"}
                  </h1>
                }
            </div>
          <CardTitle className="text-2xl font-bold">Connexion au portail</CardTitle>
          <CardDescription>
            Saisissez vos identifiants pour accéder à votre tableau de bord.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@isgi.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={handleSignIn} disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Se connecter
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
