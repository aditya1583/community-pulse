import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Capacitor requires static export
  // We only turn this on when building for the app
  output: process.env.NEXT_PUBLIC_EXPORT_MODE === 'true' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: process.env.NEXT_PUBLIC_EXPORT_MODE === 'true' ? true : false,
  },

  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
