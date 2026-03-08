"use client";

import React, { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/api-config";

type CommunityVibeBannerProps = {
  cityName: string;
  /** Number of recent user pulses — banner only shows if > 0 */
  userPulseCount: number;
  className?: string;
};

/**
 * Community Vibe Banner
 *
 * Shows an AI-generated one-line summary of what the community is talking about.
 * Fetches from /api/community-summary which uses GPT-4o-mini to summarize
 * recent user posts into a natural, warm sentence.
 *
 * Examples:
 * - "🍓 Leander neighbors are buzzing about brunch spots and strawberry picking"
 * - "🚗 Traffic on 183 and late-night work vibes in Leander today"
 * - "💬 3 neighbors shared updates in Austin today"
 */
export default function CommunityVibeBanner({ cityName, userPulseCount, className = "" }: CommunityVibeBannerProps) {
  const [summary, setSummary] = useState<{ text: string; emoji: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userPulseCount === 0 || !cityName) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(getApiUrl(`/api/community-summary?city=${encodeURIComponent(cityName)}`))
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.summary) {
          setSummary({ text: data.summary, emoji: data.emoji || "💬" });
        }
      })
      .catch(() => {
        // Silently fail — banner just won't show
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cityName, userPulseCount]);

  if (!summary && !loading) return null;
  if (loading) return null; // Don't show skeleton — just appear when ready

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border border-emerald-500/10 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0 animate-bounce-subtle">{summary?.emoji}</span>
        <p className="text-sm font-bold text-slate-200 tracking-tight leading-snug">
          {summary?.text}
        </p>
      </div>
    </div>
  );
}
