
import ProfileForm from "@/components/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Profil Utilisateur</h1>
        <p className="text-muted-foreground">
          Gérez les informations de votre compte.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations Personnelles</CardTitle>
          <CardDescription>
            Mettez à jour vos informations personnelles. Assurez-vous qu'elles sont correctes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="flex items-center justify-center h-48">
               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>}>
            <ProfileForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
