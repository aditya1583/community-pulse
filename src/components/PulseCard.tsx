"use client";

import React, { useState } from "react";
import type { Pulse } from "./types";
import { formatPulseDateTime } from "@/lib/pulses";
import { useExpiryCountdown } from "@/hooks/useExpiryCountdown";
import PulseLikeButton from "@/components/PulseLikeButton";
import PollVoting from "@/components/PollVoting";
import PulseComments from "@/components/PulseComments";
import ReportPulseButton from "@/components/ReportPulseButton";
import StatusRing from "@/components/StatusRing";
import { StatusIndicator } from "@/components/StatusRing";
import DistanceBadge from "@/components/DistanceBadge";
import { RADIUS_CONFIG } from "@/lib/constants/radius";

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

  // Don't render if fully expired (client-side safety)
  if (isExpired) {
    return null;
  }

  // Determine card border color based on expiry status
  const getBorderClass = () => {
    if (isFading) {
      return "border-amber-500/20 hover:border-amber-500/30";
    }
    if (isExpiringSoon) {
      return "border-orange-500/20 hover:border-orange-500/30";
    }
    return "border-slate-700/50 hover:border-emerald-500/30";
  };

  return (
    <article
      className={`bg-slate-800/60 border rounded-xl p-4 transition ${getBorderClass()}`}
      style={{ opacity }}
    >
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <StatusRing
            rank={authorRank}
            level={authorLevel}
            showLevel={authorLevel !== undefined && authorLevel > 1}
            size="md"
          >
            <span className="text-2xl">{pulse.mood}</span>
          </StatusRing>
          <span className="text-[10px] uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            {pulse.tag}
          </span>
          {/* Distance badge for out-of-radius content */}
          {pulse.distanceMiles !== undefined &&
            pulse.distanceMiles !== null &&
            pulse.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES && (
              <DistanceBadge distanceMiles={pulse.distanceMiles} size="xs" />
            )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug mb-3">{pulse.message}</p>

          {/* Poll voting for This or That posts */}
          {pulse.poll_options && pulse.poll_options.length >= 2 && (
            <PollVoting
              pulseId={pulse.id}
              options={pulse.poll_options}
              userIdentifier={userIdentifier}
            />
          )}

          <div className="flex items-center justify-between text-xs gap-3 mt-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-cyan-400 font-medium truncate">{pulse.author}</span>
              {pulse.is_bot && (
                <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded font-medium uppercase tracking-wide">
                  Bot
                </span>
              )}
              {!pulse.is_bot && <StatusIndicator rank={authorRank} level={authorLevel} />}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
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
                className={`transition ${
                  isFavorite
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
