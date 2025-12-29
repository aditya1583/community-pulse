"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getTierFromRank, formatXP, type LeaderboardEntry } from "@/lib/gamification";
import { StatusIndicator } from "./StatusRing";

type LeaderboardPeriod = "weekly" | "monthly" | "alltime";

type LeaderboardProps = {
  /** Current user ID (to highlight their row) */
  currentUserId?: string;
  /** Filter by city (null = global) */
  city?: string | null;
  /** Maximum entries to show */
  limit?: number;
  /** Show period selector tabs */
  showPeriodSelector?: boolean;
  /** Initial period */
  initialPeriod?: LeaderboardPeriod;
  /** Additional class names */
  className?: string;
};

/**
 * Leaderboard - Shows top contributors for a given period
 *
 * Features:
 * - Weekly / Monthly / All-time views
 * - Current user highlighting
 * - Tier-colored rank indicators
 * - City-specific or global scope
 */
export default function Leaderboard({
  currentUserId,
  city,
  limit = 25,
  showPeriodSelector = true,
  initialPeriod = "weekly",
  className = "",
}: LeaderboardProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Query leaderboard cache
      let query = supabase
        .from("leaderboard_cache")
        .select("*")
        .eq("period", period)
        .order("rank", { ascending: true })
        .limit(limit);

      if (city) {
        query = query.eq("city", city);
      } else {
        query = query.is("city", null);
      }

      const { data, error: fetchError } = await query;

      // Handle missing table or other errors gracefully
      if (fetchError) {
        const errorMsg = fetchError.message || "";
        const errorCode = fetchError.code || "";

        // If table doesn't exist, or we get an empty error object (common with missing tables)
        // just show empty state instead of error
        const isTableMissing =
          errorCode === "42P01" ||
          errorMsg.includes("does not exist") ||
          errorMsg.includes("relation") ||
          // Empty error object often means table doesn't exist
          (Object.keys(fetchError).length === 0) ||
          // PGRST error codes for missing resources
          errorCode === "PGRST116" ||
          errorCode.startsWith("PGRST");

        if (isTableMissing) {
          console.warn("[Leaderboard] Table not ready yet, showing empty state");
          setEntries([]);
          return;
        }

        console.error("[Leaderboard] Fetch error:", fetchError);
        setError("Unable to load leaderboard");
        return;
      }

      const mapped: LeaderboardEntry[] = (data || []).map((row) => ({
        userId: row.user_id,
        username: row.username,
        rank: row.rank,
        score: row.score,
        pulseCount: row.pulse_count,
        reactionCount: row.reaction_count,
        period: row.period as LeaderboardPeriod,
        city: row.city,
      }));

      setEntries(mapped);

      // Find current user's rank
      if (currentUserId) {
        const userEntry = mapped.find((e) => e.userId === currentUserId);
        setUserRank(userEntry?.rank ?? null);
      }
    } catch (err) {
      console.error("[Leaderboard] Error:", err);
      setError("Unable to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [period, city, limit, currentUserId]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const periodLabels: Record<LeaderboardPeriod, string> = {
    weekly: "This Week",
    monthly: "This Month",
    alltime: "All Time",
  };

  return (
    <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span className="text-lg">🏆</span>
          Leaderboard
        </h3>
        {showPeriodSelector && (
          <div className="flex gap-1 bg-slate-900/50 rounded-lg p-0.5">
            {(["weekly", "monthly", "alltime"] as LeaderboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  period === p
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {p === "alltime" ? "All" : p.charAt(0).toUpperCase() + p.slice(1, -2)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2">
        {loading ? (
          <div className="py-8 text-center text-slate-500">
            <div className="inline-block w-5 h-5 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-slate-500 text-sm">{error}</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-slate-400 text-sm mb-1">No activity yet</div>
            <div className="text-slate-500 text-xs">
              Be the first to post a pulse!
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                isCurrentUser={entry.userId === currentUserId}
                periodLabel={periodLabels[period]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Current user position (if not in top N) */}
      {currentUserId && userRank && userRank > limit && (
        <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-900/30">
          <div className="text-xs text-slate-400 text-center">
            You are ranked <span className="text-emerald-300 font-semibold">#{userRank}</span> {periodLabels[period].toLowerCase()}
          </div>
        </div>
      )}
    </div>
  );
}

type LeaderboardRowProps = {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  periodLabel: string;
};

function LeaderboardRow({ entry, isCurrentUser }: LeaderboardRowProps) {
  const tier = getTierFromRank(entry.rank);

  // Rank display with tier coloring
  const rankDisplay = () => {
    if (entry.rank === 1) {
      return <span className="text-lg">🥇</span>;
    }
    if (entry.rank === 2) {
      return <span className="text-lg">🥈</span>;
    }
    if (entry.rank === 3) {
      return <span className="text-lg">🥉</span>;
    }

    const rankColors: Record<string, string> = {
      gold: "text-amber-400",
      silver: "text-slate-300",
      bronze: "text-orange-400",
      none: "text-slate-500",
    };

    return (
      <span className={`text-sm font-mono ${rankColors[tier.name]}`}>
        #{entry.rank}
      </span>
    );
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg
        ${isCurrentUser ? "bg-emerald-500/10 border border-emerald-500/30" : "hover:bg-slate-700/30"}
        transition-colors
      `}
    >
      {/* Rank */}
      <div className="w-8 flex-shrink-0 flex justify-center">{rankDisplay()}</div>

      {/* Username + tier badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-medium truncate ${
              isCurrentUser ? "text-emerald-300" : "text-white"
            }`}
          >
            {entry.username}
          </span>
          {tier.name !== "none" && (
            <StatusIndicator rank={entry.rank} />
          )}
          {isCurrentUser && (
            <span className="text-[10px] text-emerald-400 font-medium">(you)</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1" title="Pulses">
          <span className="text-slate-500">📝</span>
          <span>{entry.pulseCount}</span>
        </div>
        <div className="flex items-center gap-1" title="Reactions received">
          <span className="text-slate-500">👍</span>
          <span>{entry.reactionCount}</span>
        </div>
        <div className="w-12 text-right font-mono text-slate-300" title="Score">
          {formatXP(entry.score)}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact leaderboard widget for sidebar or dashboard
 */
export function LeaderboardWidget({
  currentUserId,
  city,
  className = "",
}: {
  currentUserId?: string;
  city?: string | null;
  className?: string;
}) {
  return (
    <Leaderboard
      currentUserId={currentUserId}
      city={city}
      limit={10}
      showPeriodSelector={false}
      initialPeriod="weekly"
      className={className}
    />
  );
}

/**
 * User's rank highlight card
 */
export function UserRankCard({
  rank,
  period = "weekly",
  pulsesToNextRank,
  className = "",
}: {
  rank: number | null;
  period?: LeaderboardPeriod;
  pulsesToNextRank?: number;
  className?: string;
}) {
  const tier = getTierFromRank(rank);

  if (!rank) {
    return (
      <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 ${className}`}>
        <div className="text-center">
          <div className="text-slate-400 text-sm mb-1">Start posting to join the leaderboard!</div>
          <div className="text-slate-500 text-xs">Your first pulse gets you on the board</div>
        </div>
      </div>
    );
  }

  const periodLabels: Record<LeaderboardPeriod, string> = {
    weekly: "this week",
    monthly: "this month",
    alltime: "all time",
  };

  return (
    <div
      className={`
        bg-gradient-to-r ${tier.name !== "none" ? `from-slate-800/80 via-slate-800/60 to-slate-800/80` : "from-slate-800/60 to-slate-800/60"}
        border border-slate-700/50 rounded-xl p-4
        ${tier.name !== "none" ? tier.glowColor : ""}
        ${className}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-slate-400 text-xs mb-0.5">Your rank {periodLabels[period]}</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">#{rank}</span>
            {tier.name !== "none" && (
              <span className={`text-sm font-semibold ${tier.badgeColor} px-2 py-0.5 rounded`}>
                {tier.label}
              </span>
            )}
          </div>
        </div>

        {pulsesToNextRank && pulsesToNextRank > 0 && rank > 3 && (
          <div className="text-right">
            <div className="text-emerald-400 text-sm font-semibold">
              {pulsesToNextRank} more
            </div>
            <div className="text-slate-500 text-xs">to next tier</div>
          </div>
        )}
      </div>
    </div>
  );
}
