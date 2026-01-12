"use client";

import React, { forwardRef, useState, useEffect } from "react";
import { CATEGORY_MOODS, type PulseCategory } from "./types";

const MAX_MESSAGE_LENGTH = 240;

/**
 * Category-specific placeholder examples
 * These are designed to inspire contextual, specific content
 */
const CATEGORY_PLACEHOLDERS: Record<PulseCategory, string[]> = {
  Traffic: [
    "Ronald Reagan traffic around 5:00 is crazy right now",
    "I-35 backed up near downtown - accident on shoulder",
    "Mopac is clear, smooth sailing today",
    "Construction on 183 causing major delays",
    "360 loop moving slow - give yourself extra time",
  ],
  Events: [
    "The concert at Moody Center was amazing!",
    "Long lines at the stadium - arrive early",
    "This festival has great food trucks",
    "Parking is $40 near the arena tonight",
    "The opening act is fire - don't skip it",
  ],
  General: [
    "Torchy's on 183 has a 20 min wait right now",
    "Found a great parking spot downtown",
    "The new coffee shop on South Congress is worth it",
    "Farmers market is packed but vibes are good",
    "Line at Franklin's is only an hour today",
  ],
  Weather: [
    "It's way hotter than the forecast said",
    "Perfect patio weather downtown",
    "Flooding on low water crossings - be careful",
    "The sunset tonight is incredible",
  ],
};

/**
 * Get a stable placeholder that only changes every few minutes
 */
function getStablePlaceholder(category: PulseCategory): string {
  const placeholders = CATEGORY_PLACEHOLDERS[category];
  const index = Math.floor(Date.now() / (3 * 60 * 1000)) % placeholders.length;
  return placeholders[index];
}

type TabPulseInputProps = {
  /** The category this input is pre-set to (Traffic, Events, General) */
  category: PulseCategory;
  /** Current mood selection */
  mood: string;
  /** Current message text */
  message: string;
  /** User's display name */
  displayName: string;
  /** Whether user is signed in */
  isSignedIn: boolean;
  /** Whether identity is ready for posting */
  identityReady: boolean;
  /** Whether a post is in progress */
  loading: boolean;
  /** Mood validation error */
  moodValidationError: string | null;
  /** Message validation error */
  messageValidationError: string | null;
  /** Whether to show validation errors */
  showValidationErrors: boolean;
  /** Callback when mood changes */
  onMoodChange: (mood: string) => void;
  /** Callback when message changes */
  onMessageChange: (message: string) => void;
  /** Callback to submit the pulse */
  onSubmit: () => void;
  /** Callback to show sign-in modal */
  onSignInClick: () => void;
};

/**
 * TabPulseInput - Compact, pre-tagged pulse input for embedding in tabs
 *
 * Design principles:
 * - Pre-tagged: Category is fixed, no selector needed
 * - Compact: Minimal vertical space while remaining functional
 * - Contextual: Placeholder examples match the tab context
 * - Category-specific vibes: Only shows relevant mood options
 */
const TabPulseInput = forwardRef<HTMLTextAreaElement, TabPulseInputProps>(
  function TabPulseInput(
    {
      category,
      mood,
      message,
      displayName,
      isSignedIn,
      identityReady,
      loading,
      moodValidationError,
      messageValidationError,
      showValidationErrors,
      onMoodChange,
      onMessageChange,
      onSubmit,
      onSignInClick,
    },
    ref
  ) {
    // Time-based placeholder (refreshes when category changes)
    const [placeholder, setPlaceholder] = useState(() =>
      getStablePlaceholder(category)
    );

    // Update placeholder when category changes
    useEffect(() => {
      setPlaceholder(getStablePlaceholder(category));
    }, [category]);

    // Get moods for current category
    const categoryMoods = CATEGORY_MOODS[category];

    // Check if form is ready for submission
    const isPostEnabled = identityReady && !loading && !!mood && !!message.trim();

    // Get category label for display
    const categoryLabel = category === "General" ? "Local" : category;

    // Not signed in state - compact version
    if (!isSignedIn) {
      return (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-slate-300">
                Drop a <span className="text-emerald-400">{categoryLabel.toLowerCase()}</span> pulse
              </span>
            </div>
            <button
              onClick={onSignInClick}
              className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition"
            >
              Sign in to post
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-slate-300">
              Drop a <span className="text-emerald-400">{categoryLabel.toLowerCase()}</span> pulse
            </span>
          </div>
          <span className="text-[10px] text-slate-500 px-2 py-0.5 bg-slate-900/50 rounded-full border border-slate-700/30">
            {category}
          </span>
        </div>

        {/* Mood Selection - Compact horizontal layout */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Vibe</span>
            {!mood && (
              <span className="text-[10px] text-amber-400/70">pick one</span>
            )}
          </div>
          <div
            className={`flex flex-wrap gap-1.5 ${
              showValidationErrors && moodValidationError
                ? "p-1.5 rounded-lg bg-red-500/10 border border-red-500/40"
                : ""
            }`}
          >
            {categoryMoods.map(({ emoji, label }) => {
              const isSelected = mood === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onMoodChange(emoji)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition ${
                    isSelected
                      ? "bg-emerald-500/20 border border-emerald-500 text-white"
                      : "bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  <span className="text-base">{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {showValidationErrors && moodValidationError && (
            <p className="text-[10px] text-red-400">{moodValidationError}</p>
          )}
        </div>

        {/* Message input - Compact */}
        <div className="space-y-1.5">
          {/* Suggestion chip - tappable prompt */}
          {!message && (
            <button
              type="button"
              onClick={() => onMessageChange(placeholder)}
              className="group flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/40 transition-all"
            >
              <span className="text-amber-400 text-sm">e.g.</span>
              <span className="text-amber-200/80 flex-1 line-clamp-1">{placeholder}</span>
              <span className="text-[9px] text-amber-400/60 group-hover:text-amber-400 transition-colors whitespace-nowrap">tap</span>
            </button>
          )}

          <textarea
            ref={ref}
            value={message}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= MAX_MESSAGE_LENGTH) {
                onMessageChange(value);
              }
            }}
            rows={2}
            className={`w-full rounded-lg bg-slate-900/60 border px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent resize-none ${
              showValidationErrors && messageValidationError
                ? "border-red-500/60"
                : "border-slate-700/40"
            }`}
            placeholder="Share what's happening..."
          />

          {/* Character count + Submit row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </span>
              {showValidationErrors && messageValidationError && (
                <span className="text-[10px] text-red-400">{messageValidationError}</span>
              )}
            </div>
            <button
              onClick={onSubmit}
              disabled={!isPostEnabled}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-xs rounded-lg shadow transition ${
                isPostEnabled
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
              }`}
            >
              <span>{identityReady ? "Post" : "..."}</span>
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default TabPulseInput;
