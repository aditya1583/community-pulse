"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { VENUE_VIBE_TYPES, getVibeTypeInfo, VenueVibeType, VenueVibeAggregate, VibeWithTrust, getTrustBadge, getTrustBadgeInfo } from "./types";

type VenueVibeCheckProps = {
  venueId: string;
  venueName: string;
  venueLat?: number;
  venueLon?: number;
  /** City name for filtering (e.g., "Austin, TX, US") */
  city?: string;
  /** Compact mode shows only a button + top vibe badge */
  compact?: boolean;
  /** User ID - if not provided, user must sign in to log vibes */
  userId?: string | null;
  /** Callback to show sign-in modal */
  onSignInClick?: () => void;
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
  city,
  compact = false,
  userId,
  onSignInClick,
}: VenueVibeCheckProps) {
  const isAuthenticated = !!userId;
  const [vibes, setVibes] = useState<VenueVibeAggregate[]>([]);
  const [vibesWithTrust, setVibesWithTrust] = useState<VibeWithTrust[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedVibe, setSubmittedVibe] = useState<VenueVibeType | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [confirmingVibeId, setConfirmingVibeId] = useState<string | null>(null);
  const [showVerifyPanel, setShowVerifyPanel] = useState(false);
  const [confirmedVibes, setConfirmedVibes] = useState<Map<string, "confirm" | "contradict">>(new Map());
  const [verifyError, setVerifyError] = useState<string | null>(null);

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

  // Fetch vibes with trust info for verification
  const fetchVibesWithTrust = useCallback(async () => {
    try {
      const res = await fetch(`/api/vibe-confirm?venue_id=${encodeURIComponent(venueId)}`);
      const data = await res.json();
      setVibesWithTrust(data.vibes || []);
    } catch (error) {
      console.error("Error fetching vibes with trust:", error);
    }
  }, [venueId]);

  useEffect(() => {
    fetchVibes();
    fetchVibesWithTrust();
  }, [fetchVibes, fetchVibesWithTrust]);

  // Confirm or contradict a vibe
  const confirmVibe = async (vibeId: string, action: "confirm" | "contradict") => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      setTimeout(() => setShowAuthPrompt(false), 3000);
      return;
    }

    setConfirmingVibeId(vibeId);
    setVerifyError(null);

    try {
      const res = await fetch("/api/vibe-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibeId,
          action,
          userId,
          city,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerifyError(data.error || "Failed to verify vibe");
        return;
      }

      // Track confirmed vibe for visual feedback
      setConfirmedVibes(prev => new Map(prev).set(vibeId, action));

      // Refresh vibes with trust
      await fetchVibesWithTrust();
      await fetchVibes();
    } catch (error) {
      console.error("Error confirming vibe:", error);
      setVerifyError("Failed to verify. Please try again.");
    } finally {
      setConfirmingVibeId(null);
    }
  };

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
          city, // Pass city for filtering
          userId, // Pass user ID for auth and tracking
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Failed to submit vibe");
        return;
      }

      setSubmitSuccess(true);
      setSubmittedVibe(vibeType);
      setIsOpen(false);

      // Refresh vibes
      await fetchVibes();

      // Reset success state after animation (longer for better feedback)
      setTimeout(() => {
        setSubmitSuccess(false);
        setSubmittedVibe(null);
      }, 3000);
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

  // Get the submitted vibe info for feedback
  const submittedVibeInfo = submittedVibe ? getVibeTypeInfo(submittedVibe) : null;
  const submittedVibeCount = submittedVibe
    ? (vibes.find(v => v.vibeType === submittedVibe)?.count || 1)
    : 0;

  // Prevent clicks from bubbling to parent anchor tags
  const handleContainerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Compact mode: just show the top vibe badge and a button
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 flex-wrap"
        onClick={handleContainerClick}
      >
        {/* Success feedback - shows after submitting */}
        {submitSuccess && submittedVibeInfo && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full animate-fade-in">
            <span>{submittedVibeInfo.emoji}</span>
            <span>
              {submittedVibeCount > 1
                ? `You + ${submittedVibeCount - 1} ${submittedVibeCount === 2 ? 'other' : 'others'}`
                : 'You'
              } say it's {submittedVibeInfo.label}!
            </span>
          </span>
        )}

        {/* Current vibe badge with verify option - hide when showing success */}
        {!submitSuccess && topVibe && topVibeInfo && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowVerifyPanel(true);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full hover:bg-violet-500/40 hover:border-violet-400/50 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] active:scale-95 transition-all duration-200 group animate-badge-glow"
          >
            <span className="group-hover:animate-bounce-subtle">{topVibeInfo.emoji}</span>
            <span>{topVibeInfo.label}</span>
            {topVibe.count > 1 && (
              <span className="text-violet-400/60 text-[10px]">({topVibe.count})</span>
            )}
            <span className="text-[10px] text-violet-400/50 group-hover:text-violet-300 ml-0.5 transition-colors">tap to verify</span>
          </button>
        )}

        {/* Vibe check button - vibrant and inviting */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isAuthenticated) {
                // Show auth prompt popup
                setShowAuthPrompt(true);
                // Auto-hide after 3 seconds
                setTimeout(() => setShowAuthPrompt(false), 3000);
                return;
              }
              setIsOpen(true);
            }}
            disabled={submitSuccess}
            className={`group inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 active:scale-95 ${
              submitSuccess
                ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.4)] cursor-default animate-success-pop"
                : "bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 text-white hover:from-violet-500 hover:to-fuchsia-500 hover:scale-105 shadow-[0_0_16px_rgba(139,92,246,0.4)] hover:shadow-[0_0_24px_rgba(139,92,246,0.6)] border border-violet-400/30 animate-subtle-pulse"
            }`}
          >
            {submitSuccess ? (
              <>
                <svg className="w-3.5 h-3.5 animate-check-draw" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Logged!</span>
              </>
            ) : (
              <>
                <span className="text-sm group-hover:animate-sparkle">✨</span>
                <span>Log Vibe</span>
              </>
            )}
          </button>

          {/* Auth prompt popup */}
          {showAuthPrompt && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-fade-in">
              <div className="bg-slate-800 border border-violet-500/30 rounded-lg shadow-lg p-3 whitespace-nowrap">
                <p className="text-xs text-slate-300 mb-2">Sign in to log vibes</p>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAuthPrompt(false);
                    onSignInClick?.();
                  }}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-md transition"
                >
                  Sign In
                </button>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                <div className="w-2 h-2 bg-slate-800 border-r border-b border-violet-500/30 rotate-45" />
              </div>
            </div>
          )}
        </div>

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

        {/* Verify panel modal */}
        {showVerifyPanel && (
          <VerifyPanel
            vibes={vibesWithTrust}
            venueName={venueName}
            onConfirm={confirmVibe}
            onClose={() => {
              setShowVerifyPanel(false);
              setVerifyError(null);
            }}
            confirmingVibeId={confirmingVibeId}
            currentUserId={userId}
            confirmedVibes={confirmedVibes}
            error={verifyError}
          />
        )}

        <style jsx>{`
          @keyframes subtle-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.02); }
          }
          .animate-subtle-pulse {
            animation: subtle-pulse 2s ease-in-out infinite;
          }
          @keyframes fade-in {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out;
          }
          @keyframes badge-glow {
            0%, 100% { box-shadow: 0 0 0 rgba(139,92,246,0); }
            50% { box-shadow: 0 0 8px rgba(139,92,246,0.2); }
          }
          .animate-badge-glow {
            animation: badge-glow 3s ease-in-out infinite;
          }
          @keyframes bounce-subtle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          .group:hover .group-hover\\:animate-bounce-subtle {
            animation: bounce-subtle 0.4s ease-in-out;
          }
          @keyframes sparkle {
            0%, 100% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.2) rotate(-10deg); }
            50% { transform: scale(1.3) rotate(5deg); }
            75% { transform: scale(1.1) rotate(-5deg); }
          }
          .group:hover .group-hover\\:animate-sparkle {
            animation: sparkle 0.5s ease-in-out;
          }
          @keyframes success-pop {
            0% { transform: scale(0.8); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-success-pop {
            animation: success-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          @keyframes check-draw {
            0% { stroke-dashoffset: 24; opacity: 0; }
            50% { opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 1; }
          }
          .animate-check-draw {
            stroke-dasharray: 24;
            animation: check-draw 0.4s ease-out forwards;
          }
        `}</style>
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

// Vibe picker modal component - uses Portal to escape anchor tags
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

  // Use portal to render outside of any parent anchor tags
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 animate-slide-up"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
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
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>,
    document.body
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
      className={`group flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 active:scale-95 ${
        count > 0
          ? "bg-violet-500/20 text-violet-200 border border-violet-500/30 hover:bg-violet-500/30 hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]"
          : "bg-slate-800 text-slate-300 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-500 hover:text-white"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span className="group-hover:scale-110 transition-transform">{vibe.emoji}</span>
      <span>{vibe.label}</span>
      {count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-violet-500/30 text-violet-200 rounded-full animate-pulse-subtle">
          {count}
        </span>
      )}
    </button>
  );
}

// Verify Panel - Shows vibes with confirm/contradict buttons
function VerifyPanel({
  vibes,
  venueName,
  onConfirm,
  onClose,
  confirmingVibeId,
  currentUserId,
  confirmedVibes,
  error,
}: {
  vibes: VibeWithTrust[];
  venueName: string;
  onConfirm: (vibeId: string, action: "confirm" | "contradict") => void;
  onClose: () => void;
  confirmingVibeId: string | null;
  currentUserId?: string | null;
  confirmedVibes: Map<string, "confirm" | "contradict">;
  error: string | null;
}) {
  if (typeof document === "undefined") return null;

  // Filter out user's own vibes
  const verifiableVibes = vibes.filter((v) => v.userId !== currentUserId);

  // Format time ago
  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700/50 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 animate-slide-up max-h-[80vh] overflow-y-auto"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>Verify Vibes</span>
              <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">+Trust</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[250px]">
              Help verify reports at {venueName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Vibes list */}
        {verifiableVibes.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl">{vibes.length > 0 ? "🙌" : "🔍"}</span>
            <p className="text-slate-400 mt-3">
              {vibes.length > 0 ? "All vibes here are yours!" : "No vibes to verify"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {vibes.length > 0
                ? "You can't verify your own vibes. Wait for neighbors to log theirs!"
                : "Be the first to log a vibe!"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {verifiableVibes.map((vibe) => {
              const vibeInfo = getVibeTypeInfo(vibe.vibeType);
              const badge = vibe.authorBadge ? getTrustBadgeInfo(vibe.authorBadge) : null;
              const isConfirming = confirmingVibeId === vibe.id;
              const netTrust = vibe.confirmCount - vibe.contradictCount;
              const userConfirmed = confirmedVibes.get(vibe.id);

              return (
                <div
                  key={vibe.id}
                  className={`bg-slate-800/50 border rounded-xl p-3 transition-all ${
                    userConfirmed
                      ? userConfirmed === "confirm"
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-red-500/50 bg-red-500/5"
                      : "border-slate-700/50"
                  }`}
                >
                  {/* Vibe header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{vibeInfo.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {vibeInfo.label}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {timeAgo(vibe.createdAt)}
                          {badge && (
                            <span className={`ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/50 ${badge.color} animate-trust-badge`}>
                              <span className="text-[10px]">{badge.emoji}</span>
                              <span className="text-[9px]">{badge.label}</span>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Trust indicator */}
                    {(vibe.confirmCount > 0 || vibe.contradictCount > 0) && (
                      <div className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        netTrust > 0
                          ? "bg-emerald-500/20 text-emerald-400"
                          : netTrust < 0
                          ? "bg-red-500/20 text-red-400"
                          : "bg-slate-700 text-slate-400"
                      }`}>
                        {vibe.confirmCount > 0 && `${vibe.confirmCount} ✓`}
                        {vibe.contradictCount > 0 && ` ${vibe.contradictCount} ✗`}
                      </div>
                    )}
                  </div>

                  {/* Action buttons or confirmed state */}
                  {userConfirmed ? (
                    <div className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg ${
                      userConfirmed === "confirm"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    } animate-fade-in`}>
                      {userConfirmed === "confirm" ? (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>You confirmed this</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>You marked as changed</span>
                        </>
                      )}
                    </div>
                  ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onConfirm(vibe.id, "confirm")}
                      disabled={isConfirming}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 hover:border-emerald-400/50 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] active:scale-95 transition-all duration-200 disabled:opacity-50 group/confirm"
                    >
                      {isConfirming ? (
                        <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 group-hover/confirm:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Confirm</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => onConfirm(vibe.id, "contradict")}
                      disabled={isConfirming}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/50 rounded-lg hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 active:scale-95 transition-all duration-200 disabled:opacity-50 group/contradict"
                    >
                      {isConfirming ? (
                        <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 group-hover/contradict:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span>That's changed</span>
                        </>
                      )}
                    </button>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-700/50">
          <p className="text-[10px] text-slate-500 text-center">
            Verifying vibes builds your Local Trust score
          </p>
        </div>
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
        @keyframes trust-badge {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-trust-badge {
          animation: trust-badge 0.3s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>,
    document.body
  );
}
