"use client";

import React, { useRef, useEffect } from "react";
import { POST_TAGS, CATEGORY_MOODS, type PulseCategory } from "./types";

const MAX_MESSAGE_LENGTH = 240;

type PulseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mood: string;
  tag: string;
  message: string;
  displayName: string;
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
  weather?: { temp: number; description: string } | null;
};

/**
 * Get placeholder text based on selected category
 */
function getPlaceholderText(category: PulseCategory): string {
  switch (category) {
    case "Traffic":
      return "What's traffic like? (e.g., 'I-35 is backed up near downtown')";
    case "Weather":
      return "How's the weather feeling? (e.g., 'Perfect day for a walk!')";
    case "Events":
      return "What event are you at? (e.g., 'Amazing concert at Zilker!')";
    case "General":
    default:
      return "What's the vibe right now?";
  }
}

/**
 * Pulse Creation Modal - Slide-up sheet or centered modal
 *
 * Features:
 * - Category selection (pill buttons)
 * - Dynamic mood selection based on category (MANDATORY)
 * - Context section based on category
 * - Message input with character limit
 * - Close button + Submit button
 * - Backdrop blur
 */
export default function PulseModal({
  isOpen,
  onClose,
  mood,
  tag,
  message,
  displayName,
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
  weather,
}: PulseModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Derive category directly from tag prop, defaulting to "General"
  const selectedCategory: PulseCategory =
    tag && POST_TAGS.includes(tag as (typeof POST_TAGS)[number])
      ? (tag as PulseCategory)
      : "General";

  // Handle category selection
  const handleCategorySelect = (category: PulseCategory) => {
    onTagChange(category);
    // Clear mood when category changes since moods are category-specific
    onMoodChange("");
  };

  // Get moods for current category
  const categoryMoods = CATEGORY_MOODS[selectedCategory];

  // Mood is mandatory, message can be empty
  const isPostEnabled = identityReady && !loading && !!mood && !!tag;

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit();
    // Modal will be closed by parent after successful submission
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full sm:max-w-lg mx-4 mb-4 sm:mb-0 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-sm font-medium text-white">
            Drop a <span className="text-emerald-400">pulse</span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
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

        {/* Body */}
        <div className="p-4 space-y-4">
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Vibe</span>
              <span className="text-[10px] text-amber-400/80">*required</span>
            </div>
            <div
              className={`flex flex-wrap gap-2 p-2 rounded-lg ${
                showValidationErrors && moodValidationError
                  ? "bg-red-500/10 border border-red-500/40"
                  : "bg-slate-800/50"
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
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
              <span className="text-xs text-slate-400">Current conditions</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-medium text-white">
                  {Math.round(weather.temp)}°F
                </span>
                <span className="text-sm text-slate-300 capitalize">
                  {weather.description}
                </span>
              </div>
            </div>
          )}

          {/* Message input */}
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= MAX_MESSAGE_LENGTH) {
                  onMessageChange(value);
                }
              }}
              rows={4}
              className={`w-full rounded-lg bg-slate-800/70 border px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-transparent resize-none ${
                showValidationErrors && messageValidationError
                  ? "border-red-500/60"
                  : "border-slate-700/50"
              }`}
              placeholder={getPlaceholderText(selectedCategory)}
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
          </div>

          {/* Posting as */}
          <p className="text-[11px] text-slate-500">
            Posting as <span className="text-cyan-400">{displayName}</span>.
            Pulses are public.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-700/50 sticky bottom-0 bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isPostEnabled}
            className={`inline-flex items-center gap-1.5 px-5 py-2 font-medium text-sm rounded-lg shadow-lg transition ${
              isPostEnabled
                ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-slate-950 shadow-emerald-500/30 hover:from-emerald-300 hover:to-emerald-500"
                : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
            }`}
          >
            <span>{identityReady ? "Post pulse" : "Please wait..."}</span>
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
