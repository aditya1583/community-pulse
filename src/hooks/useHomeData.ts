"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api-config";
import type { WeatherInfo, TrafficLevel } from "@/components/types";

type TrafficIncident = {
  id: string;
  type: "accident" | "roadwork" | "closure" | "congestion" | "other";
  description: string;
  roadName?: string;
  delay?: number;
  severity: 1 | 2 | 3 | 4;
};

interface UseHomeDataOptions {
  city: string;
  lat?: number | null;
  lon?: number | null;
}

export function useHomeData({ city, lat, lon }: UseHomeDataOptions) {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [trafficLevel, setTrafficLevel] = useState<TrafficLevel | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  const [hasRoadClosure, setHasRoadClosure] = useState(false);

  useEffect(() => {
    if (!city.trim()) {
      setWeather(null);
      setWeatherError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);
        setTrafficLoading(true);
        setTrafficError(null);

        const params = new URLSearchParams({ city });
        if (lat != null) params.set("lat", String(lat));
        if (lon != null) params.set("lon", String(lon));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(getApiUrl(`/api/pulse?${params}`), {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (cancelled) return;

        const data = await res.json();

        // Weather
        if (data.weather) {
          setWeather(data.weather);
          setWeatherError(null);
        } else {
          setWeather(null);
          setWeatherError("Unable to load weather.");
        }

        // Traffic (from TomTom via bundled endpoint)
        if (data.traffic) {
          if (data.traffic.level) {
            setTrafficLevel(data.traffic.level);
            setTrafficError(null);
          }
          if (data.traffic.incidents) {
            setTrafficIncidents(data.traffic.incidents);
          }
          if (data.traffic.hasRoadClosure !== undefined) {
            setHasRoadClosure(data.traffic.hasRoadClosure);
          }
        } else {
          // Traffic data unavailable — not critical
          setTrafficLevel(null);
        }
      } catch {
        if (!cancelled) {
          setWeather(null);
          setWeatherError("Unable to load weather.");
          setTrafficLevel(null);
          setTrafficError("Unable to load traffic right now.");
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
          setTrafficLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [city, lat, lon]);

  return {
    weather,
    weatherLoading,
    weatherError,
    trafficLevel,
    trafficLoading,
    trafficError,
    trafficIncidents,
    hasRoadClosure,
  };
}
