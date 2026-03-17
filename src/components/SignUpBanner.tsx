"use client";

import React, { useEffect, useState } from "react";

const DISMISSED_KEY = "voxlo-signup-banner-dismissed";

type SignUpBannerProps = {
  onSignUpClick: () => void;
};

export default function SignUpBanner({ onSignUpClick }: SignUpBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // localStorage unavailable — just hide in-session
    }
  };

  if (!visible) return null;

  return (
    <div className="animate-in fade-in duration-500 mx-4 mb-3">
      <div className="relative flex items-center gap-3 px-4 py-3 bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl shadow-lg">
        {/* Bell icon */}
        <span className="text-xl shrink-0" aria-hidden="true">🔔</span>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-100 leading-tight">Get real-time alerts</p>
          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
            Sign up to receive traffic updates, weather alerts, and posts from your neighborhood.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onSignUpClick}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-[11px] font-black uppercase tracking-widest shadow-md shadow-emerald-500/20 active:scale-95 transition-all whitespace-nowrap"
        >
          Sign up — it&apos;s free
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
