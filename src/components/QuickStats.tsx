"use client";

import React from "react";
import type { TrafficLevel, CityMood, MoodScore } from "./types";
import BentoStatCard from "@/components/BentoStatCard";

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
 * Expanded Traffic Content - Shows detailed traffic info
 */
function TrafficExpandedContent({
  level,
  onViewDetails
}: {
  level: TrafficLevel | null;
  onViewDetails?: () => void;
}) {
  const trafficInfo = {
    Light: {
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
      description: "Roads are clear. Great time to drive!",
      tip: "Enjoy the smooth commute",
      icon: "🚗",
    },
    Moderate: {
      color: "text-amber-400",
      bg: "bg-amber-500/20",
      description: "Some congestion on main routes.",
      tip: "Consider alternate routes",
      icon: "🚙",
    },
    Heavy: {
      color: "text-red-400",
      bg: "bg-red-500/20",
      description: "Significant delays expected.",
      tip: "Delay travel if possible",
      icon: "🚦",
    },
  };

  const info = level ? trafficInfo[level] : null;

  if (!info) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p>Traffic data unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className={`${info.bg} rounded-xl p-4 text-center`}>
        <span className="text-4xl">{info.icon}</span>
        <h3 className={`text-2xl font-bold mt-2 ${info.color}`}>{level} Traffic</h3>
        <p className="text-slate-300 mt-1">{info.description}</p>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
        <span className="text-lg">💡</span>
        <div>
          <p className="text-sm font-medium text-slate-200">Pro tip</p>
          <p className="text-sm text-slate-400">{info.tip}</p>
        </div>
      </div>

      {/* View more button */}
      <button
        className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-300 transition-colors"
        onClick={onViewDetails}
      >
        View full traffic details →
      </button>
    </div>
  );
}

/**
 * Expanded Events Content - Shows event count and quick preview
 */
function EventsExpandedContent({
  count,
  onExplore
}: {
  count: number;
  onExplore?: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Count display */}
      <div className="bg-purple-500/20 rounded-xl p-4 text-center">
        <span className="text-5xl font-bold text-purple-400">{count}</span>
        <p className="text-slate-300 mt-1">
          {count === 1 ? "Event happening today" : "Events happening today"}
        </p>
      </div>

      {/* Categories preview */}
      <div className="grid grid-cols-2 gap-2">
        {["🎵 Music", "🎭 Arts", "🏃 Sports", "🍔 Food"].map((cat) => (
          <button
            key={cat}
            onClick={onExplore}
            className="bg-white/5 hover:bg-white/10 rounded-lg p-2.5 text-sm text-slate-300 text-center transition-colors"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Explore button */}
      <button
        className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-sm text-purple-300 transition-colors"
        onClick={onExplore}
      >
        Explore all events →
      </button>
    </div>
  );
}

/**
 * Expanded Mood Content - Shows mood breakdown
 */
function MoodExpandedContent({
  mood,
  onSetVibe
}: {
  mood: CityMood | null;
  onSetVibe?: () => void;
}) {
  if (!mood || mood.pulseCount === 0) {
    return (
      <div className="text-center py-8">
        <span className="text-5xl">😐</span>
        <p className="text-slate-400 mt-3">No mood data yet</p>
        <button
          onClick={onSetVibe}
          className="text-sm text-emerald-400 hover:text-emerald-300 mt-1 underline underline-offset-2 transition-colors"
        >
          Be the first to set the vibe!
        </button>
      </div>
    );
  }

  const moodLabels: Record<string, string> = {
    "😊": "Happy",
    "😐": "Neutral",
    "😢": "Sad",
    "😡": "Angry",
    "😴": "Sleepy",
    "🤩": "Excited",
  };

  return (
    <div className="space-y-4">
      {/* Dominant mood */}
      <div className="bg-amber-500/20 rounded-xl p-4 text-center">
        <span className="text-5xl">{mood.dominantMood}</span>
        <h3 className="text-xl font-bold text-amber-400 mt-2">
          {moodLabels[mood.dominantMood || ""] || "Mixed"} Vibes
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Based on {mood.pulseCount} {mood.pulseCount === 1 ? "pulse" : "pulses"}
        </p>
      </div>

      {/* Mood breakdown bars */}
      {mood.scores && mood.scores.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Mood breakdown
          </p>
          {mood.scores.slice(0, 5).map((score: MoodScore) => (
            <div key={score.mood} className="flex items-center gap-3">
              <span className="text-lg w-8">{score.mood}</span>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${score.percent}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 w-10 text-right">
                {score.percent}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Vibe headline */}
      {mood.vibeHeadline && (
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-sm text-slate-300">{mood.vibeHeadline}</p>
          {mood.vibeSubtext && (
            <p className="text-xs text-slate-500 mt-1">{mood.vibeSubtext}</p>
          )}
        </div>
      )}

      {/* Add vibe button */}
      <button
        className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-sm text-amber-300 transition-colors"
        onClick={onSetVibe}
      >
        Drop your pulse →
      </button>
    </div>
  );
}

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
      <BentoStatCard
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
        expandedTitle="Traffic Conditions"
        expandedContent={(closeModal) => (
          <TrafficExpandedContent
            level={trafficLevel}
            onViewDetails={() => {
              closeModal();
              onTrafficClick();
            }}
          />
        )}
      />

      <BentoStatCard
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
        expandedTitle="Today's Events"
        expandedContent={(closeModal) => (
          <EventsExpandedContent
            count={eventsCount}
            onExplore={() => {
              closeModal();
              onEventsClick();
            }}
          />
        )}
      />

      <BentoStatCard
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
        expandedTitle="City Mood"
        expandedContent={(closeModal) => (
          <MoodExpandedContent
            mood={cityMood}
            onSetVibe={() => {
              closeModal();
              onMoodClick();
            }}
          />
        )}
      />
    </div>
  );
}
