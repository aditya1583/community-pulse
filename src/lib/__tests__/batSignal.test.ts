/**
 * Tests for Bat Signal - Smart Geo-Alert System
 */

import { describe, it, expect } from "vitest";
import {
  calculateVibeVelocity,
  shouldTriggerSpikeAlert,
  detectVibeShift,
  findKeywordClusters,
  isInQuietHours,
  generateNotificationMessage,
} from "../batSignal";

describe("calculateVibeVelocity", () => {
  it("returns 0 when no historical data and low activity", () => {
    expect(calculateVibeVelocity(2, null)).toBe(0);
    expect(calculateVibeVelocity(0, null)).toBe(0);
  });

  it("returns 100 when no historical data but high activity", () => {
    expect(calculateVibeVelocity(5, null)).toBe(100);
    expect(calculateVibeVelocity(10, null)).toBe(100);
  });

  it("calculates percentage increase correctly", () => {
    // Double the average = 100% increase
    expect(calculateVibeVelocity(10, 5)).toBe(100);
    // Triple = 200% increase
    expect(calculateVibeVelocity(15, 5)).toBe(200);
    // Same as average = 0% increase
    expect(calculateVibeVelocity(5, 5)).toBe(0);
  });

  it("handles decrease correctly", () => {
    // Half the average = -50% (decrease)
    expect(calculateVibeVelocity(5, 10)).toBe(-50);
  });
});

describe("shouldTriggerSpikeAlert", () => {
  it("does not trigger for very low activity", () => {
    expect(shouldTriggerSpikeAlert(2, 1)).toBe(false);
    expect(shouldTriggerSpikeAlert(1, 0.5)).toBe(false);
  });

  it("triggers when 200%+ increase with sufficient activity", () => {
    expect(shouldTriggerSpikeAlert(15, 5)).toBe(true); // 200% increase
    expect(shouldTriggerSpikeAlert(20, 5)).toBe(true); // 300% increase
  });

  it("does not trigger below threshold", () => {
    expect(shouldTriggerSpikeAlert(10, 5)).toBe(false); // 100% increase, below 200%
  });

  it("triggers with no history if 5+ pulses", () => {
    expect(shouldTriggerSpikeAlert(5, null)).toBe(true);
    expect(shouldTriggerSpikeAlert(4, null)).toBe(false);
  });

  it("respects custom threshold", () => {
    // 100% increase with 100% threshold should trigger
    expect(shouldTriggerSpikeAlert(10, 5, 100)).toBe(true);
    // 100% increase with 150% threshold should not trigger
    expect(shouldTriggerSpikeAlert(10, 5, 150)).toBe(false);
  });
});

describe("detectVibeShift", () => {
  it("detects escalating shift", () => {
    expect(detectVibeShift("quiet", "buzzing")).toEqual({
      shifted: true,
      direction: "escalating",
    });
    expect(detectVibeShift("active", "intense")).toEqual({
      shifted: true,
      direction: "escalating",
    });
  });

  it("detects calming shift", () => {
    expect(detectVibeShift("intense", "active")).toEqual({
      shifted: true,
      direction: "calming",
    });
    expect(detectVibeShift("buzzing", "quiet")).toEqual({
      shifted: true,
      direction: "calming",
    });
  });

  it("does not shift for small changes", () => {
    expect(detectVibeShift("quiet", "active")).toEqual({
      shifted: false,
      direction: "none",
    });
    expect(detectVibeShift("active", "buzzing")).toEqual({
      shifted: false,
      direction: "none",
    });
  });

  it("handles null previous state", () => {
    expect(detectVibeShift(null, "buzzing")).toEqual({
      shifted: false,
      direction: "none",
    });
  });
});

describe("findKeywordClusters", () => {
  const now = Date.now();

  const makePulse = (id: number, message: string, minutesAgo: number = 0) => ({
    id,
    message,
    created_at: new Date(now - minutesAgo * 60 * 1000).toISOString(),
  });

  it("finds clusters with 3+ mentions", () => {
    const pulses = [
      makePulse(1, "Police activity on Main St"),
      makePulse(2, "Saw the police nearby"),
      makePulse(3, "POLICE everywhere!"),
    ];

    const clusters = findKeywordClusters(pulses, ["police"]);
    expect(clusters.size).toBe(1);
    expect(clusters.get("police")).toEqual([1, 2, 3]);
  });

  it("ignores clusters with fewer than 3 mentions", () => {
    const pulses = [
      makePulse(1, "Police activity"),
      makePulse(2, "Nothing to see here"),
    ];

    const clusters = findKeywordClusters(pulses, ["police"]);
    expect(clusters.size).toBe(0);
  });

  it("respects time window", () => {
    const pulses = [
      makePulse(1, "Fire reported", 0), // Now
      makePulse(2, "Fire trucks arriving", 30), // 30 mins ago
      makePulse(3, "More fire activity", 90), // Outside window
    ];

    const clusters = findKeywordClusters(pulses, ["fire"], 60);
    expect(clusters.size).toBe(0); // Only 2 within window
  });

  it("handles multiple keywords", () => {
    const pulses = [
      makePulse(1, "Police and fire on scene"),
      makePulse(2, "Fire department responding"),
      makePulse(3, "Major fire downtown"),
      makePulse(4, "Police directing traffic"),
      makePulse(5, "Another police car arrived"),
    ];

    const clusters = findKeywordClusters(pulses, ["police", "fire"]);
    expect(clusters.get("police")).toEqual([1, 4, 5]);
    expect(clusters.get("fire")).toEqual([1, 2, 3]);
  });

  it("uses word boundary matching", () => {
    const pulses = [
      makePulse(1, "Fireplace sale today"),
      makePulse(2, "Campfire at the park"),
      makePulse(3, "Wildfire warning"),
    ];

    // "fire" should not match these because they are part of compound words
    const clusters = findKeywordClusters(pulses, ["fire"]);
    expect(clusters.size).toBe(0);
  });
});

describe("isInQuietHours", () => {
  // Note: These tests may be timezone-sensitive
  // In production, the actual time check happens in the user's timezone

  it("returns false when quiet hours not set", () => {
    expect(isInQuietHours(null, null)).toBe(false);
    expect(isInQuietHours("22:00", null)).toBe(false);
    expect(isInQuietHours(null, "07:00")).toBe(false);
  });

  // Additional time-based tests would require mocking Date
});

describe("generateNotificationMessage", () => {
  it("generates spike alert message", () => {
    const message = generateNotificationMessage({
      type: "spike_alert",
      city: "Austin, TX",
      currentHourCount: 15,
      rollingAverage: 5,
      percentIncrease: 200,
      dominantMood: null,
      dominantTag: null,
    });

    expect(message.title).toBe("Something is happening in Austin");
    expect(message.body).toContain("15 pulses");
    expect(message.tag).toContain("spike-");
  });

  it("generates vibe shift message", () => {
    const message = generateNotificationMessage({
      type: "vibe_shift",
      city: "Leander, TX",
      previousVibe: "quiet",
      currentVibe: "buzzing",
      dominantMood: null,
      dominantMoodPercent: 0,
      pulseCount: 10,
    });

    expect(message.title).toBe("Leander just went Buzzing");
    expect(message.body).toContain("Quiet");
    expect(message.body).toContain("10 people");
  });

  it("generates keyword cluster message", () => {
    const message = generateNotificationMessage({
      type: "keyword_cluster",
      city: "Cedar Park, TX",
      keyword: "police",
      matchCount: 5,
      radiusMiles: 1.0,
      recentPulseIds: [1, 2, 3, 4, 5],
    });

    expect(message.title).toContain("Police");
    expect(message.title).toContain("Cedar Park");
    expect(message.body).toContain("5 people");
  });
});
