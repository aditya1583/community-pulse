import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { CapacitorProvider } from "@/components/CapacitorProvider";

// Premium modern font
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Voxlo | Hyperlocal Vibes & Community Pulse",
  description: "Real-time updates, vibes, and community pulses within 10 miles of your location. Stay hyper-connected with Voxlo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Voxlo",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Voxlo - Local Vibes within 10 Miles",
    description: "What's the vibe in your neighborhood? Check Voxlo for real-time hyperlocal pulses.",
    url: "https://voxlo.app",
    siteName: "Voxlo",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voxlo | Hyperlocal Vibes",
    description: "Real-time updates within 10 miles. Stay hyper-connected.",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} font-sans antialiased bg-slate-950 text-slate-50`}
      >
        <CapacitorProvider>
          <ServiceWorkerRegister />
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <main className="flex-1">{children}</main>

            <footer className="border-t border-white/5 bg-white/5 backdrop-blur-md text-sm text-slate-400">
              <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1 items-center sm:items-start">
                  <span className="text-xs opacity-60">
                    Built for the 10-mile radius. Trust your neighbors.
                  </span>
                </div>

                <div className="flex justify-center gap-6 text-slate-400 sm:justify-end">
                  <a
                    href="/privacy"
                    className="transition hover:text-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                  >
                    Privacy
                  </a>
                  <a
                    href="/terms"
                    className="transition hover:text-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                  >
                    Terms
                  </a>
                  <span className="opacity-30">v1.0.0</span>
                </div>
              </div>
            </footer>
          </div>
        </CapacitorProvider>
      </body>
    </html>
  );
}
