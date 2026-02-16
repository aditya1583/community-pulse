import { describe, expect, it } from "vitest";
import {
  formatPulseLocation,
  isInLocalToday,
  isInRecentWindow,
  isPostEnabled,
  readOnboardingCompleted,
  resetComposerAfterSuccessfulPost,
  shouldShowFirstPulseOnboarding,
  startOfRecentWindow,
  writeOnboardingCompleted,
  // Ephemeral pulse functions
  calculateExpiryTime,
  getRemainingSeconds,
  getPulseExpiryStatus,
  isPulseVisible,
  filterVisiblePulses,
  formatRemainingTime,
  getPulseOpacity,
  getExpiryClasses,
} from "@/lib/pulses";

describe("pulse helpers", () => {
  it("shows onboarding only when auth+identity resolved and pulseCount===0", () => {
    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "loading",
        identityReady: true,
        pulseCountResolved: true,
        userPulseCount: 0,
        onboardingCompleted: false,
        hasShownThisSession: false,
      })
    ).toBe(false);

    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "signed_in",
        identityReady: false,
        pulseCountResolved: true,
        userPulseCount: 0,
        onboardingCompleted: false,
        hasShownThisSession: false,
      })
    ).toBe(false);

    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "signed_in",
        identityReady: true,
        pulseCountResolved: false,
        userPulseCount: 0,
        onboardingCompleted: false,
        hasShownThisSession: false,
      })
    ).toBe(false);

    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "signed_in",
        identityReady: true,
        pulseCountResolved: true,
        userPulseCount: 1,
        onboardingCompleted: false,
        hasShownThisSession: false,
      })
    ).toBe(false);

    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "signed_in",
        identityReady: true,
        pulseCountResolved: true,
        userPulseCount: 0,
        onboardingCompleted: true,
        hasShownThisSession: false,
      })
    ).toBe(false);

    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "signed_in",
        identityReady: true,
        pulseCountResolved: true,
        userPulseCount: 0,
        onboardingCompleted: false,
        hasShownThisSession: true,
      })
    ).toBe(false);

    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "signed_in",
        identityReady: true,
        pulseCountResolved: true,
        userPulseCount: 0,
        onboardingCompleted: false,
        hasShownThisSession: false,
      })
    ).toBe(true);
  });

  it("persists onboarding completion (refresh simulation)", () => {
    const userId = "user-123";

    window.localStorage.clear();
    expect(readOnboardingCompleted(window.localStorage, userId)).toBe(false);

    writeOnboardingCompleted(window.localStorage, userId);
    expect(readOnboardingCompleted(window.localStorage, userId)).toBe(true);

    expect(
      shouldShowFirstPulseOnboarding({
        authStatus: "signed_in",
        identityReady: true,
        pulseCountResolved: true,
        userPulseCount: 0,
        onboardingCompleted: readOnboardingCompleted(window.localStorage, userId),
        hasShownThisSession: false,
      })
    ).toBe(false);
  });

  it("formats location without blanks", () => {
    expect(formatPulseLocation("Austin, TX, US")).toBe("Austin, TX, US");
    expect(formatPulseLocation("Austin, TX, US", "Downtown")).toBe(
      "Austin, TX, US · Downtown"
    );
    expect(formatPulseLocation("", null)).toBe("Unknown location");
  });

  it("filters to local 'today'", () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    expect(isInLocalToday(now.toISOString(), now)).toBe(true);
    expect(isInLocalToday(yesterday.toISOString(), now)).toBe(false);
  });

  // B7 FIX: Test the new 7-day recency window
  it("filters to recent 7-day window", () => {
    const now = new Date();

    // Today should be in the window
    expect(isInRecentWindow(now.toISOString(), now)).toBe(true);

    // Yesterday should be in the window
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    expect(isInRecentWindow(yesterday.toISOString(), now)).toBe(true);

    // 6 days ago should be in the window
    const sixDaysAgo = new Date(now);
    sixDaysAgo.setDate(now.getDate() - 6);
    expect(isInRecentWindow(sixDaysAgo.toISOString(), now)).toBe(true);

    // 8 days ago should NOT be in the window
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setDate(now.getDate() - 8);
    expect(isInRecentWindow(eightDaysAgo.toISOString(), now)).toBe(false);

    // Invalid date should return false
    expect(isInRecentWindow("not-a-date", now)).toBe(false);
  });

  it("calculates start of recent window correctly", () => {
    const now = new Date("2024-03-15T12:00:00Z");
    const start = startOfRecentWindow(now, 7);

    // Should be 7 days before, at midnight local time
    expect(start.getDate()).toBe(now.getDate() - 7);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
  });

  it("resets composer and disables posting until reselected", () => {
    const reset = resetComposerAfterSuccessfulPost();
    expect(reset.message).toBe("");
    expect(reset.mood).toBe("");
    expect(reset.tag).toBe("");

    expect(
      isPostEnabled({
        identityReady: true,
        loading: false,
        mood: reset.mood,
        tag: reset.tag,
        message: reset.message,
      })
    ).toBe(false);
  });

  it("requires identity, mood, tag, and message for posting", () => {
    // All fields filled - should be enabled
    expect(
      isPostEnabled({
        identityReady: true,
        loading: false,
        mood: "happy",
        tag: "General",
        message: "Hello world",
      })
    ).toBe(true);

    // Identity not ready - should be disabled
    expect(
      isPostEnabled({
        identityReady: false,
        loading: false,
        mood: "happy",
        tag: "General",
        message: "Hello world",
      })
    ).toBe(false);

    // Loading - should be disabled
    expect(
      isPostEnabled({
        identityReady: true,
        loading: true,
        mood: "happy",
        tag: "General",
        message: "Hello world",
      })
    ).toBe(false);

    // No mood - should be disabled
    expect(
      isPostEnabled({
        identityReady: true,
        loading: false,
        mood: "",
        tag: "General",
        message: "Hello world",
      })
    ).toBe(false);

    // No tag - should be disabled
    expect(
      isPostEnabled({
        identityReady: true,
        loading: false,
        mood: "happy",
        tag: "",
        message: "Hello world",
      })
    ).toBe(false);

    // Empty message - should be disabled
    expect(
      isPostEnabled({
        identityReady: true,
        loading: false,
        mood: "happy",
        tag: "General",
        message: "",
      })
    ).toBe(false);

    // Whitespace-only message - should be disabled
    expect(
      isPostEnabled({
        identityReady: true,
        loading: false,
        mood: "happy",
        tag: "General",
        message: "   ",
      })
    ).toBe(false);
  });
});

// ============================================================================
// EPHEMERAL PULSE SYSTEM TESTS
// ============================================================================

describe("ephemeral pulse system", () => {
  describe("calculateExpiryTime", () => {
    it("calculates 2 hour lifespan for Traffic pulses", () => {
      const createdAt = new Date("2024-12-28T10:00:00Z");
      const expiresAt = calculateExpiryTime(createdAt, "Traffic");

      expect(expiresAt.getTime()).toBe(
        new Date("2024-12-28T12:00:00Z").getTime()
      );
    });

    it("calculates 4 hour lifespan for Weather pulses", () => {
      const createdAt = new Date("2024-12-28T10:00:00Z");
      const expiresAt = calculateExpiryTime(createdAt, "Weather");

      expect(expiresAt.getTime()).toBe(
        new Date("2024-12-28T14:00:00Z").getTime()
      );
    });

    it("calculates 24 hour lifespan for Events pulses", () => {
      const createdAt = new Date("2024-12-28T10:00:00Z");
      const expiresAt = calculateExpiryTime(createdAt, "Events");

      expect(expiresAt.getTime()).toBe(
        new Date("2024-12-29T10:00:00Z").getTime()
      );
    });

    it("calculates 24 hour lifespan for General pulses", () => {
      const createdAt = new Date("2024-12-28T10:00:00Z");
      const expiresAt = calculateExpiryTime(createdAt, "General");

      expect(expiresAt.getTime()).toBe(
        new Date("2024-12-29T10:00:00Z").getTime()
      );
    });

    it("handles string dates", () => {
      const expiresAt = calculateExpiryTime("2024-12-28T10:00:00Z", "Traffic");
      expect(expiresAt.getTime()).toBe(
        new Date("2024-12-28T12:00:00Z").getTime()
      );
    });

    it("defaults to 24 hours for unknown tags", () => {
      const createdAt = new Date("2024-12-28T10:00:00Z");
      const expiresAt = calculateExpiryTime(createdAt, "UnknownTag");

      expect(expiresAt.getTime()).toBe(
        new Date("2024-12-29T10:00:00Z").getTime()
      );
    });
  });

  describe("getRemainingSeconds", () => {
    it("returns positive seconds for future expiry", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T11:00:00Z"); // 1 hour later

      expect(getRemainingSeconds(expiresAt, now)).toBe(3600);
    });

    it("returns negative seconds for past expiry", () => {
      const now = new Date("2024-12-28T12:00:00Z");
      const expiresAt = new Date("2024-12-28T11:00:00Z"); // 1 hour earlier

      expect(getRemainingSeconds(expiresAt, now)).toBe(-3600);
    });

    it("returns null for null/undefined expiry", () => {
      const now = new Date();
      expect(getRemainingSeconds(null, now)).toBeNull();
      expect(getRemainingSeconds(undefined, now)).toBeNull();
    });

    it("returns null for invalid date strings", () => {
      const now = new Date();
      expect(getRemainingSeconds("not-a-date", now)).toBeNull();
    });
  });

  describe("getPulseExpiryStatus", () => {
    it("returns 'active' for pulses with no expiry", () => {
      expect(getPulseExpiryStatus(null)).toBe("active");
      expect(getPulseExpiryStatus(undefined)).toBe("active");
    });

    it("returns 'active' for pulses more than 30 minutes from expiry", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T11:00:00Z"); // 60 min remaining

      expect(getPulseExpiryStatus(expiresAt, now)).toBe("active");
    });

    it("returns 'expiring-soon' for pulses within 30 minutes of expiry", () => {
      const now = new Date("2024-12-28T10:35:00Z");
      const expiresAt = new Date("2024-12-28T11:00:00Z"); // 25 min remaining

      expect(getPulseExpiryStatus(expiresAt, now)).toBe("expiring-soon");
    });

    it("returns 'fading' for pulses past expiry but within grace period", () => {
      const now = new Date("2024-12-28T11:30:00Z");
      const expiresAt = new Date("2024-12-28T11:00:00Z"); // 30 min past expiry

      expect(getPulseExpiryStatus(expiresAt, now)).toBe("fading");
    });

    it("returns 'expired' for pulses past grace period (1 hour)", () => {
      const now = new Date("2024-12-28T12:01:00Z");
      const expiresAt = new Date("2024-12-28T11:00:00Z"); // 61 min past expiry

      expect(getPulseExpiryStatus(expiresAt, now)).toBe("expired");
    });
  });

  describe("isPulseVisible", () => {
    it("returns true for active pulses", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(isPulseVisible(expiresAt, now)).toBe(true);
    });

    it("returns true for expiring-soon pulses", () => {
      const now = new Date("2024-12-28T11:40:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(isPulseVisible(expiresAt, now)).toBe(true);
    });

    it("returns true for fading pulses (in grace period)", () => {
      const now = new Date("2024-12-28T12:30:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(isPulseVisible(expiresAt, now)).toBe(true);
    });

    it("returns false for fully expired pulses", () => {
      const now = new Date("2024-12-28T13:01:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(isPulseVisible(expiresAt, now)).toBe(false);
    });

    it("returns true for pulses with no expiry", () => {
      expect(isPulseVisible(null)).toBe(true);
      expect(isPulseVisible(undefined)).toBe(true);
    });
  });

  describe("filterVisiblePulses", () => {
    it("filters out expired pulses", () => {
      const now = new Date("2024-12-28T14:00:00Z");

      const pulses = [
        { id: 1, expiresAt: "2024-12-28T16:00:00Z" }, // active
        { id: 2, expiresAt: "2024-12-28T12:00:00Z" }, // expired (2h past + 1h grace)
        { id: 3, expiresAt: "2024-12-28T13:30:00Z" }, // fading (30 min into grace)
        { id: 4, expiresAt: null }, // no expiry
      ];

      const visible = filterVisiblePulses(pulses, now);

      expect(visible.map((p) => p.id)).toEqual([1, 3, 4]);
    });

    it("returns empty array for empty input", () => {
      expect(filterVisiblePulses([], new Date())).toEqual([]);
    });
  });

  describe("formatRemainingTime", () => {
    it("formats hours and minutes", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T12:30:00Z"); // 2h 30m

      expect(formatRemainingTime(expiresAt, now)).toBe("2h 30m left");
    });

    it("formats only hours when no minutes", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z"); // 2h

      expect(formatRemainingTime(expiresAt, now)).toBe("2h left");
    });

    it("formats only minutes when under an hour", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T10:45:00Z"); // 45m

      expect(formatRemainingTime(expiresAt, now)).toBe("45m left");
    });

    it("shows '< 1m left' for under a minute", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T10:00:30Z"); // 30s

      expect(formatRemainingTime(expiresAt, now)).toBe("< 1m left");
    });

    it("shows 'Fading...' for pulses in grace period", () => {
      const now = new Date("2024-12-28T10:30:00Z");
      const expiresAt = new Date("2024-12-28T10:00:00Z"); // 30m past

      expect(formatRemainingTime(expiresAt, now)).toBe("Fading...");
    });

    it("returns null for expired pulses", () => {
      const now = new Date("2024-12-28T12:00:00Z");
      const expiresAt = new Date("2024-12-28T10:00:00Z"); // 2h past (beyond grace)

      expect(formatRemainingTime(expiresAt, now)).toBeNull();
    });

    it("returns null for null expiry", () => {
      expect(formatRemainingTime(null)).toBeNull();
    });
  });

  describe("getPulseOpacity", () => {
    it("returns 1.0 for active pulses", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(getPulseOpacity(expiresAt, now)).toBe(1.0);
    });

    it("returns between 0.8 and 1.0 for expiring-soon pulses", () => {
      const now = new Date("2024-12-28T11:45:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z"); // 15 min left

      const opacity = getPulseOpacity(expiresAt, now);
      expect(opacity).toBeGreaterThan(0.8);
      expect(opacity).toBeLessThan(1.0);
    });

    it("returns between 0.4 and 0.8 for fading pulses", () => {
      const now = new Date("2024-12-28T12:30:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z"); // 30 min into grace

      const opacity = getPulseOpacity(expiresAt, now);
      expect(opacity).toBeGreaterThan(0.4);
      expect(opacity).toBeLessThan(0.8);
    });

    it("returns 0 for expired pulses", () => {
      const now = new Date("2024-12-28T14:00:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z"); // 2h past

      expect(getPulseOpacity(expiresAt, now)).toBe(0);
    });

    it("returns 1.0 for null expiry", () => {
      expect(getPulseOpacity(null)).toBe(1.0);
    });
  });

  describe("getExpiryClasses", () => {
    it("returns empty string for active pulses", () => {
      const now = new Date("2024-12-28T10:00:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(getExpiryClasses(expiresAt, now)).toBe("");
    });

    it("returns 'pulse-expiring-soon' for expiring-soon pulses", () => {
      const now = new Date("2024-12-28T11:40:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(getExpiryClasses(expiresAt, now)).toBe("pulse-expiring-soon");
    });

    it("returns 'pulse-fading' for fading pulses", () => {
      const now = new Date("2024-12-28T12:30:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(getExpiryClasses(expiresAt, now)).toBe("pulse-fading");
    });

    it("returns 'pulse-expired' for expired pulses", () => {
      const now = new Date("2024-12-28T14:00:00Z");
      const expiresAt = new Date("2024-12-28T12:00:00Z");

      expect(getExpiryClasses(expiresAt, now)).toBe("pulse-expired");
    });
  });
});
