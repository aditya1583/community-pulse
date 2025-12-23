"use client";

import React from "react";
import type { Pulse } from "./types";
import { formatPulseDateTime, formatPulseLocation } from "@/lib/pulses";

type PulseCardProps = {
  pulse: Pulse;
  isOwnPulse: boolean;
  isFavorite: boolean;
  onToggleFavorite: (pulseId: number) => void;
  onDelete: (pulseId: number) => void;
};

/**
 * Pulse Card component
 *
 * Shows: avatar (mood), username, timestamp, distance, mood badge, message text
 * Actions: Delete (own pulses only), Favorite toggle
 */
export default function PulseCard({
  pulse,
  isOwnPulse,
  isFavorite,
  onToggleFavorite,
  onDelete,
}: PulseCardProps) {
  return (
    <article className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-emerald-500/30 transition">
      <div className="flex gap-3">
        {/* Left column: Mood avatar + tag */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-slate-900/80 flex items-center justify-center text-2xl">
            {pulse.mood}
          </div>
          <span className="text-[10px] uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            {pulse.tag}
          </span>
        </div>

        {/* Right column: Content */}
        <div className="flex-1 min-w-0">
          {/* Message */}
          <p className="text-sm text-white leading-snug mb-3">
            {pulse.message}
          </p>

          {/* Footer: Author, actions, timestamp */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-cyan-400 font-medium">{pulse.author}</span>

            <div className="flex items-center gap-3">
              {/* Delete button - only for own pulses */}
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

              {/* Favorite button */}
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
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
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

              {/* Timestamp + location */}
              <span className="text-slate-500 font-mono">
                {formatPulseDateTime(pulse.createdAt)} ·{" "}
                {formatPulseLocation(pulse.city, pulse.neighborhood)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
