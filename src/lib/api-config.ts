
export const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // If we have a base URL (like in Capacitor), use it.
    // Otherwise, use relative path for web (default browser behavior).
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return `${process.env.NEXT_PUBLIC_BASE_URL}${cleanPath}`;
    }

    return cleanPath;
}
