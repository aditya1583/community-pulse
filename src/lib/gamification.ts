/**
 * Gamification System Types and Utilities
 *
 * This module defines the core types and helper functions for the gamification system.
 * The system rewards users for contributing pulses and receiving positive reactions.
 *
 * Core concepts:
 * - XP: Experience points earned from pulses (10 XP) and reactions (2-5 XP each)
 * - Level: Calculated from XP using sqrt curve (1-100)
 * - Tier: Weekly rank-based status (Bronze, Silver, Gold, Diamond)
 * - Badges: Achievement markers for category expertise, streaks, and milestones
 */

// ============================================================================
// TIER SYSTEM
// Weekly leaderboard rank determines tier status
// ============================================================================

export type TierName = "none" | "bronze" | "silver" | "gold" | "diamond";

export type TierInfo = {
  name: TierName;
  label: string;
  minRank: number;
  maxRank: number;
  ringColor: string;
  glowColor: string;
  badgeColor: string;
};

/**
 * Tier definitions based on weekly leaderboard rank
 * Diamond: Top 3
 * Gold: Top 10
 * Silver: Top 25
 * Bronze: Top 50
 * None: Everyone else (still shows level)
 */
export const TIERS: Record<TierName, TierInfo> = {
  diamond: {
    name: "diamond",
    label: "Diamond",
    minRank: 1,
    maxRank: 3,
    ringColor: "from-cyan-300 via-white to-cyan-300",
    glowColor: "shadow-cyan-400/60",
    badgeColor: "bg-gradient-to-r from-cyan-400 to-white text-slate-900",
  },
  gold: {
    name: "gold",
    label: "Gold",
    minRank: 4,
    maxRank: 10,
    ringColor: "from-amber-300 via-yellow-200 to-amber-400",
    glowColor: "shadow-amber-400/50",
    badgeColor: "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900",
  },
  silver: {
    name: "silver",
    label: "Silver",
    minRank: 11,
    maxRank: 25,
    ringColor: "from-slate-300 via-white to-slate-400",
    glowColor: "shadow-slate-300/40",
    badgeColor: "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900",
  },
  bronze: {
    name: "bronze",
    label: "Bronze",
    minRank: 26,
    maxRank: 50,
    ringColor: "from-orange-400 via-amber-600 to-orange-500",
    glowColor: "shadow-orange-400/30",
    badgeColor: "bg-gradient-to-r from-orange-400 to-amber-600 text-white",
  },
  none: {
    name: "none",
    label: "",
    minRank: 51,
    maxRank: Infinity,
    ringColor: "from-slate-600 to-slate-700",
    glowColor: "",
    badgeColor: "bg-slate-700 text-slate-300",
  },
};

/**
 * Get tier from weekly leaderboard rank
 */
export function getTierFromRank(rank: number | null): TierInfo {
  if (rank === null || rank <= 0) return TIERS.none;

  if (rank <= 3) return TIERS.diamond;
  if (rank <= 10) return TIERS.gold;
  if (rank <= 25) return TIERS.silver;
  if (rank <= 50) return TIERS.bronze;
  return TIERS.none;
}

// ============================================================================
// LEVEL SYSTEM
// XP-based progression (mirrors database calculation)
// ============================================================================

/**
 * Calculate level from XP (mirrors database function)
 * Level = floor(sqrt(xp / 100)) + 1, capped at 100
 */
export function calculateLevel(xp: number): number {
  return Math.min(100, Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1));
}

/**
 * Calculate XP required for a specific level
 * Inverse of calculateLevel: xp = (level - 1)^2 * 100
 */
export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100;
}

/**
 * Calculate progress to next level (0-100%)
 */
export function levelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp);
  if (currentLevel >= 100) return 100;

  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpInLevel = xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;

  return Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));
}

// ============================================================================
// BADGE TYPES
// ============================================================================

export type BadgeCategory = "category" | "achievement" | "streak" | "milestone";

export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  requiredTag?: string | null;
  tier?: number;
  requiredPulseCount?: number;
  requiredReactionCount?: number;
  requiredStreakDays?: number;
  specialCondition?: Record<string, unknown> | null;
  displayOrder: number;
};

export type UserBadge = {
  id: string;
  badgeId: string;
  earnedAt: string;
  expiresAt?: string | null;
  currentProgress?: number;
  badge: BadgeDefinition;
};

// ============================================================================
// USER STATS TYPES
// ============================================================================

export type UserStats = {
  userId: string;
  pulseCountTotal: number;
  pulseCountTraffic: number;
  pulseCountWeather: number;
  pulseCountEvents: number;
  pulseCountGeneral: number;
  reactionsReceivedTotal: number;
  reactionsFireReceived: number;
  reactionsEyesReceived: number;
  reactionsCheckReceived: number;
  currentStreakDays: number;
  longestStreakDays: number;
  lastPulseDate?: string | null;
  pulsesThisWeek: number;
  pulsesThisMonth: number;
  reactionsThisWeek: number;
  reactionsThisMonth: number;
  level: number;
  xpTotal: number;
};

export type LeaderboardEntry = {
  userId: string;
  username: string;
  rank: number;
  score: number;
  pulseCount: number;
  reactionCount: number;
  period: "weekly" | "monthly" | "alltime";
  city?: string | null;
};

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type UserProfileWithStats = {
  userId: string;
  username: string;
  level: number;
  xp: number;
  tier: TierInfo;
  weeklyRank: number | null;
  stats: UserStats;
  badges: UserBadge[];
  topBadge?: UserBadge | null;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  period: "weekly" | "monthly" | "alltime";
  city?: string | null;
  userRank?: number | null;
  totalUsers: number;
};

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format XP for display (e.g., "1.2K", "15K")
 */
export function formatXP(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}

/**
 * Get category badge icon for a tag
 */
export function getCategoryIcon(tag: string): string {
  switch (tag) {
    case "Traffic":
      return "🚗";
    case "Weather":
      return "🌤️";
    case "Events":
      return "🎪";
    case "General":
      return "💬";
    default:
      return "📝";
  }
}

/**
 * Get the most impressive badge to display
 * Prioritizes: Category level > Streak > Milestone > Achievement
 */
export function getTopBadge(badges: UserBadge[]): UserBadge | null {
  if (badges.length === 0) return null;

  // Sort by tier (descending) then by display order
  const sorted = [...badges].sort((a, b) => {
    const tierA = a.badge.tier ?? 0;
    const tierB = b.badge.tier ?? 0;
    if (tierB !== tierA) return tierB - tierA;
    return a.badge.displayOrder - b.badge.displayOrder;
  });

  return sorted[0];
}
