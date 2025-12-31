"use client";

import React from "react";

type LocationPromptProps = {
  onRequestLocation: () => Promise<boolean>;
  onUseManual: () => void;
  loading?: boolean;
  error?: string | null;
};

/**
 * LocationPrompt Component
 *
 * Displayed when the app needs location permission from the user.
 * Offers two paths:
 * 1. Grant geolocation permission for hyperlocal experience
 * 2. Enter city manually (fallback)
 *
 * The prompt is friendly and explains the value of sharing location.
 */
export default function LocationPrompt({
  onRequestLocation,
  onUseManual,
  loading = false,
  error,
}: LocationPromptProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Radar Animation */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            {/* Outer pulse rings */}
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-ping" style={{ animationDelay: "0.3s" }} />
            <div className="absolute inset-4 rounded-full bg-emerald-500/40 animate-ping" style={{ animationDelay: "0.6s" }} />
            {/* Center point */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Community Pulse
          </h1>
          <p className="text-slate-400 text-center mb-6">
            Your hyperlocal neighborhood companion
          </p>

          {/* Value Proposition */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-400 text-lg">📍</span>
              <span className="text-slate-300">5-mile radius of local updates</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-400 text-lg">⚡</span>
              <span className="text-slate-300">Real-time traffic, events & news</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-400 text-lg">🏘️</span>
              <span className="text-slate-300">See what your neighbors are saying</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Location Button */}
          <button
            onClick={onRequestLocation}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Finding your location...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Use My Location</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-700/50" />
            <span className="text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-slate-700/50" />
          </div>

          {/* Manual Entry Button */}
          <button
            onClick={onUseManual}
            className="w-full py-3 px-4 rounded-xl font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 hover:border-slate-500/50 transition-all duration-200"
          >
            Enter City Manually
          </button>

          {/* Privacy Note */}
          <p className="text-xs text-slate-500 text-center mt-4">
            Your location stays on your device. We only use it to show nearby content.
          </p>
        </div>
      </div>
    </div>
  );
}
