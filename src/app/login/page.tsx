
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Bot, Building, ChromeIcon, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, AuthErrorCodes } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, collection, setDoc } from "firebase/firestore";
import QRCode from "qrcode.react";

const loginSchema = z.object({
  email: z.string().email("Veuillez saisir une adresse e-mail valide."),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrLoginError, setQrLoginError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@isgi.com",
      password: "password",
    },
  });
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (isQrDialogOpen && qrSessionId) {
      const sessionRef = doc(db, 'qr_sessions', qrSessionId);
      unsubscribe = onSnapshot(sessionRef, async (doc) => {
        if (doc.exists() && doc.data().status === 'validated' && doc.data().email && doc.data().password) {
            try {
                setLoading(true);
                await signInWithEmailAndPassword(auth, doc.data().email, doc.data().password);
                toast({ title: "Connexion par QR Code réussie" });
                router.push("/dashboard");
                setIsQrDialogOpen(false);
            } catch (error) {
                 setQrLoginError("Les identifiants validés sont incorrects. Veuillez réessayer.");
                 toast({
                    variant: "destructive",
                    title: "Erreur de connexion QR",
                    description: "Les identifiants fournis via le QR code sont incorrects.",
                });
            } finally {
                setLoading(false);
            }
        }
      });
    }
    // Cleanup function to unsubscribe when the dialog is closed or component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isQrDialogOpen, qrSessionId, router, toast]);

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({ title: "Connexion réussie" });
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      let description = "Une erreur inattendue est survenue. Veuillez réessayer.";
      if (error.code === AuthErrorCodes.INVALID_LOGIN_CREDENTIALS || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        description = "L'adresse e-mail ou le mot de passe est incorrect.";
      }
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: description,
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Connexion Google réussie" });
      router.push("/dashboard");
    } catch (error: any) {
       console.error("Google sign-in error:", error);
       toast({
        variant: "destructive",
        title: "Erreur de connexion Google",
        description: "Impossible de se connecter avec Google. Veuillez réessayer ou contacter le support.",
      });
    } finally {
        setLoading(false);
    }
  }

  const handleQrCodeClick = async () => {
    const sessionId = doc(collection(db, 'qr_sessions')).id;
    await setDoc(doc(db, 'qr_sessions', sessionId), { status: 'pending', createdAt: new Date() });
    setQrSessionId(sessionId);
    setQrLoginError(null);
    setIsQrDialogOpen(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Image src="/logo.png" alt="ISGI Logo" width={48} height={48} />
                </div>
                <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
                    ISGI
                </h1>
            </div>
          <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
          <CardDescription>
            Accédez à votre tableau de bord.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse e-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="votre.email@isgi.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Se connecter
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
            <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                    Ou continuer avec
                    </span>
                </div>
            </div>
             <div className="grid grid-cols-2 gap-4 w-full">
                <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChromeIcon className="mr-2 h-4 w-4" />}
                    Google
                </Button>
                 <Button variant="outline" className="w-full" onClick={handleQrCodeClick} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                    Code QR
                </Button>
            </div>
        </CardFooter>
      </Card>
      
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Connexion par Code QR</DialogTitle>
                <DialogDescription>
                    Scannez ce code avec l'appareil photo de votre téléphone pour vous connecter.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
                {qrSessionId ? (
                    <QRCode value={`${window.location.origin}/validate-login?sessionId=${qrSessionId}`} size={256} />
                ) : (
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                )}
            </div>
            {qrLoginError ? (
                <p className="text-center text-sm text-destructive">{qrLoginError}</p>
            ) : (
                <p className="text-center text-sm text-muted-foreground">
                    En attente de validation...
                </p>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
