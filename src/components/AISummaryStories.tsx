"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import type { TicketmasterEvent } from "@/hooks/useEvents";
import type { TabId, TrafficLevel } from "./types";
import ShareableSummaryCard from "./ShareableSummaryCard";

/** Normalize and deduplicate events */
function deduplicateEvents(events: TicketmasterEvent[]): TicketmasterEvent[] {
  const seen = new Set<string>();
  return events.filter(event => {
    const normalized = event.name.toLowerCase().trim().replace(/\s+/g, " ");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

type AISummaryStoriesProps = {
  activeTab: TabId;
  summary: string | null;
  summaryLoading: boolean;
  summaryError: string | null;
  pulsesCount: number;
  cityName: string;
  events: TicketmasterEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  trafficLevel: TrafficLevel | null;
  trafficLoading: boolean;
  trafficError: string | null;
  onNavigateTab?: (tab: TabId) => void;
  vibeHeadline?: string;
  vibeEmoji?: string;
  temperature?: number;
};

type StoryCard = {
  id: TabId | "share";
  icon: string;
  title: string;
  value: string;
  subtitle: string;
  color: string;
  bgGradient: string;
};

/**
 * AI Summary Stories - Swipeable story cards format
 *
 * 2026 UX Pattern: Instead of a wall of text, present info as
 * tappable story cards that users can swipe through.
 */
export default function AISummaryStories({
  activeTab,
  summary,
  summaryLoading,
  summaryError,
  pulsesCount,
  cityName,
  events,
  eventsLoading,
  eventsError,
  trafficLevel,
  trafficLoading,
  trafficError,
  onNavigateTab,
  vibeHeadline,
  vibeEmoji,
  temperature,
}: AISummaryStoriesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayCity = cityName.split(",")[0]?.trim() || cityName;

  const uniqueEvents = useMemo(() => deduplicateEvents(events), [events]);

  // Build story cards from data
  const stories: StoryCard[] = useMemo(() => {
    const cards: StoryCard[] = [];

    // Pulse/Vibe card
    cards.push({
      id: "pulse",
      icon: "💬",
      title: "Pulses",
      value: pulsesCount > 0 ? `${pulsesCount}` : "0",
      subtitle: summaryLoading
        ? "Loading..."
        : summaryError
        ? "Error loading"
        : pulsesCount > 0
        ? summary?.split(".")[0] || "Recent activity"
        : "Be the first to share",
      color: "text-emerald-400",
      bgGradient: "from-emerald-500/20 to-emerald-600/10",
    });

    // Traffic card
    const trafficColors: Record<TrafficLevel, string> = {
      Light: "text-emerald-400",
      Moderate: "text-amber-400",
      Heavy: "text-red-400",
    };
    cards.push({
      id: "traffic",
      icon: trafficLevel === "Heavy" ? "🚦" : trafficLevel === "Moderate" ? "🚙" : "🚗",
      title: "Traffic",
      value: trafficLoading ? "..." : trafficLevel || "N/A",
      subtitle: trafficLoading
        ? "Checking roads..."
        : trafficError
        ? "Unable to load"
        : trafficLevel === "Light"
        ? "Roads are clear"
        : trafficLevel === "Moderate"
        ? "Some congestion"
        : trafficLevel === "Heavy"
        ? "Expect delays"
        : "No data",
      color: trafficLevel ? trafficColors[trafficLevel] : "text-slate-400",
      bgGradient: trafficLevel === "Heavy"
        ? "from-red-500/20 to-red-600/10"
        : trafficLevel === "Moderate"
        ? "from-amber-500/20 to-amber-600/10"
        : "from-emerald-500/20 to-emerald-600/10",
    });

    // Events card
    cards.push({
      id: "events",
      icon: "🎉",
      title: "Events",
      value: eventsLoading ? "..." : `${uniqueEvents.length}`,
      subtitle: eventsLoading
        ? "Finding events..."
        : eventsError
        ? "Unable to load"
        : uniqueEvents.length > 0
        ? uniqueEvents[0].name.slice(0, 40) + (uniqueEvents[0].name.length > 40 ? "..." : "")
        : "Nothing nearby",
      color: "text-purple-400",
      bgGradient: "from-purple-500/20 to-purple-600/10",
    });

    // Local card
    cards.push({
      id: "local",
      icon: "📍",
      title: "Local",
      value: "Gas & More",
      subtitle: `Essentials in ${displayCity}`,
      color: "text-cyan-400",
      bgGradient: "from-cyan-500/20 to-cyan-600/10",
    });

    return cards;
  }, [
    pulsesCount, summary, summaryLoading, summaryError,
    trafficLevel, trafficLoading, trafficError,
    uniqueEvents, eventsLoading, eventsError,
    displayCity,
  ]);

  // Handle scroll to update active indicator
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const cardWidth = 140 + 12; // card width + gap
    const newIndex = Math.round(scrollLeft / cardWidth);
    setActiveIndex(Math.min(newIndex, stories.length - 1));
  }, [stories.length]);

  // Handle card tap
  const handleCardTap = useCallback((card: StoryCard) => {
    if (card.id !== "share" && onNavigateTab) {
      onNavigateTab(card.id as TabId);
    }
  }, [onNavigateTab]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-emerald-400"
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
          <span className="text-sm font-mono text-emerald-400 uppercase tracking-wider">
            Quick Brief
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {stories.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                idx === activeIndex
                  ? "bg-emerald-400 w-3"
                  : "bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scrollable story cards */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {stories.map((card) => {
          const baseClasses = "flex-shrink-0 w-[140px] snap-start border border-white/[0.06] rounded-xl p-3 transition-all duration-200 hover:scale-[1.02] hover:border-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
          const activeClasses = activeTab === card.id ? "ring-2 ring-emerald-500/40" : "";

          return (
          <button
            key={card.id}
            onClick={() => handleCardTap(card)}
            className={`${baseClasses} bg-gradient-to-br ${card.bgGradient} ${activeClasses}`}
          >
            <div className="flex flex-col items-start gap-2 text-left">
              <div className="flex items-center justify-between w-full">
                <span className="text-2xl">{card.icon}</span>
                <span className={`text-lg font-bold ${card.color}`}>
                  {card.value}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  {card.title}
                </p>
                <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-snug">
                  {card.subtitle}
                </p>
              </div>
            </div>
          </button>
        );
        })}
      </div>

      {/* Share button (optional, shown when summary available) */}
      {summary && !summaryLoading && !summaryError && (
        <ShareableSummaryCard
          cityName={cityName}
          vibeHeadline={vibeHeadline || `${displayCity} is ${pulsesCount > 0 ? "Active" : "Quiet"}`}
          vibeEmoji={vibeEmoji}
          summary={summary}
          trafficLevel={trafficLevel}
          eventsCount={events.length}
          temperature={temperature}
        />
      )}
    </div>
  );
}
