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
  gasStationName?: string | null;
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
  // gasPrice is intentionally unused - we show station name only, not misleading price associations
  gasPrice: _unusedGasPrice,
  gasStationName,
  onGasPriceClick,
}: CurrentVibeCardProps) {
  void _unusedGasPrice; // Suppress unused variable warning - prop kept for API compatibility
  const formatTempF = (temp: number) => `${Math.round(temp)}\u00B0F`;

  // Get weather condition text with appropriate emoji
  const getWeatherDisplay = (): { emoji: string; text: string } | null => {
    if (weatherLoading || !weather) return null;

    const desc = weather.description?.toLowerCase() || "";
    const temp = weather.temp;

    // Map weather conditions to emoji and short description
    if (desc.includes("rain") || desc.includes("drizzle") || desc.includes("shower")) {
      return { emoji: "\uD83C\uDF27\uFE0F", text: `${formatTempF(temp)} Rain` };
    }
    if (desc.includes("thunder") || desc.includes("storm")) {
      return { emoji: "\u26C8\uFE0F", text: `${formatTempF(temp)} Storms` };
    }
    if (desc.includes("snow")) {
      return { emoji: "\uD83C\uDF28\uFE0F", text: `${formatTempF(temp)} Snow` };
    }
    if (desc.includes("fog") || desc.includes("mist")) {
      return { emoji: "\uD83C\uDF2B\uFE0F", text: `${formatTempF(temp)} Foggy` };
    }
    if (desc.includes("cloud") || desc.includes("overcast")) {
      return { emoji: "\u2601\uFE0F", text: `${formatTempF(temp)} Cloudy` };
    }
    if (desc.includes("clear") || desc.includes("sun")) {
      return { emoji: "\u2600\uFE0F", text: `${formatTempF(temp)} Clear` };
    }

    // Default: show temp with generic emoji
    return { emoji: "\uD83C\uDF21\uFE0F", text: formatTempF(temp) };
  };

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
  const weatherDisplay = getWeatherDisplay();

  return (
    <div className={`
      relative overflow-hidden glass-card premium-border rounded-[2rem] p-6 
      transition-all duration-700 group
      ${getBorderGlow()}
    `}>
      {/* Background Animated Gradient Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-50 z-0" />

      {/* Floating Sparkles / Particles effect if buzzing */}
      {cityMood?.vibeIntensity === "buzzing" && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-amber-400 rounded-full animate-ping opacity-20" />
          <div className="absolute bottom-1/3 right-1/4 w-1 h-1 bg-amber-400 rounded-full animate-ping opacity-10 [animation-delay:1s]" />
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                Current Local Vibe
              </span>
              {/* Live Scan indicator */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Scanning</span>
              </div>
            </div>

            {isLoading ? (
              <div className="h-10 w-64 bg-white/5 rounded-xl animate-pulse mt-2" />
            ) : (
              <h2 className={`text-4xl font-black leading-[0.9] tracking-tighter ${getEmotionColor()} drop-shadow-sm transition-all duration-500 group-hover:tracking-normal`}>
                {getHeadline()}
              </h2>
            )}
          </div>

          <div className="relative">
            <div className="text-6xl drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] transform transition-transform duration-700 group-hover:scale-110 group-hover:rotate-6">
              {getVibeEmoji()}
            </div>
            {/* Vibe Intensity Aura */}
            <div className={`absolute -inset-4 blur-3xl opacity-20 -z-10 transition-opacity duration-700 group-hover:opacity-40 rounded-full ${cityMood?.vibeIntensity === "intense" ? "bg-red-500" : cityMood?.vibeIntensity === "buzzing" ? "bg-amber-500" : "bg-emerald-500"}`} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Weather Pill */}
          {weatherDisplay && (
            <div className="flex items-center gap-2 px-4 py-2 bg-black/20 backdrop-blur-md rounded-2xl border border-white/5 shadow-inner">
              <span className="text-xl">{weatherDisplay.emoji}</span>
              <span className="text-sm font-black text-white/90">{weatherDisplay.text}</span>
            </div>
          )}

          {/* Activity Info */}
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-bold text-slate-400 leading-relaxed">
              {getSubtext()}
            </p>
          </div>
        </div>

        {/* Gas Station Quick View */}
        {gasStationName && (
          <button
            onClick={onGasPriceClick}
            className="flex items-center gap-3 w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all duration-300 group/gas"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-lg">⛽</div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Nearest Gas</span>
              <span className="text-sm font-bold text-white group-hover/gas:text-emerald-400 transition-colors">
                {gasStationName}
              </span>
            </div>
            <div className="ml-auto w-6 h-6 rounded-full bg-white/5 flex items-center justify-center transform group-hover/gas:translate-x-1 transition-transform">
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
