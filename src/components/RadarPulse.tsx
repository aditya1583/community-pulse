"use client";

import React from "react";

type RadarPulseProps = {
  radiusMiles?: number;
  isScanning?: boolean;
  size?: "sm" | "md" | "lg";
};

/**
 * RadarPulse - Animated radar visualization
 *
 * Replaces static "5-mile radius active" text with a living, breathing
 * visualization that communicates active monitoring.
 *
 * Design:
 * - Concentric circles pulsing outward (sonar effect)
 * - Center dot representing user location
 * - Subtle glow that indicates active scanning
 * - Pure CSS animations for performance
 */
export default function RadarPulse({
  radiusMiles = 10,
  isScanning = true,
  size = "sm",
}: RadarPulseProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  // Staggered delays for pulse rings create the sonar effect
  const ringDelays = [0, 0.6, 1.2];

  return (
    <div className="flex items-center gap-2">
      {/* Radar visualization */}
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Background circle */}
        <div className="absolute inset-0 rounded-full bg-emerald-950/30 border border-emerald-500/20" />

        {/* Animated pulse rings - using Tailwind animate-ping with custom delays */}
        {isScanning && ringDelays.map((delay, index) => (
          <div
            key={index}
            className="absolute inset-0 rounded-full border border-emerald-400/40 animate-[radar-ping_2.5s_ease-out_infinite]"
            style={{
              animationDelay: `${delay}s`,
            }}
          />
        ))}

        {/* Radar sweep line */}
        {isScanning && (
          <div
            className="absolute inset-0 origin-center animate-[spin_3s_linear_infinite]"
          >
            <div
              className="absolute top-1/2 left-1/2 h-[1px] bg-gradient-to-r from-emerald-400/80 to-transparent origin-left"
              style={{
                width: "50%",
                transform: "translateY(-50%)",
              }}
            />
          </div>
        )}

        {/* Center dot (user location) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50">
          {isScanning && (
            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          )}
        </div>
      </div>

      {/* Radius text */}
      <div className="flex flex-col">
        <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider leading-tight">
          {radiusMiles}-Mile Radius
        </span>
        <span className="text-[10px] text-emerald-500/70 font-mono uppercase tracking-wide">
          {isScanning ? "Scanning" : "Paused"}
        </span>
      </div>
    </div>
  );
}
