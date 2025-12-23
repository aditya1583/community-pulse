"use client";

import React, { useState } from "react";
import type { TicketmasterEvent } from "@/hooks/useEvents";

type EventCardProps = {
  events: TicketmasterEvent[];
  isLoading: boolean;
  error: string | null;
  hasLocation: boolean;
};

/**
 * Featured Event Card - First/next upcoming event
 *
 * Large card with category-based gradient
 * Date badge, event name, venue, price
 * Entire card is clickable
 */
function FeaturedEventCard({ event }: { event: TicketmasterEvent }) {
  const eventDate = event.date
    ? new Date(event.date + (event.time ? `T${event.time}` : ""))
    : null;

  const timeStr = event.time
    ? new Date(`2000-01-01T${event.time}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Time TBD";

  // Category-based gradient colors
  const getGradient = (): string => {
    const category = event.category?.toLowerCase() || "";
    if (
      category.includes("sport") ||
      category.includes("concert") ||
      category.includes("music")
    ) {
      return "from-purple-500/20 to-purple-900/20 border-purple-500/30";
    } else if (category.includes("market") || category.includes("food")) {
      return "from-amber-500/20 to-amber-900/20 border-amber-500/30";
    }
    return "from-cyan-500/20 to-cyan-900/20 border-cyan-500/30";
  };

  const handleClick = () => {
    if (event.url) {
      window.open(event.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article
      onClick={handleClick}
      className={`bg-gradient-to-r ${getGradient()} border rounded-xl p-4 cursor-pointer hover:scale-[1.02] transition-transform duration-200`}
    >
      <div className="flex gap-4">
        {/* Date badge */}
        <div className="flex-shrink-0 w-16 text-center">
          <div className="rounded-lg bg-slate-900/80 border border-slate-700/50 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-emerald-300">
              {eventDate
                ? eventDate.toLocaleDateString("en-US", { weekday: "short" })
                : "TBD"}
            </p>
            <p className="text-xl font-semibold text-white">
              {eventDate ? eventDate.getDate() : "--"}
            </p>
            <p className="text-[10px] uppercase text-slate-400">
              {eventDate
                ? eventDate.toLocaleDateString("en-US", { month: "short" })
                : ""}
            </p>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1">{timeStr}</p>
        </div>

        {/* Event details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white mb-1 line-clamp-2">
            {event.name}
          </h3>
          <p className="text-sm text-slate-400 flex items-center gap-1 mb-1">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
            <span className="truncate">{event.venue}</span>
          </p>
          {event.priceRange && (
            <p className="text-sm text-emerald-400">{event.priceRange}</p>
          )}
          {event.category && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-300 border border-slate-700/50">
              {event.category}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Small event card for accordion list
 */
function SmallEventCard({ event }: { event: TicketmasterEvent }) {
  const eventDate = event.date ? new Date(event.date) : null;

  const handleClick = () => {
    if (event.url) {
      window.open(event.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article
      onClick={handleClick}
      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 cursor-pointer hover:border-emerald-500/50 transition"
    >
      <div className="flex items-center gap-3">
        {/* Date */}
        <div className="flex-shrink-0 text-center min-w-[40px]">
          <p className="text-sm font-semibold text-white">
            {eventDate
              ? eventDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "TBD"}
          </p>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">
            {event.name}
          </h4>
          <p className="text-xs text-slate-400 truncate">{event.venue}</p>
        </div>

        {/* Arrow */}
        <svg
          className="w-4 h-4 text-slate-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </article>
  );
}

/**
 * Event Card component with featured event + accordion for more
 */
export default function EventCard({
  events,
  isLoading,
  error,
  hasLocation,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 animate-pulse">
          <div className="flex gap-4">
            <div className="w-16 h-20 bg-slate-700/50 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 bg-slate-700/50 rounded" />
              <div className="h-4 w-1/2 bg-slate-700/50 rounded" />
              <div className="h-4 w-1/4 bg-slate-700/50 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No location
  if (!hasLocation) {
    return (
      <div className="bg-slate-800/60 border border-dashed border-slate-700/50 rounded-xl p-8 text-center">
        <svg
          className="w-8 h-8 mx-auto text-slate-500 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
          />
        </svg>
        <p className="text-sm text-slate-400 mb-1">
          Select a city to see nearby events
        </p>
        <p className="text-xs text-slate-500">
          Search for your city above to discover what&apos;s happening
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  // No events
  if (events.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-dashed border-slate-700/50 rounded-xl p-8 text-center">
        <svg
          className="w-8 h-8 mx-auto text-slate-500 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          />
        </svg>
        <p className="text-sm text-slate-400">No events nearby this week</p>
        <p className="text-xs text-slate-500 mt-1">Check back soon!</p>
      </div>
    );
  }

  const featuredEvent = events[0];
  const remainingEvents = events.slice(1);

  return (
    <div className="space-y-3">
      {/* Featured Event */}
      <FeaturedEventCard event={featuredEvent} />

      {/* Accordion for more events */}
      {remainingEvents.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 hover:text-white hover:border-emerald-500/50 transition"
          >
            <span>
              {expanded ? "Hide" : `View ${remainingEvents.length} more`}{" "}
              {remainingEvents.length === 1 ? "event" : "events"}
            </span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                expanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div
            className={`accordion-content ${expanded ? "expanded" : ""}`}
          >
            <div className="space-y-2">
              {remainingEvents.map((event) => (
                <SmallEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Attribution */}
      <p className="text-center text-[10px] text-slate-500 pt-1">
        Events via Ticketmaster
      </p>
    </div>
  );
}
