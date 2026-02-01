
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
    // But in local dev, always stay relative to avoid CORS and port issues
    const isLocal = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (process.env.NEXT_PUBLIC_BASE_URL && !isLocal) {
        return `${process.env.NEXT_PUBLIC_BASE_URL}${cleanPath}`;
    }

    return cleanPath;
}
