"use client";

import React, { useState, useEffect, useCallback } from "react";
import { VENUE_VIBE_TYPES, getVibeTypeInfo, VenueVibeType, VenueVibeAggregate } from "./types";

type VenueVibeCheckProps = {
  venueId: string;
  venueName: string;
  venueLat?: number;
  venueLon?: number;
  /** Compact mode shows only a button + top vibe badge */
  compact?: boolean;
};

// Generate a simple device fingerprint for rate limiting
function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "server";

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");
  const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
  const renderer = debugInfo
    ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : "unknown";

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    renderer,
  ].join("|");

  // Simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export default function VenueVibeCheck({
  venueId,
  venueName,
  venueLat,
  venueLon,
  compact = false,
}: VenueVibeCheckProps) {
  const [vibes, setVibes] = useState<VenueVibeAggregate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current vibes
  const fetchVibes = useCallback(async () => {
    try {
      const res = await fetch(`/api/venue-vibe?venue_id=${encodeURIComponent(venueId)}`);
      const data = await res.json();
      setVibes(data.vibes || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error("Error fetching venue vibes:", error);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchVibes();
  }, [fetchVibes]);

  // Submit a vibe
  const submitVibe = async (vibeType: VenueVibeType) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/venue-vibe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          venueName,
          vibeType,
          venueLat,
          venueLon,
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Failed to submit vibe");
        return;
      }

      setSubmitSuccess(true);
      setIsOpen(false);

      // Refresh vibes
      await fetchVibes();

      // Reset success state after animation
      setTimeout(() => setSubmitSuccess(false), 2000);
    } catch (error) {
      console.error("Error submitting vibe:", error);
      setSubmitError("Failed to submit vibe. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get the top vibe to display
  const topVibe = vibes[0];
  const topVibeInfo = topVibe ? getVibeTypeInfo(topVibe.vibeType as VenueVibeType) : null;

  // Group vibe types by category for the picker
  const vibesByCategory = {
    crowd: VENUE_VIBE_TYPES.filter((v) => v.category === "crowd"),
    atmosphere: VENUE_VIBE_TYPES.filter((v) => v.category === "atmosphere"),
    service: VENUE_VIBE_TYPES.filter((v) => v.category === "service"),
    quality: VENUE_VIBE_TYPES.filter((v) => v.category === "quality"),
  };

  // Compact mode: just show the top vibe badge and a button
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Current vibe badge */}
        {topVibe && topVibeInfo && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full">
            <span>{topVibeInfo.emoji}</span>
            <span>{topVibeInfo.label}</span>
            {topVibe.count > 1 && (
              <span className="text-violet-400/60">({topVibe.count})</span>
            )}
          </span>
        )}

        {/* Vibe check button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(true);
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full transition ${
            submitSuccess
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-700/50 text-slate-300 hover:bg-violet-500/20 hover:text-violet-300 border border-slate-600/50 hover:border-violet-500/30"
          }`}
        >
          {submitSuccess ? (
            <>
              <span>+1</span>
            </>
          ) : (
            <>
              <span>Vibe</span>
              <span className="text-violet-400">?</span>
            </>
          )}
        </button>

        {/* Vibe picker modal */}
        {isOpen && (
          <VibePicker
            vibesByCategory={vibesByCategory}
            currentVibes={vibes}
            onSelect={submitVibe}
            onClose={() => setIsOpen(false)}
            isSubmitting={isSubmitting}
            error={submitError}
            venueName={venueName}
          />
        )}
      </div>
    );
  }

  // Full mode: show all vibes and expanded picker
  return (
    <div className="space-y-2">
      {/* Current vibes display */}
      {!loading && vibes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {vibes.slice(0, 3).map((vibe) => {
            const info = getVibeTypeInfo(vibe.vibeType as VenueVibeType);
            return (
              <span
                key={vibe.vibeType}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-violet-500/10 text-violet-300 border border-violet-500/20 rounded-lg"
              >
                <span>{info.emoji}</span>
                <span>{info.label}</span>
                <span className="text-violet-400/60 text-[10px]">
                  {vibe.count}
                </span>
              </span>
            );
          })}
          {totalCount > 0 && (
            <span className="text-[10px] text-slate-500 self-center ml-1">
              {totalCount} vibe{totalCount !== 1 ? "s" : ""} in last 4h
            </span>
          )}
        </div>
      )}

      {/* Vibe check button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition ${
          submitSuccess
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/30"
        }`}
      >
        {submitSuccess ? (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Vibe Submitted!</span>
          </>
        ) : (
          <>
            <span>What's the vibe?</span>
          </>
        )}
      </button>

      {/* Vibe picker modal */}
      {isOpen && (
        <VibePicker
          vibesByCategory={vibesByCategory}
          currentVibes={vibes}
          onSelect={submitVibe}
          onClose={() => setIsOpen(false)}
          isSubmitting={isSubmitting}
          error={submitError}
          venueName={venueName}
        />
      )}
    </div>
  );
}

// Vibe picker modal component
function VibePicker({
  vibesByCategory,
  currentVibes,
  onSelect,
  onClose,
  isSubmitting,
  error,
  venueName,
}: {
  vibesByCategory: Record<string, typeof VENUE_VIBE_TYPES[number][]>;
  currentVibes: VenueVibeAggregate[];
  onSelect: (vibeType: VenueVibeType) => void;
  onClose: () => void;
  isSubmitting: boolean;
  error: string | null;
  venueName: string;
}) {
  // Get counts for each vibe type
  const getVibeCount = (vibeType: string) => {
    const found = currentVibes.find((v) => v.vibeType === vibeType);
    return found?.count || 0;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              What's the vibe?
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[250px]">
              at {venueName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Vibe options by category */}
        <div className="space-y-4">
          {/* Crowd Level */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Crowd Level
            </p>
            <div className="flex flex-wrap gap-2">
              {vibesByCategory.crowd.map((vibe) => (
                <VibeButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Atmosphere */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Atmosphere
            </p>
            <div className="flex flex-wrap gap-2">
              {vibesByCategory.atmosphere.map((vibe) => (
                <VibeButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Service */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Service
            </p>
            <div className="flex flex-wrap gap-2">
              {vibesByCategory.service.map((vibe) => (
                <VibeButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Worth It?
            </p>
            <div className="flex flex-wrap gap-2">
              {vibesByCategory.quality.map((vibe) => (
                <VibeButton
                  key={vibe.id}
                  vibe={vibe}
                  count={getVibeCount(vibe.id)}
                  onSelect={() => onSelect(vibe.id)}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-slate-500 text-center mt-4">
          Vibes expire after 4 hours to stay fresh
        </p>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

// Individual vibe button
function VibeButton({
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
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition ${
        count > 0
          ? "bg-violet-500/20 text-violet-200 border border-violet-500/30 hover:bg-violet-500/30"
          : "bg-slate-800 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span>{vibe.emoji}</span>
      <span>{vibe.label}</span>
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-violet-500/30 text-violet-200 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}
