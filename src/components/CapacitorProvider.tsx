
"use client";

import { useEffect } from 'react';

export function CapacitorProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Only run on client
        if (typeof window === 'undefined') return;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        if (!baseUrl) return;

        // Check if we're running in Capacitor (or just apply it if baseUrl is set, which only happens in Capacitor build)
        const isCapacitor = (window as any).Capacitor ||
            window.location.protocol === 'capacitor:' ||
            window.location.protocol === 'file:';

        if (isCapacitor) {
            console.log('Voxlo: Capacitor detected, intercepting fetch calls for baseUrl:', baseUrl);

            const originalFetch = window.fetch;
            window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
                if (typeof input === 'string' && input.startsWith('/api/')) {
                    const newUrl = `${baseUrl}${input}`;
                    return originalFetch(newUrl, init);
                }
                return originalFetch(input, init);
            };
        }
    }, []);

    return <>{children}</>;
}
