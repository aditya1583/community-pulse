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
 * Compact layout: Radar + City name with integrated LIVE indicator
 * The LIVE badge is now a subtle dot next to the city name, not a separate element
 * This prevents awkward proximity with the Sign In button in the parent layout
 */
export default function Header({ cityName, isLive = true, radiusMiles = 10 }: HeaderProps) {
  // Show full "City, ST" format to avoid Springfield trap
  // Only strip country if it's included (e.g., "Austin, TX, US" → "Austin, TX")
  const parts = cityName.split(",").map(p => p.trim());
  const displayCity = parts.length > 2
    ? `${parts[0]}, ${parts[1]}`  // "Austin, TX, US" → "Austin, TX"
    : cityName;                    // Already "Austin, TX" or just "Austin"

  return (
    <header className="flex items-center gap-3">
      {/* Animated radar replacing static icon */}
      <div className="relative flex-shrink-0">
        <RadarPulse
          radiusMiles={radiusMiles}
          isScanning={isLive}
          size="md"
        />
        {/* Subtle glow behind radar */}
        <div className="absolute inset-0 bg-emerald-500/20 blur-xl -z-10" />
      </div>

      <div className="flex flex-col min-w-0">
        {/* City name with integrated LIVE indicator */}
        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-none truncate">
            {displayCity}
          </h1>
          {/* Subtle LIVE dot - integrated with city name */}
          {isLive && (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 mt-0.5">
          {radiusMiles}-Mile Radius Active
        </p>
      </div>
    </header>
  );
}
