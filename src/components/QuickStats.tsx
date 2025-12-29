"use client";

import React from "react";
import type { TrafficLevel, CityMood } from "./types";
import StatCard from "@/components/StatCard";

type QuickStatsProps = {
  trafficLevel: TrafficLevel | null;
  trafficLoading: boolean;
  eventsCount: number;
  eventsLoading: boolean;
  cityMood: CityMood | null;
  cityMoodLoading: boolean;
  onTrafficClick: () => void;
  onEventsClick: () => void;
  onMoodClick: () => void;
};

/**
 * Quick Stats Row - 3 equal columns showing Traffic, Events, and Mood
 *
 * Each stat: bg-slate-800/60, border-slate-700/50, rounded-xl, p-3, text-center
 * Traffic: Car icon (color based on level)
 * Events: Calendar icon (purple-400)
 * Mood: Emoji (amber-400)
 */
export default function QuickStats({
  trafficLevel,
  trafficLoading,
  eventsCount,
  eventsLoading,
  cityMood,
  cityMoodLoading,
  onTrafficClick,
  onEventsClick,
  onMoodClick,
}: QuickStatsProps) {
  // Traffic icon color based on level
  const getTrafficColor = (): string => {
    switch (trafficLevel) {
      case "Light":
        return "text-emerald-400";
      case "Moderate":
        return "text-amber-400";
      case "Heavy":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  const getTrafficLabel = (): string => {
    if (trafficLoading) return "...";
    return trafficLevel || "N/A";
  };

  const getEventsLabel = (): string => {
    if (eventsLoading) return "...";
    return eventsCount.toString();
  };

  const getMoodEmoji = (): string => {
    if (cityMoodLoading) return "...";
    return cityMood?.dominantMood || "😐";
  };

  const getMoodLabel = (): string => {
    if (cityMoodLoading) return "Reading...";
    if (!cityMood || cityMood.pulseCount === 0) return "No data";

    // Map emoji to mood word
    const moodLabels: Record<string, string> = {
      "😊": "Happy",
      "😐": "Neutral",
      "😢": "Sad",
      "😡": "Angry",
      "😴": "Sleepy",
      "🤩": "Excited",
    };

    return moodLabels[cityMood.dominantMood || ""] || "Mixed";
  };

  const hasMoodData =
    !!cityMood && cityMood.pulseCount > 0 && !!cityMood.dominantMood;

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        icon={
          <svg
            className={`w-6 h-6 ${getTrafficColor()}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
            />
          </svg>
        }
        value={getTrafficLabel()}
        label="Traffic"
        onClick={onTrafficClick}
        accentColor="emerald"
      />

      <StatCard
        icon={
          <svg
            className="w-6 h-6 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
        }
        value={getEventsLabel()}
        label="Events"
        onClick={onEventsClick}
        accentColor="purple"
      />

      <StatCard
        icon={
          cityMoodLoading ? (
            <div
              className="w-6 h-6 bg-slate-700/50 rounded-full animate-pulse"
              aria-hidden="true"
            />
          ) : hasMoodData ? (
            <span className="text-xl text-amber-400" aria-hidden="true">
              {getMoodEmoji()}
            </span>
          ) : (
            <div className="relative" aria-hidden="true">
              <span className="text-xl opacity-60">😐</span>
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full motion-safe:animate-ping" />
            </div>
          )
        }
        value={
          cityMoodLoading ? "..." : hasMoodData ? getMoodLabel() : "Be first"
        }
        label={hasMoodData ? "Mood" : "Set the vibe"}
        onClick={onMoodClick}
        accentColor={hasMoodData ? "amber" : "emerald"}
        ariaLabel={hasMoodData ? `Mood: ${getMoodLabel()}` : "Set the vibe"}
      />
    </div>
  );
}
