"use client";

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// This is a client component that listens for Firestore permission errors
// and displays a detailed toast notification.
// It is intended to be used within the FirebaseProvider.
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error("Caught Firestore Permission Error:", error.toString());
      
      const readableOperation = {
        'get': 'lire le document',
        'list': 'lister les documents',
        'create': 'créer le document',
        'update': 'mettre à jour le document',
        'delete': 'supprimer le document',
      }[error.context.operation];

      toast({
        variant: "destructive",
        title: "Erreur de Permission Firestore",
        description: (
          <div className="text-xs font-mono">
            <p className="mb-2">L'opération de <strong>{readableOperation}</strong> sur le chemin <strong>{error.context.path}</strong> a été refusée par les règles de sécurité.</p>
            {error.context.requestResourceData && <p><strong>Données envoyées:</strong> {JSON.stringify(error.context.requestResourceData, null, 2)}</p>}
          </div>
        ),
        duration: 20000, 
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null; // This component does not render anything
}
