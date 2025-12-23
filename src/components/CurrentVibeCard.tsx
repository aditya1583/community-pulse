"use client";

import React from "react";
import type { WeatherInfo } from "./types";

type CurrentVibeCardProps = {
  weather: WeatherInfo | null;
  weatherLoading: boolean;
  activeUsersCount: number;
};

/**
 * Current Vibe Card - Shows weather-based vibe + active users
 *
 * Design: Rounded-2xl with emerald border glow
 * Content: Vibe description based on weather, temp, and active users nearby
 */
export default function CurrentVibeCard({
  weather,
  weatherLoading,
  activeUsersCount,
}: CurrentVibeCardProps) {
  // Generate vibe description based on weather
  const getVibeDescription = (): string => {
    if (!weather) return "Checking the vibe...";

    const desc = weather.description.toLowerCase();
    const temp = weather.temp;

    // Temperature-based descriptors
    let tempVibe = "";
    if (temp < 40) tempVibe = "Chilly";
    else if (temp < 55) tempVibe = "Cool";
    else if (temp < 70) tempVibe = "Nice";
    else if (temp < 85) tempVibe = "Warm";
    else tempVibe = "Hot";

    // Weather condition-based descriptors
    if (desc.includes("rain") || desc.includes("drizzle")) {
      return `${tempVibe} & Rainy`;
    } else if (desc.includes("cloud")) {
      return `${tempVibe} & Cloudy`;
    } else if (desc.includes("clear") || desc.includes("sun")) {
      return `${tempVibe} & Sunny`;
    } else if (desc.includes("snow")) {
      return `${tempVibe} & Snowy`;
    } else if (desc.includes("fog") || desc.includes("mist")) {
      return `${tempVibe} & Foggy`;
    } else if (desc.includes("storm") || desc.includes("thunder")) {
      return `${tempVibe} & Stormy`;
    }

    return `${tempVibe} & ${weather.description}`;
  };

  // Weather icon mapping
  const getWeatherEmoji = (): string => {
    if (!weather) return "🌍";

    const iconMap: Record<string, string> = {
      "01d": "☀️",
      "01n": "🌙",
      "02d": "🌤️",
      "02n": "☁️",
      "03d": "⛅",
      "03n": "☁️",
      "04d": "☁️",
      "04n": "☁️",
      "09d": "🌧️",
      "09n": "🌧️",
      "10d": "🌦️",
      "10n": "🌧️",
      "11d": "⛈️",
      "11n": "🌩️",
      "13d": "❄️",
      "13n": "❄️",
      "50d": "🌫️",
      "50n": "🌫️",
    };

    return iconMap[weather.icon] || "🌍";
  };

  // Subtext with temp, wind description, and active users
  const getSubtext = (): string => {
    if (!weather) return "Loading weather data...";

    const parts: string[] = [];
    parts.push(`${Math.round(weather.temp)}°F`);

    // Add a simple wind indicator based on "feels like" diff
    const tempDiff = Math.abs(weather.temp - weather.feelsLike);
    if (tempDiff > 5) {
      parts.push("Light breeze");
    } else {
      parts.push("Calm air");
    }

    parts.push(`${activeUsersCount} active nearby`);

    return parts.join(" • ");
  };

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-emerald-500/20 p-4 shadow-lg shadow-emerald-500/5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
            Current Vibe
          </p>

          {weatherLoading ? (
            <>
              <div className="h-7 w-48 bg-slate-700/50 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-slate-700/50 rounded animate-pulse" />
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">
                {getVibeDescription()}
              </h2>
              <p className="text-sm text-slate-400">{getSubtext()}</p>
            </>
          )}
        </div>

        {/* Weather icon */}
        <div className="text-3xl ml-4">{getWeatherEmoji()}</div>
      </div>
    </div>
  );
}
