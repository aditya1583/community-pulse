"use client";

/**
 * Sentiment Heatmap Component
 *
 * Displays aggregated vibe/pulse data as a geographic heatmap.
 *
 * TECHNOLOGY STACK (All Free, Open Source):
 * - Leaflet: BSD-2-Clause license (https://leafletjs.com/)
 * - React-Leaflet: MIT license
 * - OpenStreetMap: ODbL license (requires attribution)
 *
 * COMPLIANCE:
 * - OSM attribution is REQUIRED and included in the component
 * - See: https://www.openstreetmap.org/copyright
 *
 * COST: $0/month - uses only open source libraries and OSM tiles
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";

// Types for heatmap data
type HeatmapPoint = {
  lat: number;
  lon: number;
  intensity: number;
  count: number;
  dominantVibe: string;
};

type HeatmapMetadata = {
  timeWindow: string;
  totalPoints: number;
  gridSize: number;
  cellsWithData: number;
  privacyThreshold: number;
};

type HeatmapData = {
  points: HeatmapPoint[];
  metadata: HeatmapMetadata;
};

type TimeWindow = "2h" | "4h" | "24h" | "7d";

type SentimentHeatmapProps = {
  lat: number;
  lon: number;
  city?: string;
  className?: string;
};

// Vibe emoji mapping
const VIBE_EMOJI: Record<string, string> = {
  busy: "🔥",
  live_music: "🎵",
  great_vibes: "✨",
  worth_it: "👍",
  fast_service: "⚡",
  moderate: "👥",
  chill: "😌",
  quiet: "🤫",
  long_wait: "⏳",
  skip_it: "👎",
};

// Time window options
const TIME_OPTIONS: { id: TimeWindow; label: string }[] = [
  { id: "2h", label: "2 hrs" },
  { id: "4h", label: "4 hrs" },
  { id: "24h", label: "24 hrs" },
  { id: "7d", label: "7 days" },
];

// Intensity to color gradient (OLED-friendly)
function getIntensityColor(intensity: number): string {
  // Gradient from cool (low activity) to hot (high activity)
  if (intensity < 0.3) return "rgba(59, 130, 246, 0.6)"; // Blue
  if (intensity < 0.5) return "rgba(16, 185, 129, 0.7)"; // Green
  if (intensity < 0.7) return "rgba(245, 158, 11, 0.75)"; // Amber
  if (intensity < 0.85) return "rgba(239, 68, 68, 0.8)"; // Red
  return "rgba(236, 72, 153, 0.85)"; // Pink (hottest)
}

// Dynamically import the map component to avoid SSR issues
const MapContent = dynamic(
  () => import("./HeatmapMapContent"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-400">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export default function SentimentHeatmap({
  lat,
  lon,
  city,
  className = "",
}: SentimentHeatmapProps) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("4h");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Fetch heatmap data
  const fetchHeatmapData = useCallback(async () => {
    if (!lat || !lon) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        timeWindow,
        radius: "10", // 10km radius
      });

      if (city) {
        params.set("city", city);
      }

      const res = await fetch(`/api/heatmap?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch heatmap data");
      }

      setData(json);
      setLastFetch(new Date());
    } catch (err) {
      console.error("[SentimentHeatmap] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load heatmap");
    } finally {
      setLoading(false);
    }
  }, [lat, lon, city, timeWindow]);

  // Fetch on mount and when time window changes
  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchHeatmapData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHeatmapData]);

  // Memoize processed points for performance
  const processedPoints = useMemo(() => {
    if (!data?.points) return [];
    return data.points.map(point => ({
      ...point,
      color: getIntensityColor(point.intensity),
      emoji: VIBE_EMOJI[point.dominantVibe] || "📍",
    }));
  }, [data?.points]);

  return (
    <div className={`relative rounded-xl overflow-hidden bg-slate-900/50 border border-slate-700/50 ${className}`}>
      {/* Header with time filter */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-3 bg-gradient-to-b from-slate-900/90 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗺️</span>
            <h3 className="text-sm font-medium text-white">Vibe Heatmap</h3>
            {data && data.points.length > 0 && (
              <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                {data.metadata.cellsWithData} hotspots
              </span>
            )}
          </div>

          {/* Time window selector */}
          <div className="flex gap-1 bg-slate-800/80 rounded-lg p-0.5">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setTimeWindow(option.id)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  timeWindow === option.id
                    ? "bg-emerald-500 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="h-[300px] w-full">
        {loading && !data ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Loading heatmap...</p>
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center p-4">
              <span className="text-3xl mb-2 block">🗺️</span>
              <p className="text-slate-400 text-sm">{error}</p>
              <button
                onClick={fetchHeatmapData}
                className="mt-3 text-xs text-emerald-400 hover:text-emerald-300"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <MapContent
            center={[lat, lon]}
            points={processedPoints}
            loading={loading}
          />
        )}
      </div>

      {/* Legend & attribution footer */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] p-2 bg-gradient-to-t from-slate-900/90 to-transparent">
        <div className="flex items-center justify-between text-[10px]">
          {/* Legend */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Activity:</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-2 rounded-sm bg-blue-500/60" title="Low" />
              <div className="w-3 h-2 rounded-sm bg-emerald-500/70" title="Medium" />
              <div className="w-3 h-2 rounded-sm bg-amber-500/75" title="High" />
              <div className="w-3 h-2 rounded-sm bg-red-500/80" title="Very High" />
              <div className="w-3 h-2 rounded-sm bg-pink-500/85" title="Hot!" />
            </div>
          </div>

          {/* OSM Attribution - REQUIRED for compliance */}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-400 transition"
          >
            © OpenStreetMap contributors
          </a>
        </div>

        {/* Last updated */}
        {lastFetch && (
          <div className="text-[9px] text-slate-600 mt-1 text-center">
            Updated {lastFetch.toLocaleTimeString()}
            {loading && " • Refreshing..."}
          </div>
        )}
      </div>

      {/* Empty state overlay */}
      {data && data.points.length === 0 && !loading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="text-center p-4">
            <span className="text-4xl mb-3 block">🌱</span>
            <p className="text-slate-300 font-medium">No hotspots yet</p>
            <p className="text-slate-500 text-sm mt-1">
              Be the first to log vibes in your area!
            </p>
            <p className="text-slate-600 text-xs mt-2">
              Heatmap requires {data.metadata.privacyThreshold}+ vibes per area for privacy
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Export types for the map content component
export type { HeatmapPoint };
