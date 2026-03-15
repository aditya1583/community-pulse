"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getApiUrl } from "@/lib/api-config";
import type { NWSAlert } from "@/app/api/nws-alerts/route";
import type { AQIResult } from "@/app/api/air-quality/route";
import type { NewsItem } from "@/app/api/local-news/route";

export type { NWSAlert, AQIResult, NewsItem };

interface UseUniversalDataOptions {
  lat: number | null;
  lon: number | null;
  city: string;
  state: string;
}

interface UseUniversalDataResult {
  nwsAlerts: NWSAlert[];
  nwsLoading: boolean;
  airQuality: AQIResult | null;
  aqiLoading: boolean;
  localNews: NewsItem[];
  newsLoading: boolean;
}

const NWS_INTERVAL_MS = 5 * 60 * 1000;      // 5 min
const AQI_INTERVAL_MS = 30 * 60 * 1000;     // 30 min
const NEWS_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function useUniversalData({
  lat,
  lon,
  city,
  state,
}: UseUniversalDataOptions): UseUniversalDataResult {
  const [nwsAlerts, setNwsAlerts] = useState<NWSAlert[]>([]);
  const [nwsLoading, setNwsLoading] = useState(false);

  const [airQuality, setAirQuality] = useState<AQIResult | null>(null);
  const [aqiLoading, setAqiLoading] = useState(false);

  const [localNews, setLocalNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  // Track last-fetch timestamps for interval-based refresh
  const lastNwsFetch = useRef<number>(0);
  const lastAqiFetch = useRef<number>(0);
  const lastNewsFetch = useRef<number>(0);

  // ----- NWS Alerts -----
  const fetchNWS = useCallback(async (latitude: number, longitude: number) => {
    setNwsLoading(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/nws-alerts?lat=${latitude}&lon=${longitude}`)
      );
      if (res.ok) {
        const data: NWSAlert[] = await res.json();
        setNwsAlerts(data);
        lastNwsFetch.current = Date.now();
      }
    } catch {
      // Fail silently — NWS alerts are supplementary
    } finally {
      setNwsLoading(false);
    }
  }, []);

  // ----- AQI -----
  const fetchAQI = useCallback(async (latitude: number, longitude: number) => {
    setAqiLoading(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/air-quality?lat=${latitude}&lon=${longitude}`)
      );
      if (res.ok) {
        const data: AQIResult = await res.json();
        setAirQuality(data);
        lastAqiFetch.current = Date.now();
      }
    } catch {
      // Fail silently
    } finally {
      setAqiLoading(false);
    }
  }, []);

  // ----- Local News -----
  const fetchNews = useCallback(async (cityName: string, stateName: string) => {
    if (!cityName.trim()) return;
    setNewsLoading(true);
    try {
      const params = new URLSearchParams({ city: cityName, state: stateName });
      const res = await fetch(getApiUrl(`/api/local-news?${params}`));
      if (res.ok) {
        const data: NewsItem[] = await res.json();
        setLocalNews(data);
        lastNewsFetch.current = Date.now();
      }
    } catch {
      // Fail silently
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // ----- Orchestrator: run all fetches, respecting intervals -----
  const runAll = useCallback(
    (force = false) => {
      const now = Date.now();

      if (lat != null && lon != null) {
        if (force || now - lastNwsFetch.current >= NWS_INTERVAL_MS) {
          void fetchNWS(lat, lon);
        }
        if (force || now - lastAqiFetch.current >= AQI_INTERVAL_MS) {
          void fetchAQI(lat, lon);
        }
      }

      if (force || now - lastNewsFetch.current >= NEWS_INTERVAL_MS) {
        void fetchNews(city, state);
      }
    },
    [lat, lon, city, state, fetchNWS, fetchAQI, fetchNews]
  );

  // Initial fetch + interval polling
  useEffect(() => {
    // Force on mount / dependency change
    runAll(true);

    // Check intervals every minute
    const intervalId = setInterval(() => runAll(false), 60_000);

    // Re-fetch on app foregrounding
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        runAll(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [runAll]);

  return {
    nwsAlerts,
    nwsLoading,
    airQuality,
    aqiLoading,
    localNews,
    newsLoading,
  };
}
