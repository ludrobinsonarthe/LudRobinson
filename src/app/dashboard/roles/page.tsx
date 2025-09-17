
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
import { useToast } from "@/hooks/use-toast";
import { AdminRole, adminPermissions, AdminPermission } from "@/lib/types";
import { Loader2, PlusCircle, ShieldCheck, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDescription } from "@/components/ui/form";
import { useUser } from "@/hooks/use-user";

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
    'Général': ['view_reporting', 'manage_admin_settings'],
    'Pédagogie': ['manage_students', 'manage_teachers', 'manage_course', 'manage_grades', 'manage_attendance'],
    'Finances': ['manage_tuition', 'manage_fees', 'manage_salaries', 'manage_cash_flow'],
    'Système': ['manage_users', 'manage_roles']
}

export default function RolesPage() {
  const { roles: initialRoles, loading: loadingRoles, setUsers, users } = useUser();
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<RolesFormValues>({
    resolver: zodResolver(rolesFormSchema),
    defaultValues: {
      roles: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "roles",
  });

  useEffect(() => {
    if (!loadingRoles) {
        replace(initialRoles);
    }
  }, [initialRoles, loadingRoles, replace]);

  const onSubmit = async (data: RolesFormValues) => {
    setSubmitting(true);
    // This is a simulation, we just update the local state for now
    const updatedUsers = users.map(u => {
        if(u.role === 'admin' && u.admin?.roleId && !data.roles.find(r => r.id === u.admin?.roleId)) {
            return { ...u, admin: { ...u.admin, roleId: ''}};
        }
        return u;
    });
    // This is a hacky way to update roles, but since we use mock data it's fine
    // @ts-ignore
    setUsers(updatedUsers);

    setTimeout(() => {
        toast({ title: "Rôles mis à jour (Simulation)", description: "Les permissions ont été enregistrées localement." });
        setSubmitting(false);
    }, 1000);
  };

  const addNewRole = () => {
    const newId = `role_${Date.now()}`;
    append({
        id: newId,
        name: "",
        permissions: []
    });
  }

  const removeRole = async (index: number) => {
    remove(index);
    toast({ title: "Rôle supprimé (Simulation)" });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Gestion des Rôles & Permissions</h1>
        <p className="text-muted-foreground">
          Créez des rôles administratifs et attribuez-leur des permissions spécifiques pour sécuriser l'accès à l'application.
        </p>
      </div>

       {loadingRoles ? (
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
                                                        {(groupPermissions as AdminPermission[]).map((permission) => (
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
                                                                <FormLabel className="font-normal text-sm">{adminPermissions[permission]}</FormLabel>
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
                    <Button type="submit" disabled={form.formState.isSubmitting || submitting}>
                        {(form.formState.isSubmitting || submitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enregistrer les rôles
                    </Button>
                </div>
            </form>
            </Form>
        )}

    </div>
  );
}

    