"use client";

/**
 * Heatmap Map Content Component
 *
 * This component is dynamically imported to avoid SSR issues with Leaflet.
 *
 * LIBRARIES (All Free, Open Source):
 * - Leaflet: BSD-2-Clause license
 * - React-Leaflet: MIT license
 * - OpenStreetMap tiles: ODbL license (free, attribution required)
 *
 * TILE PROVIDERS (All Free):
 * - CartoDB Dark Matter: Free, OLED-friendly dark tiles
 * - OpenStreetMap: Free, requires attribution
 *
 * Alternative free tile options if needed:
 * - Stadia Maps (free tier)
 * - Thunderforest (free tier with API key)
 */

import React, { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { HeatmapPoint } from "./SentimentHeatmap";

type HeatmapMapContentProps = {
  center: [number, number];
  points: (HeatmapPoint & { color: string; emoji: string })[];
  loading?: boolean;
};

// Component to handle map view updates
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [map, center]);

  return null;
}

// Vibe labels for display
const VIBE_LABELS: Record<string, string> = {
  busy: "Busy",
  live_music: "Live Music",
  great_vibes: "Great Vibes",
  worth_it: "Worth It",
  fast_service: "Fast Service",
  moderate: "Moderate",
  chill: "Chill",
  quiet: "Quiet",
  long_wait: "Long Wait",
  skip_it: "Skip It",
};

export default function HeatmapMapContent({
  center,
  points,
  loading = false,
}: HeatmapMapContentProps) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={false} // We handle attribution manually for better styling
      style={{ background: "#0f172a" }} // Match OLED dark theme
    >
      {/* Dark map tiles - CartoDB Dark Matter (FREE, no API key needed) */}
      {/* License: CC BY 3.0 - https://carto.com/basemaps/ */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        // Attribution included in parent component footer
      />

      {/* Alternative: OpenStreetMap standard tiles (uncomment if CartoDB has issues) */}
      {/* <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /> */}

      <MapController center={center} />

      {/* Heatmap points as gradient circles */}
      {points.map((point, index) => {
        // Calculate radius based on activity count
        const baseRadius = 20;
        const countBoost = Math.min(point.count / 5, 3); // Max 3x boost
        const radius = baseRadius + (countBoost * 10);

        return (
          <CircleMarker
            key={`${point.lat}-${point.lon}-${index}`}
            center={[point.lat, point.lon]}
            radius={radius}
            pathOptions={{
              fillColor: point.color,
              fillOpacity: 0.7,
              color: point.color.replace(/[\d.]+\)$/, "1)"), // Solid border
              weight: 2,
              opacity: 0.9,
            }}
          >
            <Popup className="heatmap-popup">
              <div className="text-center min-w-[120px]">
                <span className="text-2xl block mb-1">{point.emoji}</span>
                <p className="font-semibold text-slate-900">
                  {VIBE_LABELS[point.dominantVibe] || point.dominantVibe}
                </p>
                <div className="mt-1 text-xs text-slate-600">
                  <span>{point.count} vibes logged</span>
                  <br />
                  <span>Activity: {Math.round(point.intensity * 100)}%</span>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-[1000] bg-slate-900/30 flex items-center justify-center pointer-events-none">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Custom CSS for popup styling */}
      <style>{`
        .heatmap-popup .leaflet-popup-content-wrapper {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .heatmap-popup .leaflet-popup-tip {
          background: white;
        }
        .heatmap-popup .leaflet-popup-content {
          margin: 10px 14px;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </MapContainer>
  );
}
