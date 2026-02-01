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
      accent: "emerald",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      description: "Roads are clear. Great time to travel!",
      tip: "Enjoy the smooth commute",
      icon: "🚗",
    },
    Moderate: {
      color: "text-amber-400",
      accent: "amber",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      description: "Some congestion on main routes.",
      tip: "Consider alternate routes",
      icon: "🚙",
    },
    Heavy: {
      color: "text-red-400",
      accent: "red",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      description: "Significant delays expected.",
      tip: "Delay travel if possible",
      icon: "🚦",
    },
  };

  const info = level ? trafficInfo[level] : null;

  if (!info) {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="text-4xl opacity-20">📡</div>
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Data Unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status indicator */}
      <div className={`relative overflow-hidden glass-card ${info.bg} ${info.border} border rounded-3xl p-8 text-center`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
        <div className="relative z-10">
          <span className="text-6xl mb-4 block transform transition-transform hover:scale-110 duration-500">{info.icon}</span>
          <h3 className={`text-3xl font-black tracking-tighter mb-2 ${info.color}`}>{level} Flow</h3>
          <p className="text-sm font-bold text-slate-300 leading-relaxed max-w-[200px] mx-auto">{info.description}</p>
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-4 glass-card premium-border rounded-2xl p-5 bg-white/5">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl shadow-inner">💡</div>
        <div>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Local Insight</p>
          <p className="text-sm font-bold text-slate-200 leading-snug">{info.tip}</p>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={onViewDetails}
        className="group w-full py-4 glass-card premium-border rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300 flex items-center justify-center gap-2"
      >
        <span>View Full Dashboard</span>
        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
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
    <div className="space-y-6">
      {/* Count display */}
      <div className="relative overflow-hidden glass-card bg-purple-500/10 border-purple-500/20 border rounded-3xl p-8 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-50" />
        <div className="relative z-10">
          <span className="text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">{count}</span>
          <p className="text-xs font-black text-purple-400 uppercase tracking-[0.2em] mt-2">
            Local Events Today
          </p>
        </div>
      </div>

      {/* Categories preview */}
      <div className="grid grid-cols-2 gap-3">
        {["🎵 Music", "🎭 Arts", "🏃 Sports", "🍔 Food"].map((cat) => (
          <button
            key={cat}
            onClick={onExplore}
            className="glass-card bg-white/5 border border-white/5 hover:bg-white/10 rounded-2xl py-3 px-4 text-xs font-bold text-slate-300 text-center transition-all duration-300 hover:scale-[1.05]"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Action button */}
      <button
        onClick={onExplore}
        className="group w-full py-4 glass-card border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-purple-300 transition-all duration-300 flex items-center justify-center gap-2"
      >
        <span>Discover Everything</span>
        <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
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
      <div className="text-center py-10 space-y-6">
        <span className="text-6xl block transform animate-bounce">😐</span>
        <div className="space-y-2">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Quiet in the City</p>
          <p className="text-[11px] font-bold text-slate-500 max-w-[180px] mx-auto leading-relaxed">No mood pulses recorded yet in this area.</p>
        </div>
        <button
          onClick={onSetVibe}
          className="px-6 py-3 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl border border-emerald-500/30 hover:bg-emerald-500/20 transition-all duration-300"
        >
          Initialize the Vibe
        </button>
      </div>
    );
  }

  const moodLabels: Record<string, string> = {
    "😊": "Radiant",
    "😐": "Balanced",
    "😢": "Low Energy",
    "😡": "Heated",
    "😴": "Quiet",
    "🤩": "Electric",
  };

  return (
    <div className="space-y-6">
      {/* Dominant mood */}
      <div className="relative overflow-hidden glass-card bg-amber-500/10 border-amber-500/20 border rounded-3xl p-8 text-center">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-500/10 to-transparent" />
        <div className="relative z-10">
          <span className="text-7xl mb-4 block drop-shadow-xl">{mood.dominantMood}</span>
          <h3 className="text-3xl font-black text-amber-100 tracking-tighter">
            {moodLabels[mood.dominantMood || ""] || "Pulsing"} State
          </h3>
          <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-black/30 rounded-full border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {mood.pulseCount} Active Pulses
            </span>
          </div>
        </div>
      </div>

      {/* Mood breakdown bars */}
      {mood.scores && mood.scores.length > 0 && (
        <div className="glass-card premium-border rounded-2xl p-5 bg-white/5 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Sentiment Breakdown
          </p>
          <div className="space-y-3">
            {mood.scores.slice(0, 5).map((score: MoodScore) => (
              <div key={score.mood} className="flex items-center gap-4">
                <span className="text-xl w-6 flex-shrink-0">{score.mood}</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${score.percent}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-slate-400 w-8 text-right font-mono">
                  {score.percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vibe headline */}
      {mood.vibeHeadline && (
        <div className="glass-card border border-white/5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl p-5 text-center">
          <p className="text-sm font-bold text-slate-200 leading-snug tracking-tight mb-1">&quot;{mood.vibeHeadline}&quot;</p>
          {mood.vibeSubtext && (
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{mood.vibeSubtext}</p>
          )}
        </div>
      )}


      {/* Action button */}
      <button
        onClick={onSetVibe}
        className="group w-full py-4 glass-card border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-amber-300 transition-all duration-300 flex items-center justify-center gap-2"
      >
        <span>Contribute Your Pulse</span>
        <svg className="w-4 h-4 transform group-hover:scale-125 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
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
              setTimeout(onTrafficClick, 300);
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
              setTimeout(onEventsClick, 300);
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
              setTimeout(onMoodClick, 300);
            }}
          />
        )}
      />
    </div>
  );
}
