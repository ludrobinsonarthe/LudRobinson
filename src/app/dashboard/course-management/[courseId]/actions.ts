'use server';

import { db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { revalidatePath } from "next/cache";

export async function uploadCourseDocument(courseId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const file = formData.get('document') as File;

    if (!file) {
        return { success: false, error: 'Aucun fichier trouvé.' };
    }
     if (file.size === 0) {
        return { success: false, error: 'Le fichier est vide.' };
    }

    try {
        const filePath = `courses/${courseId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        const fileRef = ref(storage, filePath);
        
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        await uploadBytes(fileRef, fileBuffer, { contentType: file.type });
        const newDocumentUrl = await getDownloadURL(fileRef);

        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);
        if(!courseSnap.exists()) {
            return { success: false, error: 'Cours introuvable.' };
        }
        
        const courseData = courseSnap.data();
        const updatedDocuments = [...(courseData.documents || []), newDocumentUrl];
        await updateDoc(courseRef, { documents: updatedDocuments });
        
        revalidatePath(`/dashboard/course-management/${courseId}`);
        return { success: true };

    } catch (error) {
        console.error("Server Action - Error uploading file:", error);
        return { success: false, error: "Une erreur est survenue sur le serveur." };
    }
}
