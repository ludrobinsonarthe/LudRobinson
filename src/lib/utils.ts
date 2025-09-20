import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string, defaultLogo: string = '/logo.png'): Promise<string> {
    if (!url) return defaultLogo;

    // Use a proxy for CORS issues in development or if needed
    // const proxyUrl = '/api/image-proxy?url=';
    // const fetchUrl = url.startsWith('http') ? `${proxyUrl}${encodeURIComponent(url)}` : url;

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
        console.error("Failed to convert image to data URL:", error);
        // Fallback to a default local logo if fetching fails
        return defaultLogo;
    }
}
