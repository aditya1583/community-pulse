"use client";

import React, { forwardRef, useState, useEffect } from "react";
import { CATEGORY_MOODS, type PulseCategory } from "./types";
import { getStableHyperlocalPlaceholder } from "@/lib/hyperlocal-prompts";

const MAX_MESSAGE_LENGTH = 240;

type TabPulseInputProps = {
  /** The category this input is pre-set to (Traffic, Events, General) */
  category: PulseCategory;
  /** The user's selected city name for hyperlocal prompts */
  cityName?: string;
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
      cityName = "Austin", // Default to Austin for backward compatibility
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
    // Time-based placeholder (refreshes when category or city changes)
    // Uses hyperlocal prompts specific to the user's selected city
    const [placeholder, setPlaceholder] = useState(() =>
      getStableHyperlocalPlaceholder(cityName, category)
    );

    // Update placeholder when category or city changes
    useEffect(() => {
      setPlaceholder(getStableHyperlocalPlaceholder(cityName, category));
    }, [category, cityName]);

    // Get moods for current category
    const categoryMoods = CATEGORY_MOODS[category];

    // Check if form is ready for submission
    const isPostEnabled = identityReady && !loading && !!mood && !!message.trim();

    // Get category label for display
    const categoryLabel = category === "General" ? "Local" : category;

    // Not signed in state - compact version
    if (!isSignedIn) {
      return (
        <div className="relative overflow-hidden glass-card premium-border rounded-2xl p-4 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-50" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-lg">💬</div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Post a <span className="text-emerald-400">{categoryLabel}</span> Pulse
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sign in to share</span>
              </div>
            </div>
            <button
              onClick={onSignInClick}
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl border border-emerald-500/30 transition-all duration-300"
            >
              Sign In
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="glass-card premium-border rounded-[2rem] p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
              New <span className="text-emerald-400">{categoryLabel}</span> Pulse
            </h4>
          </div>
          <div className="px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest">
            {category}
          </div>
        </div>

        {/* Mood Selection - Compact horizontal layout */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Vibe</span>
          </div>
          <div
            className={`flex flex-wrap gap-2 ${showValidationErrors && moodValidationError
              ? "p-2 rounded-xl bg-red-500/5 border border-red-500/20"
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 ${isSelected
                    ? "bg-emerald-500/20 border border-emerald-500/50 text-white shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]"
                    : "bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="tracking-tight">{label}</span>
                </button>
              );
            })}
          </div>
          {showValidationErrors && moodValidationError && (
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest px-1">{moodValidationError}</p>
          )}
        </div>

        {/* Message input - Compact */}
        <div className="space-y-2">
          {/* Suggestion chip - tappable prompt */}
          {!message && (
            <button
              type="button"
              onClick={() => onMessageChange(placeholder)}
              className="group flex items-center gap-3 w-full px-3 py-2 text-left bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-xl hover:from-amber-500/20 hover:border-amber-500/40 transition-all duration-500"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-xs font-black text-amber-500">?</div>
              <span className="text-[11px] font-bold text-amber-200/70 flex-1 line-clamp-1">{placeholder}</span>
              <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest group-hover:text-amber-400 transition-colors whitespace-nowrap">Tap to use</span>
            </button>
          )}

          <div className="relative group/textarea">
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
              className={`w-full rounded-2xl bg-black/40 backdrop-blur-sm border px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all duration-300 resize-none ${showValidationErrors && messageValidationError
                ? "border-red-500/40"
                : "border-white/5 group-hover/textarea:border-white/10"
                }`}
              placeholder="Share what's happening..."
            />

            {/* Character count overlay */}
            <div className="absolute bottom-3 right-3">
              <span className={`text-[9px] font-black uppercase tracking-widest ${message.length > MAX_MESSAGE_LENGTH * 0.9 ? "text-amber-500" : "text-slate-600"}`}>
                {message.length}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
          </div>

          {/* Error & Submit row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex-1">
              {showValidationErrors && messageValidationError && (
                <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">{messageValidationError}</span>
              )}
            </div>

            <button
              onClick={onSubmit}
              disabled={!isPostEnabled}
              className={`group flex items-center gap-2 px-5 py-2.5 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-xl transition-all duration-500 ${isPostEnabled
                ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 shadow-emerald-500/20 hover:scale-[1.05] active:scale-95"
                : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 grayscale"
                }`}
            >
              <span>{identityReady ? "Send Pulse" : "Posting..."}</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-500 ${isPostEnabled ? "group-hover:translate-x-0.5 group-hover:-translate-y-0.5" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default TabPulseInput;
