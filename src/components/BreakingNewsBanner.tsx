"use client";

import React, { useState } from "react";
import type { NewsItem } from "@/app/api/local-news/route";

interface BreakingNewsBannerProps {
  newsItems: NewsItem[];
}

type Urgency = "critical" | "major";

const CRITICAL_KEYWORDS = [
  "shooting",
  "active shooter",
  "tornado",
  "earthquake",
  "explosion",
  "amber alert",
  "evacuation",
  "tsunami",
];

const MAJOR_KEYWORDS = [
  "missing person",
  "power outage",
  "fire",
  "crash",
  "flooding",
  "emergency",
  "breaking",
  "killed",
  "homicide",
  "stabbing",
  "lockdown",
];

function getUrgency(title: string): Urgency | null {
  const lower = title.toLowerCase();
  // Check critical first (higher priority)
  if (CRITICAL_KEYWORDS.some((kw) => lower.includes(kw))) return "critical";
  if (MAJOR_KEYWORDS.some((kw) => lower.includes(kw))) return "major";
  return null;
}

function isWithin24Hours(pubDate: string): boolean {
  if (!pubDate) return false;
  const parsed = new Date(pubDate);
  if (isNaN(parsed.getTime())) return false;
  return Date.now() - parsed.getTime() <= 24 * 60 * 60 * 1000;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

interface BreakingItem {
  newsItem: NewsItem;
  urgency: Urgency;
}

export default function BreakingNewsBanner({ newsItems }: BreakingNewsBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const breaking: BreakingItem[] = [];
  for (const item of newsItems) {
    if (breaking.length >= 2) break;
    if (dismissed.has(item.title)) continue;
    if (!isWithin24Hours(item.pubDate)) continue;
    const urgency = getUrgency(item.title);
    if (!urgency) continue;
    breaking.push({ newsItem: item, urgency });
  }

  if (breaking.length === 0) return null;

  const handleDismiss = (title: string) => {
    setDismissed((prev) => new Set([...prev, title]));
  };

  return (
    <div className="space-y-2 px-0.5">
      {breaking.map(({ newsItem, urgency }) => {
        const isCritical = urgency === "critical";

        return (
          <div
            key={newsItem.title}
            className={`
              relative rounded-2xl border backdrop-blur-md flex items-start gap-3 p-3
              ${isCritical
                ? "bg-red-900/60 border-red-500/70 shadow-[0_0_16px_rgba(239,68,68,0.4)]"
                : "bg-orange-900/50 border-orange-500/60"
              }
              transition-all duration-300
            `}
          >
            {/* Pulsing ring for critical */}
            {isCritical && (
              <div className="absolute inset-0 rounded-2xl border border-red-500/40 animate-ping pointer-events-none" />
            )}

            {/* Status dot */}
            <span
              className={`
                mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0
                ${isCritical
                  ? "bg-red-500 animate-pulse"
                  : "bg-orange-400"
                }
              `}
            />

            {/* Content */}
            <a
              href={newsItem.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 group"
            >
              <p
                className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${
                  isCritical ? "text-red-300" : "text-orange-300"
                }`}
              >
                {isCritical ? "BREAKING" : "ALERT"}
              </p>
              <p className="text-sm font-bold text-white leading-snug group-hover:underline">
                {truncate(newsItem.title, 80)}
              </p>
              {newsItem.source && (
                <p className="text-[10px] text-white/40 font-medium mt-0.5">
                  {newsItem.source}
                </p>
              )}
            </a>

            {/* Dismiss button */}
            <button
              onClick={() => handleDismiss(newsItem.title)}
              className="w-5 h-5 flex-shrink-0 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white text-xs transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
