"use client";

import React from "react";
import StatusRing from "./StatusRing";
import { BadgeGrid } from "./BadgeDisplay";
import { UserRankCard } from "./Leaderboard";
import {
  formatXP,
  levelProgress,
  xpForLevel,
  type UserBadge,
  type TierInfo,
  type UserStats,
} from "@/lib/gamification";

type UserProfileCardProps = {
  username: string;
  level: number;
  xp: number;
  tier: TierInfo;
  weeklyRank: number | null;
  stats: UserStats | null;
  badges: UserBadge[];
  loading?: boolean;
  className?: string;
  nameLocked?: boolean;
  onRerollName?: () => void;
};

/**
 * UserProfileCard - Displays the current user's gamification status
 *
 * Shows:
 * - Username with status ring
 * - Level and XP progress bar
 * - Weekly rank and tier
 * - Recent badges
 * - Quick stats (pulses, reactions, streak)
 */
export default function UserProfileCard({
  username,
  level,
  xp,
  tier,
  weeklyRank,
  stats,
  badges,
  loading = false,
  className = "",
  nameLocked = true,
  onRerollName,
}: UserProfileCardProps) {
  if (loading) {
    return (
      <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-700" />
            <div className="flex-1">
              <div className="h-5 bg-slate-700 rounded w-32 mb-2" />
              <div className="h-3 bg-slate-700 rounded w-24" />
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full" />
          <div className="flex gap-2">
            <div className="w-10 h-10 rounded-xl bg-slate-700" />
            <div className="w-10 h-10 rounded-xl bg-slate-700" />
            <div className="w-10 h-10 rounded-xl bg-slate-700" />
          </div>
        </div>
      </div>
    );
  }

  const progress = levelProgress(xp);
  const xpToNextLevel = xpForLevel(level + 1) - xp;

  return (
    <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden ${className}`}>
      {/* Header with avatar and name */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          <StatusRing rank={weeklyRank} level={level} showLevel size="lg">
            <span className="text-3xl">🧑</span>
          </StatusRing>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate">{username}</span>
              {!nameLocked && onRerollName && (
                <button
                  onClick={onRerollName}
                  className="text-lg hover:scale-110 active:scale-95 transition-transform"
                  title="Change username"
                >
                  🎲
                </button>
              )}
              {tier.name !== "none" && (
                <span className={`text-xs font-bold ${tier.badgeColor} px-2 py-0.5 rounded`}>
                  {tier.label}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-400">
              Level {level} · {formatXP(xp)} XP
            </div>
          </div>
        </div>

        {/* XP Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Level {level}</span>
            <span>{xpToNextLevel} XP to Level {level + 1}</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Rank Card */}
      <div className="p-4 border-b border-slate-700/50">
        <UserRankCard rank={weeklyRank} period="weekly" />
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="p-4 border-b border-slate-700/50">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Your Stats
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <StatBox
              icon="📝"
              label="Pulses"
              value={stats.pulseCountTotal}
              subValue={`+${stats.pulsesThisWeek} this week`}
            />
            <StatBox
              icon="👍"
              label="Reactions"
              value={stats.reactionsReceivedTotal}
              subValue={`+${stats.reactionsThisWeek} this week`}
            />
            <StatBox
              icon="🔥"
              label="Streak"
              value={stats.currentStreakDays}
              subValue={`Best: ${stats.longestStreakDays} days`}
            />
          </div>
        </div>
      )}

      {/* Category Progress */}
      {stats && (
        <div className="p-4 border-b border-slate-700/50">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Category Progress
          </h4>
          <div className="space-y-2">
            <CategoryProgress
              icon="🚗"
              label="Traffic"
              count={stats.pulseCountTraffic}
              color="from-orange-500 to-amber-500"
            />
            <CategoryProgress
              icon="🌤️"
              label="Weather"
              count={stats.pulseCountWeather}
              color="from-cyan-500 to-blue-500"
            />
            <CategoryProgress
              icon="🎪"
              label="Events"
              count={stats.pulseCountEvents}
              color="from-purple-500 to-pink-500"
            />
            <CategoryProgress
              icon="💬"
              label="General"
              count={stats.pulseCountGeneral}
              color="from-emerald-500 to-teal-500"
            />
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Badges ({badges.length})
        </h4>
        <BadgeGrid badges={badges} maxVisible={6} size="sm" />
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  subValue,
}: {
  icon: string;
  label: string;
  value: number;
  subValue?: string;
}) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 text-center">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
      {subValue && <div className="text-[9px] text-slate-600 mt-0.5">{subValue}</div>}
    </div>
  );
}

function CategoryProgress({
  icon,
  label,
  count,
  color,
}: {
  icon: string;
  label: string;
  count: number;
  color: string;
}) {
  // Progress toward next badge tier (5, 25, 100, 250, 500)
  const thresholds = [5, 25, 100, 250, 500];
  const currentThreshold = thresholds.find((t) => count < t) ?? 500;
  const prevThreshold = thresholds[thresholds.indexOf(currentThreshold) - 1] ?? 0;
  const progress = Math.min(
    100,
    ((count - prevThreshold) / (currentThreshold - prevThreshold)) * 100
  );
  const tierLevel =
    thresholds.findIndex((t) => count < t) === -1
      ? 5
      : thresholds.findIndex((t) => count < t);

  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-300">{label}</span>
          <span className="text-slate-500">
            {count}/{currentThreshold} (Tier {tierLevel + 1})
          </span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-300`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for sidebar or header
 */
export function UserProfileCompact({
  username,
  level,
  tier,
  weeklyRank,
  onClick,
  className = "",
}: {
  username: string;
  level: number;
  tier: TierInfo;
  weeklyRank: number | null;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg
        bg-slate-800/40 hover:bg-slate-800/60
        border border-slate-700/30 hover:border-slate-600/50
        transition-colors group
        ${className}
      `}
    >
      <StatusRing rank={weeklyRank} level={level} showLevel={false} size="sm">
        <span className="text-sm">🧑</span>
      </StatusRing>
      <div className="text-left min-w-0">
        <div className="text-sm text-white truncate max-w-[100px]">{username}</div>
        <div className="text-[10px] text-slate-500">Lv.{level}</div>
      </div>
      {tier.name !== "none" && (
        <span className={`text-[10px] font-bold ${tier.badgeColor} px-1.5 py-0.5 rounded ml-auto`}>
          {tier.label}
        </span>
      )}
    </button>
  );
}
