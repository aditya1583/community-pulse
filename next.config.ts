import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Capacitor requires static export
  // We only turn this on when building for the app
  output: process.env.NEXT_PUBLIC_EXPORT_MODE === 'true' ? 'export' : undefined,
  // Only enable trailing slashes for static export (Capacitor local files need it)
  // In Vercel production mode, this causes 308 redirects on API routes that break Capacitor fetch
  trailingSlash: process.env.NEXT_PUBLIC_EXPORT_MODE === 'true',
  images: {
    unoptimized: process.env.NEXT_PUBLIC_EXPORT_MODE === 'true' ? true : false,
  },

  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },

  // CORS headers for Capacitor iOS app
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        // Prevent WKWebView from caching stale HTML/JS
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
