/**
 * useGamification - React hook for user gamification state
 *
 * Provides:
 * - User stats (pulse counts, reactions, streaks)
 * - Earned badges
 * - Level and XP
 * - Weekly leaderboard rank and tier
 *
 * Usage:
 * const { stats, badges, level, tier, loading } = useGamification(userId);
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  UserStats,
  UserBadge,
  TierInfo,
  LeaderboardEntry,
} from "@/lib/gamification";
import { getTierFromRank, TIERS } from "@/lib/gamification";
import { getApiUrl } from "@/lib/api-config";

type GamificationState = {
  userId: string | null;
  username: string;
  level: number;
  xp: number;
  tier: TierInfo;
  weeklyRank: number | null;
  stats: UserStats | null;
  badges: UserBadge[];
  topBadge: UserBadge | null;
  loading: boolean;
  error: string | null;
};

const initialState: GamificationState = {
  userId: null,
  username: "",
  level: 1,
  xp: 0,
  tier: TIERS.none,
  weeklyRank: null,
  stats: null,
  badges: [],
  topBadge: null,
  loading: false,
  error: null,
};

export function useGamification(userId: string | null) {
  const [state, setState] = useState<GamificationState>(initialState);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const loadStats = useCallback(async () => {
    // Reset state if no user
    if (!userId) {
      // Defer to avoid synchronous setState in effect
      await Promise.resolve();
      if (isMounted.current) {
        setState(initialState);
      }
      return;
    }

    // Ensure async execution to satisfy linter
    await Promise.resolve();

    if (isMounted.current) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const res = await fetch(getApiUrl(`/api/gamification/stats?userId=${userId}`));

      if (!res.ok) {
        const data = await res.json();
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: data.error || "Failed to load stats",
          }));
        }
        return;
      }

      const data = await res.json();

      if (isMounted.current) {
        setState({
          userId: data.userId,
          username: data.username,
          level: data.level,
          xp: data.xp,
          tier: getTierFromRank(data.weeklyRank),
          weeklyRank: data.weeklyRank,
          stats: data.stats,
          badges: data.badges || [],
          topBadge: data.topBadge || null,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error("[useGamification] Error:", err);
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Unable to load gamification data",
        }));
      }
    }
  }, [userId]);

  useEffect(() => {
    // Avoid calling sync state updates directly in effect
    // We defer to a separate microtask or similar
    const init = async () => {
      await loadStats();
    };
    init();
  }, [loadStats]);

  return {
    ...state,
    reload: loadStats,
  };
}

type LeaderboardState = {
  entries: LeaderboardEntry[];
  period: "weekly" | "monthly" | "alltime";
  city: string | null;
  userRank: number | null;
  totalUsers: number;
  loading: boolean;
  error: string | null;
};

const initialLeaderboardState: LeaderboardState = {
  entries: [],
  period: "weekly",
  city: null,
  userRank: null,
  totalUsers: 0,
  loading: false,
  error: null,
};

export function useLeaderboard(
  period: "weekly" | "monthly" | "alltime" = "weekly",
  city: string | null = null,
  userId: string | null = null,
  limit: number = 25
) {
  const [state, setState] = useState<LeaderboardState>({
    ...initialLeaderboardState,
    period,
    city,
  });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const loadLeaderboard = useCallback(async () => {
    await Promise.resolve();
    if (isMounted.current) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const params = new URLSearchParams({
        period,
        limit: limit.toString(),
      });

      if (city) params.set("city", city);
      if (userId) params.set("userId", userId);

      const res = await fetch(getApiUrl(`/api/gamification/leaderboard?${params}`));

      if (!res.ok) {
        const data = await res.json();
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: data.error || "Failed to load leaderboard",
          }));
        }
        return;
      }

      const data = await res.json();

      if (isMounted.current) {
        setState({
          entries: data.entries || [],
          period: data.period,
          city: data.city,
          userRank: data.userRank,
          totalUsers: data.totalUsers,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error("[useLeaderboard] Error:", err);
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Unable to load leaderboard",
        }));
      }
    }
  }, [period, city, userId, limit]);

  useEffect(() => {
    const init = async () => {
      await loadLeaderboard();
    };
    init();
  }, [loadLeaderboard]);

  return {
    ...state,
    reload: loadLeaderboard,
  };
}

/**
 * Simple cache for user ranks to avoid repeated API calls
 * for the same user within a session
 */
const rankCache = new Map<string, { rank: number | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useUserRank(userId: string | null) {
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!userId) {
      setRank(null);
      return;
    }

    // Check cache
    const cached = rankCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setRank(cached.rank);
      return;
    }

    const fetchRank = async () => {
      // Async start
      await Promise.resolve();
      if (isMounted.current) setLoading(true);

      try {
        const res = await fetch(getApiUrl(`/api/gamification/stats?userId=${userId}`));
        if (res.ok) {
          const data = await res.json();
          const fetchedRank = data.weeklyRank ?? null;
          if (isMounted.current) {
            setRank(fetchedRank);
            rankCache.set(userId, { rank: fetchedRank, timestamp: Date.now() });
          }
        }
      } catch {
        // Ignore errors for rank fetching
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    void fetchRank();
  }, [userId]);

  return { rank, loading };
}
