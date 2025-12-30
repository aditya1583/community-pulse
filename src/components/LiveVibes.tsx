"use client";

import React, { useState, useEffect } from "react";
import { getVibeTypeInfo, VenueVibeType } from "./types";

type LiveVibe = {
  venueId: string;
  venueName: string;
  vibeType: string;
  vibeCount: number;
  latestAt: string;
};

type LiveVibesProps = {
  city: string;
  onNavigateToLocal?: () => void;
};

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function LiveVibes({ city, onNavigateToLocal }: LiveVibesProps) {
  const [vibes, setVibes] = useState<LiveVibe[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasVibes, setHasVibes] = useState(false);

  useEffect(() => {
    const fetchLiveVibes = async () => {
      if (!city) return;

      try {
        const res = await fetch(`/api/live-vibes?city=${encodeURIComponent(city)}&limit=5`);
        const data = await res.json();
        setVibes(data.vibes || []);
        setHasVibes(data.hasVibes || false);
      } catch (error) {
        console.error("Error fetching live vibes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveVibes();
    // Refresh every 2 minutes
    const interval = setInterval(fetchLiveVibes, 120000);
    return () => clearInterval(interval);
  }, [city]);

  // Don't render while loading
  if (loading) return null;

  // Empty state - show CTA to discover the feature
  if (!hasVibes || vibes.length === 0) {
    return (
      <div className="bg-gradient-to-br from-violet-900/20 via-slate-800/50 to-fuchsia-900/20 border border-violet-500/20 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">✨</span>
          <h3 className="text-sm font-semibold text-white">Live Vibes</h3>
          <span className="text-[10px] text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
            NEW
          </span>
        </div>

        <p className="text-sm text-slate-300 mb-3">
          Know what's <span className="text-violet-400 font-medium">really</span> happening at local spots.
          Is the coffee shop packed? Is the bar chill tonight?
        </p>

        <button
          onClick={onNavigateToLocal}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 text-white text-sm font-semibold rounded-lg hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-[0_0_16px_rgba(139,92,246,0.3)] border border-violet-400/30"
        >
          🎯 Log Your First Vibe
        </button>

        <p className="text-[10px] text-slate-500 text-center mt-2">
          Google knows it's open. You'll know if it's worth going.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-violet-900/20 via-slate-800/50 to-fuchsia-900/20 border border-violet-500/20 rounded-xl p-4 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📍</span>
        <h3 className="text-sm font-semibold text-white">Live Vibes</h3>
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Vibe cards */}
      <div className="space-y-2">
        {vibes.map((vibe) => {
          const info = getVibeTypeInfo(vibe.vibeType as VenueVibeType);
          return (
            <div
              key={vibe.venueId}
              className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/30"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-lg flex-shrink-0">{info.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{vibe.venueName}</p>
                  <p className="text-xs text-slate-400">
                    {info.label}
                    {vibe.vibeCount > 1 && (
                      <span className="text-violet-400 ml-1">
                        ({vibe.vibeCount} reports)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">
                {formatTimeAgo(vibe.latestAt)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-slate-500 text-center mt-3">
        Real-time crowd-sourced vibes from your neighbors
      </p>
    </div>
  );
}
