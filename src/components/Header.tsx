"use client";

import React from "react";
import RadarPulse from "./RadarPulse";

type HeaderProps = {
  cityName: string;
  isLive?: boolean;
  radiusMiles?: number;
};

/**
 * Header component with neon theme styling
 *
 * Left: City name + Animated radar visualization showing active scanning
 * Right: LIVE badge with pulsing green dot
 *
 * The radar animation replaces the static "5-MILE RADIUS ACTIVE" text,
 * providing visual proof that the app is actively monitoring the area.
 */
export default function Header({ cityName, isLive = true, radiusMiles = 10 }: HeaderProps) {
  // Show full "City, ST" format to avoid Springfield trap
  // Only strip country if it's included (e.g., "Austin, TX, US" → "Austin, TX")
  const parts = cityName.split(",").map(p => p.trim());
  const displayCity = parts.length > 2
    ? `${parts[0]}, ${parts[1]}`  // "Austin, TX, US" → "Austin, TX"
    : cityName;                    // Already "Austin, TX" or just "Austin"

  return (
    <header className="flex items-center gap-4">
      {/* Animated radar replacing static icon */}
      <div className="relative">
        <RadarPulse
          radiusMiles={radiusMiles}
          isScanning={isLive}
          size="md"
        />
        {/* Subtle glow behind radar */}
        <div className="absolute inset-0 bg-emerald-500/20 blur-xl -z-10" />
      </div>

      <div className="flex flex-col flex-1">
        <h1 className="text-2xl font-black text-white tracking-tighter leading-none">
          {displayCity}
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">
          Local Monitoring Active
        </p>
      </div>

      {/* LIVE badge - moved inside header to stay with city info */}
      {isLive && (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="relative flex h-1 w-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500" />
          </span>
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.1em]">
            Live
          </span>
        </div>
      )}
    </header>
  );
}
