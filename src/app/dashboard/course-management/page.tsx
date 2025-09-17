

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
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
import { Course, Field, Sector, Cycle } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, Edit, ClipboardList } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import UserDeleteDialog from "@/components/user-delete-dialog";
import CourseFormDialog from "@/components/course-form-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockCourses, mockSectors, mockFields } from "@/lib/mock-data";

const levels = ["Licence 1", "Licence 2", "Licence 3", "Master 1", "Master 2"];
const cycles: { value: Cycle, label: string }[] = [
    { value: 'local', label: 'Cycle Local' },
    { value: 'international', label: 'Cycle International' },
    { value: 'entrepreneur', label: 'Cycle Entrepreneur' },
];

export default function CourseManagementPage() {
    const { users } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [fields, setFields] = useState<Field[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const { toast } = useToast();

    // Filters state
    const [nameFilter, setNameFilter] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [sectorFilter, setSectorFilter] = useState("all");
    const [fieldFilter, setFieldFilter] = useState("all");
    const [cycleFilter, setCycleFilter] = useState("all");
    
    useEffect(() => {
        setLoading(true);
        setCourses(mockCourses);
        setSectors(mockSectors);
        setFields(mockFields);
        setLoading(false);
    }, []);

    const teachers = useMemo(() => users.filter(u => u.role === 'teacher'), [users]);
    const fieldsById = useMemo(() => fields.reduce((acc, f) => ({...acc, [f.id]: f}), {} as Record<string, Field>), [fields]);
    const sectorsById = useMemo(() => sectors.reduce((acc, s) => ({...acc, [s.id]: s}), {} as Record<string, Sector>), [sectors]);

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
    
    const availableFields = useMemo(() => {
        if (sectorFilter === 'all') return fields;
        return fields.filter(f => f.sectorId === sectorFilter);
    }, [sectorFilter, fields]);

    useEffect(() => {
        setFieldFilter("all");
    }, [sectorFilter]);

    const filteredCourses = useMemo(() => {
        return courses.filter(course => {
            const courseField = course.fieldId ? fieldsById[course.fieldId] : null;
            const courseSectorId = courseField?.sectorId;

            return (
                (nameFilter === "" || course.name.toLowerCase().includes(nameFilter.toLowerCase())) &&
                (levelFilter === "all" || course.level === levelFilter) &&
                (cycleFilter === "all" || course.cycle === cycleFilter) &&
                (sectorFilter === "all" || courseSectorId === sectorFilter) &&
                (fieldFilter === "all" || course.fieldId === fieldFilter)
            );
        });
    }, [courses, nameFilter, levelFilter, sectorFilter, fieldFilter, cycleFilter, fieldsById]);

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
        if (selectedCourse) {
            setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...selectedCourse, ...courseData } as Course : c));
            toast({ title: "Cours mis à jour (Simulation)", description: "Les informations du cours ont été mises à jour localement."});
        } else {
            const newCourse = { ...courseData, id: `course_${Date.now()}` } as Course;
            setCourses(prev => [newCourse, ...prev]);
            toast({ title: "Cours ajouté (Simulation)", description: "Le nouveau cours a été créé localement."});
        }
        setIsFormOpen(false);
    }
    
    const confirmDelete = async () => {
        if(selectedCourse) {
            setCourses(prev => prev.filter(c => c.id !== selectedCourse.id));
            toast({ title: "Cours supprimé (Simulation)" });
            setIsDeleteOpen(false);
            setSelectedCourse(null);
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
                        Filtrez, recherchez, ajoutez ou modifiez les informations et les horaires des cours.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-wrap items-center gap-4 mb-6">
                        <Input 
                            placeholder="Rechercher par nom..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par niveau" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les niveaux</SelectItem>
                                {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={cycleFilter} onValueChange={setCycleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par cycle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les cycles</SelectItem>
                                {cycles.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                         <Select value={sectorFilter} onValueChange={setSectorFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrer par secteur" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous les secteurs</SelectItem>
                                {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fieldFilter} onValueChange={setFieldFilter} disabled={sectorFilter === 'all'}>
                            <SelectTrigger className="w-[240px]">
                                <SelectValue placeholder="Filtrer par filière" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les filières</SelectItem>
                                {availableFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
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
                            ) : filteredCourses.length > 0 ? filteredCourses.map(course => {
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
                                               <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/grade-management?courseId=${course.id}`}>
                                                        <ClipboardList className="mr-2 h-4 w-4" />
                                                        Gérer les notes
                                                    </Link>
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
                                        Aucun cours trouvé pour les filtres actuels.
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
                sectors={sectors}
                fields={fields}
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

    
