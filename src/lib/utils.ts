import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;

    // This check is to avoid trying to fetch from placeholder sites or other external domains
    // that are not configured for cross-origin requests. We only want to process our own storage images.
    // The new Firebase Storage URLs might not contain 'firebasestorage.googleapis.com' but something like 'storage.googleapis.com'
    if (!url.includes('googleapis.com')) {
      // Allow picsum.photos for mock data/placeholders
      if(!url.includes('picsum.photos')) {
        console.warn("Skipping image conversion for non-Google API URL:", url);
        return null;
      }
    }

    try {
        // Adding a timestamp to bypass potential browser caching issues with CORS responses.
        const uncachedUrl = new URL(url);
        uncachedUrl.searchParams.append('t', new Date().getTime().toString());

        const response = await fetch(uncachedUrl.toString());
        
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
