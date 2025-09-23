import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;

    // For local assets or already data URLs
    if (url.startsWith('/') || url.startsWith('data:')) {
        // This part needs to be handled carefully. For local files, we can't fetch them directly on the client
        // unless they are in the public folder. Assuming they are accessible via a web request.
        // Or if it's already a data URL, just return it.
        if (url.startsWith('data:')) return url;
        
        // Attempt to fetch local files. This assumes the Next.js server serves them.
        try {
            const response = await fetch(url);
             if (!response.ok) {
                console.error(`Failed to fetch local image: ${response.statusText}`);
                return null;
            }
            const blob = await response.blob();
             return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Error fetching local image to convert to data URL:", error);
            return null;
        }

    }


    // For external URLs, especially Firebase Storage
    // The new Firebase Storage URLs might not contain 'firebasestorage.googleapis.com' but something like 'storage.googleapis.com'
    if (!url.includes('googleapis.com') && !url.includes('picsum.photos')) {
        console.warn("Skipping image conversion for non-approved external URL:", url);
        return null;
    }


    try {
        // Adding a timestamp to bypass potential browser caching issues with CORS responses.
        const uncachedUrl = new URL(url);
        uncachedUrl.searchParams.append('t', new Date().getTime().toString());

        const response = await fetch(uncachedUrl.toString(), { cache: 'no-store'});
        
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting image to data URL. This is likely a CORS issue.", error);
        console.warn("To fix this, you need to configure CORS on your Firebase Storage bucket. See Firebase documentation for details.");
        return null; // Return null if fetching or conversion fails
    }
}
