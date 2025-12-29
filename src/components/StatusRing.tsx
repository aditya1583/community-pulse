"use client";

import React from "react";
import { type TierInfo, TIERS, getTierFromRank } from "@/lib/gamification";

type StatusRingProps = {
  /** Content to display inside the ring (usually emoji or avatar) */
  children: React.ReactNode;
  /** Weekly leaderboard rank (determines tier) */
  rank?: number | null;
  /** User's level (displayed as badge if showLevel is true) */
  level?: number;
  /** Whether to show level badge */
  showLevel?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional tier override (skips rank calculation) */
  tier?: TierInfo;
  /** Additional class names */
  className?: string;
};

/**
 * StatusRing - A visual indicator of user status
 *
 * Displays a gradient ring around content based on weekly leaderboard rank.
 * Diamond (Top 3): Cyan/white shimmer with strong glow
 * Gold (Top 10): Amber/yellow gradient with warm glow
 * Silver (Top 25): Slate/white gradient with subtle glow
 * Bronze (Top 50): Orange/amber gradient with soft glow
 * None: Simple slate border
 *
 * Usage:
 * <StatusRing rank={5} level={12} showLevel>
 *   <span className="text-2xl">😊</span>
 * </StatusRing>
 */
export default function StatusRing({
  children,
  rank,
  level = 1,
  showLevel = false,
  size = "md",
  tier: tierOverride,
  className = "",
}: StatusRingProps) {
  const tier = tierOverride ?? getTierFromRank(rank ?? null);
  const isTopTier = tier.name === "diamond" || tier.name === "gold";

  // Size configurations
  const sizes = {
    sm: {
      ring: "w-8 h-8",
      inner: "w-6 h-6",
      border: "2px",
      levelBadge: "text-[8px] -bottom-1 -right-1 w-4 h-4",
      glow: isTopTier ? "shadow-md" : "",
    },
    md: {
      ring: "w-10 h-10",
      inner: "w-8 h-8",
      border: "2px",
      levelBadge: "text-[9px] -bottom-0.5 -right-0.5 w-4 h-4",
      glow: isTopTier ? "shadow-lg" : "",
    },
    lg: {
      ring: "w-14 h-14",
      inner: "w-11 h-11",
      border: "3px",
      levelBadge: "text-[10px] -bottom-0.5 -right-0.5 w-5 h-5",
      glow: isTopTier ? "shadow-xl" : "",
    },
  };

  const s = sizes[size];

  // For "none" tier, use simple styling
  if (tier.name === "none") {
    return (
      <div className={`relative inline-flex ${className}`}>
        <div
          className={`${s.ring} rounded-xl bg-slate-900/80 border border-slate-700/50 flex items-center justify-center`}
        >
          <div className={`${s.inner} flex items-center justify-center`}>
            {children}
          </div>
        </div>
        {showLevel && level > 1 && (
          <div
            className={`absolute ${s.levelBadge} bg-slate-700 text-slate-300 rounded-full flex items-center justify-center font-bold`}
          >
            {level}
          </div>
        )}
      </div>
    );
  }

  // Tiered styling with gradient ring
  return (
    <div className={`relative inline-flex ${className}`}>
      {/* Outer gradient ring */}
      <div
        className={`${s.ring} ${s.glow} ${tier.glowColor} rounded-xl bg-gradient-to-br ${tier.ringColor} p-[${s.border}] flex items-center justify-center`}
        style={{ padding: s.border }}
      >
        {/* Inner content area */}
        <div
          className={`${s.inner} rounded-lg bg-slate-900/95 flex items-center justify-center`}
        >
          {children}
        </div>
      </div>

      {/* Level badge */}
      {showLevel && (
        <div
          className={`absolute ${s.levelBadge} ${tier.badgeColor} rounded-full flex items-center justify-center font-bold shadow-sm`}
        >
          {level}
        </div>
      )}

      {/* Animated shimmer for diamond tier */}
      {tier.name === "diamond" && (
        <div
          className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
  );
}

/**
 * StatusRingPreview - Shows all tier styles for reference
 * Useful for development/testing
 */
export function StatusRingPreview() {
  const tiers = [
    { rank: 1, label: "Diamond (#1)" },
    { rank: 5, label: "Gold (#5)" },
    { rank: 15, label: "Silver (#15)" },
    { rank: 30, label: "Bronze (#30)" },
    { rank: 100, label: "None (#100)" },
  ];

  return (
    <div className="flex flex-wrap gap-6 p-4 bg-slate-900 rounded-xl">
      {tiers.map(({ rank, label }) => (
        <div key={rank} className="flex flex-col items-center gap-2">
          <StatusRing rank={rank} level={12} showLevel size="lg">
            <span className="text-2xl">😊</span>
          </StatusRing>
          <span className="text-xs text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact status indicator for inline use (e.g., next to username)
 */
export function StatusIndicator({
  rank,
  level,
  className = "",
}: {
  rank?: number | null;
  level?: number;
  className?: string;
}) {
  const tier = getTierFromRank(rank ?? null);

  if (tier.name === "none") {
    if (level && level > 1) {
      return (
        <span
          className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-slate-700 text-slate-300 rounded ${className}`}
        >
          Lv.{level}
        </span>
      );
    }
    return null;
  }

  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold ${tier.badgeColor} rounded shadow-sm ${className}`}
    >
      {tier.label}
      {level && level > 1 && <span className="ml-1 opacity-80">Lv.{level}</span>}
    </span>
  );
}
