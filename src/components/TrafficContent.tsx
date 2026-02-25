"use client";

import React, { useMemo } from "react";
import type { TrafficLevel, Pulse, TrafficIncident } from "./types";
import TabPulseInput from "./TabPulseInput";

type TrafficContentProps = {
  trafficLevel: TrafficLevel | null;
  trafficLoading: boolean;
  trafficError: string | null;
  trafficPulses: Pulse[];
  cityName: string;
  // Real-time traffic incidents
  trafficIncidents?: TrafficIncident[];
  hasRoadClosure?: boolean;
  // Pulse input props
  isSignedIn: boolean;
  identityReady: boolean;
  displayName: string;
  pulseLoading: boolean;
  pulseMood: string;
  pulseMessage: string;
  moodValidationError: string | null;
  messageValidationError: string | null;
  showValidationErrors: boolean;
  onMoodChange: (mood: string) => void;
  onMessageChange: (message: string) => void;
  onSubmit: () => void;
  onSignInClick: () => void;
};

// Traffic mood sentiment analysis
// Maps mood emojis to sentiment scores (-1 = bad, 0 = neutral, 1 = good)
const TRAFFIC_MOOD_SENTIMENT: Record<string, { score: number; label: string }> = {
  "😤": { score: -1, label: "Frustrated" },
  "🏃": { score: -0.5, label: "Rushed" },
  "😌": { score: 1, label: "Chill" },
  "🛑": { score: -1, label: "Stuck" },
  // Fallback for other moods
  "😊": { score: 0.5, label: "Good" },
  "😐": { score: 0, label: "Neutral" },
  "😢": { score: -0.5, label: "Frustrated" },
  "😡": { score: -1, label: "Frustrated" },
  "😴": { score: 0, label: "Slow" },
  "🤩": { score: 1, label: "Great" },
};

type TrafficIntelligence = {
  recentCount: number;
  lastHourCount: number;
  dominantMood: string | null;
  dominantMoodLabel: string;
  averageSentiment: number;
  sentimentLabel: "Good" | "Mixed" | "Rough";
  hasUserData: boolean;
};

/**
 * Traffic Tab Content
 *
 * Shows real-time traffic section with road conditions
 * Plus community traffic reports from pulses
 *
 * Intelligence features:
 * - User-sourced traffic sentiment from pulse moods
 * - Recent report counts with time-awareness
 * - Fallback to time-based patterns when no user data
 */
export default function TrafficContent({
  trafficLevel,
  trafficLoading,
  trafficError,
  trafficPulses,
  cityName,
  trafficIncidents = [],
  hasRoadClosure = false,
  isSignedIn,
  identityReady,
  displayName,
  pulseLoading,
  pulseMood,
  pulseMessage,
  moodValidationError,
  messageValidationError,
  showValidationErrors,
  onMoodChange,
  onMessageChange,
  onSubmit,
  onSignInClick,
}: TrafficContentProps) {
  // Stable now state for purity and reactive updates
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Calculate traffic intelligence from user pulses
  const intelligence = useMemo((): TrafficIntelligence => {
    const oneHourAgo = now - 60 * 60 * 1000;

    // Filter pulses from the last hour
    const lastHourPulses = trafficPulses.filter(
      (p) => new Date(p.createdAt).getTime() > oneHourAgo
    );

    if (trafficPulses.length === 0) {
      return {
        recentCount: 0,
        lastHourCount: 0,
        dominantMood: null,
        dominantMoodLabel: "",
        averageSentiment: 0,
        sentimentLabel: "Mixed",
        hasUserData: false,
      };
    }

    // Count mood occurrences
    const moodCounts: Record<string, number> = {};
    let totalSentiment = 0;
    let sentimentCount = 0;

    for (const pulse of lastHourPulses.length > 0 ? lastHourPulses : trafficPulses.slice(0, 10)) {
      const mood = pulse.mood;
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;

      const moodInfo = TRAFFIC_MOOD_SENTIMENT[mood];
      if (moodInfo) {
        totalSentiment += moodInfo.score;
        sentimentCount++;
      }
    }

    // Find dominant mood
    let dominantMood: string | null = null;
    let maxCount = 0;
    for (const [mood, count] of Object.entries(moodCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    }

    const avgSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    const sentimentLabel: "Good" | "Mixed" | "Rough" =
      avgSentiment > 0.3 ? "Good" : avgSentiment < -0.3 ? "Rough" : "Mixed";

    return {
      recentCount: trafficPulses.length,
      lastHourCount: lastHourPulses.length,
      dominantMood,
      dominantMoodLabel: dominantMood
        ? TRAFFIC_MOOD_SENTIMENT[dominantMood]?.label || "Unknown"
        : "",
      averageSentiment: avgSentiment,
      sentimentLabel,
      hasUserData: trafficPulses.length > 0,
    };
  }, [trafficPulses, now]);

  // Get current hour for time-based patterns
  const currentHour = new Date().getHours();
  const isRushHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 16 && currentHour <= 19);
  const isLateNight = currentHour >= 22 || currentHour <= 5;

  // Traffic level config
  const getTrafficConfig = () => {
    switch (trafficLevel) {
      case "Light":
        return {
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/30",
          icon: "🟢",
          description: "Roads are clear. Great time to travel!",
        };
      case "Moderate":
        return {
          color: "text-amber-400",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/30",
          icon: "🟡",
          description: "Some congestion in busy areas. Allow extra time.",
        };
      case "Heavy":
        return {
          color: "text-red-400",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          icon: "🔴",
          description: "Significant delays expected. Consider alternate routes.",
        };
      default:
        return {
          color: "text-slate-400",
          bgColor: "bg-slate-800/60",
          borderColor: "border-slate-700/50",
          icon: "⚪",
          description: "Traffic data not available.",
        };
    }
  };

  const config = getTrafficConfig();

  // Determine if flash news should show (heavy traffic, incidents, or closures)
  const showFlashNews =
    trafficLevel === "Heavy" ||
    hasRoadClosure ||
    trafficIncidents.some((i) => i.severity >= 3);

  // Get the most important alert to display
  const flashNewsContent = useMemo(() => {
    // Priority 1: Road closures
    const closure = trafficIncidents.find((i) => i.type === "closure");
    if (closure || hasRoadClosure) {
      const road = closure?.roadName || "road";
      const desc = closure?.description || "Closure reported";
      return {
        icon: "🚧",
        type: "ROADWORK",
        message: closure?.roadName ? `${closure.roadName}: ${desc}` : desc,
        severity: "high" as const,
      };
    }

    // Priority 2: Major accidents
    const accident = trafficIncidents.find(
      (i) => i.type === "accident" && i.severity >= 3
    );
    if (accident) {
      const road = accident.roadName ? `${accident.roadName}: ` : "";
      return {
        icon: "🚨",
        type: "ACCIDENT",
        message: `${road}${accident.description || "Accident reported"}`,
        severity: "high" as const,
      };
    }

    // Priority 3: Heavy traffic
    if (trafficLevel === "Heavy") {
      const congestion = trafficIncidents.find((i) => i.type === "congestion");
      const road = congestion?.roadName ? `${congestion.roadName}: ` : "";
      return {
        icon: "🔴",
        type: "HEAVY TRAFFIC",
        message: `${road}${congestion?.description || "Major delays expected."}`,
        severity: "medium" as const,
      };
    }

    // Priority 4: Other significant incidents
    const significant = trafficIncidents.find((i) => i.severity >= 3);
    if (significant) {
      const road = significant.roadName ? `${significant.roadName}: ` : "";
      return {
        icon: "⚠️",
        type: "ALERT",
        message: `${road}${significant.description}`,
        severity: "medium" as const,
      };
    }

    return null;
  }, [trafficLevel, trafficIncidents, hasRoadClosure]);

  return (
    <div className="space-y-6">
      {/* Flash News Banner - Blinking alert for road conditions */}
      {showFlashNews && flashNewsContent && !trafficLoading && (
        <div
          className={`
            relative overflow-hidden glass-card rounded-2xl p-4 border-2
            ${flashNewsContent.severity === "high"
              ? "bg-red-500/10 border-red-500/40"
              : "bg-amber-500/10 border-amber-500/40"
            }
          `}
        >
          {/* Animated Background Pulse */}
          <div className={`absolute inset-0 opacity-10 ${flashNewsContent.severity === "high" ? "bg-red-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />

          <div className="relative z-10 flex items-center gap-4">
            <div className="flex-shrink-0 relative">
              <div className="w-12 h-12 rounded-xl bg-black/20 flex items-center justify-center text-3xl shadow-inner border border-white/5">
                {flashNewsContent.icon}
              </div>
              <span
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-black ${flashNewsContent.severity === "high"
                  ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
                  : "bg-amber-500 shadow-[0_0_10px_#f59e0b]"
                  } animate-ping`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md ${flashNewsContent.severity === "high"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-amber-500/20 text-amber-400"
                    }`}
                >
                  {flashNewsContent.type}
                </span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Live Alert
                </span>
              </div>
              <p
                className={`text-[15px] font-bold leading-tight ${flashNewsContent.severity === "high"
                  ? "text-red-100"
                  : "text-amber-100"
                  }`}
              >
                {flashNewsContent.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main traffic status card */}
      <div
        className={`
          relative overflow-hidden glass-card premium-border rounded-[2.5rem] p-8 text-center
          bg-gradient-to-br ${config.bgColor} to-transparent
          ${config.borderColor}
        `}
      >
        {/* Decorative elements */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-${trafficLevel === "Heavy" ? "red" : trafficLevel === "Moderate" ? "amber" : "emerald"}-400/50 to-transparent`} />

        {trafficLoading ? (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto bg-white/5 rounded-full animate-pulse" />
            <div className="h-8 w-48 mx-auto bg-white/5 rounded-xl animate-pulse" />
            <div className="h-4 w-64 mx-auto bg-white/5 rounded-lg animate-pulse" />
          </div>
        ) : trafficError ? (
          <div className="py-4">
            <span className="text-5xl mb-4 block">⚠️</span>
            <p className="text-sm font-bold text-red-400">{trafficError}</p>
          </div>
        ) : (
          <div className="relative z-10 space-y-4">
            <div className="text-7xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] transform transition-transform hover:scale-110 duration-500">
              {config.icon}
            </div>
            <div>
              <h3 className={`text-4xl font-black tracking-tighter ${config.color} leading-none mb-2`}>
                {trafficLevel ? `${trafficLevel} Flow` : "No Data"}
              </h3>
              <p className="text-sm font-bold text-slate-400 text-balance tracking-tight">
                {config.description}
              </p>
            </div>

            {/* TomTom Attribution */}
            <div className="pt-4">
              <a
                href="https://www.tomtom.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1 bg-black/20 rounded-full border border-white/5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
                Verified by TomTom
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Drop a Traffic Pulse */}
      <TabPulseInput
        category="Traffic"
        cityName={cityName}
        mood={pulseMood}
        message={pulseMessage}
        displayName={displayName}
        isSignedIn={isSignedIn}
        identityReady={identityReady}
        loading={pulseLoading}
        moodValidationError={moodValidationError}
        messageValidationError={messageValidationError}
        showValidationErrors={showValidationErrors}
        onMoodChange={onMoodChange}
        onMessageChange={onMessageChange}
        onSubmit={onSubmit}
        onSignInClick={onSignInClick}
      />

      {/* Traffic intelligence cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent Reports / Time Pattern Card */}
        <div className="glass-card premium-border rounded-3xl p-5 text-center transition-transform hover:scale-[1.02] duration-300">
          {intelligence.hasUserData ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <div className="text-xl font-black text-emerald-400">
                  {intelligence.lastHourCount > 0
                    ? intelligence.lastHourCount
                    : intelligence.recentCount}
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">
                {intelligence.lastHourCount > 0
                  ? "Reports / Hour"
                  : "Recent Reports"}
              </p>
              <p className="text-xs font-bold text-white tracking-tight">
                Crowdsourced Info
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Travel Tip</p>
              <p className="text-xs font-bold text-white tracking-tight">
                {isLateNight ? "Smooth night flow" : "Morning advantage"}
              </p>
            </>
          )}
        </div>

        {/* Traffic Mood / Rush Hour Card */}
        <div className="glass-card premium-border rounded-3xl p-5 text-center transition-transform hover:scale-[1.02] duration-300">
          {intelligence.hasUserData && intelligence.dominantMood ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3 text-2xl">
                {intelligence.dominantMood}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Commuter Mood</p>
              <p
                className={`text-xs font-bold tracking-tight ${intelligence.sentimentLabel === "Good"
                  ? "text-emerald-400"
                  : intelligence.sentimentLabel === "Rough"
                    ? "text-red-400"
                    : "text-amber-400"
                  }`}
              >
                {intelligence.sentimentLabel} Profile
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                <svg className={`w-6 h-6 ${isRushHour ? "text-red-400" : "text-amber-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">
                {isRushHour ? "Rush Active" : "Typical Rush"}
              </p>
              <p className={`text-xs font-bold tracking-tight ${isRushHour ? "text-red-400" : "text-white"}`}>
                {isRushHour ? "Heavy Volume" : "7-9am | 4-7pm"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Community traffic reports */}
      <div className="glass-card premium-border rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Reports</h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Community Pulses</p>
            </div>
          </div>
          {trafficPulses.length > 0 && (
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 uppercase tracking-widest">
              {trafficPulses.length} Total
            </span>
          )}
        </div>

        {trafficPulses.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <div className="text-4xl opacity-20">📡</div>
            <p className="text-sm font-bold text-slate-400">
              Quiet on the airwaves
            </p>
            <p className="text-[11px] font-medium text-slate-500 mx-auto max-w-[200px]">
              No recent traffic reports from the community in {cityName}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trafficPulses.slice(0, 5).map((pulse) => (
              <div
                key={pulse.id}
                className="group flex items-start gap-4 p-4 bg-black/20 hover:bg-black/30 rounded-2xl border border-white/5 transition-all duration-300"
              >
                <div className="text-2xl transform group-hover:scale-110 transition-transform duration-500">{pulse.mood}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-white leading-snug tracking-tight">
                    {pulse.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{pulse.author}</span>
                    <span className="text-[9px] font-black font-mono text-slate-600 uppercase tracking-widest">
                      {new Date(pulse.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
