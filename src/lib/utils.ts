
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function imageToDataUrl(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;

    // If it's already a data URL, return it directly
    if (url.startsWith('data:')) return url;

    // Use a CORS proxy to bypass browser security restrictions on fetching cross-origin images.
    // This is a common and necessary step for client-side PDF generation when images are hosted on different domains.
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            console.error(`Failed to fetch image via proxy from ${url}. Status: ${response.statusText}`);
            // Attempt to fetch directly as a fallback
            try {
                const directResponse = await fetch(url);
                if(!directResponse.ok) {
                    console.error(`Direct fetch for image ${url} also failed. Status: ${directResponse.statusText}`);
                    return null;
                }
                const blob = await directResponse.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch(directError) {
                console.error(`Direct fetch for image ${url} threw an error.`, directError);
                return null;
            }
        }
        
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    } catch (error) {
        console.error(`Error converting image to data URL for ${url} using proxy.`, error);
        return null;
    }
}
