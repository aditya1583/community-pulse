"use client";

import { useEffect, useRef, useState } from "react";
import { filterVisiblePulses } from "@/lib/pulses";
import type { Pulse, WeatherInfo } from "@/components/types";

const STALE_PULSE_THRESHOLD = 5;
const STALE_AGE_HOURS = 1;

interface TicketmasterEventSlim {
  name: string;
  venue?: string;
  date?: string;
  category?: string;
}

interface UseAutoSeedOptions {
  city: string;
  pulses: Pulse[];
  initialPulsesFetched: boolean;
  loading: boolean;
  ticketmasterEvents: TicketmasterEventSlim[];
  ticketmasterLoading: boolean;
  weather: WeatherInfo | null;
  weatherLoading: boolean;
  selectedCityLat?: number | null;
  selectedCityLon?: number | null;
  fetchPulses: () => Promise<void>;
}

export function useAutoSeed({
  city, pulses, initialPulsesFetched, loading,
  ticketmasterEvents, ticketmasterLoading,
  weather, weatherLoading,
  selectedCityLat, selectedCityLon,
  fetchPulses,
}: UseAutoSeedOptions) {
  const [autoSeedAttempted, setAutoSeedAttempted] = useState<string | null>(null);
  const [staleRefreshAttempted, setStaleRefreshAttempted] = useState<string | null>(null);
  const isSeedingRef = useRef(false);

  useEffect(() => {
    const triggerAutoSeed = async () => {
      const validPulses = filterVisiblePulses(pulses);

      const isEmpty = validPulses.length < 5;
      const isStale = !isEmpty && (
        validPulses.length < STALE_PULSE_THRESHOLD ||
        (validPulses.length > 0 && isContentStale(validPulses))
      );

      if (isSeedingRef.current) {
        console.log("[Content Refresh] Skipping - seeding already in progress");
        return;
      }

      function isContentStale(pulsesToCheck: Pulse[]): boolean {
        if (pulsesToCheck.length === 0) return false;

        const newestPulse = pulsesToCheck.reduce((newest, p) => {
          const pTime = new Date(p.createdAt).getTime();
          const newestTime = new Date(newest.createdAt).getTime();
          return pTime > newestTime ? p : newest;
        }, pulsesToCheck[0]);

        const newestAge = Date.now() - new Date(newestPulse.createdAt).getTime();
        const staleAgeMs = STALE_AGE_HOURS * 60 * 60 * 1000;

        return newestAge > staleAgeMs;
      }

      console.log("[Content Refresh] Checking conditions:", {
        city,
        initialPulsesFetched,
        totalPulses: pulses.length,
        visiblePulses: validPulses.length,
        isEmpty,
        isStale,
        autoSeedAttempted,
        staleRefreshAttempted,
        loading,
        ticketmasterLoading,
      });

      if (!isEmpty && !isStale) {
        console.log("[Content Refresh] Skipping - city has fresh content");
        return;
      }

      if (!initialPulsesFetched) {
        console.log("[Content Refresh] Skipping - initial fetch not complete");
        return;
      }

      if (isEmpty && autoSeedAttempted === city) {
        console.log("[Content Refresh] Skipping - already attempted empty seed for this city");
        return;
      }
      if (isStale && staleRefreshAttempted === city) {
        console.log("[Content Refresh] Skipping - already attempted stale refresh for this city");
        return;
      }

      if (loading) {
        console.log("[Content Refresh] Skipping - still loading pulses");
        return;
      }

      if (ticketmasterLoading) {
        console.log("[Content Refresh] Skipping - waiting for events to load");
        return;
      }
      if (weatherLoading) {
        console.log("[Content Refresh] Skipping - waiting for weather to load");
        return;
      }

      const cityNamePart = city.split(",")[0].toLowerCase().trim();
      const weatherMatchesCity = weather?.cityName?.toLowerCase().includes(cityNamePart);

      if (weather && !weatherMatchesCity) {
        console.log("[Content Refresh] Skipping - weather data is stale (from different city)", {
          weatherCity: weather.cityName,
          currentCity: city,
        });
        return;
      }

      const refreshType = isEmpty ? "cold-start" : "stale-refresh";
      console.log(`[Content Refresh] Triggering ${refreshType} for:`, city);

      try {
        isSeedingRef.current = true;
        console.log(`[Content Refresh] ${refreshType} for ${city}...`);

        const endpoint = isEmpty ? "/api/auto-seed" : "/api/cron/refresh-content";
        const requestBody = isEmpty
          ? {
            city,
            lat: selectedCityLat,
            lon: selectedCityLon,
            events: ticketmasterEvents.slice(0, 3).map((e) => ({
              name: e.name,
              venue: e.venue,
              date: e.date,
              category: e.category,
            })),
            weather: weather && weatherMatchesCity
              ? {
                description: weather.description,
                temp: weather.temp,
                icon: weather.icon,
              }
              : null,
          }
          : {
            city,
            force: false,
          };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = await res.json();
        console.log(`[Content Refresh] ${refreshType} API Response:`, res.status, data);

        if (!res.ok) {
          console.error(`[Content Refresh] ${refreshType} API Error:`, data);
          return;
        }

        if (isEmpty) {
          setAutoSeedAttempted(city);
        } else {
          setStaleRefreshAttempted(city);
        }

        const postsCreated = data.postsCreated ?? data.created ?? 0;

        if (postsCreated === 0) {
          console.log(`[Content Refresh] Skipped - ${data.message || "city may already have recent pulses"}`);
        } else if (postsCreated > 0) {
          console.log(`[Content Refresh] SUCCESS! Created ${postsCreated} posts for ${city} (${refreshType})`);
          await fetchPulses();
        }
      } catch (err) {
        console.error("[Content Refresh] Error:", err);
      } finally {
        isSeedingRef.current = false;
      }
    };

    triggerAutoSeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, initialPulsesFetched, pulses.length, ticketmasterEvents, ticketmasterLoading, weather, weatherLoading, autoSeedAttempted, staleRefreshAttempted, loading, selectedCityLat, selectedCityLon]);
}
