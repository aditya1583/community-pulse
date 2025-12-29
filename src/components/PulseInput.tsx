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
    },
    ref
  ) {
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
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-300 mb-4">
            Sign in to drop pulses and join the conversation
          </p>
          <button
            onClick={onSignInClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 font-medium text-sm rounded-lg shadow-lg shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500 transition"
          >
            <span>Sign in to post</span>
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
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">
            Drop a <span className="text-emerald-400">pulse</span>
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live board</span>
          </div>
        </div>

        {/* Category Selection Pills */}
        <div className="space-y-2">
          <span className="text-xs text-slate-400">Category</span>
          <div className="flex flex-wrap gap-2">
            {POST_TAGS.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategorySelect(category as PulseCategory)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
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
        <div id="mood-selector" tabIndex={-1} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Vibe</span>
            <span className="text-[10px] text-amber-400/80">*required</span>
          </div>
          <div
            className={`flex flex-wrap gap-2 p-2 rounded-lg ${
              showValidationErrors && moodValidationError
                ? "bg-red-500/10 border border-red-500/40"
                : "bg-slate-900/50"
            }`}
          >
            {categoryMoods.map(({ emoji, label }) => {
              const isSelected = mood === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onMoodChange(emoji)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                    isSelected
                      ? "bg-emerald-500/20 border border-emerald-500 text-white"
                      : "bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  <span className="text-lg">{emoji}</span>
                  <span className="text-xs">{label}</span>
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
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
            <span className="text-xs text-slate-400">Current conditions</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-medium text-white">
                {Math.round(weather.temp)}
                {"\u00B0F"}
              </span>
              <span className="text-sm text-slate-300 capitalize">
                {weather.description}
              </span>
            </div>
          </div>
        )}

        {/* Message input */}
        <div className="space-y-2">
          {/* Suggestion chip - tappable prompt that auto-fills */}
          {!message && (
            <button
              type="button"
              onClick={() => onMessageChange(placeholder)}
              className="group flex items-center gap-2 w-full px-3 py-2 text-left text-sm bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/40 transition-all"
            >
              <span className="text-amber-400 text-base animate-pulse">💡</span>
              <span className="text-amber-200/90 flex-1 line-clamp-1">{placeholder}</span>
              <span className="text-[10px] text-amber-400/60 group-hover:text-amber-400 transition-colors whitespace-nowrap">tap to use</span>
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
            rows={3}
            className={`w-full rounded-lg bg-slate-900/70 border px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent resize-none ${
              showValidationErrors && messageValidationError
                ? "border-red-500/60"
                : "border-slate-700/50"
            }`}
            placeholder="Share what's happening..."
          />

          {/* Character count + validation error */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
            {showValidationErrors && messageValidationError && (
              <span className="text-red-400">{messageValidationError}</span>
            )}
          </div>

          {/* Submit row */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Posting as <span className="text-cyan-400">{displayName}</span>
            </span>
            <button
              onClick={onSubmit}
              disabled={!isPostEnabled}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 font-medium text-xs rounded-lg shadow-lg transition ${
                isPostEnabled
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
              }`}
            >
              <span>{identityReady ? "Post pulse" : "Please wait..."}</span>
              <svg
                className="w-3.5 h-3.5"
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

export default PulseInput;
