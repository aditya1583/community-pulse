"use client";

import React from "react";

type LocationPromptProps = {
  onRequestLocation: () => Promise<boolean>;
  onUseManual: () => void;
  loading?: boolean;
  error?: string | null;
};

/**
 * LocationPrompt Component - Production Version
 * 
 * Optimized for Conversion (CRO):
 * - Clear Value Proposition: "The 10-Mile Radius"
 * - Trust Indicators: "Privacy-first", "Device-local"
 * - Premium Aesthetic: Glassmorphism, Animated Pulses
 */
export default function LocationPrompt({
  onRequestLocation,
  onUseManual,
  loading = false,
  error,
}: LocationPromptProps) {
  return (
    <div className="min-h-screen bg-[#020617] font-sans flex items-center justify-center px-4 overflow-hidden relative">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] -z-10" />

      <div className="max-w-md w-full relative">
        {/* Radar Animation - Enhanced */}
        <div className="flex justify-center mb-10">
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-[ping_3s_linear_infinite]" />
            <div className="absolute inset-4 rounded-full border border-emerald-500/40 animate-[ping_3s_linear_infinite_1s]" />
            <div className="absolute inset-8 rounded-full border border-emerald-500/50 animate-[ping_3s_linear_infinite_2s]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="glass-card premium-border rounded-[2.5rem] p-8 backdrop-blur-xl bg-white/5 border-white/10 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
              Voxlo
            </h1>
            <p className="text-slate-400 font-medium">
              Hyperlocal Monitoring Active.
            </p>
          </div>

          {/* Value Proposition - Focused on 'Aha' */}
          <div className="space-y-5 mb-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 text-xl font-bold">10</span>
              </div>
              <div>
                <h3 className="text-slate-100 font-bold leading-tight">10-Mile Radius</h3>
                <p className="text-slate-400 text-xs">Only see what matters to your immediate community.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 text-xl">✨</span>
              </div>
              <div>
                <h3 className="text-slate-100 font-bold leading-tight">Live Vibes</h3>
                <p className="text-slate-400 text-xs">Traffic, mood, and events unfolding right now.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 text-xl">🔒</span>
              </div>
              <div>
                <h3 className="text-slate-100 font-bold leading-tight">Zero Tracking</h3>
                <p className="text-slate-400 text-xs">Location stays on your device. We never sell data.</p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2">
              <p className="text-red-400 text-sm font-medium text-center">{error}</p>
            </div>
          )}

          {/* Primary Action */}
          <button
            onClick={onRequestLocation}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] transition-all duration-200 shadow-[0_0_30px_rgba(52,211,153,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                <span>Scanning area...</span>
              </>
            ) : (
              <>
                <span className="text-xl">🛰️</span>
                <span>Enter the Radius</span>
              </>
            )}
          </button>

          {/* Secondary Action */}
          <button
            onClick={onUseManual}
            className="w-full mt-4 py-3 px-6 rounded-2xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
          >
            Enter City Manually
          </button>

          {/* Footnote */}
          <p className="text-[10px] text-slate-500 text-center mt-8 uppercase tracking-[0.2em] font-black">
            Hyperlocal Trust Verified
          </p>
        </div>
      </div>
    </div>
  );
}
