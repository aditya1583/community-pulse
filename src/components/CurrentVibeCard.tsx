"use client";

import React from "react";
import type { WeatherInfo, CityMood, VibeIntensity } from "./types";

type CurrentVibeCardProps = {
  weather: WeatherInfo | null;
  weatherLoading: boolean;
  recentPulseCount: number;
  onDropPulse?: () => void;
  // New props for pulse-based vibe system
  cityMood?: CityMood | null;
  cityMoodLoading?: boolean;
  // Gas price quick view
  gasPrice?: number | null;
  onGasPriceClick?: () => void;
};

/**
 * Current Vibe Card - Shows pulse-based city emotion with weather as secondary context
 *
 * The "gossip factor": Headlines should create curiosity
 * - "Austin is Frustrated" makes users wonder "Why?"
 * - "12 things happening in Leander" makes users want to see them
 *
 * When there are no pulses, we encourage users to be the first.
 * Weather is shown as supporting context, not the primary vibe.
 */
export default function CurrentVibeCard({
  weather,
  weatherLoading,
  recentPulseCount,
  onDropPulse,
  cityMood,
  cityMoodLoading = false,
  gasPrice,
  onGasPriceClick,
}: CurrentVibeCardProps) {
  const formatTempF = (temp: number) => `${Math.round(temp)}\u00B0F`;

  // Get the vibe emoji based on emotion or intensity
  const getVibeEmoji = (): string => {
    if (cityMoodLoading) return "...";

    // If we have pulse data, use the dominant mood emoji
    if (cityMood?.dominantMood) {
      return cityMood.dominantMood;
    }

    // Map vibe intensity to emoji for variety
    const intensityEmoji: Record<VibeIntensity, string> = {
      quiet: "\uD83C\uDF19", // 🌙
      active: "\u26A1", // ⚡
      buzzing: "\uD83D\uDD25", // 🔥
      intense: "\uD83C\uDF00", // 🌀
    };

    if (cityMood?.vibeIntensity) {
      return intensityEmoji[cityMood.vibeIntensity];
    }

    // Fallback to weather emoji if no pulse data
    if (weather) {
      return getWeatherEmoji();
    }

    return "\u2728"; // ✨ for loading/unknown
  };

  const getWeatherEmoji = (): string => {
    if (!weather) return "\u2728";

    const iconMap: Record<string, string> = {
      "01d": "\u2600\uFE0F",
      "01n": "\uD83C\uDF19",
      "02d": "\uD83C\uDF24\uFE0F",
      "02n": "\uD83C\uDF11",
      "03d": "\u2601\uFE0F",
      "03n": "\u2601\uFE0F",
      "04d": "\u2601\uFE0F",
      "04n": "\u2601\uFE0F",
      "09d": "\uD83C\uDF27\uFE0F",
      "09n": "\uD83C\uDF27\uFE0F",
      "10d": "\uD83C\uDF26\uFE0F",
      "10n": "\uD83C\uDF27\uFE0F",
      "11d": "\u26C8\uFE0F",
      "11n": "\u26C8\uFE0F",
      "13d": "\uD83C\uDF28\uFE0F",
      "13n": "\uD83C\uDF28\uFE0F",
      "50d": "\uD83C\uDF2B\uFE0F",
      "50n": "\uD83C\uDF2B\uFE0F",
    };

    return iconMap[weather.icon] || "\u2728";
  };

  // Get the headline - pulse-based emotion or fallback
  const getHeadline = (): string => {
    if (cityMoodLoading) return "Reading the vibe...";

    // Use the API-generated headline if available
    if (cityMood?.vibeHeadline) {
      return cityMood.vibeHeadline;
    }

    // Fallback: No pulse data, show weather-based vibe
    if (weather) {
      const desc = weather.description.toLowerCase();
      const temp = weather.temp;

      let tempVibe = "";
      if (temp < 40) tempVibe = "Chilly";
      else if (temp < 55) tempVibe = "Cool";
      else if (temp < 70) tempVibe = "Nice";
      else if (temp < 85) tempVibe = "Warm";
      else tempVibe = "Hot";

      if (desc.includes("rain") || desc.includes("drizzle")) return `${tempVibe} & Rainy`;
      if (desc.includes("cloud")) return `${tempVibe} & Cloudy`;
      if (desc.includes("clear") || desc.includes("sun")) return `${tempVibe} & Sunny`;

      return `${tempVibe} outside`;
    }

    return "Checking the vibe...";
  };

  // Get headline accent color based on emotion
  const getEmotionColor = (): string => {
    const emotion = cityMood?.vibeEmotion?.toLowerCase();

    const emotionColors: Record<string, string> = {
      frustrated: "text-red-400",
      angry: "text-red-400",
      stuck: "text-orange-400",
      rushed: "text-orange-400",
      overheated: "text-orange-400",
      busy: "text-amber-400",
      curious: "text-purple-400",
      excited: "text-emerald-400",
      thrilled: "text-emerald-400",
      happy: "text-emerald-400",
      blessed: "text-cyan-400",
      chill: "text-cyan-400",
      cozy: "text-violet-400",
      buzzing: "text-yellow-400",
      active: "text-emerald-400",
      quiet: "text-slate-400",
    };

    return emotionColors[emotion || ""] || "text-white";
  };

  // Build the subtext with weather context and pulse info
  const getSubtext = (): React.ReactNode => {
    // Use API-generated subtext if available
    if (cityMood?.vibeSubtext) {
      // Check if it's a "be the first" message
      if (cityMood.vibeSubtext.toLowerCase().includes("be the first")) {
        return (
          <>
            {cityMood.vibeSubtext}{" "}
            <button
              type="button"
              onClick={handleDropPulseClick}
              className="inline-flex items-center text-emerald-300/90 hover:text-emerald-200 underline decoration-emerald-400/40 hover:decoration-emerald-400/70 underline-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded-sm whitespace-nowrap"
            >
              Drop a pulse
            </button>
          </>
        );
      }

      // Add weather context if available
      if (weather && cityMood.pulseCount > 0) {
        return (
          <>
            {cityMood.vibeSubtext}
            <span aria-hidden="true" className="mx-2 text-slate-600">{"\u00B7"}</span>
            <span className="text-slate-500">{formatTempF(weather.temp)} outside</span>
          </>
        );
      }

      return cityMood.vibeSubtext;
    }

    // Fallback to original logic
    const parts: React.ReactNode[] = [];

    if (weather) {
      parts.push(<span key="temp">{formatTempF(weather.temp)}</span>);
    }

    if (recentPulseCount > 0) {
      parts.push(<span key="pulses">{recentPulseCount} pulses nearby</span>);
    } else {
      parts.push(
        <span key="empty">
          Quiet right now {"\u2014"}{" "}
          <button
            type="button"
            onClick={handleDropPulseClick}
            className="inline-flex items-center text-emerald-300/90 hover:text-emerald-200 underline decoration-emerald-400/40 hover:decoration-emerald-400/70 underline-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded-sm whitespace-nowrap"
          >
            Drop a pulse
          </button>
        </span>
      );
    }

    return parts.map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span aria-hidden="true" className="mx-2 text-slate-600">{"\u00B7"}</span>}
        {part}
      </React.Fragment>
    ));
  };

  const handleDropPulseClick = () => {
    if (onDropPulse) {
      onDropPulse();
      return;
    }
    document
      .getElementById("drop-a-pulse")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Border glow based on vibe intensity
  const getBorderGlow = (): string => {
    const intensity = cityMood?.vibeIntensity;

    if (intensity === "intense") {
      return "border-red-500/30 shadow-red-500/10";
    }
    if (intensity === "buzzing") {
      return "border-amber-500/30 shadow-amber-500/10";
    }
    if (intensity === "active") {
      return "border-emerald-500/30 shadow-emerald-500/10";
    }

    return "border-emerald-500/20 shadow-emerald-500/5";
  };

  const isLoading = weatherLoading || cityMoodLoading;

  return (
    <div className={`bento-card elevation-2 p-4 transition-all duration-500 ${getBorderGlow()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
            Current Vibe
          </p>

          {isLoading ? (
            <>
              <div className="h-7 w-48 bg-slate-700/50 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-slate-700/50 rounded animate-pulse" />
            </>
          ) : (
            <>
              <h2 className={`text-xl font-semibold mb-1 ${getEmotionColor()}`}>
                {getHeadline()}
              </h2>
              <p className="text-sm text-slate-400 flex flex-wrap items-center">
                {getSubtext()}
              </p>
            </>
          )}
        </div>

        <div className="text-3xl ml-4 transition-transform hover:scale-110">
          {getVibeEmoji()}
        </div>
      </div>

      {/* Gas Price Quick View */}
      {gasPrice && gasPrice > 0 && (
        <button
          onClick={onGasPriceClick}
          className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/30 rounded-lg transition-colors group"
        >
          <span className="text-base">⛽</span>
          <span className="text-sm font-medium text-amber-400">${gasPrice.toFixed(2)}</span>
          <span className="text-xs text-slate-500">Regular</span>
          <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
