import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SchedulePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Emploi du Temps</h1>
                <p className="text-muted-foreground">
                    Votre emploi du temps personnel pour la semaine.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Semaine en cours</CardTitle>
                    <CardDescription>
                        Organisation de vos cours et activités.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <p className="text-muted-foreground">
                            La section de l'emploi du temps est en cours de construction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
