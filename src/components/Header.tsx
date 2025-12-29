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
export default function Header({ cityName, isLive = true, radiusMiles = 5 }: HeaderProps) {
  // Extract just the city name without state/country
  const displayCity = cityName.split(",")[0]?.trim() || cityName;

  return (
    <header className="flex items-center justify-between px-4 py-3">
      {/* Left side: City name + Radar visualization */}
      <div className="flex items-center gap-3">
        {/* Animated radar replacing static icon */}
        <RadarPulse
          radiusMiles={radiusMiles}
          isScanning={isLive}
          size="md"
        />

        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-white tracking-tight">
            {displayCity}
          </h1>
        </div>
      </div>

      {/* Right side: LIVE badge */}
      {isLive && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
            Live
          </span>
        </div>
      )}
    </header>
  );
}
