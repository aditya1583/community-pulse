"use client";

import React, { useMemo } from "react";
import type { Pulse } from "./types";

type CommunityVibeBannerProps = {
  pulses: Pulse[];
  className?: string;
};

/**
 * Community Vibe Banner
 *
 * Shows a one-line consensus summary of what the community is talking about.
 * Analyzes user posts (not bot posts) to surface trending topics and vibes.
 *
 * Examples:
 * - "🍓 Strawberry picking is the vibe today"
 * - "🚗 Everyone's talking about traffic on 183"
 * - "☀️ Neighbors are loving the weather"
 * - "📢 3 neighbors shared thoughts today"
 */
export default function CommunityVibeBanner({ pulses, className = "" }: CommunityVibeBannerProps) {
  const banner = useMemo(() => {
    // Only consider recent user posts (not bot posts), last 24h
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentUserPulses = pulses.filter(
      (p) => !p.is_bot && new Date(p.createdAt).getTime() > oneDayAgo
    );

    if (recentUserPulses.length === 0) return null;

    // Extract keywords and patterns from messages
    const allText = recentUserPulses.map((p) => p.message.toLowerCase()).join(" ");
    const moods = recentUserPulses.map((p) => p.mood).filter(Boolean);

    // Find the dominant mood emoji
    const moodCounts: Record<string, number> = {};
    for (const m of moods) {
      moodCounts[m] = (moodCounts[m] || 0) + 1;
    }
    const dominantMood = Object.entries(moodCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    // Topic detection — look for common themes
    const topicPatterns: { pattern: RegExp; emoji: string; label: string }[] = [
      { pattern: /strawberr/i, emoji: "🍓", label: "Strawberry picking" },
      { pattern: /farmer'?s?\s*market/i, emoji: "🌽", label: "Farmers market" },
      { pattern: /traffic|accident|road|closure|183|29|1431/i, emoji: "🚗", label: "Traffic" },
      { pattern: /weather|rain|storm|tornado|heat|cold|freeze/i, emoji: "⛅", label: "Weather" },
      { pattern: /food\s*truck|restaurant|eat|lunch|dinner|brunch/i, emoji: "🍽️", label: "Food spots" },
      { pattern: /hike|trail|park|outdoor|walk/i, emoji: "🥾", label: "Outdoor activities" },
      { pattern: /school|kid|parent|family/i, emoji: "🏫", label: "Family & schools" },
      { pattern: /music|concert|live|show|band/i, emoji: "🎵", label: "Live music" },
      { pattern: /dog|pet|cat|animal/i, emoji: "🐕", label: "Pets" },
      { pattern: /open|new|just\s+opened|grand\s+opening/i, emoji: "🆕", label: "New openings" },
      { pattern: /sale|deal|discount|free/i, emoji: "💰", label: "Deals & sales" },
      { pattern: /help|volunteer|community|neighbor/i, emoji: "🤝", label: "Community help" },
      { pattern: /water|lake|pool|swim/i, emoji: "💧", label: "Water activities" },
      { pattern: /bbq|grill|barbecue|cookout/i, emoji: "🔥", label: "BBQ & cookouts" },
      { pattern: /game|sport|watch\s*party|football|soccer|basketball/i, emoji: "🏈", label: "Sports" },
    ];

    // Find matching topics
    const matchedTopics = topicPatterns.filter((t) => t.pattern.test(allText));

    // Tag distribution
    const tagCounts: Record<string, number> = {};
    for (const p of recentUserPulses) {
      const tag = p.tag || "General";
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }

    // Build the banner text
    let emoji: string;
    let text: string;

    if (matchedTopics.length > 0) {
      // Use the most-mentioned topic
      const topTopic = matchedTopics[0];
      const count = recentUserPulses.filter((p) =>
        topTopic.pattern.test(p.message)
      ).length;

      emoji = topTopic.emoji;
      if (count >= 3) {
        text = `${topTopic.label} is trending — ${count} neighbors talking about it`;
      } else if (count >= 2) {
        text = `${topTopic.label} is catching interest nearby`;
      } else {
        text = `${topTopic.label} vibes in the neighborhood`;
      }
    } else if (recentUserPulses.length >= 3) {
      // No specific topic — use general vibe
      emoji = dominantMood || "📢";
      const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
      text = `${recentUserPulses.length} neighbors shared thoughts today${topTag ? ` — mostly ${topTag[0].toLowerCase()}` : ""}`;
    } else if (recentUserPulses.length >= 1) {
      emoji = dominantMood || "💬";
      text = `${recentUserPulses.length === 1 ? "A neighbor" : `${recentUserPulses.length} neighbors`} dropped a pulse today`;
    } else {
      return null;
    }

    return { emoji, text };
  }, [pulses]);

  if (!banner) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border border-emerald-500/10 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0 animate-bounce-subtle">{banner.emoji}</span>
        <p className="text-sm font-bold text-slate-200 tracking-tight leading-snug">
          {banner.text}
        </p>
      </div>
      {/* Subtle glow effect */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
    </div>
  );
}
