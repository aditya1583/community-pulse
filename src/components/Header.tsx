"use client";

import React from "react";
import RadarPulse from "./RadarPulse";

type HeaderProps = {
  cityName: string;
  isLive?: boolean;
  radiusMiles?: number;
};

/**
 * Header component — compact layout
 * Radar (small) + City name + LIVE dot
 */
export default function Header({ cityName, isLive = true, radiusMiles = 10 }: HeaderProps) {
  // Strip country if included (e.g., "Austin, TX, US" → "Austin, TX")
  const parts = cityName.split(",").map(p => p.trim());
  const displayCity = parts.length > 2
    ? `${parts[0]}, ${parts[1]}`
    : cityName;

  return (
    <header className="flex items-center gap-2">
      {/* Compact radar */}
      <div className="relative flex-shrink-0">
        <RadarPulse
          radiusMiles={radiusMiles}
          isScanning={isLive}
          size="sm"
        />
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 className="text-base font-black text-white tracking-tight leading-none whitespace-nowrap">
            {displayCity}
          </h1>
          {isLive && (
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
          )}
        </div>
        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
          {radiusMiles}mi radius
        </p>
      </div>
    </header>
  );
}
