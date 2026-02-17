"use client";

import React, { useRef, useEffect, useState } from "react";
import { POST_TAGS, CATEGORY_MOODS, type PulseCategory } from "./types";
import { getStablePulsePrompt } from "@/lib/pulsePrompts";

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

  // Time-based placeholder prompt (Stable derived value)
  const suggestedPrompt = getStablePulsePrompt(selectedCategory);

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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full sm:max-w-xl bg-slate-900 glass-card premium-border sm:rounded-3xl rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/10 rounded-full mt-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 sticky top-0 bg-slate-900/80 backdrop-blur-xl z-10 mt-2 sm:mt-0">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-white tracking-tighter leading-none">
              Drop a <span className="text-emerald-400">Pulse</span>
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">
              Local broadcast active
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Category Selection Pills */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Broadcast Category</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {POST_TAGS.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategorySelect(category as PulseCategory)}
                    className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 transform active:scale-95 ${isActive
                      ? "bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                      : "bg-white/5 border border-white/5 text-slate-500 hover:text-white hover:bg-white/10"
                      }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
            {showValidationErrors && tagValidationError && (
              <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest px-1">{tagValidationError}</p>
            )}
          </div>

          {/* Mood Selection (MANDATORY) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">The Vibe</span>
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded">Required</span>
            </div>
            <div
              className={`flex flex-wrap gap-2.5 p-3 rounded-2xl transition-all duration-300 ${showValidationErrors && moodValidationError
                ? "bg-red-500/5 border-2 border-red-500/20"
                : "bg-black/30 border border-white/5"
                }`}
            >
              {categoryMoods.map(({ emoji, label }) => {
                const isSelected = mood === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onMoodChange(emoji)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-500 group/vibe ${isSelected
                      ? "bg-emerald-500/20 border border-emerald-500 text-white shadow-[0_0_15px_-5px_#10b981]"
                      : "bg-white/5 border border-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                      }`}
                  >
                    <span className="text-xl transform transition-transform group-hover/vibe:scale-125 duration-300">{emoji}</span>
                    <span className="tracking-tight">{label}</span>
                  </button>
                );
              })}
            </div>
            {showValidationErrors && moodValidationError && (
              <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest px-1">{moodValidationError}</p>
            )}
          </div>

          {/* Context Section (Dynamic based on category) */}
          {selectedCategory === "Weather" && weather && (
            <div className="glass-card bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent rounded-2xl p-4 border border-emerald-500/20">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 block">Live conditions</span>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-black text-white leading-none">
                  {Math.round(weather.temp)}
                  {"\u00B0F"}
                </span>
                <div className="h-6 w-px bg-white/10" />
                <span className="text-sm font-bold text-slate-300 capitalize tracking-tight">
                  {weather.description}
                </span>
              </div>
            </div>
          )}

          {/* Message input */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Message</span>
            </div>

            {!message && (
              <button
                type="button"
                onClick={() => onMessageChange(suggestedPrompt)}
                className="group flex items-center gap-4 w-full px-4 py-3 text-left bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl hover:from-amber-500/20 transition-all duration-500"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-lg shadow-inner">💡</div>
                <div className="flex flex-col flex-1 overflow-hidden">
                  <p className="text-[11px] font-bold text-amber-200/90 line-clamp-1">{suggestedPrompt}</p>
                  <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest">Tap to use prompt</p>
                </div>
              </button>
            )}

            <div className="relative group/textarea">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= MAX_MESSAGE_LENGTH) {
                    onMessageChange(value);
                  }
                }}
                rows={5}
                className={`w-full rounded-[2rem] bg-black/40 backdrop-blur-sm border pl-6 pr-6 pt-5 pb-10 text-[15px] text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all duration-500 resize-none ${showValidationErrors && messageValidationError
                  ? "border-red-500/40"
                  : "border-white/5 group-hover/textarea:border-white/20"
                  }`}
                placeholder="What's happening in the neighborhood?"
              />

              {/* Character count overlay */}
              <div className="absolute bottom-4 right-6 pointer-events-none">
                <span className={`text-[10px] font-black uppercase tracking-widest font-mono ${message.length > MAX_MESSAGE_LENGTH * 0.9 ? "text-amber-500" : "text-slate-600"}`}>
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </div>

            {showValidationErrors && messageValidationError && (
              <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest px-1">{messageValidationError}</p>
            )}
          </div>

          {/* Posting Info */}
          <div className="flex items-center gap-3 px-2 py-4 bg-white/2 rounded-2xl border border-white/5">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-xl">👤</div>
            <div className="flex flex-col">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Posting as <span className="text-cyan-400">{displayName}</span>
              </p>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Visible to everyone in 10-mile radius</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-6 py-5 border-t border-white/5 bg-slate-900/80 backdrop-blur-xl sticky bottom-0">
          {loading && (
            <div className="flex items-center gap-2 justify-center text-emerald-400 text-xs font-bold uppercase tracking-widest animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Launching...
            </div>
          )}
          <div className="flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 text-[11px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors duration-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!identityReady || loading}
            className={`group inline-flex items-center gap-3 px-8 py-4 font-black text-[12px] uppercase tracking-[0.2em] rounded-2xl shadow-2xl transition-all duration-500 ${loading
              ? "bg-emerald-500/50 text-slate-950 animate-pulse"
              : isPostEnabled
              ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-slate-950 shadow-emerald-500/20 hover:scale-[1.02] active:scale-95"
              : "bg-slate-800 text-slate-600 cursor-not-allowed opacity-50 grayscale"
              }`}
          >
            <span>{loading ? "Posting..." : identityReady ? (isPostEnabled ? "Launch Pulse" : "Complete Pulse") : "Syncing..."}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-500 ${isPostEnabled ? "group-hover:translate-x-1" : ""}`}
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
    </div>
  );
}
