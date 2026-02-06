"use client";

import React, { useState, useMemo } from "react";
import type { Pulse } from "./types";
import { formatPulseDateTime } from "@/lib/pulses";
import { useExpiryCountdown } from "@/hooks/useExpiryCountdown";
import PulseLikeButton from "@/components/PulseLikeButton";
import PollVoting from "@/components/PollVoting";
import PredictionCard, { type PredictionData } from "@/components/PredictionCard";
import PulseComments from "@/components/PulseComments";
import ReportPulseButton from "@/components/ReportPulseButton";
import StatusRing from "@/components/StatusRing";
import { StatusIndicator } from "@/components/StatusRing";
import DistanceBadge from "@/components/DistanceBadge";
import { RADIUS_CONFIG } from "@/lib/constants/radius";

// ============================================================================
// ACTIONABLE CONTENT DETECTION
// ============================================================================

/**
 * Parsed action data from message content
 * Used to render action buttons for farmers market and other actionable posts
 */
interface ParsedActionData {
  type: "farmers_market" | "venue" | null;
  venueName: string | null;
  address: string | null;
  directionsUrl: string | null;
}

/**
 * Detect and parse actionable content from pulse message
 *
 * Farmers market posts have recognizable patterns:
 * - Address line starting with location pin emoji
 * - Directions CTA (e.g., "Tap for directions", "Get directions")
 *
 * This allows us to make bot posts actionable without database changes.
 */
function parseActionableContent(message: string, author: string): ParsedActionData {
  // Only check bot posts that are likely market-related
  const isMarketBot = author.toLowerCase().includes("market_scout");
  // Market emojis: corn, tomato, leafy green, carrot, honey pot
  const marketEmojis = ["🌽", "🍅", "🥬", "🥕", "🍯"];
  const hasMarketEmoji = marketEmojis.some(emoji => message.includes(emoji));
  const hasAddressLine = message.includes("📍"); // Pin emoji

  if (!isMarketBot && !hasMarketEmoji && !hasAddressLine) {
    return { type: null, venueName: null, address: null, directionsUrl: null };
  }

  // Try to extract venue name (first line, usually has the market name)
  const lines = message.split("\n").filter(line => line.trim());
  let venueName: string | null = null;
  let address: string | null = null;

  // First line usually contains the market name
  if (lines.length > 0) {
    // Remove emojis and extract the name part
    const firstLine = lines[0]
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Remove emojis
      .replace(/^[^a-zA-Z]*/, "") // Remove leading non-letters
      .replace(/is (OPEN|open|Open).*$/i, "") // Remove status text
      .replace(/!.*$/, "") // Remove exclamation and after
      .trim();

    if (firstLine.length > 2) {
      venueName = firstLine;
    }
  }

  // Find address line (starts with pin emoji)
  for (const line of lines) {
    if (line.includes("📍")) {
      // Extract address after the pin emoji
      address = line
        .replace(/📍/g, "")
        .replace(/\([^)]*mi\)/g, "") // Remove distance like "(1.8 mi)"
        .trim();
      break;
    }
  }

  // Check if there's a directions CTA
  const hasDirectionsCTA =
    message.toLowerCase().includes("directions") ||
    message.toLowerCase().includes("tap for") ||
    message.toLowerCase().includes("markets tab");

  if ((venueName || address) && hasDirectionsCTA) {
    // Build Google Maps directions URL
    const searchQuery = address
      ? encodeURIComponent(address)
      : venueName
        ? encodeURIComponent(venueName)
        : null;

    const directionsUrl = searchQuery
      ? `https://www.google.com/maps/dir/?api=1&destination=${searchQuery}`
      : null;

    return {
      type: "farmers_market",
      venueName,
      address,
      directionsUrl,
    };
  }

  return { type: null, venueName: null, address: null, directionsUrl: null };
}

// ============================================================================
// BOT IDENTITY FORMATTING
// ============================================================================

/**
 * Bot name mapping - converts snake_case bot types to friendly display names
 */
const BOT_TYPE_MAP: Record<string, { name: string; emoji: string }> = {
  hot_take: { name: "Hot Take Bot", emoji: "\uD83C\uDF36\uFE0F" },
  weather: { name: "Weather Bot", emoji: "\u2600\uFE0F" },
  traffic: { name: "Traffic Bot", emoji: "\uD83D\uDE97" },
  market_scout: { name: "Market Scout", emoji: "\uD83E\uDD55" },
  community: { name: "Community Bot", emoji: "\uD83D\uDC65" },
  event: { name: "Event Bot", emoji: "\uD83C\uDF89" },
  poll: { name: "Poll Bot", emoji: "\uD83D\uDCCA" },
  vibe_check: { name: "Vibe Check", emoji: "\u2728" },
  local_guide: { name: "Local Guide", emoji: "\uD83D\uDCCD" },
};

/**
 * Parse bot author name into friendly format
 * Input: "Leander hot_take_bot" or "Austin weather_bot"
 * Output: { displayName: "Hot Take Bot", location: "Leander", emoji: "pepper" }
 */
function parseBotAuthor(author: string): {
  displayName: string;
  location: string | null;
  emoji: string;
} {
  // Default fallback
  const fallback = { displayName: author, location: null, emoji: "\uD83E\uDD16" };

  // Try to match pattern: "Location bot_type_bot emoji" or "Location bot_type"
  const parts = author.split(" ");
  if (parts.length < 2) return fallback;

  // First part is typically the location (city name)
  const location = parts[0];

  // Extract emoji if present (last part if it's an emoji)
  const lastPart = parts[parts.length - 1];
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}]$/u;
  const hasTrailingEmoji = emojiRegex.test(lastPart);
  const extractedEmoji = hasTrailingEmoji ? lastPart : null;

  // Bot parts: everything except location and trailing emoji
  const botParts = hasTrailingEmoji ? parts.slice(1, -1) : parts.slice(1);
  const botPart = botParts.join("_").toLowerCase().replace(/_bot$/, "");

  // Look up the bot type
  const botInfo = BOT_TYPE_MAP[botPart];
  if (botInfo) {
    return {
      displayName: botInfo.name,
      location,
      emoji: extractedEmoji || botInfo.emoji,
    };
  }

  // Fallback: convert snake_case to Title Case
  const titleCase = botPart
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Only append "Bot" if the name doesn't already contain "Bot" as a word
  // This handles cases like "Oracle Bot" where emoji was at the end
  const containsBot = /\bBot\b/i.test(titleCase);
  const displayName = containsBot ? titleCase : `${titleCase} Bot`;

  return {
    displayName,
    location,
    emoji: extractedEmoji || "\uD83E\uDD16",
  };
}

type PulseCardProps = {
  pulse: Pulse;
  isOwnPulse: boolean;
  isFavorite: boolean;
  onToggleFavorite: (pulseId: number) => void;
  onDelete: (pulseId: number) => void;
  reporterId?: string;
  userIdentifier?: string;
  /** Optional: author's weekly leaderboard rank for status display */
  authorRank?: number | null;
  /** Optional: author's level */
  authorLevel?: number;
};

/**
 * Action buttons for actionable posts (farmers markets, venues)
 * Renders directions and website buttons when action data is present
 */
function ActionButtons({ actionData }: { actionData: ParsedActionData }) {
  if (!actionData.type || !actionData.directionsUrl) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
      {/* Get Directions button */}
      <a
        href={actionData.directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all active:scale-95 shadow-lg shadow-emerald-500/5"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
        Get Directions
      </a>

      {/* See on Markets Tab button - navigates to Local > Markets section */}
      {actionData.address && (
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            try {
              sessionStorage.setItem("cp-active-tab", "local");
              sessionStorage.setItem("cp-local-section", "markets");
              window.location.href = "/";
            } catch {
              window.location.href = "/";
            }
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
          </svg>
          See on Markets
        </button>
      )}
    </div>
  );
}

/**
 * Clock icon SVG component
 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/**
 * Expiry indicator - subtle clock icon with tap-to-reveal time remaining
 */
function ExpiryBadge({
  remainingText,
  isExpiringSoon,
  isFading,
}: {
  remainingText: string | null;
  isExpiringSoon: boolean;
  isFading: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!remainingText) return null;

  // Determine icon color based on urgency
  let iconColor = "text-slate-500";
  if (isFading) {
    iconColor = "text-amber-400/70 animate-pulse";
  } else if (isExpiringSoon) {
    iconColor = "text-orange-400";
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onBlur={() => setTimeout(() => setShowTooltip(false), 150)}
        className={`${iconColor} hover:text-slate-300 transition-colors p-1 -m-1`}
        aria-label="Show time remaining"
      >
        <ClockIcon />
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <div className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700 whitespace-nowrap">
            {remainingText} left
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="border-4 border-transparent border-t-slate-800" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PulseCard({
  pulse,
  isOwnPulse,
  isFavorite,
  onToggleFavorite,
  onDelete,
  reporterId,
  userIdentifier,
  authorRank,
  authorLevel,
}: PulseCardProps) {
  // Track expiry countdown for visual decay
  const { remainingText, opacity, isExpiringSoon, isFading, isExpired } =
    useExpiryCountdown(pulse.expiresAt);

  // Parse actionable content from message (memoized to avoid re-parsing)
  const actionData = useMemo(
    () => parseActionableContent(pulse.message, pulse.author),
    [pulse.message, pulse.author]
  );

  // Don't render if fully expired (client-side safety)
  if (isExpired) {
    return null;
  }

  const getCategoryStyle = () => {
    const tag = pulse.tag.toLowerCase();
    if (tag === "traffic") return {
      accent: "var(--accent-traffic)",
      badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      glow: "shadow-amber-500/5",
    };
    if (tag === "events") return {
      accent: "var(--accent-event)",
      badge: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      glow: "shadow-purple-500/5",
    };
    if (tag === "weather") return {
      accent: "var(--accent-weather)",
      badge: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      glow: "shadow-sky-500/5",
    };
    return {
      accent: "var(--accent-primary)",
      badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      glow: "shadow-emerald-500/5",
    };
  };

  const style = getCategoryStyle();

  return (
    <article
      className={`glass-card rounded-2xl p-5 mb-4 transition-all duration-300 premium-border hover:shadow-2xl ${style.glow} group ${isFading ? 'opacity-40 grayscale-[0.2]' : ''} overflow-hidden relative`}
      style={{ opacity }}
    >
      {/* Subtle indicator bar */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl transition-all group-hover:w-1.5"
        style={{ backgroundColor: style.accent }}
      />
      <div className="flex gap-4 relative">
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <StatusRing
            rank={authorRank}
            level={authorLevel}
            showLevel={authorLevel !== undefined && authorLevel > 1}
            size="lg"
          >
            <span className="text-3xl filter drop-shadow-md select-none">{pulse.mood}</span>
          </StatusRing>

          <div className="flex flex-col items-center gap-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${style.badge}`}>
              {pulse.tag}
            </span>

            {/* Distance badge for out-of-radius content */}
            {pulse.distanceMiles !== undefined &&
              pulse.distanceMiles !== null &&
              pulse.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES && (
                <DistanceBadge distanceMiles={pulse.distanceMiles} size="xs" />
              )}
          </div>
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {/* Metadata Row: Badges and Status */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {(() => {
              const isNew = new Date().getTime() - new Date(pulse.createdAt).getTime() < 30 * 60 * 1000;
              const hasPoll = pulse.poll_options && pulse.poll_options.length >= 2;
              const isPrediction = pulse.is_prediction;

              if (isPrediction) {
                return (
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20">
                    Predict
                  </span>
                );
              }
              if (hasPoll) {
                return (
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-500 text-white shadow-sm shadow-violet-500/20">
                    Vibe Check
                  </span>
                );
              }
              if (isNew) {
                return (
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20">
                    New
                  </span>
                );
              }
              return null;
            })()}

            {pulse.is_bot && (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" />
                AI Generated
              </span>
            )}
          </div>

          {/* Message content - increased readability */}
          <p className="text-[15px] text-white/90 leading-[1.6] mb-4 whitespace-pre-line font-medium tracking-tight text-balance">
            {pulse.message}
          </p>

          {/* Action buttons for actionable content (farmers markets, venues) */}
          {actionData.type && <ActionButtons actionData={actionData} />}

          {/* Prediction card for XP-staked predictions */}
          {pulse.is_prediction && pulse.poll_options && pulse.poll_options.length >= 2 && pulse.prediction_resolves_at && (
            <PredictionCard
              pulseId={pulse.id}
              options={pulse.poll_options}
              predictionData={{
                isPrediction: true,
                resolvesAt: pulse.prediction_resolves_at,
                resolvedAt: pulse.prediction_resolved_at ?? null,
                winningOption: pulse.prediction_winning_option ?? null,
                xpReward: pulse.prediction_xp_reward ?? 25,
                category: pulse.prediction_category ?? "local",
              }}
              userIdentifier={userIdentifier}
            />
          )}

          {/* Poll voting for regular This or That posts (not predictions) */}
          {!pulse.is_prediction && pulse.poll_options && pulse.poll_options.length >= 2 && (
            <PollVoting
              pulseId={pulse.id}
              options={pulse.poll_options}
              userIdentifier={userIdentifier}
            />
          )}

          <div className="flex items-center justify-between gap-3 pt-2 mt-auto border-t border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              {pulse.is_bot ? (
                (() => {
                  const botInfo = parseBotAuthor(pulse.author);
                  return (
                    <div className="flex items-center gap-2 text-slate-400 group/bot cursor-default">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-white/5 shadow-sm">
                        {botInfo.emoji}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200 leading-tight">{botInfo.displayName}</span>
                        {botInfo.location && (
                          <span className="text-[10px] text-slate-500 font-medium">in {botInfo.location}</span>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-cyan-400 truncate tracking-tight">{pulse.author}</span>
                    <StatusIndicator rank={authorRank} level={authorLevel} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Share Button - Web Share API */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (navigator.share) {
                    navigator.share({
                      title: `Voxlo - ${pulse.tag} in ${pulse.city}`,
                      text: pulse.message,
                      url: window.location.href,
                    }).catch(() => { });
                  } else {
                    // Fallback: Copy to clipboard
                    navigator.clipboard.writeText(`${pulse.message} - Seen on Voxlo`).then(() => {
                      alert("Copied to clipboard!");
                    });
                  }
                }}
                className="text-slate-500 hover:text-emerald-400 transition"
                title="Share this pulse"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
              </button>

              {/* Expiry indicator */}
              <ExpiryBadge
                remainingText={remainingText}
                isExpiringSoon={isExpiringSoon}
                isFading={isFading}
              />

              <PulseLikeButton pulseId={pulse.id} userIdentifier={userIdentifier} />

              {reporterId ? (
                <ReportPulseButton pulseId={pulse.id} reporterId={reporterId} />
              ) : (
                <button
                  type="button"
                  className="text-slate-700 cursor-not-allowed"
                  title="Sign in to report"
                  aria-disabled="true"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
                    />
                  </svg>
                </button>
              )}

              {isOwnPulse && (
                <button
                  type="button"
                  onClick={() => onDelete(pulse.id)}
                  className="text-slate-500 hover:text-red-400 transition"
                  title="Delete this pulse"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleFavorite(pulse.id)}
                className={`transition ${isFavorite
                  ? "text-amber-400"
                  : "text-slate-500 hover:text-amber-300"
                  }`}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                {isFavorite ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                )}
              </button>

              <span className="text-slate-500 font-mono">
                {formatPulseDateTime(pulse.createdAt)}
              </span>
            </div>
          </div>

          {/* Comments Section */}
          <PulseComments
            pulseId={pulse.id}
            userIdentifier={userIdentifier}
            reporterId={reporterId}
          />
        </div>
      </div>
    </article>
  );
}
