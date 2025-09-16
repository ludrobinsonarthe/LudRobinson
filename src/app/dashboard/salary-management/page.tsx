
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SalaryManagementPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Salaires</h1>
                <p className="text-muted-foreground">
                    Suivez et gérez la paie des professeurs.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Historique des fiches de paie</CardTitle>
                    <CardDescription>
                        Liste de toutes les fiches de paie générées et leur statut.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <p className="text-muted-foreground">
                            La section de gestion des salaires est en cours de construction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
