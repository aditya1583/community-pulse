"use client";

import React, { useState } from "react";
import type { LocalSection } from "./types";
import GasPricesCard from "./GasPricesCard";
import FarmersMarketsSection from "./FarmersMarketsSection";
import LocalDealsSection from "./LocalDealsSection";
import SentimentHeatmap from "./SentimentHeatmap";

type LocalTabProps = {
  cityName: string;
  state: string;
  lat?: number;
  lon?: number;
  /** Controlled section state (optional - will use internal state if not provided) */
  section?: LocalSection;
  /** Callback when section changes */
  onSectionChange?: (section: LocalSection) => void;
  /** Current user ID for vibe logging */
  userId?: string | null;
  /** Callback to show sign-in modal */
  onSignInClick?: () => void;
};

const SECTIONS: { id: LocalSection; label: string; emoji: string }[] = [
  { id: "deals", label: "Explore", emoji: "🏪" },
  { id: "heatmap", label: "Heatmap", emoji: "🗺️" },
  { id: "gas", label: "Gas", emoji: "⛽" },
  { id: "markets", label: "Markets", emoji: "🥬" },
];

/**
 * Local Tab Component
 *
 * Contains four sections accessible via segmented control:
 * - Explore: Local businesses & places (via Foursquare/OSM)
 * - Heatmap: Real-time vibe heatmap (via Leaflet/OSM - FREE)
 * - Gas: Regional gas prices (via EIA - free/public domain)
 * - Markets: Farmers markets nearby (via USDA - free/public domain)
 */
export default function LocalTab({
  cityName,
  state,
  lat,
  lon,
  section,
  onSectionChange,
  userId,
  onSignInClick,
}: LocalTabProps) {
  // Support both controlled and uncontrolled modes
  const [internalSection, setInternalSection] = useState<LocalSection>("deals");
  const activeSection = section ?? internalSection;

  const handleSectionChange = (newSection: LocalSection) => {
    setInternalSection(newSection);
    onSectionChange?.(newSection);
  };

  return (
    <div className="space-y-4">
      {/* Segmented Control */}
      <div className="bg-slate-800/50 rounded-xl p-1 flex gap-1">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => handleSectionChange(section.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <span>{section.emoji}</span>
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="min-h-[300px]">
        {activeSection === "deals" && (
          <LocalDealsSection
            cityName={cityName}
            state={state}
            lat={lat}
            lon={lon}
            userId={userId}
            onSignInClick={onSignInClick}
          />
        )}

        {activeSection === "heatmap" && lat && lon && (
          <SentimentHeatmap
            lat={lat}
            lon={lon}
            city={cityName}
          />
        )}

        {activeSection === "gas" && (
          <GasPricesCard state={state} cityName={cityName} lat={lat} lon={lon} />
        )}

        {activeSection === "markets" && (
          <FarmersMarketsSection
            cityName={cityName}
            state={state}
            lat={lat}
            lon={lon}
          />
        )}
      </div>
    </div>
  );
}
