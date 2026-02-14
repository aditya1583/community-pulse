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
  themeColor: "#000000",
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
        className={`${outfit.variable} font-sans antialiased bg-black text-slate-50`}
      >
        <CapacitorProvider>
          <ServiceWorkerRegister />
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <main className="flex-1">{children}</main>

            {/* Footer lives in page.tsx to avoid duplication */}
          </div>
        </CapacitorProvider>
      </body>
    </html>
  );
}
