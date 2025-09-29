

"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Smartphone, QrCode, Camera } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, getDoc, onSnapshot, setDoc, collection, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import QRCode from "qrcode";
import { signInWithCustomToken } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import Image from "next/image";

function ShareSessionContent() {
  const [mode, setMode] = useState<'initial' | 'display_qr' | 'validate_qr'>('initial');
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrLoginError, setQrLoginError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get("sessionId");
  const { user, loading: authLoading } = useAuth();
  
  // Logic for the device that is ALREADY logged in (the "validator")
  useEffect(() => {
    if (sessionIdFromUrl && user) {
        setMode('validate_qr');
    }
  }, [sessionIdFromUrl, user]);

  // Logic for the device that WANTS to log in (the "requester")
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (mode === 'display_qr' && qrSessionId) {
      const sessionRef = doc(db, 'qr_sessions', qrSessionId);
      unsubscribe = onSnapshot(sessionRef, async (doc) => {
        const data = doc.data();
        if (doc.exists() && data?.status === 'validated' && data?.token) {
            try {
                setLoading(true);
                await signInWithCustomToken(auth, data.token);
                
                updateDoc(sessionRef, { status: 'completed' }).catch(err => {
                    // Non-critical, just log it.
                    console.error("Could not update session to completed:", err);
                });

                toast({ title: "Connexion réussie", description: "Vous êtes maintenant connecté." });
                router.push("/dashboard");
            } catch (error) {
                 setQrLoginError("Une erreur est survenue lors de la finalisation de la connexion.");
                 toast({ variant: "destructive", title: "Erreur de connexion", description: "Le jeton de connexion est invalide ou a expiré." });
                 setLoading(false);
                 setMode('initial'); // Reset
            }
        }
      },
      (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: sessionRef.path, operation: 'get' }));
        console.error("Error on snapshot:", error);
      });
    }
    // Cleanup function
    return () => {
      if (unsubscribe) unsubscribe();
      // Clean up the session doc if user navigates away
      if(qrSessionId) {
          deleteDoc(doc(db, 'qr_sessions', qrSessionId)).catch(err => {
               // Non-critical cleanup
          });
      }
    };
  }, [mode, qrSessionId, router, toast]);

  const handleDisplayQrCode = useCallback(() => {
    setLoading(true);
    const sessionId = doc(collection(db, 'qr_sessions')).id;
    const sessionData = { 
      status: 'pending', 
      createdAt: serverTimestamp() 
    };

    const loginUrl = `${window.location.origin}/dashboard/share-session?sessionId=${sessionId}`;

    QRCode.toDataURL(loginUrl, {
        width: 256,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    })
    .then(url => {
        setQrCodeDataUrl(url);
        return setDoc(doc(db, 'qr_sessions', sessionId), sessionData);
    })
    .then(() => {
        setQrSessionId(sessionId);
        setQrLoginError(null);
        setMode('display_qr');
        setLoading(false);
    })
    .catch(err => {
        console.error('Failed to generate QR code or create session', err);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `qr_sessions/${sessionId}`, operation: 'create', requestResourceData: sessionData }));
        setLoading(false);
    });
  }, []);
  
  const validateSession = async () => {
    setLoading(true);
    if (!sessionIdFromUrl || !user) {
      const errMessage = !sessionIdFromUrl ? "ID de session manquant." : "Vous devez être connecté pour valider une session.";
      toast({ variant: "destructive", title: "Erreur", description: errMessage });
      setLoading(false);
      return;
    }

    const sessionRef = doc(db, 'qr_sessions', sessionIdFromUrl);
    
    try {
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
            throw new Error("Session invalide ou expirée.");
        }

        const customToken = await user.getIdToken(); 
        const updateData = {
            userId: user.uid,
            status: 'validated',
            token: customToken,
        };
        
        await updateDoc(sessionRef, updateData);
        
        setValidated(true);
        toast({ title: "Validation réussie", description: "L'autre appareil est maintenant en train de se connecter." });
    } catch(error: any) {
        if(error.code === 'permission-denied') {
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: sessionRef.path, operation: 'update' }));
        } else {
             toast({ variant: "destructive", title: "Erreur de validation", description: error.message || "Impossible de valider la session." });
        }
    } finally {
        setLoading(false);
    }
  };

  if(authLoading) {
      return <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />;
  }

  // Initial state: choose action
  if (mode === 'initial') {
    return (
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <Card className="text-center">
                <CardHeader>
                    <QrCode className="mx-auto h-12 w-12 text-primary"/>
                    <CardTitle className="mt-4">Se connecter sur un autre appareil</CardTitle>
                    <CardDescription>Affichez un QR code à scanner pour vous connecter sur cet appareil.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleDisplayQrCode} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                        Afficher le QR Code
                    </Button>
                </CardContent>
            </Card>
            <Card className="text-center">
                 <CardHeader>
                    <Camera className="mx-auto h-12 w-12 text-primary"/>
                    <CardTitle className="mt-4">Valider un autre appareil</CardTitle>
                    <CardDescription>Utilisez la caméra de votre téléphone pour scanner un code affiché sur l'autre appareil.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Ouvrez l'application caméra de votre téléphone et scannez le code affiché sur l'autre appareil.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  // State for the device that WANTS to connect
  if (mode === 'display_qr') {
      return (
         <Card className="w-full max-w-md mx-auto">
            <CardHeader className="items-center text-center">
                <CardTitle>Connexion par Code QR</CardTitle>
                <CardDescription>
                    Connectez-vous sur votre téléphone, allez dans "Partager la session", puis scannez ce code.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-4 gap-4">
                {qrCodeDataUrl ? (
                    <Image src={qrCodeDataUrl} alt="QR Code" width={256} height={256} />
                ) : (
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                )}
                {qrLoginError && <p className="text-center text-sm text-destructive">{qrLoginError}</p>}
                <p className="text-center text-sm text-muted-foreground">En attente de validation...</p>
                 <Button variant="outline" onClick={() => setMode('initial')}>Retour</Button>
            </CardContent>
        </Card>
      );
  }

  // State for the device that IS ALREADY connected
  if (mode === 'validate_qr') {
    if (validated) {
        return (
            <Card className="w-full max-w-md mx-auto text-center">
                <CardHeader>
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                    <CardTitle className="mt-4">Connexion validée</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>L'autre appareil est maintenant connecté. Vous pouvez fermer cet onglet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto">
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
                <Button
                    className="w-full"
                    onClick={validateSession}
                    disabled={loading}
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Valider et connecter l'autre appareil
                </Button>
            </CardContent>
        </Card>
    );
  }

  return null;
}

export default function ShareSessionPage() {
    return (
        <div className="flex flex-col items-center justify-center">
             <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold font-headline tracking-tight">Partager la Session</h1>
                <p className="text-muted-foreground">
                  Connectez-vous sur un autre appareil en utilisant un QR code.
                </p>
            </div>
            <Suspense fallback={<Loader2 className="h-12 w-12 animate-spin text-primary" />}>
                <ShareSessionContent />
            </Suspense>
        </div>
    )
}
