import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string, defaultLogo: string = '/logo.png'): Promise<string> {
    if (!url) return defaultLogo;

    let fetchUrl = url;

    // Handle relative URLs on the server by creating an absolute URL
    if (url.startsWith('/') && typeof window === 'undefined') {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:9002';
        fetchUrl = new URL(url, baseUrl).toString();
    }
    
    try {
        const response = await fetch(fetchUrl);
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
        console.error(`Failed to convert image to data URL from ${fetchUrl}:`, error);
        // Fallback to a default local logo if fetching fails
        return defaultLogo;
    }
}
