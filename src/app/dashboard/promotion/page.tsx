
"use client";

import { useMemo } from 'react';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User } from 'lucide-react';

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${lastName[0] || ''}${firstName[0] || ''}`.toUpperCase();
};

export default function PromotionPage() {
    const { user: currentUser, users, loading: usersLoading, fields } = useUser();

    const classmates = useMemo(() => {
        if (!currentUser || currentUser.role !== 'student' || !currentUser.student?.fieldId || !currentUser.student?.level) {
            return [];
        }

        const { fieldId, level } = currentUser.student;
        return users.filter(user => 
            user.uid !== currentUser.uid &&
            user.role === 'student' &&
            user.student?.fieldId === fieldId &&
            user.student?.level === level
        );
    }, [currentUser, users]);

    const currentField = useMemo(() => {
        if (!currentUser?.student?.fieldId) return null;
        return fields.find(f => f.id === currentUser.student.fieldId);
    }, [currentUser, fields]);

    const title = `Promotion ${currentUser?.student?.level} - ${currentField?.name || ''}`;

    if (usersLoading) {
        return <div>Chargement de la promotion...</div>;
    }
    
    if (currentUser?.role !== 'student') {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                <User className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Page réservée aux étudiants</h3>
                <p className="mb-4 mt-2 text-sm text-muted-foreground">
                    Cette section n'est accessible qu'aux étudiants pour voir leurs camarades de classe.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">{title}</h1>
                <p className="text-muted-foreground">
                    Retrouvez ici la liste de tous vos camarades de classe pour l'année en cours.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Liste des étudiants ({classmates.length})</CardTitle>
                    <CardDescription>
                        Les profils de vos camarades de promotion.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {classmates.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {classmates.map(classmate => (
                                <Card key={classmate.uid} className="p-4">
                                    <div className="flex flex-col items-center gap-3 text-center">
                                        <Avatar className="h-20 w-20 border-2 border-primary">
                                            <AvatarImage src={classmate.photoUrl} alt={`${classmate.lastName} ${classmate.firstName}`} />
                                            <AvatarFallback className="text-2xl">{getInitials(classmate.firstName, classmate.lastName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid gap-0.5">
                                            <p className="font-semibold">{classmate.lastName} {classmate.firstName}</p>
                                            <p className="text-sm text-muted-foreground">{classmate.student?.matricule}</p>
                                        </div>
                                         <Badge variant="secondary">{classmate.email}</Badge>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                         <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center h-full">
                            <User className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">Aucun camarade trouvé</h3>
                            <p className="mb-4 mt-2 text-sm text-muted-foreground">
                                Il semblerait que vous soyez le premier de votre promotion !
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

    