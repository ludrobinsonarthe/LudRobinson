
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Course, Field, Sector } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import UserDeleteDialog from "@/components/user-delete-dialog";
import CourseFormDialog from "@/components/course-form-dialog";
import { mockSectors, mockFields } from "@/lib/mock-data";

export default function CourseManagementPage() {
    const { users } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const { toast } = useToast();
    
    useEffect(() => {
      const unsubscribe = onSnapshot(collection(db, "courses"), (snapshot) => {
        const coursesFromDb: Course[] = [];
        snapshot.forEach((doc) => {
          coursesFromDb.push({ id: doc.id, ...doc.data() } as Course);
        });
        setCourses(coursesFromDb);
        setLoading(false);
      });
      return () => unsubscribe();
    }, []);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const fieldsById = useMemo(() => mockFields.reduce((acc, f) => ({...acc, [f.id]: f}), {} as Record<string, Field>), []);
    const sectorsById = useMemo(() => mockSectors.reduce((acc, s) => ({...acc, [s.id]: s}), {} as Record<string, Sector>), []);

    const getTeacherName = (teacherId: string) => {
        const teacher = teachers.find(t => t.uid === teacherId);
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Non assigné';
    }

    const getFieldInfo = (fieldId: string) => {
        const field = fieldsById[fieldId];
        if (!field) return { fieldName: 'N/A', sectorName: 'N/A' };
        const sector = sectorsById[field.sectorId];
        return { fieldName: field.name, sectorName: sector?.name || 'N/A' };
    }

    const handleAdd = () => {
        setSelectedCourse(null);
        setIsFormOpen(true);
    }

    const handleEdit = (course: Course) => {
        setSelectedCourse(course);
        setIsFormOpen(true);
    }

    const handleDelete = (course: Course) => {
        setSelectedCourse(course);
        setIsDeleteOpen(true);
    }

    const handleSave = async (courseData: Partial<Course>) => {
        try {
            if (selectedCourse) {
                const courseRef = doc(db, "courses", selectedCourse.id);
                await updateDoc(courseRef, courseData);
                toast({ title: "Cours mis à jour", description: "Les informations du cours ont été mises à jour." });
            } else {
                const newCourseId = doc(collection(db, "courses")).id;
                await setDoc(doc(db, "courses", newCourseId), {id: newCourseId, ...courseData});
                toast({ title: "Cours ajouté", description: "Le nouveau cours a été ajouté avec succès." });
            }
        } catch (error) {
            console.error("Error saving course:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le cours." });
        }
    }
    
    const confirmDelete = async () => {
        if(selectedCourse) {
            try {
                await deleteDoc(doc(db, "courses", selectedCourse.id));
                toast({ title: "Cours supprimé", description: "Le cours a été supprimé avec succès." });
                setIsDeleteOpen(false);
                setSelectedCourse(null);
            } catch (error) {
                console.error("Error deleting course: ", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le cours." });
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                 <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Cours et Horaires</h1>
                    <p className="text-muted-foreground">
                        Créez, modifiez et gérez les cours de l'institut et leurs emplois du temps.
                    </p>
                </div>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter un cours
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Liste des cours</CardTitle>
                    <CardDescription>
                        Recherchez, ajoutez ou modifiez les informations et les horaires des cours.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom du cours</TableHead>
                                <TableHead>Professeur</TableHead>
                                <TableHead>Filière</TableHead>
                                <TableHead>Secteur</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Chargement...
                                    </TableCell>
                                </TableRow>
                            ) : courses.length > 0 ? courses.map(course => {
                                const { fieldName, sectorName } = getFieldInfo(course.fieldId);
                                return (
                                <TableRow key={course.id}>
                                    <TableCell className="font-medium">{course.name}</TableCell>
                                    <TableCell>{getTeacherName(course.teacherId)}</TableCell>
                                    <TableCell>{fieldName}</TableCell>
                                    <TableCell>{sectorName}</TableCell>
                                    <TableCell className="text-right">
                                       <DropdownMenu>
                                           <DropdownMenuTrigger asChild>
                                               <Button variant="ghost" size="icon">
                                                   <MoreHorizontal className="h-4 w-4" />
                                               </Button>
                                           </DropdownMenuTrigger>
                                           <DropdownMenuContent align="end">
                                               <DropdownMenuItem onClick={() => handleEdit(course)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifier
                                               </DropdownMenuItem>
                                               <DropdownMenuItem onClick={() => handleDelete(course)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Supprimer
                                               </DropdownMenuItem>
                                           </DropdownMenuContent>
                                       </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Aucun cours trouvé.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CourseFormDialog 
                isOpen={isFormOpen}
                setIsOpen={setIsFormOpen}
                onSave={handleSave}
                course={selectedCourse}
                teachers={teachers}
                sectors={mockSectors}
                fields={mockFields}
            />
            {selectedCourse && (
                 <UserDeleteDialog
                    isOpen={isDeleteOpen}
                    setIsOpen={setIsDeleteOpen}
                    onConfirm={confirmDelete}
                    user={{uid: selectedCourse.id, firstName: selectedCourse.name, lastName: 'Cours'}}
                />
            )}
        </div>
    );
}
