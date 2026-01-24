"use client";

import { useEffect, useRef, useState } from "react";
import type { TicketmasterEvent } from "@/app/api/events/ticketmaster/route";
import { RADIUS_CONFIG } from "@/lib/constants/radius";

// ============================================================================
// useEvents Hook
// ============================================================================
// Fetches events from the Ticketmaster API endpoint based on user location.
// Provides loading, error, and data states for a seamless UI experience.
// ============================================================================

export type { TicketmasterEvent };

// Fallback info when events come from a nearby metro
export type EventsFallback = {
  metro: string;
  distance: number; // miles
};

type UseEventsResult = {
  events: TicketmasterEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  fallback: EventsFallback | null;
};

type UseEventsOptions = {
  /** Radius in miles (default: 10 from RADIUS_CONFIG) */
  radius?: number;
  /** City name as fallback when lat/lng unavailable */
  city?: string;
  /** Whether to skip fetching (useful when location not yet available) */
  skip?: boolean;
};

export function useEvents(
  lat: number | null,
  lng: number | null,
  options: UseEventsOptions = {}
): UseEventsResult {
  const { radius = RADIUS_CONFIG.PRIMARY_RADIUS_MILES, city, skip = false } = options;

  const [events, setEvents] = useState<TicketmasterEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<EventsFallback | null>(null);

  // Track the last fetch to prevent stale updates
  const lastRequestId = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEvents = async () => {
    // Skip if explicitly disabled or no location available
    if (skip || (lat === null && lng === null && !city)) {
      setEvents([]);
      setError(null);
      setFallback(null);
      setIsLoading(false);
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++lastRequestId.current;

    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();

      if (lat !== null && lng !== null) {
        params.set("lat", lat.toString());
        params.set("lng", lng.toString());
        params.set("radius", radius.toString());
      } else if (city) {
        params.set("city", city);
      }

      // MOBILE FIX: Add aggressive timeout for unreliable mobile networks
      // Create a timeout that will abort the fetch after 8 seconds
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(
        `/api/events/ticketmaster?${params.toString()}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      // Check if this request is still the current one
      if (requestId !== lastRequestId.current) return;

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch events");
      }

      setEvents(data.events || []);
      setError(data.error || null);
      setFallback(data.fallback || null);
    } catch (err) {
      // Ignore aborted requests
      if (err instanceof Error && err.name === "AbortError") return;

      // Check if this request is still the current one
      if (requestId !== lastRequestId.current) return;

      const message =
        err instanceof Error ? err.message : "Unable to load events right now.";
      console.error("useEvents error:", err);
      setError(message);
      setEvents([]);
      setFallback(null);
    } finally {
      if (requestId === lastRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  // Refetch function for manual refresh
  const refetch = () => {
    fetchEvents();
  };

  // Fetch when dependencies change
  useEffect(() => {
    fetchEvents();

    return () => {
      // Cleanup: abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radius, city, skip]);

  return {
    events,
    isLoading,
    error,
    refetch,
    fallback,
  };
}
