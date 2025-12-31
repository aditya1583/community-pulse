"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
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

type LiveVibesResponse = {
  vibes: LiveVibe[];
  hasVibes: boolean;
  totalVenues: number;
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
  const [totalVenues, setTotalVenues] = useState(0);

  // Fetch live vibes from API - limit to 2 venues for display
  const fetchLiveVibes = useCallback(async () => {
    if (!city) return;

    try {
      // Request up to 10 to know total count, but we'll only display 2
      const res = await fetch(`/api/live-vibes?city=${encodeURIComponent(city)}&limit=10`);
      const data: LiveVibesResponse = await res.json();
      // Only keep first 2 vibes for display
      setVibes((data.vibes || []).slice(0, 2));
      setHasVibes(data.hasVibes || false);
      setTotalVenues(data.totalVenues || 0);
    } catch (error) {
      console.error("Error fetching live vibes:", error);
    } finally {
      setLoading(false);
    }
  }, [city]);

  // Initial fetch and polling fallback
  useEffect(() => {
    fetchLiveVibes();
    // Fallback polling every 2 minutes (realtime is primary)
    const interval = setInterval(fetchLiveVibes, 120000);
    return () => clearInterval(interval);
  }, [fetchLiveVibes]);

  // REALTIME: Subscribe to venue_vibes table for instant updates
  useEffect(() => {
    if (!city) return;

    const channelName = `venue-vibes-realtime-${city.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "venue_vibes",
        },
        () => {
          // Refetch vibes when a new one is added
          // This aggregates properly via the API
          fetchLiveVibes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [city, fetchLiveVibes]);

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
          Real vibes from real neighbors, right now.
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

      {/* Vibe cards - Max 2 venues + 1 summary */}
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

        {/* Category summary - shows when more than 2 venues have activity */}
        {totalVenues > 2 && (
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/20">
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0">📊</span>
              <p className="text-xs text-slate-400">
                <span className="text-violet-300 font-medium">{totalVenues - 2}</span> more spot{totalVenues - 2 !== 1 ? 's' : ''} reporting activity
              </p>
            </div>
            <button
              onClick={onNavigateToLocal}
              className="text-[10px] text-violet-400 hover:text-violet-300 transition"
            >
              View all →
            </button>
          </div>
        )}
      </div>

      {/* Log Vibe CTA - always visible */}
      <button
        onClick={onNavigateToLocal}
        className="w-full mt-3 py-2 px-4 bg-gradient-to-r from-violet-600/60 to-fuchsia-600/60 text-white text-sm font-medium rounded-lg hover:from-violet-500 hover:to-fuchsia-500 transition-all border border-violet-400/20 flex items-center justify-center gap-2"
      >
        <span>✨</span>
        <span>Log a Vibe</span>
      </button>

      {/* Footer */}
      <p className="text-[10px] text-slate-500 text-center mt-2">
        Real vibes from real neighbors, right now
      </p>
    </div>
  );
}
