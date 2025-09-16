import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Scolarité et Paiements</h1>
                <p className="text-muted-foreground">
                    Suivez l'état de vos paiements de frais de scolarité.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Historique des paiements</CardTitle>
                    <CardDescription>
                        Liste de tous les paiements effectués et soldes restants.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                        <p className="text-muted-foreground">
                            La section des paiements est en cours de construction.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
