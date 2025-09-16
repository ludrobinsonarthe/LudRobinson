import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CourseManagementPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Cours</h1>
                <p className="text-muted-foreground">
                    Créez, modifiez et gérez les cours de l'institut.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des cours</CardTitle>
                    <CardDescription>
                        Recherchez, ajoutez ou modifiez les informations des cours.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <p className="text-muted-foreground">
                            La section de gestion des cours est en cours de construction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
