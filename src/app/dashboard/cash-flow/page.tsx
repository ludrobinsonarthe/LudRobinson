import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CashFlowPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Suivi de Caisse</h1>
                <p className="text-muted-foreground">
                    Gérez les entrées, les sorties et les dépenses de la caisse.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Rapport de caisse</CardTitle>
                    <CardDescription>
                        Vue d'ensemble des transactions financières et du solde actuel.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <p className="text-muted-foreground">
                            La section de suivi de caisse est en cours de construction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
