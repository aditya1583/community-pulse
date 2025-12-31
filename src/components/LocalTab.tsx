"use client";

import React, { useState } from "react";
import type { LocalSection } from "./types";
import LocalDealsSection from "./LocalDealsSection";
import GasPricesCard from "./GasPricesCard";
import FarmersMarketsSection from "./FarmersMarketsSection";

type LocalTabProps = {
  cityName: string;
  state: string;
  lat?: number;
  lon?: number;
  /** Controlled section state (optional - will use internal state if not provided) */
  section?: LocalSection;
  /** Callback when section changes */
  onSectionChange?: (section: LocalSection) => void;
  /** User ID for vibe logging - if not provided, user must sign in */
  userId?: string | null;
  /** Callback to show sign-in modal */
  onSignInClick?: () => void;
};

const SECTIONS: { id: LocalSection; label: string; emoji: string }[] = [
  { id: "deals", label: "Deals", emoji: "🏪" },
  { id: "gas", label: "Gas", emoji: "⛽" },
  { id: "markets", label: "Markets", emoji: "🥬" },
];

/**
 * Local Tab Component
 *
 * Contains three sections accessible via segmented control:
 * - Deals: Yelp local business deals
 * - Gas: Regional gas prices
 * - Markets: Farmers markets nearby
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
            lat={lat}
            lon={lon}
            userId={userId}
            onSignInClick={onSignInClick}
          />
        )}

        {activeSection === "gas" && (
          <GasPricesCard state={state} />
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
