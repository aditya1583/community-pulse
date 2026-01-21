"use client";

import React, { useState, useCallback, useEffect } from "react";
import { calculateDistanceMiles, formatDistance } from "@/lib/geo/distance";

/**
 * Challenge data from the database
 */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
  locationName: string;
  locationAddress?: string;
  xpReward: number;
  maxClaims?: number | null;
  claimsCount: number;
  spotsRemaining?: number | null;
  expiresAt: Date | string;
  challengeType: "checkin" | "photo" | "trail";
  trailId?: string | null;
  trailTitle?: string | null;
  trailOrder?: number | null;
  userHasClaimed: boolean;
}

interface ChallengeCardProps {
  challenge: Challenge;
  userLocation?: { lat: number; lng: number } | null;
  userIdentifier?: string;
  onClaimSuccess?: (challenge: Challenge, xpAwarded: number) => void;
}

type ClaimState = "idle" | "verifying" | "success" | "error" | "too_far";

/**
 * Mini map component showing target location
 * Uses static map image from OpenStreetMap
 */
function MiniMap({
  lat,
  lng,
  locationName,
  className = "",
}: {
  lat: number;
  lng: number;
  locationName: string;
  className?: string;
}) {
  // Use OpenStreetMap static tiles
  // Zoom level 15 shows neighborhood detail
  const zoom = 15;
  const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const tileY = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
      Math.PI) /
      2) *
    Math.pow(2, zoom)
  );

  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-700 ${className}`}
      aria-label={`Map showing ${locationName}`}
    >
      {/* Static map tile */}
      <img
        src={tileUrl}
        alt={`Map of ${locationName}`}
        className="w-full h-full object-cover opacity-80"
        loading="lazy"
      />

      {/* Target marker overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          {/* Pulse animation */}
          <div className="absolute inset-0 w-8 h-8 -m-4 bg-emerald-500/30 rounded-full animate-ping" />
          {/* Pin */}
          <div className="relative w-6 h-6 -m-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-full h-full drop-shadow-lg"
            >
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                fill="#10B981"
                stroke="#064E3B"
                strokeWidth={1.5}
              />
              <circle cx="12" cy="9" r="2.5" fill="white" />
            </svg>
          </div>
        </div>
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-900/80 to-transparent" />

      {/* OSM Attribution - Required by OpenStreetMap license */}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-1 right-1 text-[8px] text-slate-400/80 hover:text-slate-300 bg-slate-900/60 px-1 rounded"
      >
        &copy; OpenStreetMap
      </a>
    </div>
  );
}

/**
 * XP reward badge
 */
function XpBadge({ xp }: { xp: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      +{xp} XP
    </span>
  );
}

/**
 * Distance indicator
 */
function DistanceIndicator({
  distanceMiles,
  isWithinRadius,
}: {
  distanceMiles: number;
  isWithinRadius: boolean;
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full
        ${isWithinRadius
          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
          : "bg-slate-600/50 text-slate-300"
        }
      `}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {formatDistance(distanceMiles)}
    </span>
  );
}

/**
 * Spots remaining indicator
 */
function SpotsIndicator({ spotsRemaining, maxClaims }: { spotsRemaining: number; maxClaims: number }) {
  const percentage = (spotsRemaining / maxClaims) * 100;
  const isLow = spotsRemaining <= 3;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${isLow ? "bg-red-500" : "bg-emerald-500"
            }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${isLow ? "text-red-400" : "text-slate-400"}`}>
        {spotsRemaining} left
      </span>
    </div>
  );
}

/**
 * Countdown timer
 */
function CountdownTimer({ expiresAt }: { expiresAt: Date }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className="text-xs text-slate-500 font-mono">
      {timeLeft}
    </span>
  );
}

/**
 * Trail progress bar
 */
function TrailProgress({
  currentStop,
  totalStops,
}: {
  currentStop: number;
  totalStops: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Trail Progress</span>
      <div className="flex-1 flex gap-1">
        {Array.from({ length: totalStops }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full ${i < currentStop ? "bg-emerald-500" : "bg-slate-700"
              }`}
          />
        ))}
      </div>
      <span className="text-xs text-emerald-400 font-medium">
        {currentStop}/{totalStops}
      </span>
    </div>
  );
}

/**
 * ChallengeCard Component
 *
 * Displays a GPS-verified check-in challenge with:
 * - Mini map showing target location
 * - Distance from user's current location
 * - Spots remaining (if limited)
 * - XP reward badge
 * - Claim button with GPS verification
 * - Progress bar for trails
 */
export default function ChallengeCard({
  challenge,
  userLocation,
  userIdentifier,
  onClaimSuccess,
}: ChallengeCardProps) {
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse expiration date
  const expiresAt =
    challenge.expiresAt instanceof Date
      ? challenge.expiresAt
      : new Date(challenge.expiresAt);

  // Stable now for expiry calculation
  const [now] = useState(() => Date.now());
  const isExpired = expiresAt.getTime() < now;

  // Calculate distance from user
  const distanceMiles = userLocation
    ? calculateDistanceMiles(
      { lat: userLocation.lat, lon: userLocation.lng },
      { lat: challenge.targetLat, lon: challenge.targetLng }
    )
    : null;

  // Check if user is within claim radius (convert meters to miles)
  const radiusMiles = challenge.radiusMeters / 1609.34;
  const isWithinRadius = distanceMiles !== null && distanceMiles <= radiusMiles;

  // Determine if claim is possible
  // spotsRemaining can be undefined (not a limited challenge), null (unlimited), or number
  const spotsAvailable = challenge.spotsRemaining === undefined || challenge.spotsRemaining === null || challenge.spotsRemaining > 0;
  const canClaim =
    !challenge.userHasClaimed &&
    !isExpired &&
    spotsAvailable &&
    isWithinRadius;

  // Handle claim button click
  const handleClaim = useCallback(async () => {
    if (!userIdentifier) {
      setErrorMessage("Sign in to claim challenges");
      return;
    }

    if (!userLocation) {
      setErrorMessage("Enable location to claim");
      return;
    }

    if (!isWithinRadius) {
      setClaimState("too_far");
      setErrorMessage(
        `Get within ${Math.round(challenge.radiusMeters)}m to claim`
      );
      return;
    }

    setClaimState("verifying");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/challenges/${challenge.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIdentifier,
          verificationLat: userLocation.lat,
          verificationLng: userLocation.lng,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setClaimState("error");
        setErrorMessage(data.message || "Failed to claim challenge");
        return;
      }

      setClaimState("success");
      if (onClaimSuccess) {
        onClaimSuccess(challenge, data.xpAwarded);
      }
    } catch (error) {
      console.error("[ChallengeCard] Claim error:", error);
      setClaimState("error");
      setErrorMessage("Network error. Please try again.");
    }
  }, [challenge, userIdentifier, userLocation, isWithinRadius, onClaimSuccess]);

  // Render claim button based on state
  const renderClaimButton = () => {
    if (challenge.userHasClaimed || claimState === "success") {
      return (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-300 font-medium">Claimed!</span>
        </div>
      );
    }

    if (isExpired) {
      return (
        <button
          disabled
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 text-slate-500 cursor-not-allowed"
        >
          Expired
        </button>
      );
    }

    if (challenge.spotsRemaining === 0) {
      return (
        <button
          disabled
          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 text-slate-500 cursor-not-allowed"
        >
          No Spots Left
        </button>
      );
    }

    if (!userLocation) {
      return (
        <button
          onClick={handleClaim}
          className="w-full px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Enable Location
          </span>
        </button>
      );
    }

    if (!isWithinRadius) {
      return (
        <div className="space-y-2">
          <button
            disabled
            className="w-full px-4 py-2 rounded-lg bg-slate-700/50 text-slate-400 cursor-not-allowed"
          >
            Get Closer to Claim
          </button>
          <p className="text-xs text-center text-slate-500">
            {formatDistance(distanceMiles!)} away (need {Math.round(challenge.radiusMeters)}m)
          </p>
        </div>
      );
    }

    if (claimState === "verifying") {
      return (
        <button
          disabled
          className="w-full px-4 py-2 rounded-lg bg-emerald-600/50 text-emerald-200 cursor-wait"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verifying Location...
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={handleClaim}
        className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
      >
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Claim Challenge
        </span>
      </button>
    );
  };

  // Get challenge type badge
  const getTypeBadge = () => {
    switch (challenge.challengeType) {
      case "photo":
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
            📸 Photo
          </span>
        );
      case "trail":
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
            🗺️ Trail
          </span>
        );
      default:
        return (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
            📍 Check-in
          </span>
        );
    }
  };

  return (
    <article
      className={`
        bg-slate-800/60 border rounded-xl overflow-hidden transition-all
        ${challenge.userHasClaimed || claimState === "success"
          ? "border-emerald-500/30 opacity-80"
          : isExpired
            ? "border-slate-700/30 opacity-60"
            : "border-slate-700/50 hover:border-emerald-500/30"
        }
      `}
    >
      {/* Mini Map */}
      <MiniMap
        lat={challenge.targetLat}
        lng={challenge.targetLng}
        locationName={challenge.locationName}
        className="h-32"
      />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Header: Type + XP + Timer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {getTypeBadge()}
            <XpBadge xp={challenge.xpReward} />
          </div>
          <CountdownTimer expiresAt={expiresAt} />
        </div>

        {/* Title */}
        <h3 className="font-semibold text-white">{challenge.title}</h3>

        {/* Location */}
        <div className="flex items-start gap-2 text-sm">
          <svg className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <span className="text-slate-200">{challenge.locationName}</span>
            {challenge.locationAddress && (
              <p className="text-xs text-slate-500">{challenge.locationAddress}</p>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-400">{challenge.description}</p>

        {/* Distance indicator */}
        {distanceMiles !== null && (
          <DistanceIndicator
            distanceMiles={distanceMiles}
            isWithinRadius={isWithinRadius}
          />
        )}

        {/* Spots remaining (if limited) */}
        {challenge.maxClaims && typeof challenge.spotsRemaining === "number" && challenge.spotsRemaining > 0 && (
          <SpotsIndicator
            spotsRemaining={challenge.spotsRemaining}
            maxClaims={challenge.maxClaims}
          />
        )}

        {/* Trail progress (if part of trail) */}
        {challenge.trailId && challenge.trailOrder && (
          <TrailProgress
            currentStop={challenge.trailOrder}
            totalStops={5} // TODO: Get from trail data
          />
        )}

        {/* Error message */}
        {errorMessage && claimState !== "success" && (
          <p className="text-xs text-red-400 text-center">{errorMessage}</p>
        )}

        {/* Claim button */}
        {renderClaimButton()}
      </div>
    </article>
  );
}

/**
 * ChallengeList Component
 * Renders a list of challenges with proper layout
 */
export function ChallengeList({
  challenges,
  userLocation,
  userIdentifier,
  onClaimSuccess,
  emptyMessage = "No active challenges right now. Check back soon!",
}: {
  challenges: Challenge[];
  userLocation?: { lat: number; lng: number } | null;
  userIdentifier?: string;
  onClaimSuccess?: (challenge: Challenge, xpAwarded: number) => void;
  emptyMessage?: string;
}) {
  if (challenges.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {challenges.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          challenge={challenge}
          userLocation={userLocation}
          userIdentifier={userIdentifier}
          onClaimSuccess={onClaimSuccess}
        />
      ))}
    </div>
  );
}
