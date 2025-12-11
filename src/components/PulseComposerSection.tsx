import React from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/pulseValidation";

type PulseComposerSectionProps = {
  moods: string[];
  tags: string[];
  mood: string | null;
  tag: string;
  message: string;
  validationError: string | null;
  moodError: string | null;
  tagError: string | null;
  posting: boolean;
  canPost: boolean;
  displayName: string;
  showFirstPulsePrompt: boolean;
  showFirstPulseCelebration: boolean;
  onFirstPulseStart: () => void;
  onDismissPrompt: () => void;
  onCloseCelebration: () => void;
  onMoodSelect: (mood: string) => void;
  onTagSelect: (tag: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export default function PulseComposerSection({
  moods,
  tags,
  mood,
  tag,
  message,
  validationError,
  moodError,
  tagError,
  posting,
  canPost,
  displayName,
  showFirstPulsePrompt,
  showFirstPulseCelebration,
  onFirstPulseStart,
  onDismissPrompt,
  onCloseCelebration,
  onMoodSelect,
  onTagSelect,
  onMessageChange,
  onSubmit,
  textareaRef,
}: PulseComposerSectionProps) {
  return (
    <div className="space-y-3">
      {showFirstPulsePrompt && (
        <div
          data-testid="first-pulse-prompt"
          className="rounded-2xl border border-pink-500/40 bg-pink-500/10 px-4 py-3 shadow shadow-pink-500/25"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Drop your first pulse
              </p>
              <p className="text-xs text-slate-200">
                Tell your city what&apos;s up right now — traffic, weather, mood,
                anything.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissPrompt}
              className="text-slate-400 hover:text-slate-100 text-sm leading-none"
              aria-label="Dismiss first pulse prompt"
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onFirstPulseStart}
              className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow shadow-pink-500/30 hover:bg-pink-400 transition"
            >
              Start my first pulse
            </button>
            <button
              type="button"
              onClick={onDismissPrompt}
              className="text-xs text-slate-300 hover:text-slate-100 transition"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {showFirstPulseCelebration && (
        <div
          data-testid="first-pulse-celebration"
          className="rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 flex items-start justify-between gap-3"
        >
          <div>
            <p className="text-sm font-semibold text-emerald-100">
              Nice! You just started your streak and unlocked your first badge 🎉
            </p>
            <p className="text-xs text-emerald-50">
              Keep the vibes coming to build momentum.
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseCelebration}
            className="text-emerald-200 hover:text-emerald-50 text-sm leading-none"
            aria-label="Close first pulse celebration"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Mood</span>
            <div className="flex gap-1.5 bg-slate-950/70 border border-slate-800 rounded-2xl px-2 py-1">
              {moods.map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => onMoodSelect(m)}
                  className={`text-lg px-1.5 rounded-2xl transition ${
                    mood === m
                      ? "bg-slate-800 scale-110"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  aria-pressed={mood === m}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {moodError && (
            <p className="text-[11px] text-red-400" data-testid="mood-error">
              {moodError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Tag</span>
            <select
              value={tag}
              onChange={(e) => onTagSelect(e.target.value)}
              className="rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
              data-testid="tag-select"
            >
              <option value="" disabled>
                Choose a tag
              </option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {tagError && (
            <p className="text-[11px] text-red-400" data-testid="tag-error">
              {tagError}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={3}
          className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent resize-none"
          placeholder="What's the vibe right now? (e.g., 'Commute is smooth on 183, sunset looks insane.')"
        />
        <div className="flex items-center justify-between text-[11px] mt-1">
          <span className="text-slate-500">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
          {validationError && (
            <span className="text-red-400" data-testid="message-error">
              {validationError}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Posting as <span className="text-slate-200">{displayName}</span>.
            Pulses are public. Keep it kind & useful.
          </span>
          <button
            type="button"
            data-testid="post-pulse-button"
            onClick={onSubmit}
            aria-disabled={!canPost || posting}
            disabled={posting}
            className={`inline-flex items-center gap-1 rounded-2xl px-4 py-1.5 text-xs font-medium transition ${
              canPost && !posting
                ? "bg-pink-500 text-slate-950 shadow-lg shadow-pink-500/30 hover:bg-pink-400"
                : "bg-slate-800 text-slate-300 cursor-not-allowed opacity-60"
            }`}
          >
            <span>Post pulse</span> <span>⚡</span>
          </button>
        </div>
      </div>
    </div>
  );
}
