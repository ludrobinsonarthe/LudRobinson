
"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";

const validationSchema = z.object({
  email: z.string().email("Veuillez saisir une adresse e-mail valide."),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
});

type ValidationFormValues = z.infer<typeof validationSchema>;

function ValidationContent() {
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const form = useForm<ValidationFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: ValidationFormValues) => {
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

    try {
      const sessionRef = doc(db, 'qr_sessions', sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
        throw new Error("Session invalide ou expirée.");
      }

      await updateDoc(sessionRef, {
        email: data.email,
        password: data.password, // IMPORTANT: Sending password to Firestore is NOT secure for production. This is a demo.
        status: 'validated',
      });
      
      setValidated(true);
      toast({
        title: "Validation réussie",
        description: "Vous pouvez maintenant retourner à votre ordinateur pour continuer.",
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
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                    <CardTitle className="mt-4">Connexion validée</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Votre ordinateur est maintenant en train de se connecter. Vous pouvez fermer cette page.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!sessionId) {
     return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="text-destructive">Session Invalide</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>L'ID de session est manquant. Veuillez scanner à nouveau le code QR sur votre ordinateur.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Valider la connexion</CardTitle>
          <CardDescription>
            Saisissez vos identifiants pour confirmer la connexion sur votre autre appareil.
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
                      <Input type="email" placeholder="votre.email@isgi.com" {...field} />
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
              <p className="text-xs text-destructive/80">
                Avertissement : Pour cette démo, le mot de passe est transmis à la base de données. N'utilisez pas cette méthode en production sans une solution sécurisée comme des jetons à usage unique.
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Valider
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ValidateLoginPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <ValidationContent />
        </Suspense>
    )
}

    