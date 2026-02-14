"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api-config";
import type { CityMood, WeatherInfo, TrafficLevel } from "@/components/types";
import type { TicketmasterEvent } from "@/hooks/useEvents";

interface UseCityMoodOptions {
  city: string;
  lat?: number | null;
  lon?: number | null;
  ticketmasterEvents: TicketmasterEvent[];
  trafficLevel: TrafficLevel | null;
  weather: WeatherInfo | null;
  pulsesLength: number;
}

export function useCityMood({
  city, lat, lon, ticketmasterEvents, trafficLevel, weather, pulsesLength,
}: UseCityMoodOptions) {
  const [cityMood, setCityMood] = useState<CityMood | null>(null);
  const [cityMoodLoading, setCityMoodLoading] = useState(false);
  const [cityMoodError, setCityMoodError] = useState<string | null>(null);

  useEffect(() => {
    if (!city) return;

    async function fetchCityMood() {
      try {
        setCityMoodLoading(true);
        setCityMoodError(null);

        const params = new URLSearchParams();
        params.set("city", city);
        if (lat != null) params.set("lat", String(lat));
        if (lon != null) params.set("lon", String(lon));

        if (ticketmasterEvents.length > 0) {
          params.set("eventsCount", String(ticketmasterEvents.length));
        }

        if (trafficLevel) {
          params.set("trafficLevel", trafficLevel);
        }

        if (weather) {
          params.set("weatherCondition", `${weather.description}, ${Math.round(weather.temp)}F`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(getApiUrl(`/api/city-mood?${params.toString()}`), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error("Failed to fetch city mood");
        }

        const data = await res.json();
        setCityMood({
          dominantMood: data.dominantMood,
          scores: data.scores || [],
          pulseCount: data.pulseCount || 0,
          tagScores: data.tagScores || [],
          dominantTag: data.dominantTag || null,
          vibeHeadline: data.vibeHeadline,
          vibeSubtext: data.vibeSubtext,
          vibeEmotion: data.vibeEmotion,
          vibeIntensity: data.vibeIntensity,
        });
      } catch (err: unknown) {
        console.error("Error fetching city mood:", err);
        setCityMoodError("Unable to load city mood right now.");
        setCityMood(null);
      } finally {
        setCityMoodLoading(false);
      }
    }

    fetchCityMood();
  }, [city, pulsesLength, ticketmasterEvents.length, trafficLevel, weather, lat, lon]);

  return { cityMood, cityMoodLoading, cityMoodError };
}
