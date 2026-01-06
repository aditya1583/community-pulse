"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Vibe type to emoji mapping
const VIBE_EMOJI: Record<string, string> = {
  busy: "🔥",
  live_music: "🎵",
  great_vibes: "✨",
  worth_it: "💯",
  fast_service: "⚡",
  moderate: "👍",
  chill: "😎",
  quiet: "🤫",
  long_wait: "⏳",
  skip_it: "👎",
};

// Vibe type to display name
const VIBE_DISPLAY: Record<string, string> = {
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
  const [loading, setLoading] = useState(true);
  const [showVibeModal, setShowVibeModal] = useState(false);
  const [loggingVibe, setLoggingVibe] = useState(false);

  // Calculate dominant vibe from recent vibes
  const dominantVibe = vibes.length > 0
    ? vibes.reduce((acc, v) => {
        acc[v.vibe_type] = (acc[v.vibe_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : null;

  const topVibe = dominantVibe
    ? Object.entries(dominantVibe).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;

  // Fetch venue vibes
  const fetchVenueData = useCallback(async () => {
    setLoading(true);

    try {
      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

      // Fetch recent vibes for this venue
      const { data: vibesData } = await supabase
        .from("venue_vibes")
        .select("id, vibe_type, created_at, venue_name")
        .eq("venue_name", venue.name)
        .gte("created_at", fourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(20);

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
  const handleLogVibe = async (vibeType: string) => {
    if (!userId) {
      onSignInClick();
      return;
    }

    setLoggingVibe(true);

    try {
      const response = await fetch("/api/venue-vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: venue.name,
          venue_id: venue.id,
          venue_lat: venue.lat,
          venue_lon: venue.lon,
          vibe_type: vibeType,
          user_id: userId,
        }),
      });

      if (response.ok) {
        setShowVibeModal(false);
        fetchVenueData(); // Refresh data
      } else {
        const error = await response.json();
        console.error("Log vibe failed:", error);
      }
    } catch (err) {
      console.error("Log vibe error:", err);
    } finally {
      setLoggingVibe(false);
    }
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

  // Open in maps
  const openInMaps = () => {
    if (venue.lat && venue.lon) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lon}`,
        "_blank"
      );
    } else if (venue.address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`,
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
        {/* Current Vibe Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">
            Current Vibe
          </div>
          {loading ? (
            <div className="text-slate-400 animate-pulse">Loading...</div>
          ) : topVibe ? (
            <div className="flex items-center gap-3">
              <span className="text-4xl">{VIBE_EMOJI[topVibe] || "📍"}</span>
              <div>
                <div className="text-xl font-semibold text-emerald-400">
                  {VIBE_DISPLAY[topVibe] || topVibe}
                </div>
                <div className="text-sm text-slate-400">
                  {vibes.length} vibe{vibes.length !== 1 ? "s" : ""} in last 4h
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-400">
              No recent vibes. Be the first to share!
            </div>
          )}
        </div>

        {/* Log Vibe Button */}
        <button
          onClick={() => setShowVibeModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 active:scale-[0.98] transition shadow-lg shadow-emerald-500/25"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Share What&apos;s Happening
        </button>

        {/* Recent Activity */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">
            Recent Activity
          </div>
          {loading ? (
            <div className="text-slate-400 animate-pulse">Loading...</div>
          ) : vibes.length > 0 ? (
            <div className="space-y-3">
              {vibes.slice(0, 5).map((vibe) => (
                <div
                  key={vibe.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="text-xl">{VIBE_EMOJI[vibe.vibe_type] || "📍"}</span>
                  <span className="flex-1 text-slate-300">
                    {VIBE_DISPLAY[vibe.vibe_type] || vibe.vibe_type}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {formatRelativeTime(vibe.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">
              No activity yet. Be the first to share!
            </div>
          )}
        </div>

        {/* Venue Info */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Info
          </div>

          {venue.address && (
            <div className="flex items-start gap-3 text-sm">
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-slate-300">{venue.address}</span>
            </div>
          )}

          {venue.phone && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <a href={`tel:${venue.phone}`} className="text-emerald-400">
                {venue.phone}
              </a>
            </div>
          )}

          {venue.hours && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-slate-300">{venue.hours}</span>
            </div>
          )}

          {(venue.lat && venue.lon) || venue.address ? (
            <button
              onClick={openInMaps}
              className="w-full mt-2 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Open in Maps
            </button>
          ) : null}
        </div>
      </main>

      {/* Vibe Modal */}
      {showVibeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
          onClick={() => setShowVibeModal(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 rounded-t-3xl p-6 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-4 text-center">
              How&apos;s the vibe at {venue.name}?
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(VIBE_EMOJI).map(([type, emoji]) => (
                <button
                  key={type}
                  onClick={() => handleLogVibe(type)}
                  disabled={loggingVibe}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 transition active:scale-[0.98]"
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-sm font-medium text-slate-200">
                    {VIBE_DISPLAY[type]}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowVibeModal(false)}
              className="w-full mt-4 py-3 text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CSS for slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
