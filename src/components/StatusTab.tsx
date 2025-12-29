"use client";

import React, { useState } from "react";
import Leaderboard from "./Leaderboard";
import UserProfileCard from "./UserProfileCard";
import { BadgeShowcase } from "./BadgeDisplay";
import { useGamification } from "@/hooks/useGamification";
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
      const res = await fetch("/api/gamification/badges");
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
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Join the Leaderboard
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Sign in to track your stats, earn badges, and compete for the top spot!
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <span>🥇</span> Weekly rankings
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span>🏅</span> Achievement badges
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <span>📈</span> Level progression
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
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span className="text-lg">🏅</span>
            Badge Collection
          </h3>
          <button
            onClick={loadAllBadges}
            disabled={badgesLoading}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
          >
            {badgesLoading ? "Loading..." : showAllBadges ? "Hide all" : "View all badges"}
          </button>
        </div>

        <div className="p-4">
          {showAllBadges ? (
            <BadgeShowcase
              earnedBadges={badges}
              allBadges={allBadges}
              grouped
            />
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm mb-3">
                You have earned <span className="text-emerald-400 font-semibold">{badges.length}</span> badges
              </p>
              <button
                onClick={loadAllBadges}
                className="text-sm text-emerald-400 hover:text-emerald-300 underline"
              >
                View all available badges
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
    <div className="bg-gradient-to-r from-emerald-900/20 to-slate-800/60 border border-emerald-500/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h4 className="font-semibold text-white mb-1">{title}</h4>
          <p className="text-sm text-slate-400">{message}</p>
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
        flex items-center gap-2 px-2 py-1 rounded-lg
        bg-slate-800/40 hover:bg-slate-800/60
        border border-slate-700/30 hover:border-slate-600/50
        transition-colors
        ${className}
      `}
      title="View your status"
    >
      <span className="text-xs text-slate-400">Lv.{level}</span>
      {weeklyRank && weeklyRank <= 50 && (
        <span className={`text-[10px] font-bold ${tier.badgeColor} px-1.5 py-0.5 rounded`}>
          #{weeklyRank}
        </span>
      )}
    </button>
  );
}
