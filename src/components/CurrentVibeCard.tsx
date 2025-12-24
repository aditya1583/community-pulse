"use client";

import React, { useEffect, useState } from "react";
import type { WeatherInfo, AirQualityData } from "./types";

type CurrentVibeCardProps = {
  weather: WeatherInfo | null;
  weatherLoading: boolean;
  activeUsersCount: number;
  lat?: number;
  lon?: number;
};

export default function CurrentVibeCard({
  weather,
  weatherLoading,
  activeUsersCount,
  lat,
  lon,
}: CurrentVibeCardProps) {
  const [aqi, setAqi] = useState<AirQualityData | null>(null);
  const [aqiLoading, setAqiLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lon) return;
    const fetchAqi = async () => {
      try {
        setAqiLoading(true);
        const response = await fetch(`/api/air-quality?lat=${lat}&lon=${lon}`);
        if (response.ok) {
          const data = await response.json();
          setAqi(data);
        }
      } catch (error) {
        console.error("Error fetching AQI:", error);
      } finally {
        setAqiLoading(false);
      }
    };
    fetchAqi();
  }, [lat, lon]);

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
    else if (desc.includes("cloud")) return `${tempVibe} & Cloudy`;
    else if (desc.includes("clear") || desc.includes("sun")) return `${tempVibe} & Sunny`;
    else if (desc.includes("snow")) return `${tempVibe} & Snowy`;
    else if (desc.includes("fog") || desc.includes("mist")) return `${tempVibe} & Foggy`;
    else if (desc.includes("storm") || desc.includes("thunder")) return `${tempVibe} & Stormy`;
    return `${tempVibe} & ${weather.description}`;
  };

  const getWeatherEmoji = (): string => {
    if (!weather) return "🌍";
    const iconMap: Record<string, string> = {
      "01d": "☀️", "01n": "🌙", "02d": "🌤️", "02n": "☁️", "03d": "⛅", "03n": "☁️",
      "04d": "☁️", "04n": "☁️", "09d": "🌧️", "09n": "🌧️", "10d": "🌦️", "10n": "🌧️",
      "11d": "⛈️", "11n": "🌩️", "13d": "❄️", "13n": "❄️", "50d": "🌫️", "50n": "🌫️",
    };
    return iconMap[weather.icon] || "🌍";
  };

  const getAqiBadgeClasses = (aqiLevel: number) => {
    switch (aqiLevel) {
      case 1: return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case 2: return "bg-lime-500/20 text-lime-400 border-lime-500/30";
      case 3: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case 4: return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case 5: return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getSubtext = (): string => {
    if (!weather) return "Loading weather data...";
    const parts: string[] = [];
    parts.push(`${Math.round(weather.temp)}F`);
    const tempDiff = Math.abs(weather.temp - weather.feelsLike);
    parts.push(tempDiff > 5 ? "Light breeze" : "Calm air");
    parts.push(`${activeUsersCount} active nearby`);
    return parts.join(" . ");
  };

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-emerald-500/20 p-4 shadow-lg shadow-emerald-500/5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Current Vibe</p>
          {weatherLoading ? (
            <>
              <div className="h-7 w-48 bg-slate-700/50 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-slate-700/50 rounded animate-pulse" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold text-white">{getVibeDescription()}</h2>
                {!aqiLoading && aqi && (
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${getAqiBadgeClasses(aqi.aqi)}`}>
                    AQI: {aqi.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">{getSubtext()}</p>
              {aqi && aqi.aqi >= 3 && aqi.healthAdvice && (
                <div className="mt-2 flex items-start gap-2 text-xs text-amber-400/80">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>{aqi.healthAdvice}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="text-3xl ml-4">{getWeatherEmoji()}</div>
      </div>
    </div>
  );
}
