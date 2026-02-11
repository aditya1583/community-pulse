"use client";

import React, { useMemo } from "react";
import type { TicketmasterEvent } from "@/hooks/useEvents";
import type { TabId, TrafficLevel } from "./types";
import ShareableSummaryCard from "./ShareableSummaryCard";

/** Normalize event name for deduplication */
function normalizeEventName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^\w\s]/g, "");
}

/** Deduplicate events by normalized name */
function deduplicateEvents(events: TicketmasterEvent[]): TicketmasterEvent[] {
  const seen = new Set<string>();
  return events.filter(event => {
    const normalized = normalizeEventName(event.name);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

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
  onNavigateTab?: (tab: TabId) => void;
  /** Optional vibe headline from city mood */
  vibeHeadline?: string;
  /** Optional vibe emoji from city mood */
  vibeEmoji?: string;
  /** Optional temperature for the share card */
  temperature?: number;
};

/** Strip markdown bold/italic formatting and section headers */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold** → bold
    .replace(/__(.+?)__/g, "$1")         // __bold__ → bold
    .replace(/\*(.+?)\*/g, "$1")         // *italic* → italic
    .replace(/_(.+?)_/g, "$1")           // _italic_ → italic
    .replace(/^#+\s+/gm, "")            // # headers
    .trim();
}

function firstSentence(text: string): string {
  const trimmed = stripMarkdown(text.trim());
  if (!trimmed) return "";

  const match = trimmed.match(/(.+?[.!?])(\s|$)/);
  return (match ? match[1] : trimmed).trim();
}

function InlineLinkButton(props: {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (!props.onClick || props.disabled) {
    return (
      <span className="text-slate-200 underline decoration-slate-600 underline-offset-2">
        {props.children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      className="text-emerald-200 underline decoration-emerald-400/50 hover:decoration-emerald-400/80 underline-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded-sm"
    >
      {props.children}
    </button>
  );
}

/** Provenance badge - shows data source attribution */
function ProvenanceBadge({ source, count, timeframe }: {
  source: string;
  count?: number;
  timeframe?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-800/50 rounded border border-slate-700/30">
      {count !== undefined && count > 0 && (
        <span className="text-slate-400">{count}</span>
      )}
      <span>{source}</span>
      {timeframe && (
        <>
          <span className="text-slate-600">·</span>
          <span>{timeframe}</span>
        </>
      )}
    </span>
  );
}

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
  onNavigateTab,
  vibeHeadline,
  vibeEmoji,
  temperature,
}: AISummaryCardProps) {
  const displayCity = cityName.split(",")[0]?.trim() || cityName;

  // Deduplicate events by name to avoid showing same event twice
  const uniqueEvents = useMemo(() => deduplicateEvents(events), [events]);

  const getEventSummary = (): string | null => {
    if (uniqueEvents.length === 0) return null;

    const nextEvent = uniqueEvents[0];
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

  const hasNavigate = !!onNavigateTab;

  const pulseLine = (() => {
    if (summaryLoading) return "Loading pulse summary…";
    if (summaryError) return summaryError;
    if (summary) return firstSentence(summary);
    if (pulsesCount === 0) return `No recent pulses in ${displayCity}.`;
    return `Generating summary from ${pulsesCount} recent pulses…`;
  })();

  const eventsLine = (() => {
    if (eventsLoading) return "Loading events…";
    if (eventsError) return eventsError;
    const s = getEventSummary();
    return s ? firstSentence(s) : "No events nearby this week.";
  })();

  const trafficLine = (() => {
    if (trafficLoading) return "Loading traffic…";
    if (trafficError) return trafficError;
    const s = getTrafficSummary();
    return s ? firstSentence(s) : "Traffic data is unavailable right now.";
  })();

  const localLine = `Local essentials (gas prices and farmers markets) for ${displayCity}.`;

  return (
    <div className="bg-gradient-to-r from-emerald-900/30 to-[var(--background-card)] border border-emerald-500/30 rounded-2xl p-4 elevation-1">
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

      {/* Summary content with provenance badges */}
      <div className="space-y-2">
        <p className="text-sm text-slate-300 leading-relaxed">
          <InlineLinkButton
            onClick={hasNavigate ? () => onNavigateTab?.("pulse") : undefined}
            disabled={activeTab === "pulse"}
          >
            Pulses
          </InlineLinkButton>
          {": "}
          {pulseLine}
          {pulsesCount > 0 && (
            <ProvenanceBadge source="community reports" count={pulsesCount} timeframe="last 4h" />
          )}
        </p>

        <p className="text-sm text-slate-300 leading-relaxed">
          <InlineLinkButton
            onClick={hasNavigate ? () => onNavigateTab?.("traffic") : undefined}
            disabled={activeTab === "traffic"}
          >
            Traffic
          </InlineLinkButton>
          {": "}
          {trafficLine}
          {trafficLevel && !trafficLoading && !trafficError && (
            <a
              href="https://www.tomtom.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-800/50 rounded border border-slate-700/30 hover:text-slate-400 hover:border-slate-600/50 transition"
            >
              Traffic by TomTom
              <span className="text-slate-600">·</span>
              <span>live</span>
            </a>
          )}
        </p>

        <p className="text-sm text-slate-300 leading-relaxed">
          <InlineLinkButton
            onClick={hasNavigate ? () => onNavigateTab?.("events") : undefined}
            disabled={activeTab === "events"}
          >
            Events
          </InlineLinkButton>
          {": "}
          {uniqueEvents.length > 0 ? (
            <>
              Upcoming events include{" "}
              {uniqueEvents.slice(0, 2).map((event, idx) => (
                <React.Fragment key={event.id}>
                  {idx > 0 ? " and " : ""}
                  <InlineLinkButton
                    onClick={hasNavigate ? () => onNavigateTab?.("events") : undefined}
                    disabled={activeTab === "events"}
                  >
                    {event.name}
                  </InlineLinkButton>
                </React.Fragment>
              ))}
              .
              <ProvenanceBadge source="Ticketmaster" count={events.length} />
            </>
          ) : (
            eventsLine
          )}
        </p>

        <p className="text-sm text-slate-300 leading-relaxed">
          <InlineLinkButton
            onClick={hasNavigate ? () => onNavigateTab?.("local") : undefined}
            disabled={activeTab === "local"}
          >
            Local
          </InlineLinkButton>
          {": "}
          {localLine}
          <ProvenanceBadge source="EIA & USDA" />
        </p>
      </div>

      {/* Share Today's Brief - removed for cleaner UX */}
    </div>
  );
}
