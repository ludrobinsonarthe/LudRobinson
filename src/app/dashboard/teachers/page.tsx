import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeachersPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Professeurs</h1>
                <p className="text-muted-foreground">
                    Gérez les comptes et les attributions des professeurs.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des professeurs</CardTitle>
                    <CardDescription>
                        Consultez et gérez les profils des enseignants.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <p className="text-muted-foreground">
                            La section de gestion des professeurs est en cours de construction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
