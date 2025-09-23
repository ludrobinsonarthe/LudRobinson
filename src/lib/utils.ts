import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;

    // This check is to avoid trying to fetch from placeholder sites or other external domains
    // if they are not configured for cross-origin requests. We only want to process our own storage images.
    if (!url.includes('firebasestorage.googleapis.com')) {
      console.warn("Skipping image conversion for non-Firebase URL:", url);
      return null;
    }

    try {
        const response = await fetch(url);
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
        console.error("Error converting image to data URL:", error);
        return null; // Return null if fetching or conversion fails
    }
}
