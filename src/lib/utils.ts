import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;

    if (url.startsWith('data:')) return url;

    // Use a proxy if available for CORS issues, otherwise, fetch directly.
    // In a real production app, you might use a server-side proxy.
    // For this demo, we'll fetch directly and rely on proper CORS configuration.
    try {
        // Appending a cache-busting parameter can sometimes help with CORS-cached responses.
        const fetchUrl = new URL(url);
        fetchUrl.searchParams.append('t', new Date().getTime().toString());
        
        const response = await fetch(fetchUrl.href, { cache: 'no-store' });
        
        if (!response.ok) {
            console.error(`Failed to fetch image from ${url}. Status: ${response.statusText}`);
            return null; // Return null if fetch fails
        }
        
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    } catch (error) {
        console.error(`Error converting image to data URL for ${url}. This might be a CORS issue.`, error);
        console.warn("To resolve CORS issues, ensure the storage bucket (e.g., Firebase Storage) is configured to allow cross-origin requests from this web app's domain.");
        return null; // Return null on any error
    }
}
