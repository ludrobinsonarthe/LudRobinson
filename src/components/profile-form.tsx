
"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRef, useState, useTransition } from "react";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import ImageCropperDialog from "./image-cropper-dialog";

const profileFormSchema = z.object({
  firstName: z.string().min(2, { message: "Le prénom doit comporter au moins 2 caractères." }),
  lastName: z.string().min(2, { message: "Le nom doit comporter au moins 2 caractères." }),
  email: z.string().email({ message: "Veuillez saisir une adresse e-mail valide." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  photo: z.any().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const getInitials = (firstName: string = '', lastName: string = '') => {
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};

export default function ProfileForm() {
  const { user, setUser } = useUser();
  const { toast } = useToast();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.photoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [cropperOpen, setCropperOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');


  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
    },
    mode: "onChange",
  });
  
  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImgSrc(reader.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCroppedImage = (imageBlob: Blob | null) => {
    if (imageBlob) {
        form.setValue('photo', imageBlob);
        setAvatarPreview(URL.createObjectURL(imageBlob));
    }
  }

  function onSubmit(data: ProfileFormValues) {
    if (!user) return;
    startTransition(async () => {
        try {
            let photoUrl = user.photoUrl;
            const photoFile = data.photo;
            let updatedUserData : Partial<User> = {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                address: data.address,
            }

            if (photoFile && photoFile instanceof Blob) {
                photoUrl = URL.createObjectURL(photoFile);
                updatedUserData.photoUrl = photoUrl;
            }

            // Optimistically update user context
            setUser({ ...user, ...updatedUserData } as User);

            toast({
                title: "Profil mis à jour (Simulation)",
                description: "Vos informations ont été enregistrées localement.",
            });
        } catch (error) {
            console.error("Error updating profile:", error);
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible de mettre à jour le profil.",
            });
        }
    });
  }

  if (!user) {
    return <div>Chargement du profil...</div>;
  }

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center gap-6">
            <div className="relative">
                <Avatar className="h-24 w-24 border">
                    <AvatarImage src={avatarPreview || undefined} alt="User avatar" data-ai-hint="user portrait"/>
                    <AvatarFallback className="text-3xl">
                        {getInitials(user.firstName, user.lastName)}
                    </AvatarFallback>
                </Avatar>
                <Button 
                    type="button"
                    size="icon" 
                    className="absolute -bottom-2 -right-2 rounded-full h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Camera className="h-4 w-4"/>
                    <span className="sr-only">Changer la photo</span>
                </Button>
                
                <Input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoChange}
                />
            </div>
            <div className="space-y-1">
                <h2 className="text-2xl font-bold font-headline">{`${user.firstName} ${user.lastName}`}</h2>
                <p className="text-muted-foreground">{user.email}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prénom</FormLabel>
                <FormControl>
                  <Input placeholder="Votre prénom" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom</FormLabel>
                <FormControl>
                  <Input placeholder="Votre nom de famille" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse e-mail</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} />
                </FormControl>
                <FormDescription>
                    Vous pouvez modifier votre adresse e-mail.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input placeholder="+242 XX XXX XX XX" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse</FormLabel>
                <FormControl>
                  <Input placeholder="Votre adresse" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Enregistrer les modifications
          </Button>
        </div>
      </form>
    </Form>

    <ImageCropperDialog
        isOpen={cropperOpen}
        setIsOpen={setCropperOpen}
        imgSrc={imgSrc}
        onCropped={handleCroppedImage}
    />
    </>
  );
}
