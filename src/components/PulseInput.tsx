"use client";

import React, { forwardRef, useState, useEffect } from "react";
import { POST_TAGS, CATEGORY_MOODS, type PulseCategory } from "./types";
import { getStablePulsePrompt } from "@/lib/pulsePrompts";

const MAX_MESSAGE_LENGTH = 240;

type PulseInputProps = {
  mood: string;
  tag: string;
  message: string;
  displayName: string;
  isSignedIn: boolean;
  identityReady: boolean;
  loading: boolean;
  moodValidationError: string | null;
  tagValidationError: string | null;
  messageValidationError: string | null;
  showValidationErrors: boolean;
  onMoodChange: (mood: string) => void;
  onTagChange: (tag: string) => void;
  onMessageChange: (message: string) => void;
  onSubmit: () => void;
  onSignInClick: () => void;
  weather?: { temp: number; description: string } | null;
  /** Current city name for location relevance check */
  cityName?: string;
};


/**
 * Pulse Input component - "Drop a pulse" section
 *
 * Features:
 * - Category selection (pill buttons): Traffic | Weather | Events | General
 * - Dynamic mood selection based on category (MANDATORY)
 * - Context section based on category
 * - Message input with character limit
 * - Submit button
 */
const PulseInput = forwardRef<HTMLTextAreaElement, PulseInputProps>(
  function PulseInput(
    {
      mood,
      tag,
      message,
      displayName,
      isSignedIn,
      identityReady,
      loading,
      moodValidationError,
      tagValidationError,
      messageValidationError,
      showValidationErrors,
      onMoodChange,
      onTagChange,
      onMessageChange,
      onSubmit,
      onSignInClick,
      weather,
      cityName,
    },
    ref
  ) {
    // Location relevance warning state
    const [locationWarning, setLocationWarning] = useState(false);
    const [locationWarningDismissed, setLocationWarningDismissed] = useState(false);

    // Check if message mentions locations that seem outside the user's area
    useEffect(() => {
      if (!cityName || !message || locationWarningDismissed) {
        setLocationWarning(false);
        return;
      }
      const msgLower = message.toLowerCase();
      const cityBase = cityName.split(",")[0].trim().toLowerCase();
      // List of major city names that might indicate off-topic content
      const majorCities = ["new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia", "san antonio", "san diego", "dallas", "san francisco", "seattle", "denver", "miami", "atlanta", "boston"];
      const mentionsOtherCity = majorCities.some(
        (c) => msgLower.includes(c) && !cityBase.includes(c.split(" ")[0])
      );
      setLocationWarning(mentionsOtherCity);
    }, [message, cityName, locationWarningDismissed]);
    // Derive category directly from tag prop, defaulting to "General"
    const selectedCategory: PulseCategory =
      tag && POST_TAGS.includes(tag as (typeof POST_TAGS)[number])
        ? (tag as PulseCategory)
        : "General";

    // Time-based placeholder prompt (refreshes when category changes)
    const [placeholder, setPlaceholder] = useState(() =>
      getStablePulsePrompt(selectedCategory)
    );

    // Update placeholder when category changes
    useEffect(() => {
      setPlaceholder(getStablePulsePrompt(selectedCategory));
    }, [selectedCategory]);

    // Handle category selection
    const handleCategorySelect = (category: PulseCategory) => {
      onTagChange(category);
      // Clear mood when category changes since moods are category-specific
      onMoodChange("");
    };

    // Get moods for current category
    const categoryMoods = CATEGORY_MOODS[selectedCategory];

    // Check if form is ready for submission
    // Message is required (matches server validation)
    const isPostEnabled = identityReady && !loading && !!mood && !!tag && !!message.trim();

    // Not signed in state
    if (!isSignedIn) {
      return (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Sign in to drop pulses
          </p>
          <button
            onClick={onSignInClick}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 active:scale-95 transition"
          >
            Sign in
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <div className="glass-card rounded-2xl p-5 mb-6 premium-border shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight uppercase">
            Drop a <span className="text-emerald-400">pulse</span>
          </h3>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 text-[10px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </div>

        {/* Category Selection Pills */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Category</span>
          <div className="flex flex-wrap gap-2">
            {POST_TAGS.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategorySelect(category as PulseCategory)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border ${isActive
                    ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/30 scale-105"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
          {showValidationErrors && tagValidationError && (
            <p className="text-[11px] text-red-400">{tagValidationError}</p>
          )}
        </div>

        {/* Mood Selection (MANDATORY) */}
        <div id="mood-selector" tabIndex={-1} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Vibe</span>
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter opacity-80">* required</span>
          </div>
          <div
            className={`flex flex-wrap gap-2 p-1.5 rounded-xl transition-all duration-300 ${showValidationErrors && moodValidationError
              ? "bg-red-500/10 border border-red-500/40"
              : "bg-white/5 border border-white/5"
              }`}
          >
            {categoryMoods.map(({ emoji, label }) => {
              const isSelected = mood === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onMoodChange(emoji)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${isSelected
                    ? "bg-emerald-500/20 border border-emerald-500 text-white shadow-lg shadow-emerald-500/5 scale-105"
                    : "bg-slate-900/50 border border-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                    }`}
                >
                  <span className="text-xl filter drop-shadow-sm">{emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          {showValidationErrors && moodValidationError && (
            <p className="text-[11px] text-red-400">{moodValidationError}</p>
          )}
        </div>

        {/* Context Section (Dynamic based on category) */}
        {selectedCategory === "Weather" && weather && (
          <div className="bg-sky-500/5 rounded-xl p-3 border border-sky-500/20 flex items-center justify-between">
            <span className="text-[10px] font-bold text-sky-400/80 uppercase tracking-widest">Current Weather</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-white px-2 py-0.5 rounded-lg bg-sky-500/10">
                {Math.round(weather.temp)}
                {"\u00B0F"}
              </span>
              <span className="text-xs font-bold text-sky-200 capitalize tracking-tight px-3 py-1 rounded-full bg-white/5">
                {weather.description}
              </span>
            </div>
          </div>
        )}

        {/* Message input */}
        <div className="space-y-3 pt-2">
          {/* Suggestion chip - tappable prompt that auto-fills */}
          {!message && (
            <button
              type="button"
              onClick={() => onMessageChange(placeholder)}
              className="group flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl hover:from-amber-500/15 hover:to-orange-500/15 hover:border-amber-500/30 transition-all duration-300 shadow-sm shadow-amber-900/10"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                <span className="text-amber-400 text-lg">💡</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-amber-200/90 font-bold text-xs truncate">{placeholder}</p>
                <p className="text-[9px] text-amber-500/60 uppercase font-black tracking-widest">Tap to auto-fill</p>
              </div>
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
              rows={3}
              className={`w-full rounded-xl bg-slate-900/80 border p-4 text-[15px] text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all duration-300 resize-none font-medium leading-relaxed ${showValidationErrors && messageValidationError
                ? "border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                : "border-white/5 shadow-inner"
                }`}
              placeholder="What's the vibe right now?"
            />

            {/* Character count floating overlay */}
            <div className={`absolute bottom-3 right-3 px-1.5 py-0.5 rounded bg-black/40 text-[9px] font-black tracking-tighter ${message.length >= MAX_MESSAGE_LENGTH ? 'text-red-400' : 'text-slate-500'}`}>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </div>
          </div>

          {showValidationErrors && messageValidationError && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <span className="text-base mt-0.5">🚫</span>
              <p className="text-[13px] font-bold text-red-400 leading-snug">{messageValidationError}</p>
            </div>
          )}

          {/* Location relevance warning */}
          {locationWarning && !locationWarningDismissed && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <span>⚠️</span>
              <span className="flex-1">This seems outside your area. Post anyway?</span>
              <button
                type="button"
                onClick={() => setLocationWarningDismissed(true)}
                className="text-amber-400 font-bold underline"
              >
                Yes
              </button>
            </div>
          )}

          {/* Submit row */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Posting as <span className="text-cyan-400">{displayName}</span>
              </span>
            </div>
            <button
              onClick={onSubmit}
              disabled={!isPostEnabled}
              className={`group relative inline-flex items-center gap-2 px-6 py-2.5 font-black text-xs uppercase tracking-widest rounded-full transition-all duration-500 ${isPostEnabled
                ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] hover:scale-105 hover:bg-emerald-400"
                : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/5"
                }`}
            >
              <span>{identityReady ? "Post Pulse" : "Wait..."}</span>
              <svg
                className={`w-4 h-4 transition-transform duration-500 ${isPostEnabled ? 'group-hover:translate-x-1 group-hover:-translate-y-1' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
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

export default PulseInput;
