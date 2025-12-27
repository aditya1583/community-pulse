"use client";

import React from "react";
import type { WeatherInfo } from "./types";

type CurrentVibeCardProps = {
  weather: WeatherInfo | null;
  weatherLoading: boolean;
  recentPulseCount: number;
  onDropPulse?: () => void;
};

/**
 * Current Vibe Card - Shows weather-based vibe + recent activity
 */
export default function CurrentVibeCard({
  weather,
  weatherLoading,
  recentPulseCount,
  onDropPulse,
}: CurrentVibeCardProps) {
  const formatTempF = (temp: number) => `${Math.round(temp)}\u00B0F`;

  const getVibeDescription = (): string => {
    if (!weather) return "Checking the vibe...";

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
    if (desc.includes("snow")) return `${tempVibe} & Snowy`;
    if (desc.includes("fog") || desc.includes("mist")) return `${tempVibe} & Foggy`;
    if (desc.includes("storm") || desc.includes("thunder")) return `${tempVibe} & Stormy`;

    return `${tempVibe} & ${weather.description}`;
  };

  const getWeatherEmoji = (): string => {
    if (!weather) return "??";

    const iconMap: Record<string, string> = {
      // OpenWeather icon codes: https://openweathermap.org/weather-conditions
      "01d": "\u2600\uFE0F", // ☀️
      "01n": "\uD83C\uDF19", // 🌙
      "02d": "\uD83C\uDF24\uFE0F", // 🌤️
      "02n": "\uD83C\uDF11", // 🌑 (night clouds approximation)
      "03d": "\u2601\uFE0F", // ☁️
      "03n": "\u2601\uFE0F", // ☁️
      "04d": "\u2601\uFE0F", // ☁️
      "04n": "\u2601\uFE0F", // ☁️
      "09d": "\uD83C\uDF27\uFE0F", // 🌧️
      "09n": "\uD83C\uDF27\uFE0F", // 🌧️
      "10d": "\uD83C\uDF26\uFE0F", // 🌦️
      "10n": "\uD83C\uDF27\uFE0F", // 🌧️
      "11d": "\u26C8\uFE0F", // ⛈️
      "11n": "\u26C8\uFE0F", // ⛈️
      "13d": "\uD83C\uDF28\uFE0F", // 🌨️
      "13n": "\uD83C\uDF28\uFE0F", // 🌨️
      "50d": "\uD83C\uDF2B\uFE0F", // 🌫️
      "50n": "\uD83C\uDF2B\uFE0F", // 🌫️
    };

    return iconMap[weather.icon] || "??";
  };

  const windText = (() => {
    if (!weather) return "Loading weather data...";
    const tempDiff = Math.abs(weather.temp - weather.feelsLike);
    return tempDiff > 5 ? "Light breeze" : "Calm air";
  })();

  const getSubtext = (): string => {
    if (!weather) return "Loading weather data...";

    const parts: string[] = [];
    parts.push(formatTempF(weather.temp));
    parts.push(windText);
    parts.push(
      recentPulseCount > 0
        ? `${recentPulseCount} pulses nearby (last 2h)`
        : "Quiet right now \u2014 be the first to set the vibe"
    );

    return parts.join(" \u00B7 ");
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

  const separator = (
    <span aria-hidden="true" className="mx-2 text-slate-600">
      {"\u00B7"}
    </span>
  );

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
              <p
                className="text-sm text-slate-400 flex flex-wrap items-center"
                aria-label={getSubtext()}
              >
                <span>{weather ? formatTempF(weather.temp) : "Loading..."}</span>
                {separator}
                <span>{windText}</span>
                {separator}
                {recentPulseCount > 0 ? (
                  <span>{recentPulseCount} pulses nearby (last 2h)</span>
                ) : (
                  <span>
                    Quiet right now {"\u2014"} be the first to set the vibe{" "}
                    <button
                      type="button"
                      onClick={handleDropPulseClick}
                      className="inline-flex items-center text-emerald-300/90 hover:text-emerald-200 underline decoration-emerald-400/40 hover:decoration-emerald-400/70 underline-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded-sm whitespace-nowrap"
                    >
                      Drop a pulse
                    </button>
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        <div className="text-3xl ml-4">{getWeatherEmoji()}</div>
      </div>
    </div>
  );
}
