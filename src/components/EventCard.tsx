"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import type { TicketmasterEvent, EventsFallback } from "@/hooks/useEvents";
import { RADIUS_CONFIG } from "@/lib/constants/radius";
import TabPulseInput from "./TabPulseInput";

// Supabase client for fetching vibe counts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Generate an ICS calendar file for an event
 */
function generateICS(event: TicketmasterEvent): string {
  const eventDate = event.date
    ? new Date(event.date + (event.time ? `T${event.time}` : "T12:00:00"))
    : new Date();

  // End time is 3 hours after start (default for events)
  const endDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);

  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Voxlo//Events//EN
BEGIN:VEVENT
UID:${event.id}@communitypulse
DTSTART:${formatDate(eventDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.name.replace(/,/g, "\\,")}
LOCATION:${event.venue?.replace(/,/g, "\\,") || ""}
DESCRIPTION:${event.url ? `Get tickets: ${event.url}` : ""}
URL:${event.url || ""}
END:VEVENT
END:VCALENDAR`;
}

/**
 * Download ICS file
 */
function downloadICS(event: TicketmasterEvent) {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${event.name.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type EventCardProps = {
  events: TicketmasterEvent[];
  isLoading: boolean;
  error: string | null;
  hasLocation: boolean;
  fallback?: EventsFallback | null;
  // Pulse input props
  isSignedIn?: boolean;
  identityReady?: boolean;
  displayName?: string;
  pulseLoading?: boolean;
  pulseMood?: string;
  pulseMessage?: string;
  moodValidationError?: string | null;
  messageValidationError?: string | null;
  showValidationErrors?: boolean;
  onMoodChange?: (mood: string) => void;
  onMessageChange?: (message: string) => void;
  onSubmit?: () => void;
  onSignInClick?: () => void;
};

/**
 * Featured Event Card - First/next upcoming event
 *
 * Large card with category-based gradient
 * Date badge, event name, venue, price
 * Action buttons: Add to Calendar, Directions, Share
 *
 * PROPRIETARY CONTEXT: Shows venue vibe count - data Ticketmaster doesn't have
 */
function FeaturedEventCard({ event, vibeCount }: { event: TicketmasterEvent; vibeCount?: number }) {
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

  const handleCardClick = () => {
    if (event.url) {
      window.open(event.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleCalendar = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    downloadICS(event);
  }, [event]);

  const handleDirections = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const query = encodeURIComponent(event.venue || event.name);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  }, [event]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: event.name,
      text: `${event.name} at ${event.venue}`,
      url: event.url || window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error - fall back to clipboard
        await navigator.clipboard.writeText(event.url || "");
      }
    } else {
      await navigator.clipboard.writeText(event.url || "");
    }
  }, [event]);

  return (
    <article
      onClick={handleCardClick}
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
            <span className="truncate">
              {event.venue}
              {event.venueCity && `, ${event.venueCity}`}
              {event.distanceMiles !== null && event.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES && (
                <span className="text-amber-400 font-medium"> ({event.distanceMiles} mi away)</span>
              )}
            </span>
          </p>
          {event.priceRange && (
            <p className="text-sm text-emerald-400">{event.priceRange}</p>
          )}
          {event.category && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-300 border border-slate-700/50">
              {event.category}
            </span>
          )}

          {/* PROPRIETARY CONTEXT: Venue vibe data - unique value we provide */}
          {vibeCount !== undefined && vibeCount > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium border border-emerald-500/30">
                <span>🔥</span>
                <span>{vibeCount} vibe{vibeCount !== 1 ? "s" : ""} nearby</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/30">
        <button
          onClick={handleCalendar}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 hover:text-white transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          Calendar
        </button>
        <button
          onClick={handleDirections}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 hover:text-white transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          Directions
        </button>
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 hover:text-white transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Share
        </button>
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
          <p className="text-xs text-slate-400 truncate">
            {event.venue}
            {event.venueCity && `, ${event.venueCity}`}
            {event.distanceMiles !== null && event.distanceMiles > RADIUS_CONFIG.PRIMARY_RADIUS_MILES && (
              <span className="text-amber-400"> ({event.distanceMiles} mi)</span>
            )}
          </p>
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
 *
 * Fetches venue vibes to show proprietary context alongside Ticketmaster events.
 * This differentiates us from Ticketmaster - we show real-time crowd data they don't have.
 */
export default function EventCard({
  events,
  isLoading,
  error,
  hasLocation,
  fallback,
  isSignedIn = false,
  identityReady = false,
  displayName = "",
  pulseLoading = false,
  pulseMood = "",
  pulseMessage = "",
  moodValidationError = null,
  messageValidationError = null,
  showValidationErrors = false,
  onMoodChange,
  onMessageChange,
  onSubmit,
  onSignInClick,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [venueVibeCount, setVenueVibeCount] = useState<number>(0);

  // Fetch venue vibes for the featured event's venue
  useEffect(() => {
    const fetchVenueVibes = async () => {
      if (!events || events.length === 0) {
        setVenueVibeCount(0);
        return;
      }

      const featuredEvent = events[0];
      if (!featuredEvent.venue) {
        setVenueVibeCount(0);
        return;
      }

      try {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

        // Query for vibes near the venue (by name match)
        const { count } = await supabase
          .from("venue_vibes")
          .select("id", { count: "exact", head: true })
          .ilike("venue_name", `%${featuredEvent.venue.split(",")[0].trim()}%`)
          .gte("created_at", fourHoursAgo);

        setVenueVibeCount(count || 0);
      } catch (err) {
        console.error("[EventCard] Error fetching venue vibes:", err);
        setVenueVibeCount(0);
      }
    };

    fetchVenueVibes();
  }, [events]);

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
      {/* Metro Fallback Banner */}
      {fallback && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <svg
            className="w-4 h-4 text-amber-400 flex-shrink-0"
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
          <p className="text-sm text-amber-300">
            Events in <span className="font-medium">{fallback.metro}</span>{" "}
            <span className="text-amber-400/70">({fallback.distance} mi away)</span>
          </p>
        </div>
      )}

      {/* Featured Event - with proprietary vibe context */}
      <FeaturedEventCard event={featuredEvent} vibeCount={venueVibeCount} />

      {/* Drop an Events Pulse - only show if handlers are provided */}
      {onMoodChange && onMessageChange && onSubmit && onSignInClick && (
        <TabPulseInput
          category="Events"
          mood={pulseMood}
          message={pulseMessage}
          displayName={displayName}
          isSignedIn={isSignedIn}
          identityReady={identityReady}
          loading={pulseLoading}
          moodValidationError={moodValidationError}
          messageValidationError={messageValidationError}
          showValidationErrors={showValidationErrors}
          onMoodChange={onMoodChange}
          onMessageChange={onMessageChange}
          onSubmit={onSubmit}
          onSignInClick={onSignInClick}
        />
      )}

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

      {/* Attribution & Disclaimer - Ticketmaster ToS Compliance */}
      <div className="text-center text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-800/50">
        <a
          href="https://ticketmaster.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-400 transition"
        >
          Event data provided by Ticketmaster
        </a>
        <span className="mx-1">·</span>
        <span>Details may change</span>
      </div>
    </div>
  );
}
