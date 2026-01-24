"use client";

import React, { useState } from "react";
import Leaderboard from "./Leaderboard";
import UserProfileCard from "./UserProfileCard";
import { BadgeShowcase } from "./BadgeDisplay";
import { useGamification } from "@/hooks/useGamification";
import { getApiUrl } from "@/lib/api-config";
import type { BadgeDefinition } from "@/lib/gamification";

type StatusTabProps = {
  userId: string | null;
  city?: string;
  className?: string;
};

/**
 * StatusTab - The gamification hub
 *
 * Shows:
 * - User's profile card with stats, level, badges
 * - Weekly leaderboard for the current city
 * - Badge showcase
 */
export default function StatusTab({ userId, city, className = "" }: StatusTabProps) {
  const {
    username,
    level,
    xp,
    tier,
    weeklyRank,
    stats,
    badges,
    loading
  } = useGamification(userId);

  const [showAllBadges, setShowAllBadges] = useState(false);
  const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);

  const loadAllBadges = async () => {
    if (allBadges.length > 0) {
      setShowAllBadges(true);
      return;
    }

    setBadgesLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/gamification/badges"));
      if (res.ok) {
        const data = await res.json();
        setAllBadges(data.badges || []);
        setShowAllBadges(true);
      }
    } catch (err) {
      console.error("[StatusTab] Failed to load badges:", err);
    } finally {
      setBadgesLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Sign in prompt */}
        <div className="relative overflow-hidden glass-card premium-border rounded-[2rem] p-8 text-center bg-gradient-to-br from-emerald-500/10 to-transparent">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-emerald-500/40" />
          <div className="text-6xl mb-6 transform transition-transform hover:scale-110 duration-500">🏆</div>
          <h3 className="text-2xl font-black text-white tracking-tighter mb-3 uppercase">
            Claim Your Legacy
          </h3>
          <p className="text-slate-400 text-sm font-bold leading-relaxed mb-8 max-w-[240px] mx-auto text-balance">
            Sync your profile to track progression, earn elite badges, and dominate the local rankings.
          </p>
          <div className="grid grid-cols-3 gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
            <div className="space-y-2 group">
              <span className="text-2xl block group-hover:scale-125 transition-transform duration-300">🥇</span>
              <span>Regional Rankings</span>
            </div>
            <div className="space-y-2 group">
              <span className="text-2xl block group-hover:scale-125 transition-transform duration-300">🏅</span>
              <span>Elite Achievement</span>
            </div>
            <div className="space-y-2 group">
              <span className="text-2xl block group-hover:scale-125 transition-transform duration-300">📈</span>
              <span>Level Matrix</span>
            </div>
          </div>
        </div>

        {/* Leaderboard (viewable without sign in) */}
        <Leaderboard
          currentUserId={undefined}
          city={city}
          limit={25}
          showPeriodSelector
          initialPeriod="weekly"
        />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* User Profile Card */}
      <UserProfileCard
        username={username}
        level={level}
        xp={xp}
        tier={tier}
        weeklyRank={weeklyRank}
        stats={stats}
        badges={badges}
        loading={loading}
      />

      {/* Leaderboard */}
      <Leaderboard
        currentUserId={userId}
        city={city}
        limit={25}
        showPeriodSelector
        initialPeriod="weekly"
      />

      {/* Badge Collection */}
      <div className="glass-card premium-border rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl">🏅</div>
            <div>
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none">Badge Collection</h3>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Verified achievements</p>
            </div>
          </div>
          <button
            onClick={loadAllBadges}
            disabled={badgesLoading}
            className="text-[10px] font-black text-emerald-400 hover:text-white uppercase tracking-[0.15em] transition-all disabled:opacity-50"
          >
            {badgesLoading ? "Syncing..." : showAllBadges ? "Hide Grid" : "Analyze Map"}
          </button>
        </div>

        <div className="p-6">
          {showAllBadges ? (
            <BadgeShowcase
              earnedBadges={badges}
              allBadges={allBadges}
              grouped
            />
          ) : (
            <div className="text-center py-6 space-y-4">
              <p className="text-xs font-bold text-slate-400 tracking-tight">
                You have unlocked <span className="text-emerald-400 px-1">{badges.length}</span> prestige markers
              </p>
              <button
                onClick={loadAllBadges}
                className="group flex items-center gap-2 mx-auto text-[10px] font-black text-emerald-400 hover:text-white uppercase tracking-[0.2em] transition-all duration-300"
              >
                <span>View Full Inventory</span>
                <svg className="w-3 h-3 transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Motivation Section */}
      <MotivationCard
        level={level}
        weeklyRank={weeklyRank}
        pulsesThisWeek={stats?.pulsesThisWeek ?? 0}
        currentStreak={stats?.currentStreakDays ?? 0}
      />
    </div>
  );
}

function MotivationCard({
  level,
  weeklyRank,
  pulsesThisWeek,
  currentStreak,
}: {
  level: number;
  weeklyRank: number | null;
  pulsesThisWeek: number;
  currentStreak: number;
}) {
  // Generate a motivational message based on user's current state
  const getMessage = () => {
    if (pulsesThisWeek === 0) {
      return {
        emoji: "🚀",
        title: "Start your week strong!",
        message: "Post your first pulse this week to get on the leaderboard.",
      };
    }

    if (weeklyRank && weeklyRank <= 3) {
      return {
        emoji: "👑",
        title: "You're on top!",
        message: "Amazing work! Keep posting to maintain your position.",
      };
    }

    if (weeklyRank && weeklyRank <= 10) {
      return {
        emoji: "🔥",
        title: "So close to the top!",
        message: `Just ${4 - Math.min(3, weeklyRank)} more ranks to Diamond status!`,
      };
    }

    if (currentStreak >= 7) {
      return {
        emoji: "⚡",
        title: "Streak master!",
        message: `${currentStreak} days in a row! Keep the momentum going.`,
      };
    }

    if (currentStreak >= 3) {
      return {
        emoji: "🔥",
        title: "Building momentum!",
        message: `${currentStreak}-day streak! ${7 - currentStreak} more for Week Warrior badge.`,
      };
    }

    if (level < 5) {
      return {
        emoji: "🌱",
        title: "Growing your reputation",
        message: "Every pulse brings you closer to becoming a local expert!",
      };
    }

    return {
      emoji: "💪",
      title: "Keep contributing!",
      message: "Your pulses help everyone stay informed about the community.",
    };
  };

  const { emoji, title, message } = getMessage();

  return (
    <div className="relative overflow-hidden glass-card premium-border rounded-[2rem] p-6 bg-gradient-to-r from-emerald-500/10 to-transparent">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <span className="text-6xl transform rotate-12 block">{emoji}</span>
      </div>
      <div className="relative z-10 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-3xl shadow-inner border border-white/5">
          {emoji}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{title}</h4>
          <p className="text-[13px] font-bold text-slate-400 leading-snug tracking-tight text-balance">{message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini status widget for the header
 */
export function StatusWidget({
  userId,
  onClick,
  className = "",
}: {
  userId: string | null;
  onClick?: () => void;
  className?: string;
}) {
  const { level, tier, weeklyRank, loading } = useGamification(userId);

  if (!userId || loading) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-xl
        glass-card premium-border bg-white/5 hover:bg-white/10
        transition-all duration-300
        ${className}
      `}
      title="View your status"
    >
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lv.{level}</span>
      {weeklyRank && weeklyRank <= 50 && (
        <span className={`text-[9px] font-black ${tier.badgeColor} px-2 py-0.5 rounded-lg border border-white/10 shadow-sm`}>
          #{weeklyRank}
        </span>
      )}
    </button>
  );
}
