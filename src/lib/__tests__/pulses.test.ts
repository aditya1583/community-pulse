import { describe, expect, it } from "vitest";
import {
  formatPulseDateTime,
  formatPulseLocation,
  isInLocalToday,
  isInRecentWindow,
  isPostEnabled,
  readOnboardingCompleted,
  resetComposerAfterSuccessfulPost,
  shouldShowFirstPulseOnboarding,
  startOfRecentWindow,
  writeOnboardingCompleted,
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

  it("formats date/time and location without blanks", () => {
    const nowIso = new Date().toISOString();
    expect(formatPulseDateTime(nowIso)).toBeTruthy();
    expect(formatPulseDateTime("not-a-date")).toBe("Unknown time");

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
