"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api-config";
import type { WeatherInfo, TrafficLevel, Pulse } from "@/components/types";

interface TicketmasterEvent {
  name: string;
  venue?: string;
  date?: string;
  time?: string;
  category?: string;
}

interface UseSummaryOptions {
  city: string;
  pulses: Pulse[];
  ticketmasterEvents: TicketmasterEvent[];
  trafficLevel: TrafficLevel | null;
  weather: WeatherInfo | null;
}

export function useSummary({ city, pulses, ticketmasterEvents, trafficLevel, weather }: UseSummaryOptions) {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Stabilize pulses reference — only re-trigger when IDs actually change
  const pulsesFingerprint = useMemo(
    () => pulses.filter(p => !p.is_bot).map(p => p.id).sort((a, b) => a - b).join(","),
    [pulses]
  );
  const stableUserPulses = useMemo(
    () => pulses.filter(p => !p.is_bot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pulsesFingerprint]
  );

  // Keep previous summary visible during re-fetch (no flash to "Loading...")
  const prevSummaryRef = useRef<string | null>(null);

  useEffect(() => {
    const userPulses = stableUserPulses;
    // Need at least some data to generate a summary
    const hasData = userPulses.length > 0 || ticketmasterEvents.length > 0 || trafficLevel || weather;

    if (!hasData) {
      setSummary(null);
      setSummaryError(null);
      setSummaryLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        // Only show loading state on first fetch — keep stale data visible on refresh
        if (!prevSummaryRef.current) {
          setSummaryLoading(true);
        }
        setSummaryError(null);

        // Prepare events data for the summary (deduplicated by normalized name)
        const normalizeEventName = (name: string): string => {
          return name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ")
            .replace(/[^\w\s]/g, "");
        };

        const seenEventNames = new Set<string>();
        const eventsForSummary = ticketmasterEvents
          .filter((e) => {
            const normalizedName = normalizeEventName(e.name);
            if (seenEventNames.has(normalizedName)) {
              return false;
            }
            seenEventNames.add(normalizedName);
            return true;
          })
          .slice(0, 10)
          .map((e) => ({
            name: e.name,
            venue: e.venue,
            date: e.date,
            time: e.time,
          }));

        const weatherCondition = weather
          ? `${weather.description}, ${Math.round(weather.temp)}F`
          : undefined;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(getApiUrl("/api/summary"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: city.split(',')[0].trim(),
            context: "all",
            pulses: userPulses,
            events: eventsForSummary,
            trafficLevel,
            weatherCondition,
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setSummaryError(data.error || "Failed to get summary");
          setSummary(null);
          return;
        }

        setSummary(data.summary);
        prevSummaryRef.current = data.summary;
      } catch {
        if (!cancelled) {
          setSummaryError("Unable to summarize right now.");
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [city, stableUserPulses, ticketmasterEvents, trafficLevel, weather]);

  return { summary, summaryLoading, summaryError };
}
