import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string, defaultLogo: string = '/logo.png'): Promise<string> {
    // If the URL is remote, it's likely for a PDF generation.
    // Client-side PDF generation with remote images from Firebase Storage can cause CORS issues.
    // To prevent this, we will always use the local logo for PDF generation.
    if (url.startsWith('http')) {
        const localLogoUrl = new URL(defaultLogo, window.location.origin).toString();
        try {
            const response = await fetch(localLogoUrl);
            if (!response.ok) throw new Error('Failed to fetch local logo');
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Could not fetch local logo, returning path:", error);
            return defaultLogo; // Fallback to path if fetch fails.
        }
    }

    // For local URLs or if the initial check fails, try fetching directly.
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Failed to convert image to data URL from ${url}:`, error);
        return defaultLogo; // Fallback if anything goes wrong.
    }
}
