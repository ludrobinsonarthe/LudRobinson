
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { User, Course, Attendance, StudentAttendanceStatus } from "@/lib/types";
import { useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Check, UserX, X } from "lucide-react";

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

const statusOptions: { value: StudentAttendanceStatus; label: string; icon: React.ElementType, className: string }[] = [
    { value: 'present', label: 'Présent', icon: Check, className: 'bg-green-500 hover:bg-green-600 border-green-600 text-white' },
    { value: 'absent', label: 'Absent', icon: X, className: 'bg-red-500 hover:bg-red-600 border-red-600 text-white' },
    { value: 'justified', label: 'Justifié', icon: UserX, className: 'bg-gray-400 hover:bg-gray-500 border-gray-500 text-white' },
];


export default function AttendanceDialog({ isOpen, setIsOpen, onSave, course, date, students, existingAttendance }: AttendanceDialogProps) {
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      teacherStatus: 'present',
      studentAttendances: [],
    }
  });

  const { fields } = useFieldArray({
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
                studentAttendances: students.map(student => ({ studentId: student.uid, status: 'present' })) // Default to present
             });
        }
    }
  }, [existingAttendance, isOpen, form, students]);


  const onSubmit = (data: AttendanceFormValues) => {
    onSave(data);
  };
  
  const setAllStudents = (status: 'present' | 'absent') => {
      const updatedAttendances = students.map(s => ({ studentId: s.uid, status }));
      form.setValue('studentAttendances', updatedAttendances, { shouldDirty: true });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl">
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
                        <h3 className="font-semibold">Présence des Étudiants ({students.length})</h3>
                        <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => setAllStudents('present')}>Tous présents</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setAllStudents('absent')}>Tous absents</Button>
                        </div>
                    </div>
                     <ScrollArea className="h-72 w-full rounded-md border">
                        <Table>
                             <TableBody>
                                {fields.map((field, index) => {
                                    const student = students.find(s => s.uid === field.studentId);
                                    if (!student) return null;

                                    return (
                                    <TableRow key={field.id}>
                                        <TableCell className="font-medium">{student.lastName} {student.firstName}</TableCell>
                                        <TableCell className="text-right">
                                            <FormField
                                                control={form.control}
                                                name={`studentAttendances.${index}.status`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormControl>
                                                      <RadioGroup
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                        className="flex justify-end gap-2"
                                                      >
                                                        {statusOptions.map(option => (
                                                          <FormItem key={option.value}>
                                                            <FormControl>
                                                              <RadioGroupItem value={option.value} className="sr-only" />
                                                            </FormControl>
                                                            <FormLabel>
                                                              <div className={cn(
                                                                buttonVariants({ variant: 'outline', size: 'sm' }),
                                                                "cursor-pointer",
                                                                field.value !== option.value && "bg-transparent text-foreground",
                                                                field.value === option.value && option.className
                                                              )}>
                                                                <option.icon className="mr-2 h-4 w-4" />
                                                                {option.label}
                                                              </div>
                                                            </FormLabel>
                                                          </FormItem>
                                                        ))}
                                                      </RadioGroup>
                                                    </FormControl>
                                                  </FormItem>
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
