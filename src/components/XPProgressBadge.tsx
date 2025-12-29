"use client";

import React from "react";
import { getTierFromRank, levelProgress, type TierInfo } from "@/lib/gamification";

type XPProgressBadgeProps = {
  level: number;
  xp: number;
  weeklyRank: number | null;
  onClick?: () => void;
  className?: string;
};

/**
 * XPProgressBadge - Compact level indicator with progress bar
 *
 * Displays:
 * - Current level (e.g., "Lv.12")
 * - Progress bar to next level
 * - Tier-colored styling if ranked (Diamond/Gold/Silver/Bronze)
 *
 * Tappable to navigate to Status tab
 */
export default function XPProgressBadge({
  level,
  xp,
  weeklyRank,
  onClick,
  className = "",
}: XPProgressBadgeProps) {
  const tier = getTierFromRank(weeklyRank);
  const progress = levelProgress(xp);
  const isRanked = tier.name !== "none";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${
        isRanked
          ? `bg-gradient-to-r ${tier.ringColor} hover:shadow-md ${tier.glowColor}`
          : "bg-slate-800/80 border border-slate-700/50 hover:border-emerald-500/50"
      } ${className}`}
      title={`Level ${level} • ${Math.round(progress)}% to next level • Tap for status`}
    >
      {/* Level badge */}
      <span
        className={`text-[11px] font-bold ${
          isRanked ? "text-slate-900" : "text-slate-300"
        }`}
      >
        Lv.{level}
      </span>

      {/* Progress bar container */}
      <div
        className={`w-10 h-1.5 rounded-full overflow-hidden ${
          isRanked ? "bg-slate-900/30" : "bg-slate-700/50"
        }`}
      >
        {/* Progress fill */}
        <div
          className={`h-full rounded-full transition-all ${
            isRanked
              ? "bg-slate-900/70"
              : "bg-gradient-to-r from-emerald-500 to-emerald-400"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Tier indicator for ranked users */}
      {isRanked && (
        <span className="text-[9px] font-bold text-slate-900/80 uppercase tracking-wide">
          {tier.label}
        </span>
      )}
    </button>
  );
}
