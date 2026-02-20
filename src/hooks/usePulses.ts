"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  isInRecentWindow,
  startOfRecentWindow,
  filterVisiblePulses,
} from "@/lib/pulses";
import { calculateDistanceMiles } from "@/lib/geo/distance";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import { getApiUrl } from "@/lib/api-config";
import type { Pulse } from "@/components/types";
import type { GeocodedCity } from "@/lib/geocoding";

// Real-time Live Updates
type DBPulse = {
  id: number;
  city: string;
  neighborhood?: string | null;
  mood: string;
  tag: string;
  message: string;
  author: string;
  created_at: string;
  user_id?: string;
  expires_at?: string | null;
  is_bot?: boolean;
  hidden?: boolean;
  poll_options?: string[] | null;
  lat?: number | null;
  lon?: number | null;
};

const PULSES_PAGE_SIZE = 50;

function mapDBPulseToPulse(row: DBPulse): Pulse {
  return {
    id: row.id,
    city: row.city,
    neighborhood: row.neighborhood ?? null,
    mood: row.mood,
    tag: row.tag,
    message: row.message,
    author: row.author,
    createdAt: row.created_at,
    user_id: row.user_id,
    expiresAt: row.expires_at ?? null,
    is_bot: row.is_bot ?? false,
    poll_options: row.poll_options ?? null,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
  };
}

interface UsePulsesParams {
  city: string;
  selectedCity: GeocodedCity | null;
  geolocation: { lat: number | null; lon: number | null };
}

export function usePulses({ city, selectedCity, geolocation }: UsePulsesParams) {
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [initialPulsesFetched, setInitialPulsesFetched] = useState(false);
  const [hasMorePulses, setHasMorePulses] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authorStats, setAuthorStats] = useState<Record<string, { level: number; rank: number | null }>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const retryAttempted = useRef(false);

  // ========= REAL-TIME FEED =========
  useEffect(() => {
    if (!city) return;

    const channelName = `pulses-realtime-${city.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pulses",
        },
        (payload) => {
          const row = payload.new as DBPulse;
          const cityBase = city.split(",").slice(0, 2).join(",").trim().toLowerCase();
          const rowCityBase = (row.city || "").split(",").slice(0, 2).join(",").trim().toLowerCase();
          if (!row || rowCityBase !== cityBase) return;
          if (!isInRecentWindow(row.created_at)) return;

          const pulse = mapDBPulseToPulse(row);

          setPulses((prev) => {
            const exists = prev.some((p) => String(p.id) === String(pulse.id));
            if (exists) return prev;

            return [pulse, ...prev].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pulses",
        },
        (payload) => {
          const deleted = payload.old as { id?: number };
          if (!deleted?.id) return;

          setPulses((prev) => prev.filter((p) => p.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [city]);

  // ========= PULSES FETCH =========
  const fetchPulses = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setHasMorePulses(false);

    console.log("[Pulses] fetchPulses called for city:", city);

    try {
      const userLat = selectedCity?.lat;
      const userLon = selectedCity?.lon;
      const params = new URLSearchParams();
      if (userLat != null && userLon != null) {
        params.set("lat", String(userLat));
        params.set("lon", String(userLon));
      }
      params.set("city", city);
      params.set("limit", String(PULSES_PAGE_SIZE + 1));

      const apiUrl = `${getApiUrl("/api/pulses/feed")}?${params}`;
      console.log(`[Pulses] Fetching via API: ${apiUrl}`);
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `API error ${res.status}`);
      }

      const result = await res.json();
      const rawData: DBPulse[] = result.pulses || [];
      console.log(`[Pulses] API returned ${rawData.length} pulses`);

      // Auto-retry if backend is seeding content for a new city
      if (result.seeding && result.retryAfterMs && !retryAttempted.current) {
        retryAttempted.current = true;
        console.log(`[Pulses] City being seeded — auto-retrying in ${result.retryAfterMs}ms`);
        setTimeout(() => {
          retryAttempted.current = false;
          fetchPulses();
        }, result.retryAfterMs);
      } else {
        retryAttempted.current = false;
      }

      const data: DBPulse[] | null = rawData;
      const error: { message: string } | null = null;

      if (error) {
        console.error("[Pulses] Error fetching pulses:", error.message);
        setErrorMsg("Could not load pulses. Try again in a bit.");
        setPulses([]);
      } else if (data) {
        console.log(`[Pulses] Fetched ${data.length} pulses from DB for "${city}"`);

        if (data.length > 0) {
          const now = new Date();
          data.slice(0, 3).forEach((p, i) => {
            const expiresAt = p.expires_at ? new Date(p.expires_at) : null;
            const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() - 60 * 60 * 1000 : false;
            console.log(`[Pulses] #${i + 1}: tag=${p.tag}, created=${p.created_at}, expires=${p.expires_at}, expired=${isExpired}`);
          });
        }

        const hasMore = data.length > PULSES_PAGE_SIZE;
        setHasMorePulses(hasMore);

        const pageData = hasMore ? data.slice(0, PULSES_PAGE_SIZE) : data;

        const mapped: Pulse[] = (pageData as DBPulse[]).map((row) => ({
          ...mapDBPulseToPulse(row),
          author: row.author || "Anonymous",
        }));
        setPulses(mapped);
      } else {
        console.log(`[Pulses] No data returned for "${city}" (data is null/undefined)`);
        setPulses([]);
      }
    } catch (fetchErr) {
      console.error("[Pulses] fetchPulses CAUGHT ERROR:", fetchErr);
      // Don't show abort/timeout errors to user — just log and keep any cached pulses
      const isAbort = fetchErr instanceof DOMException && fetchErr.name === "AbortError";
      const isTimeout = fetchErr instanceof DOMException && fetchErr.name === "TimeoutError";
      if (isAbort || isTimeout) {
        console.warn("[Pulses] Request timed out — keeping existing data");
      } else {
        setErrorMsg("Could not load pulses. Pull down to retry.");
        setPulses([]);
      }
    } finally {
      setLoading(false);
      setInitialPulsesFetched(true);
    }
  }, [city, selectedCity?.lat, selectedCity?.lon]);

  // Initial load + auto-refresh interval
  useEffect(() => {
    setInitialPulsesFetched(false);

    if (city) {
      fetchPulses();

      const refreshInterval = setInterval(() => {
        console.log("[Pulses] Safety-net refresh (Realtime is primary)...");
        fetchPulses();
      }, 5 * 60 * 1000);

      return () => clearInterval(refreshInterval);
    }
  }, [city, fetchPulses]);

  // ========= PULL-TO-REFRESH HANDLER =========
  const handlePullToRefresh = useCallback(async () => {
    console.log("[PullToRefresh] Triggered manual refresh");
    try {
      await fetchPulses();
    } catch (err) {
      console.error("[PullToRefresh] fetchPulses error:", err);
    }
  }, [fetchPulses]);

  // ========= FETCH AUTHOR STATS =========
  useEffect(() => {
    const fetchAuthorStats = async () => {
      const userIds = [
        ...new Set(
          pulses
            .map((p) => p.user_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (userIds.length === 0) {
        setAuthorStats({});
        return;
      }

      try {
        const res = await fetch(
          `/api/gamification/batch-stats?userIds=${userIds.join(",")}`
        );
        if (res.ok) {
          const data = await res.json();
          setAuthorStats(data.stats || {});
        }
      } catch (err) {
        console.error("[fetchAuthorStats] Error:", err);
      }
    };

    if (pulses.length > 0) {
      fetchAuthorStats();
    }
  }, [pulses]);

  // ========= LOAD MORE PULSES =========
  const handleLoadMorePulses = useCallback(async () => {
    if (loadingMore || !hasMorePulses || pulses.length === 0) return;

    setLoadingMore(true);

    const now = new Date();
    const start = startOfRecentWindow(now, 7);
    const loadMoreExpiryGrace = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const oldestPulse = pulses[pulses.length - 1];
    const cursor = oldestPulse.createdAt;

    try {
      let data: DBPulse[] | null = null;
      let error: { message: string } | null = null;

      const queryWithPolls = await supabase
        .from("pulses")
        .select("id, city, neighborhood, mood, tag, message, author, created_at, user_id, expires_at, is_bot, poll_options, lat, lon")
        .eq("city", city)
        .gte("created_at", start.toISOString())
        .lt("created_at", cursor)
        .or(`expires_at.is.null,expires_at.gt.${loadMoreExpiryGrace}`)
        .order("created_at", { ascending: false })
        .limit(PULSES_PAGE_SIZE + 1);

      if (queryWithPolls.error?.message?.includes("poll_options")) {
        const fallbackQuery = await supabase
          .from("pulses")
          .select("id, city, neighborhood, mood, tag, message, author, created_at, user_id, expires_at, is_bot, lat, lon")
          .eq("city", city)
          .gte("created_at", start.toISOString())
          .lt("created_at", cursor)
          .or(`expires_at.is.null,expires_at.gt.${loadMoreExpiryGrace}`)
          .order("created_at", { ascending: false })
          .limit(PULSES_PAGE_SIZE + 1);
        data = (fallbackQuery.data as DBPulse[]) ?? null;
        error = fallbackQuery.error;
      } else {
        data = (queryWithPolls.data as DBPulse[]) ?? null;
        error = queryWithPolls.error;
      }

      if (error) {
        console.error("Error loading more pulses:", error.message);
      } else if (data) {
        const hasMore = data.length > PULSES_PAGE_SIZE;
        setHasMorePulses(hasMore);

        const pageData = hasMore ? data.slice(0, PULSES_PAGE_SIZE) : data;

        const mapped: Pulse[] = (pageData as DBPulse[]).map((row) => ({
          ...mapDBPulseToPulse(row),
          author: row.author || "Anonymous",
        }));

        setPulses((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newPulses = mapped.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newPulses];
        });
      }
    } catch (err) {
      console.error("Unexpected error loading more pulses:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMorePulses, pulses, city]);

  // ========= FILTER AND SORT PULSES BY DISTANCE =========
  const visiblePulses = useMemo(() => {
    const filtered = filterVisiblePulses(pulses);
    const seen = new Map<string, number>();
    return filtered.filter((p) => {
      const key = `${p.author}::${p.message}`;
      const ts = new Date(p.createdAt).getTime();
      const existing = seen.get(key);
      if (existing !== undefined && Math.abs(ts - existing) < 5 * 60 * 1000) {
        return false;
      }
      seen.set(key, ts);
      return true;
    });
  }, [pulses]);

  const afterRecentFilter = useMemo(
    () => visiblePulses.filter((p) => isInRecentWindow(p.createdAt)),
    [visiblePulses]
  );

  const pulsesWithDistance = useMemo(() => {
    const userLat = geolocation.lat ?? selectedCity?.lat ?? null;
    const userLon = geolocation.lon ?? selectedCity?.lon ?? null;

    if (!userLat || !userLon) {
      return afterRecentFilter.map((p) => ({ ...p, distanceMiles: null }));
    }

    const withDistance = afterRecentFilter.map((pulse) => {
      const pulseLat = pulse.lat ?? null;
      const pulseLon = pulse.lon ?? null;

      let distanceMiles: number | null = null;

      if (pulseLat !== null && pulseLon !== null) {
        distanceMiles = calculateDistanceMiles(
          { lat: userLat, lon: userLon },
          { lat: pulseLat, lon: pulseLon }
        );
      }

      const pulseCity = (pulse.city || "").toLowerCase().trim();
      const currentCity = (city || "").toLowerCase().trim();
      if (pulseCity && currentCity && pulseCity === currentCity && (distanceMiles === null || distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES)) {
        distanceMiles = 0;
      }

      return { ...pulse, distanceMiles };
    });

    return withDistance.sort((a, b) => {
      const distA = a.distanceMiles;
      const distB = b.distanceMiles;
      const radiusMiles = RADIUS_CONFIG.PRIMARY_RADIUS_MILES;

      if (distA === null && distB === null) return 0;
      if (distA === null) return 1;
      if (distB === null) return -1;

      const aInRadius = distA <= radiusMiles;
      const bInRadius = distB <= radiusMiles;

      if (aInRadius && !bInRadius) return -1;
      if (!aInRadius && bInRadius) return 1;

      return distA - distB;
    });
  }, [afterRecentFilter, geolocation.lat, geolocation.lon, selectedCity?.lat, selectedCity?.lon, city]);

  return {
    pulses,
    setPulses,
    initialPulsesFetched,
    setInitialPulsesFetched,
    hasMorePulses,
    loadingMore,
    authorStats,
    loading,
    setLoading,
    errorMsg,
    setErrorMsg,
    fetchPulses,
    handlePullToRefresh,
    handleLoadMorePulses,
    visiblePulses,
    pulsesWithDistance,
  };
}
