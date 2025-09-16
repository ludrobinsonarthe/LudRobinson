
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, onSnapshot, query, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { AdminRole, adminPermissions, AdminPermission } from "@/lib/types";
import { Loader2, PlusCircle, ShieldCheck, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDescription } from "@/components/ui/form";

const roleSchema = z.object({
  id: z.string(),
  name: z.string().min(3, "Le nom du rôle est requis."),
  permissions: z.array(z.string()),
});

const rolesFormSchema = z.object({
  roles: z.array(roleSchema),
});

type RolesFormValues = z.infer<typeof rolesFormSchema>;

const permissionGroups = {
    'Pédagogie': ['manage_students', 'manage_teachers', 'manage_course', 'manage_grades', 'manage_attendance'],
    'Finances': ['manage_tuition', 'manage_fees', 'manage_salaries', 'manage_cash_flow'],
    'Administration Système': ['manage_users', 'manage_roles', 'manage_admin_settings', 'view_reporting']
}

export default function RolesPage() {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<RolesFormValues>({
    resolver: zodResolver(rolesFormSchema),
    defaultValues: {
      roles: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "roles",
  });

  useEffect(() => {
    const q = query(collection(db, "admin_roles"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        form.reset({ roles: [] });
      } else {
        const rolesFromDb: AdminRole[] = [];
        snapshot.forEach((doc) => {
          rolesFromDb.push({ id: doc.id, ...doc.data() } as AdminRole);
        });
        form.reset({ roles: rolesFromDb });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [form]);

  const onSubmit = async (data: RolesFormValues) => {
    try {
      setLoading(true);
      const batch = writeBatch(db);
      data.roles.forEach((role) => {
        const docRef = doc(db, "admin_roles", role.id);
        batch.set(docRef, role);
      });
      await batch.commit();
      toast({
        title: "Rôles mis à jour",
        description: "Les rôles et permissions ont été enregistrés.",
      });
    } catch (error) {
      console.error("Error saving roles:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer les rôles.",
      });
    } finally {
      setLoading(false);
    }
  };

  const addNewRole = () => {
    const newId = doc(collection(db, 'admin_roles')).id;
    append({
        id: newId,
        name: "",
        permissions: []
    });
  }

  const removeRole = async (index: number) => {
    const roleId = fields[index].id;
    try {
        await deleteDoc(doc(db, "admin_roles", roleId));
        remove(index);
        toast({ title: "Rôle supprimé" });
    } catch(error) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer ce rôle." });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Rôles & Permissions</h1>
        <p className="text-muted-foreground">
          Créez des rôles administratifs et attribuez-leur des permissions spécifiques pour sécuriser l'accès à l'application.
        </p>
      </div>

       {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ) : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-6">
                {fields.map((field, index) => (
                    <Card key={field.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                             <div className="flex-1">
                                <FormField
                                    control={form.control}
                                    name={`roles.${index}.name`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input {...field} placeholder="Nom du rôle (ex: Comptable)" className="text-xl font-bold font-headline tracking-tight border-0 shadow-none p-0 focus-visible:ring-0" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <CardDescription>ID du rôle: {field.id}</CardDescription>
                             </div>
                             <Button type="button" variant="ghost" size="icon" onClick={() => removeRole(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                        </CardHeader>
                        <CardContent>
                            <FormField
                                control={form.control}
                                name={`roles.${index}.permissions`}
                                render={({ field: { value, onChange } }) => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base">Permissions</FormLabel>
                                            <FormDescription>Cochez les accès que ce rôle doit avoir.</FormDescription>
                                        </div>
                                        <div className="space-y-6">
                                            {Object.entries(permissionGroups).map(([groupName, groupPermissions]) => (
                                                <div key={groupName}>
                                                    <h4 className="font-medium text-sm text-foreground mb-2">{groupName}</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {groupPermissions.map((permission) => (
                                                            <div key={permission} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={value.includes(permission)}
                                                                        onCheckedChange={(checked) => {
                                                                            return checked
                                                                            ? onChange([...value, permission])
                                                                            : onChange(value.filter((p) => p !== permission))
                                                                        }}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="font-normal text-sm">{adminPermissions[permission as AdminPermission]}</FormLabel>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                ))}
                </div>

                <div className="flex justify-between items-center pt-4">
                    <Button type="button" variant="outline" onClick={addNewRole}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Ajouter un rôle
                    </Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || loading}>
                        {(form.formState.isSubmitting || loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enregistrer les rôles
                    </Button>
                </div>
            </form>
            </Form>
        )}

    </div>
  );
}
