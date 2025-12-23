"use client";

import React from "react";

type HeaderProps = {
  cityName: string;
  isLive?: boolean;
};

/**
 * Header component with neon theme styling
 *
 * Left: Emerald gradient Radio icon + City name + "5-MILE RADIUS ACTIVE"
 * Right: LIVE badge with pulsing green dot
 */
export default function Header({ cityName, isLive = true }: HeaderProps) {
  // Extract just the city name without state/country
  const displayCity = cityName.split(",")[0]?.trim() || cityName;

  return (
    <header className="flex items-center justify-between px-4 py-3">
      {/* Left side: Icon + City + Radius indicator */}
      <div className="flex items-center gap-3">
        {/* Radio/Signal icon with emerald gradient */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <svg
            className="w-5 h-5 text-slate-950"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
          </svg>
        </div>

        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-white tracking-tight">
            {displayCity}
          </h1>
          <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
            5-Mile Radius Active
          </span>
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
