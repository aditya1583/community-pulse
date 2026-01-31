
"use client";

import { useEffect } from 'react';

// Hardcoded fallback for when NEXT_PUBLIC_BASE_URL isn't inlined at build time
// This is the Vercel deployment that serves API routes
const CAPACITOR_API_BACKEND = "https://voxlo-theta.vercel.app";

export function CapacitorProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isCapacitor = !!(
            (window as any).Capacitor ||
            window.location.protocol === 'capacitor:' ||
            window.location.protocol === 'file:'
        );

        if (!isCapacitor) return;

        // Use build-time env var if available, otherwise fall back to hardcoded backend
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || CAPACITOR_API_BACKEND;

        console.log('[Voxlo] Capacitor detected, routing API calls to:', baseUrl);

        const originalFetch = window.fetch;
        window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
            if (typeof input === 'string' && input.startsWith('/api/')) {
                const newUrl = `${baseUrl}${input}`;
                console.log(`[Voxlo] Redirecting ${input} → ${newUrl}`);
                return originalFetch(newUrl, init);
            }
            if (typeof input === 'string' && input.startsWith('/')) {
                // Also handle other absolute paths (e.g. /manifest.webmanifest)
                return originalFetch(input, init);
            }
            return originalFetch(input, init);
        };
    }, []);

    return <>{children}</>;
}
