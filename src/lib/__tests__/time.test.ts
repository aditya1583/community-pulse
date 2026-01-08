import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTime } from "@/lib/time";

/**
 * Time Utility Tests
 *
 * Tests for relative time formatting function.
 * Uses fake timers to ensure consistent test results.
 */

describe("Time Utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a fixed "now" date
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatRelativeTime", () => {
    describe("minutes ago", () => {
      it("shows 0m ago for times just now", () => {
        const now = new Date("2024-06-15T12:00:00Z");
        expect(formatRelativeTime(now.toISOString())).toBe("0m ago");
      });

      it("shows minutes for times under an hour ago", () => {
        const fiveMinAgo = new Date("2024-06-15T11:55:00Z");
        expect(formatRelativeTime(fiveMinAgo.toISOString())).toBe("5m ago");

        const thirtyMinAgo = new Date("2024-06-15T11:30:00Z");
        expect(formatRelativeTime(thirtyMinAgo.toISOString())).toBe("30m ago");

        const fiftyNineMinAgo = new Date("2024-06-15T11:01:00Z");
        expect(formatRelativeTime(fiftyNineMinAgo.toISOString())).toBe("59m ago");
      });
    });

    describe("hours ago", () => {
      it("shows hours for times 1-23 hours ago", () => {
        const oneHourAgo = new Date("2024-06-15T11:00:00Z");
        expect(formatRelativeTime(oneHourAgo.toISOString())).toBe("1h ago");

        const sixHoursAgo = new Date("2024-06-15T06:00:00Z");
        expect(formatRelativeTime(sixHoursAgo.toISOString())).toBe("6h ago");

        const twentyThreeHoursAgo = new Date("2024-06-14T13:00:00Z");
        expect(formatRelativeTime(twentyThreeHoursAgo.toISOString())).toBe("23h ago");
      });
    });

    describe("days ago", () => {
      it("shows days for times 1-6 days ago", () => {
        const oneDayAgo = new Date("2024-06-14T12:00:00Z");
        expect(formatRelativeTime(oneDayAgo.toISOString())).toBe("1d ago");

        const threeDaysAgo = new Date("2024-06-12T12:00:00Z");
        expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe("3d ago");

        const sixDaysAgo = new Date("2024-06-09T12:00:00Z");
        expect(formatRelativeTime(sixDaysAgo.toISOString())).toBe("6d ago");
      });
    });

    describe("date format for older times", () => {
      it("shows month and day for times 7+ days ago", () => {
        const sevenDaysAgo = new Date("2024-06-08T12:00:00Z");
        expect(formatRelativeTime(sevenDaysAgo.toISOString())).toBe("Jun 8");

        const thirtyDaysAgo = new Date("2024-05-16T12:00:00Z");
        expect(formatRelativeTime(thirtyDaysAgo.toISOString())).toBe("May 16");

        const lastYear = new Date("2023-12-25T12:00:00Z");
        expect(formatRelativeTime(lastYear.toISOString())).toBe("Dec 25");
      });
    });

    describe("edge cases", () => {
      it("handles future dates gracefully (shows 0m ago)", () => {
        const future = new Date("2024-06-15T13:00:00Z");
        // Should show 0m ago for future dates (Math.max(0, diffMins))
        expect(formatRelativeTime(future.toISOString())).toBe("0m ago");
      });

      it("handles exactly 60 minutes (shows 1h ago)", () => {
        const exactlyOneHour = new Date("2024-06-15T11:00:00Z");
        expect(formatRelativeTime(exactlyOneHour.toISOString())).toBe("1h ago");
      });

      it("handles exactly 24 hours (shows 1d ago)", () => {
        const exactlyOneDay = new Date("2024-06-14T12:00:00Z");
        expect(formatRelativeTime(exactlyOneDay.toISOString())).toBe("1d ago");
      });
    });
  });
});
