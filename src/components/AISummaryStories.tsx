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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
            Hyperlocal Brief
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1">
          {stories.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-500 ${idx === activeIndex
                  ? "bg-emerald-400 w-4 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  : "bg-white/10 w-1"
                }`}
            />
          ))}
        </div>
      </div>

      {/* Scrollable story cards */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide px-0.5"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {stories.map((card) => {
          const isActiveItem = activeTab === card.id;

          return (
            <button
              key={card.id}
              onClick={() => handleCardTap(card)}
              className={`
              flex-shrink-0 w-[160px] snap-start relative group
              glass-card premium-border rounded-2xl p-4 transition-all duration-500
              hover:scale-[1.05] hover:-rotate-1 active:scale-[0.98]
              focus-visible:outline-none 
              ${isActiveItem ? "border-emerald-500/50 shadow-lg shadow-emerald-500/10" : ""}
            `}
            >
              {/* Background Accent Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-30 group-hover:opacity-50 transition-opacity duration-500 z-0`} />

              <div className="relative z-10 flex flex-col items-start gap-3 text-left">
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                    {card.icon}
                  </div>
                  <div className={`text-xl font-black ${card.color} drop-shadow-sm`}>
                    {card.value}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover:text-white transition-colors">
                    {card.title}
                  </p>
                  <p className="text-[11px] font-bold text-slate-200 line-clamp-2 leading-[1.4] tracking-tight">
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {isActiveItem && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              )}
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
