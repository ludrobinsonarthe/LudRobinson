
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { User, Course, Attendance, StudentAttendance } from "@/lib/types";
import { useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";

const studentAttendanceSchema = z.object({
    studentId: z.string(),
    status: z.enum(['present', 'absent', 'justified']),
});

const attendanceFormSchema = z.object({
  teacherStatus: z.enum(['present', 'absent']),
  studentAttendances: z.array(studentAttendanceSchema),
});

type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

interface AttendanceDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: (data: AttendanceFormValues) => void;
  course: Course | null;
  date: string | null;
  students: User[];
  existingAttendance?: Attendance;
}

export default function AttendanceDialog({ isOpen, setIsOpen, onSave, course, date, students, existingAttendance }: AttendanceDialogProps) {
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      teacherStatus: 'present',
      studentAttendances: [],
    }
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "studentAttendances",
  });

  useEffect(() => {
    if (isOpen) {
        if(existingAttendance) {
             form.reset({
                teacherStatus: existingAttendance.teacherStatus,
                studentAttendances: students.map(student => {
                    const existingStudent = existingAttendance.studentAttendances.find(sa => sa.studentId === student.uid);
                    return { studentId: student.uid, status: existingStudent?.status || 'absent' };
                })
             });
        } else {
             form.reset({
                teacherStatus: 'present',
                studentAttendances: students.map(student => ({ studentId: student.uid, status: 'absent' }))
             });
        }
    }
  }, [existingAttendance, isOpen, form, students]);


  const onSubmit = (data: AttendanceFormValues) => {
    onSave(data);
  };
  
  const setAllStudents = (status: 'present' | 'absent') => {
      const updatedAttendances = students.map(s => ({ studentId: s.uid, status }));
      form.setValue('studentAttendances', updatedAttendances);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="font-headline">
                Fiche de présence du cours: {course?.name}
              </DialogTitle>
              <DialogDescription>
                Pour le {date ? format(new Date(date), 'd MMMM yyyy', {locale: fr}) : ''}. Enregistrez la présence pour le professeur et les étudiants.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
                <FormField control={form.control} name="teacherStatus" render={({ field }) => (
                    <FormItem className="flex items-center gap-4 space-y-0 rounded-lg border p-4">
                        <FormLabel className="font-semibold">Présence du Professeur:</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="present">Présent(e)</SelectItem>
                                <SelectItem value="absent">Absent(e)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">Présence des Étudiants</h3>
                        <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => setAllStudents('present')}>Tous présents</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setAllStudents('absent')}>Tous absents</Button>
                        </div>
                    </div>
                     <ScrollArea className="h-72 w-full rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Étudiant</TableHead>
                                    <TableHead className="text-right">Statut</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {fields.map((field, index) => {
                                    const student = students.find(s => s.uid === field.studentId);
                                    if (!student) return null;

                                    return (
                                    <TableRow key={field.id}>
                                        <TableCell>{student.firstName} {student.lastName}</TableCell>
                                        <TableCell className="text-right">
                                            <FormField
                                                control={form.control}
                                                name={`studentAttendances.${index}.status`}
                                                render={({ field }) => (
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="w-[130px] float-right">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="present"><Badge className="bg-green-600 hover:bg-green-700">Présent</Badge></SelectItem>
                                                            <SelectItem value="absent"><Badge variant="destructive">Absent</Badge></SelectItem>
                                                            <SelectItem value="justified"><Badge variant="secondary">Justifié</Badge></SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            />
                                        </TableCell>
                                    </TableRow>
                                    )
                                })}
                             </TableBody>
                        </Table>
                     </ScrollArea>
                </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
              <Button type="submit">Enregistrer la fiche</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
