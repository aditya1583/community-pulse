"use client";

import React from "react";
import type { TicketmasterEvent } from "@/hooks/useEvents";
import type { TabId, TrafficLevel } from "./types";

type NewsSummary = {
  paragraph: string;
  bulletPoints: string[];
} | null;

type AISummaryCardProps = {
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
  newsSummary?: NewsSummary;
  newsLoading?: boolean;
  newsError?: string | null;
  newsCount?: number;
};

/**
 * AI Summary Card - Always visible below tabs
 *
 * Design: bg-gradient from emerald-900/30 to slate-900/80
 * Border: border-emerald-500/30
 * Header: Zap icon + "AI PULSE SUMMARY" (emerald-400, text-sm, font-mono)
 * Content: Dynamic summary based on active tab
 */
export default function AISummaryCard({
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
  newsSummary,
  newsLoading = false,
  newsError = null,
  newsCount = 0,
}: AISummaryCardProps) {
  const displayCity = cityName.split(",")[0]?.trim() || cityName;

  // Get tab-specific summary intro
  const getSummaryIntro = (): string => {
    switch (activeTab) {
      case "pulse":
        return "Based on recent community pulses";
      case "events":
        return "Events happening in your area";
      case "traffic":
        return "Current traffic conditions";
      case "news":
        return "Latest local news highlights";
      default:
        return "Community overview";
    }
  };

  const getEventSummary = (): string | null => {
    if (events.length === 0) return null;

    const nextEvent = events[0];
    const eventDate = nextEvent.date
      ? new Date(nextEvent.date + (nextEvent.time ? `T${nextEvent.time}` : ""))
      : null;
    const dateLabel = eventDate
      ? eventDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null;
    const timeLabel = nextEvent.time
      ? new Date(`2000-01-01T${nextEvent.time}`).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
    const timing = dateLabel
      ? ` on ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`
      : " soon";

    return `${events.length} events coming up. Next: ${nextEvent.name} at ${nextEvent.venue}${timing}.`;
  };

  const getTrafficSummary = (): string | null => {
    if (!trafficLevel) return null;

    const summaryByLevel: Record<TrafficLevel, string> = {
      Light: "Roads are clear. Great time to travel.",
      Moderate: "Some congestion in busy areas. Allow extra time.",
      Heavy: "Significant delays expected. Consider alternate routes.",
    };

    return `${trafficLevel} traffic across ${displayCity}. ${
      summaryByLevel[trafficLevel]
    }`;
  };

  const getNewsSummary = (): string | null => {
    if (!newsSummary) return null;
    return newsSummary.paragraph;
  };

  const summaryState = () => {
    if (activeTab === "events") {
      return {
        loading: eventsLoading,
        error: eventsError,
        summary: getEventSummary(),
        fallback: "No events nearby this week.",
      };
    }

    if (activeTab === "traffic") {
      return {
        loading: trafficLoading,
        error: trafficError,
        summary: getTrafficSummary(),
        fallback: "Traffic data is unavailable right now.",
      };
    }

    if (activeTab === "news") {
      return {
        loading: newsLoading,
        error: newsError,
        summary: getNewsSummary(),
        fallback:
          newsCount === 0
            ? `No local news found for ${displayCity}.`
            : "Loading news summary...",
      };
    }

    return {
      loading: summaryLoading,
      error: summaryError,
      summary,
      fallback:
        pulsesCount === 0
          ? `No recent pulses in ${displayCity}. Be the first to share what's happening!`
          : `Generating summary from ${pulsesCount} recent pulses...`,
    };
  };

  const activeSummary = summaryState();

  return (
    <div className="bg-gradient-to-r from-emerald-900/30 to-slate-900/80 border border-emerald-500/30 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {/* Zap icon */}
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
          AI Pulse Summary
        </span>
      </div>

      {/* Summary content */}
      <div className="space-y-2">
        {activeSummary.loading ? (
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-700/50 rounded animate-pulse" />
            <div className="h-4 w-4/5 bg-slate-700/50 rounded animate-pulse" />
            <div className="h-4 w-3/5 bg-slate-700/50 rounded animate-pulse" />
          </div>
        ) : activeSummary.error ? (
          <p className="text-sm text-red-400">{activeSummary.error}</p>
        ) : activeSummary.summary ? (
          <>
            <p className="text-xs text-slate-500 mb-2">{getSummaryIntro()}</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {activeSummary.summary}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">{activeSummary.fallback}</p>
        )}
      </div>
    </div>
  );
}
