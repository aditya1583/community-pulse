"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/../lib/supabaseClient";
import { createPortal } from "react-dom";
import {
  VENUE_VIBE_TYPES,
  getVibeTypeInfo,
  VenueVibeType,
  VenueVibeAggregate,
} from "./types";

// Supabase client imported from shared module

type Venue = {
  id: string;
  name: string;
  category?: string;
  address?: string;
  lat?: number;
  lon?: number;
  phone?: string;
  hours?: string;
  isPartner?: boolean;
  foursquare_id?: string;
};

type VenueVibe = {
  id: string;
  vibe_type: string;
  created_at: string;
  venue_name: string;
};

// Group vibe types by category for the picker
const VIBES_BY_CATEGORY = {
  crowd: VENUE_VIBE_TYPES.filter((v) => v.category === "crowd"),
  atmosphere: VENUE_VIBE_TYPES.filter((v) => v.category === "atmosphere"),
  service: VENUE_VIBE_TYPES.filter((v) => v.category === "service"),
  quality: VENUE_VIBE_TYPES.filter((v) => v.category === "quality"),
};

type Props = {
  venue: Venue;
  userId: string | null;
  onBack: () => void;
  onSignInClick: () => void;
};

export default function VenueDetailPage({
  venue,
  userId,
  onBack,
  onSignInClick,
}: Props) {
  const [vibes, setVibes] = useState<VenueVibe[]>([]);
  const [aggregatedVibes, setAggregatedVibes] = useState<VenueVibeAggregate[]>([]);
  const [totalVibeCount, setTotalVibeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showVibeModal, setShowVibeModal] = useState(false);
  const [loggingVibe, setLoggingVibe] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedVibe, setSubmittedVibe] = useState<VenueVibeType | null>(null);
  const [vibeError, setVibeError] = useState<string | null>(null);

  // Get the top vibe for hero display
  const topVibe = aggregatedVibes[0];
  const topVibeInfo = topVibe ? getVibeTypeInfo(topVibe.vibeType as VenueVibeType) : null;

  // Fetch venue vibes (both raw and aggregated)
  const fetchVenueData = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch aggregated vibes from API using venue_name (canonical identifier)
      const res = await fetch(`/api/venue-vibe?venue_name=${encodeURIComponent(venue.name)}`);
      const data = await res.json();
      setAggregatedVibes(data.vibes || []);
      setTotalVibeCount(data.totalCount || 0);

      // Also fetch raw recent vibes for activity feed
      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

      const { data: vibesData } = await supabase
        .from("venue_vibes")
        .select("id, vibe_type, created_at, venue_name")
        .eq("venue_name", venue.name)
        .gte("created_at", fourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(10);

      setVibes(vibesData || []);
    } catch (err) {
      console.error("Error fetching venue data:", err);
    } finally {
      setLoading(false);
    }
  }, [venue.name]);

  useEffect(() => {
    fetchVenueData();
  }, [fetchVenueData]);

  // Handle log vibe
  const handleLogVibe = async (vibeType: VenueVibeType) => {
    if (!userId) {
      onSignInClick();
      return;
    }

    setLoggingVibe(true);
    setVibeError(null); // Clear previous errors

    try {
      const response = await fetch("/api/venue-vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueName: venue.name,
          venueId: venue.id,
          venueLat: venue.lat,
          venueLon: venue.lon,
          vibeType: vibeType,
          userId: userId,
        }),
      });

      if (response.ok) {
        setShowVibeModal(false);
        setSubmitSuccess(true);
        setSubmittedVibe(vibeType);
        setVibeError(null);
        await fetchVenueData(); // Refresh data

        // Reset success state after animation
        setTimeout(() => {
          setSubmitSuccess(false);
          setSubmittedVibe(null);
        }, 3000);
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to log vibe. Please try again.";
        setVibeError(errorMessage);
        console.error("Log vibe failed:", errorMessage);

        // Auto-clear error after 5 seconds
        setTimeout(() => setVibeError(null), 5000);
      }
    } catch (err) {
      const errorMessage = "Network error. Please try again.";
      setVibeError(errorMessage);
      console.error("Log vibe error:", err);
      setTimeout(() => setVibeError(null), 5000);
    } finally {
      setLoggingVibe(false);
    }
  };

  // Get vibe count for a specific type
  const getVibeCount = (vibeType: string): number => {
    const found = aggregatedVibes.find((v) => v.vibeType === vibeType);
    return found?.count || 0;
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Open in maps - use venue name + address for better UX (shows business name, not coordinates)
  const openInMaps = () => {
    // Build a search query with venue name and address for best results
    const searchParts: string[] = [];
    if (venue.name) searchParts.push(venue.name);
    if (venue.address) searchParts.push(venue.address);

    if (searchParts.length > 0) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchParts.join(' '))}`,
        "_blank"
      );
    } else if (venue.lat && venue.lon) {
      // Fallback to coordinates only if no name/address available
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lon}`,
        "_blank"
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition"
            aria-label="Go back"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{venue.name}</h1>
            <div className="flex items-center gap-2">
              {venue.category && (
                <span className="text-sm text-slate-400">{venue.category}</span>
              )}
              {venue.isPartner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Partner
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-24">
        {/* Hero Vibe Section - The star of the show */}
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-slate-700/50 rounded-2xl p-5 relative overflow-hidden">
          {/* Subtle background glow when there's a vibe */}
          {topVibeInfo && (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
          )}

          <div className="relative">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : topVibeInfo ? (
              <>
                {/* Current vibe display */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <span className="text-4xl">{topVibeInfo.emoji}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-semibold text-white">
                      {topVibeInfo.label}
                    </div>
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                      <span>{totalVibeCount} {totalVibeCount === 1 ? "person" : "people"} checked in</span>
                      <span className="text-slate-600">in last 4h</span>
                    </div>
                  </div>
                </div>

                {/* Other active vibes */}
                {aggregatedVibes.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {aggregatedVibes.slice(1, 4).map((vibe) => {
                      const info = getVibeTypeInfo(vibe.vibeType as VenueVibeType);
                      return (
                        <span
                          key={vibe.vibeType}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800/80 text-slate-300 border border-slate-700/50 rounded-full"
                        >
                          <span>{info.emoji}</span>
                          <span>{info.label}</span>
                          <span className="text-slate-500">{vibe.count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Empty state - invitation to contribute */
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-800/50 border border-dashed border-slate-600 flex items-center justify-center">
                  <span className="text-3xl opacity-50">?</span>
                </div>
                <p className="text-slate-400 mb-1">No vibes yet</p>
                <p className="text-sm text-slate-500">Be the first to share what it&apos;s like here</p>
              </div>
            )}

            {/* Success feedback overlay */}
            {submitSuccess && submittedVibe && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 rounded-2xl animate-fade-in">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-success-pop">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {getVibeTypeInfo(submittedVibe).emoji} Vibe logged!
                  </p>
                  <p className="text-sm text-slate-400 mt-1">Thanks for sharing</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Toast */}
        {vibeError && (
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
            <span className="text-red-400 text-sm">⚠️</span>
            <span className="text-red-300 text-sm flex-1">{vibeError}</span>
            <button
              onClick={() => setVibeError(null)}
              className="text-red-400 hover:text-red-300 text-lg"
            >
              ×
            </button>
          </div>
        )}

        {/* Quick Vibe Actions - Most common vibes as one-tap buttons */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Quick Check-in
            </span>
            <button
              onClick={() => setShowVibeModal(true)}
              className="text-xs text-violet-400 hover:text-violet-300 transition"
            >
              See all vibes
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {/* Show the 4 most relevant quick vibes */}
            {[
              VENUE_VIBE_TYPES.find(v => v.id === "busy"),
              VENUE_VIBE_TYPES.find(v => v.id === "chill"),
              VENUE_VIBE_TYPES.find(v => v.id === "great_vibes"),
              VENUE_VIBE_TYPES.find(v => v.id === "worth_it"),
            ].filter(Boolean).map((vibe) => {
              const count = getVibeCount(vibe!.id);
              const isActive = count > 0;

              return (
                <button
                  key={vibe!.id}
                  onClick={() => handleLogVibe(vibe!.id as VenueVibeType)}
                  disabled={loggingVibe}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all active:scale-95 ${isActive
                    ? "bg-violet-500/15 border-violet-500/30 hover:bg-violet-500/25"
                    : "bg-slate-800/60 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"
                    } disabled:opacity-50`}
                >
                  <span className="text-2xl">{vibe!.emoji}</span>
                  <span className={`text-[10px] font-medium ${isActive ? "text-violet-300" : "text-slate-400"}`}>
                    {vibe!.label}
                  </span>
                  {count > 0 && (
                    <span className="text-[9px] text-violet-400/70">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Venue Info */}
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Info
          </div>

          {venue.address && (
            <div className="flex items-start gap-3 text-sm">
              <svg className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-slate-300">{venue.address}</span>
            </div>
          )}

          {venue.phone && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href={`tel:${venue.phone}`} className="text-emerald-400 hover:text-emerald-300 transition">
                {venue.phone}
              </a>
            </div>
          )}

          {venue.hours && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-slate-300">{venue.hours}</span>
            </div>
          )}

          {(venue.lat && venue.lon) || venue.address ? (
            <button
              onClick={openInMaps}
              className="w-full mt-2 py-2.5 px-4 rounded-xl border border-slate-700/50 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Open in Maps
            </button>
          ) : null}
        </div>
      </main>

      {/* Vibe Modal - Full categorized picker */}
      {showVibeModal && (
        <VibePickerModal
          venueName={venue.name}
          aggregatedVibes={aggregatedVibes}
          onSelect={handleLogVibe}
          onClose={() => setShowVibeModal(false)}
          isSubmitting={loggingVibe}
        />
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        @keyframes success-pop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-success-pop {
          animation: success-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Vibe Picker Modal - Categorized vibe selection
// ============================================================
function VibePickerModal({
  venueName,
  aggregatedVibes,
  onSelect,
  onClose,
  isSubmitting,
}: {
  venueName: string;
  aggregatedVibes: VenueVibeAggregate[];
  onSelect: (vibeType: VenueVibeType) => void;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  // Get counts for each vibe type
  const getVibeCount = (vibeType: string) => {
    const found = aggregatedVibes.find((v) => v.vibeType === vibeType);
    return found?.count || 0;
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">
              What&apos;s the vibe?
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[250px]">
              at {venueName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Vibe options by category */}
        <div className="space-y-5">
          {/* Crowd Level */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">
              Crowd Level
            </p>
            <div className="flex flex-wrap gap-2">
              {VIBES_BY_CATEGORY.crowd.map((vibe) => (
                <VibeOptionButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id as VenueVibeType)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Atmosphere */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">
              Atmosphere
            </p>
            <div className="flex flex-wrap gap-2">
              {VIBES_BY_CATEGORY.atmosphere.map((vibe) => (
                <VibeOptionButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id as VenueVibeType)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Service */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">
              Service
            </p>
            <div className="flex flex-wrap gap-2">
              {VIBES_BY_CATEGORY.service.map((vibe) => (
                <VibeOptionButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id as VenueVibeType)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">
              Worth It?
            </p>
            <div className="flex flex-wrap gap-2">
              {VIBES_BY_CATEGORY.quality.map((vibe) => (
                <VibeOptionButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id as VenueVibeType)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-slate-500 text-center mt-5">
          Vibes expire after 4 hours to stay fresh
        </p>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>,
    document.body
  );
}

// Individual vibe option button
function VibeOptionButton({
  vibe,
  count,
  onSelect,
  disabled,
}: {
  vibe: typeof VENUE_VIBE_TYPES[number];
  count: number;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`group flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 active:scale-95 ${count > 0
        ? "bg-violet-500/20 text-violet-200 border border-violet-500/30 hover:bg-violet-500/30 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]"
        : "bg-slate-800 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-500 hover:text-white"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span className="group-hover:scale-110 transition-transform">{vibe.emoji}</span>
      <span>{vibe.label}</span>
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-violet-500/30 text-violet-200 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}
