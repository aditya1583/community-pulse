"use client";

import React, { useState } from "react";
import type { UserBadge, BadgeDefinition } from "@/lib/gamification";

type BadgeProps = {
  badge: BadgeDefinition;
  /** Whether the user has earned this badge */
  earned?: boolean;
  /** When the badge was earned (for earned badges) */
  earnedAt?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional class names */
  className?: string;
};

/**
 * Single badge display with optional tooltip
 */
export function Badge({
  badge,
  earned = true,
  earnedAt,
  size = "md",
  showTooltip = true,
  className = "",
}: BadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const sizes = {
    sm: "w-8 h-8 text-lg",
    md: "w-10 h-10 text-xl",
    lg: "w-14 h-14 text-3xl",
  };

  const tierColors: Record<number, string> = {
    1: "border-slate-600",
    2: "border-emerald-500/50",
    3: "border-cyan-500/50",
    4: "border-amber-500/50",
    5: "border-amber-300 shadow-amber-400/30",
  };

  const tierGlows: Record<number, string> = {
    1: "",
    2: "",
    3: "shadow-sm shadow-cyan-500/20",
    4: "shadow-md shadow-amber-500/30",
    5: "shadow-lg shadow-amber-400/40",
  };

  const tier = badge.tier ?? 1;

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`
          ${sizes[size]}
          ${earned ? "opacity-100" : "opacity-40 grayscale"}
          ${tierColors[tier]}
          ${earned ? tierGlows[tier] : ""}
          rounded-xl border-2 bg-slate-800/80
          flex items-center justify-center
          transition-all duration-200
          ${earned ? "hover:scale-110" : ""}
        `}
        title={showTooltip ? undefined : badge.name}
      >
        <span className="select-none">{badge.icon}</span>
      </div>

      {/* Tier indicator for leveled badges */}
      {tier > 1 && earned && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center">
          <span className="text-[9px] font-bold text-slate-300">{tier}</span>
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl min-w-[160px] max-w-[240px]">
            <div className="font-semibold text-white text-sm mb-1">
              {badge.name}
            </div>
            <div className="text-slate-400 text-xs leading-snug">
              {badge.description}
            </div>
            {earnedAt && (
              <div className="text-slate-500 text-[10px] mt-1.5 border-t border-slate-700 pt-1.5">
                Earned {formatDate(earnedAt)}
              </div>
            )}
            {!earned && (
              <div className="text-amber-400/80 text-[10px] mt-1.5 border-t border-slate-700 pt-1.5">
                Not yet earned
              </div>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type BadgeGridProps = {
  badges: UserBadge[];
  /** Maximum badges to show (rest collapsed behind "more" button) */
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Grid display of multiple badges
 */
export function BadgeGrid({
  badges,
  maxVisible = 6,
  size = "md",
  className = "",
}: BadgeGridProps) {
  const [showAll, setShowAll] = useState(false);

  const visibleBadges = showAll ? badges : badges.slice(0, maxVisible);
  const hiddenCount = badges.length - maxVisible;

  if (badges.length === 0) {
    return (
      <div className={`text-slate-500 text-sm italic ${className}`}>
        No badges earned yet
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {visibleBadges.map((userBadge) => (
          <Badge
            key={userBadge.id}
            badge={userBadge.badge}
            earned
            earnedAt={userBadge.earnedAt}
            size={size}
          />
        ))}
        {!showAll && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className={`
              ${size === "sm" ? "w-8 h-8" : size === "md" ? "w-10 h-10" : "w-14 h-14"}
              rounded-xl border-2 border-dashed border-slate-600
              bg-slate-800/40 text-slate-400
              flex items-center justify-center
              hover:border-slate-500 hover:text-slate-300
              transition-colors text-xs font-medium
            `}
          >
            +{hiddenCount}
          </button>
        )}
      </div>
    </div>
  );
}

type BadgeShowcaseProps = {
  earnedBadges: UserBadge[];
  /** All available badges (for showing locked ones) */
  allBadges?: BadgeDefinition[];
  /** Group by category */
  grouped?: boolean;
  className?: string;
};

/**
 * Full badge showcase with categories and locked badges
 */
export function BadgeShowcase({
  earnedBadges,
  allBadges = [],
  grouped = true,
  className = "",
}: BadgeShowcaseProps) {
  const earnedIds = new Set(earnedBadges.map((b) => b.badgeId));

  const categoryOrder = ["category", "achievement", "streak", "milestone"];
  const categoryLabels: Record<string, string> = {
    category: "Category Expertise",
    achievement: "Achievements",
    streak: "Streaks",
    milestone: "Milestones",
  };

  if (!grouped) {
    return (
      <div className={`flex flex-wrap gap-3 ${className}`}>
        {allBadges.map((badge) => {
          const userBadge = earnedBadges.find((b) => b.badgeId === badge.id);
          return (
            <Badge
              key={badge.id}
              badge={badge}
              earned={earnedIds.has(badge.id)}
              earnedAt={userBadge?.earnedAt}
              size="md"
            />
          );
        })}
      </div>
    );
  }

  // Group badges by category
  const grouped_badges: Record<string, BadgeDefinition[]> = {};
  for (const badge of allBadges) {
    if (!grouped_badges[badge.category]) {
      grouped_badges[badge.category] = [];
    }
    grouped_badges[badge.category].push(badge);
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {categoryOrder.map((category) => {
        const badges = grouped_badges[category];
        if (!badges || badges.length === 0) return null;

        return (
          <div key={category}>
            <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
              {categoryLabels[category]}
            </h4>
            <div className="flex flex-wrap gap-3">
              {badges
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((badge) => {
                  const userBadge = earnedBadges.find(
                    (b) => b.badgeId === badge.id
                  );
                  return (
                    <Badge
                      key={badge.id}
                      badge={badge}
                      earned={earnedIds.has(badge.id)}
                      earnedAt={userBadge?.earnedAt}
                      size="md"
                    />
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type FeaturedBadgeProps = {
  badge: UserBadge;
  className?: string;
};

/**
 * Large featured badge display (for profile hero section)
 */
export function FeaturedBadge({ badge, className = "" }: FeaturedBadgeProps) {
  const tier = badge.badge.tier ?? 1;

  const tierGradients: Record<number, string> = {
    1: "from-slate-700 to-slate-800",
    2: "from-emerald-900/30 to-slate-800",
    3: "from-cyan-900/30 to-slate-800",
    4: "from-amber-900/30 to-slate-800",
    5: "from-amber-800/40 to-slate-800",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-3
        px-4 py-2 rounded-xl
        bg-gradient-to-r ${tierGradients[tier]}
        border border-slate-700/50
        ${className}
      `}
    >
      <Badge badge={badge.badge} earned size="lg" showTooltip={false} />
      <div className="text-left">
        <div className="font-semibold text-white text-sm">{badge.badge.name}</div>
        <div className="text-slate-400 text-xs">{badge.badge.description}</div>
      </div>
    </div>
  );
}
