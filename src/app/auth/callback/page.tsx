"use client";

import { useEffect, useState } from "react";

/**
 * Auth Callback Page
 * 
 * Supabase redirects here after email verification/password reset.
 * This page:
 * 1. Extracts the auth tokens from the URL hash fragment
 * 2. Tries to open the Voxlo app via custom URL scheme (voxlo://)
 * 3. Falls back to redirecting to the main web app if not on mobile
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"redirecting" | "fallback">("redirecting");

  useEffect(() => {
    // Supabase puts tokens in the hash fragment: #access_token=...&refresh_token=...&type=signup
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (accessToken) {
      // Try to open the app via custom URL scheme
      const appUrl = `voxlo://auth/callback#access_token=${accessToken}&refresh_token=${refreshToken || ""}&type=${type || ""}`;
      
      // Attempt app redirect
      window.location.href = appUrl;

      // If we're still here after 2 seconds, the app didn't open — fall back to web
      setTimeout(() => {
        setStatus("fallback");
        // Redirect to main app with the tokens so web auth still works
        window.location.href = `/${hash ? "#" + hash : ""}`;
      }, 2000);
    } else {
      // No token — just go to home
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center p-8">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h1 className="text-white text-xl font-bold mb-2">
          {status === "redirecting" ? "Opening Voxlo..." : "Redirecting..."}
        </h1>
        <p className="text-slate-400 text-sm">
          {status === "redirecting"
            ? "Taking you back to the app"
            : "Opening Voxlo in your browser"}
        </p>
        {status === "fallback" && (
          <a
            href="/"
            className="inline-block mt-4 px-6 py-2 bg-emerald-500 text-black font-bold rounded-full text-sm"
          >
            Open Voxlo
          </a>
        )}
      </div>
    </div>
  );
}
