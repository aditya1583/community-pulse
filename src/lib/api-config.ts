
export const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function getApiUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Always return relative path for /api/ routes.
    // CapacitorProvider's fetch interceptor handles routing these
    // to the Vercel backend when running inside Capacitor.
    // Returning full URLs here would bypass that interceptor.
    if (cleanPath.startsWith('/api/')) {
        return cleanPath;
    }

    // Non-API paths: use base URL if available
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        return `${process.env.NEXT_PUBLIC_BASE_URL}${cleanPath}`;
    }

    return cleanPath;
}
