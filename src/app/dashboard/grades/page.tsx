import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GradesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Mes Notes</h1>
                <p className="text-muted-foreground">
                    Consultez vos notes et résultats pour chaque matière.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Relevé de notes</CardTitle>
                    <CardDescription>
                        Voici le résumé de vos performances académiques.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <p className="text-muted-foreground">
                            La section des notes est en cours de construction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
