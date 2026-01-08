import { describe, expect, it } from "vitest";
import {
  getTierFromRank,
  calculateLevel,
  xpForLevel,
  levelProgress,
  formatXP,
  getCategoryIcon,
  getTopBadge,
  TIERS,
  type UserBadge,
  type BadgeDefinition,
} from "@/lib/gamification";

/**
 * Gamification System Tests
 *
 * Tests for the tier system, level calculations, XP formatting,
 * and badge utilities.
 */

describe("Gamification - Tier System", () => {
  describe("getTierFromRank", () => {
    it("returns diamond tier for ranks 1-3", () => {
      expect(getTierFromRank(1).name).toBe("diamond");
      expect(getTierFromRank(2).name).toBe("diamond");
      expect(getTierFromRank(3).name).toBe("diamond");
    });

    it("returns gold tier for ranks 4-10", () => {
      expect(getTierFromRank(4).name).toBe("gold");
      expect(getTierFromRank(7).name).toBe("gold");
      expect(getTierFromRank(10).name).toBe("gold");
    });

    it("returns silver tier for ranks 11-25", () => {
      expect(getTierFromRank(11).name).toBe("silver");
      expect(getTierFromRank(18).name).toBe("silver");
      expect(getTierFromRank(25).name).toBe("silver");
    });

    it("returns bronze tier for ranks 26-50", () => {
      expect(getTierFromRank(26).name).toBe("bronze");
      expect(getTierFromRank(35).name).toBe("bronze");
      expect(getTierFromRank(50).name).toBe("bronze");
    });

    it("returns none tier for ranks above 50", () => {
      expect(getTierFromRank(51).name).toBe("none");
      expect(getTierFromRank(100).name).toBe("none");
      expect(getTierFromRank(1000).name).toBe("none");
    });

    it("returns none tier for null rank", () => {
      expect(getTierFromRank(null).name).toBe("none");
    });

    it("returns none tier for invalid ranks (0 or negative)", () => {
      expect(getTierFromRank(0).name).toBe("none");
      expect(getTierFromRank(-1).name).toBe("none");
      expect(getTierFromRank(-100).name).toBe("none");
    });

    it("returns full TierInfo object with all properties", () => {
      const diamondTier = getTierFromRank(1);
      expect(diamondTier).toEqual(TIERS.diamond);
      expect(diamondTier.label).toBe("Diamond");
      expect(diamondTier.minRank).toBe(1);
      expect(diamondTier.maxRank).toBe(3);
      expect(diamondTier.ringColor).toBeDefined();
      expect(diamondTier.glowColor).toBeDefined();
      expect(diamondTier.badgeColor).toBeDefined();
    });
  });

  describe("TIERS constant", () => {
    it("has all five tier definitions", () => {
      expect(Object.keys(TIERS)).toHaveLength(5);
      expect(TIERS.diamond).toBeDefined();
      expect(TIERS.gold).toBeDefined();
      expect(TIERS.silver).toBeDefined();
      expect(TIERS.bronze).toBeDefined();
      expect(TIERS.none).toBeDefined();
    });

    it("has non-overlapping rank ranges", () => {
      // diamond: 1-3, gold: 4-10, silver: 11-25, bronze: 26-50, none: 51+
      expect(TIERS.diamond.maxRank).toBeLessThan(TIERS.gold.minRank);
      expect(TIERS.gold.maxRank).toBeLessThan(TIERS.silver.minRank);
      expect(TIERS.silver.maxRank).toBeLessThan(TIERS.bronze.minRank);
      expect(TIERS.bronze.maxRank).toBeLessThan(TIERS.none.minRank);
    });
  });
});

describe("Gamification - Level System", () => {
  describe("calculateLevel", () => {
    it("returns level 1 for 0 XP", () => {
      expect(calculateLevel(0)).toBe(1);
    });

    it("returns level 1 for XP less than 100", () => {
      expect(calculateLevel(50)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
    });

    it("returns level 2 for 100 XP", () => {
      expect(calculateLevel(100)).toBe(2);
    });

    it("calculates levels correctly using sqrt formula", () => {
      // Level = floor(sqrt(xp / 100)) + 1
      expect(calculateLevel(400)).toBe(3); // sqrt(4) + 1 = 3
      expect(calculateLevel(900)).toBe(4); // sqrt(9) + 1 = 4
      expect(calculateLevel(1600)).toBe(5); // sqrt(16) + 1 = 5
      expect(calculateLevel(2500)).toBe(6); // sqrt(25) + 1 = 6
    });

    it("caps level at 100", () => {
      expect(calculateLevel(1000000)).toBe(100);
      expect(calculateLevel(10000000)).toBe(100);
    });

    it("handles negative XP (sqrt of negative returns NaN)", () => {
      // Note: calculateLevel doesn't guard against negative XP
      // In practice, XP should never be negative in the system
      const result = calculateLevel(-100);
      expect(Number.isNaN(result)).toBe(true);
    });
  });

  describe("xpForLevel", () => {
    it("returns 0 XP for level 1", () => {
      expect(xpForLevel(1)).toBe(0);
    });

    it("returns 100 XP for level 2", () => {
      expect(xpForLevel(2)).toBe(100);
    });

    it("calculates XP correctly using inverse formula", () => {
      // xp = (level - 1)^2 * 100
      expect(xpForLevel(3)).toBe(400); // 2^2 * 100
      expect(xpForLevel(4)).toBe(900); // 3^2 * 100
      expect(xpForLevel(5)).toBe(1600); // 4^2 * 100
      expect(xpForLevel(10)).toBe(8100); // 9^2 * 100
    });

    it("is inverse of calculateLevel", () => {
      // calculateLevel(xpForLevel(n)) should approximately equal n
      for (let level = 1; level <= 50; level++) {
        const xp = xpForLevel(level);
        expect(calculateLevel(xp)).toBe(level);
      }
    });
  });

  describe("levelProgress", () => {
    it("returns 0% at the start of a level", () => {
      // Level 2 starts at 100 XP
      expect(levelProgress(100)).toBe(0);
      // Level 3 starts at 400 XP
      expect(levelProgress(400)).toBe(0);
    });

    it("returns 100% at max level", () => {
      expect(levelProgress(1000000)).toBe(100);
    });

    it("calculates mid-level progress correctly", () => {
      // Level 2: 100-400 XP (300 XP range)
      // At 250 XP: (250-100)/(400-100) = 150/300 = 50%
      expect(levelProgress(250)).toBeCloseTo(50, 0);
    });

    it("returns value between 0 and 100", () => {
      for (let xp = 0; xp <= 10000; xp += 100) {
        const progress = levelProgress(xp);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      }
    });
  });
});

describe("Gamification - Display Helpers", () => {
  describe("formatXP", () => {
    it("returns raw number for XP less than 1000", () => {
      expect(formatXP(0)).toBe("0");
      expect(formatXP(100)).toBe("100");
      expect(formatXP(999)).toBe("999");
    });

    it("formats thousands with K suffix", () => {
      expect(formatXP(1000)).toBe("1.0K");
      expect(formatXP(1500)).toBe("1.5K");
      expect(formatXP(15000)).toBe("15.0K");
      expect(formatXP(999999)).toBe("1000.0K");
    });

    it("formats millions with M suffix", () => {
      expect(formatXP(1000000)).toBe("1.0M");
      expect(formatXP(2500000)).toBe("2.5M");
      expect(formatXP(10000000)).toBe("10.0M");
    });
  });

  describe("getCategoryIcon", () => {
    it("returns correct icons for known tags", () => {
      expect(getCategoryIcon("Traffic")).toBe("🚗");
      expect(getCategoryIcon("Weather")).toBe("🌤️");
      expect(getCategoryIcon("Events")).toBe("🎪");
      expect(getCategoryIcon("General")).toBe("💬");
    });

    it("returns default icon for unknown tags", () => {
      expect(getCategoryIcon("Unknown")).toBe("📝");
      expect(getCategoryIcon("")).toBe("📝");
      expect(getCategoryIcon("Custom")).toBe("📝");
    });
  });

  describe("getTopBadge", () => {
    const createBadge = (
      id: string,
      tier: number,
      displayOrder: number
    ): UserBadge => ({
      id,
      badgeId: id,
      earnedAt: new Date().toISOString(),
      badge: {
        id,
        name: `Badge ${id}`,
        description: "Test badge",
        icon: "🏆",
        category: "achievement",
        tier,
        displayOrder,
      } as BadgeDefinition,
    });

    it("returns null for empty badge array", () => {
      expect(getTopBadge([])).toBeNull();
    });

    it("returns single badge when only one exists", () => {
      const badge = createBadge("badge1", 1, 1);
      expect(getTopBadge([badge])).toEqual(badge);
    });

    it("prioritizes higher tier badges", () => {
      const lowTier = createBadge("low", 1, 1);
      const highTier = createBadge("high", 3, 2);
      const midTier = createBadge("mid", 2, 1);

      expect(getTopBadge([lowTier, highTier, midTier])).toEqual(highTier);
    });

    it("uses display order as tiebreaker for same tier", () => {
      const first = createBadge("first", 2, 1);
      const second = createBadge("second", 2, 2);
      const third = createBadge("third", 2, 3);

      expect(getTopBadge([third, first, second])).toEqual(first);
    });

    it("does not mutate original array", () => {
      const badges = [
        createBadge("a", 1, 3),
        createBadge("b", 3, 1),
        createBadge("c", 2, 2),
      ];
      const originalOrder = [...badges];

      getTopBadge(badges);

      expect(badges).toEqual(originalOrder);
    });
  });
});
