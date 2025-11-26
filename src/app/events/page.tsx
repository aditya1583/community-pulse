"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_CITY = "Austin";

export type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  starts_at: string;
  ends_at?: string | null;
};

type EventsApiResponse = {
  events?: EventItem[];
  event?: EventItem;
  error?: string;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return fallback;
}

function getEventsFromPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "events" in payload &&
    Array.isArray((payload as { events?: unknown }).events)
  ) {
    return (payload as { events: EventItem[] }).events;
  }

  return [];
}

function isEventItem(value: unknown): value is EventItem {
  return (
    !!value &&
    typeof value === "object" &&
    "starts_at" in value &&
    typeof (value as { starts_at?: unknown }).starts_at === "string" &&
    "title" in value &&
    typeof (value as { title?: unknown }).title === "string"
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventsPage() {
  const [city, setCity] = useState(DEFAULT_CITY);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventTime, setNewEventTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventUrl, setNewEventUrl] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventCreateError, setEventCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedCity = localStorage.getItem("cp-city");
    if (savedCity) {
      setCity(savedCity);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!city) return;
    localStorage.setItem("cp-city", city);
  }, [city]);

  useEffect(() => {
    if (!city) return;

    const fetchEvents = async () => {
      try {
        setEventsLoading(true);
        setEventsError(null);

        const res = await fetch(`/api/events?city=${encodeURIComponent(city)}`);

        let data: EventsApiResponse | null = null;
        try {
          data = (await res.json()) as EventsApiResponse;
        } catch {
          // ignore json parse errors
        }

        if (!res.ok) {
          setEventsError(getErrorMessage(data, "Unable to load events right now."));
          setEvents([]);
          return;
        }

        const recentWindow = Date.now() - 1000 * 60 * 60 * 24; // past 24h
        const filtered = getEventsFromPayload(data).filter((ev) => {
          const start = new Date(ev.starts_at).getTime();
          return start >= recentWindow;
        });

        const sorted = filtered.sort(
          (a: EventItem, b: EventItem) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
        );

        setEvents(sorted);
      } catch (err) {
        console.error("Error fetching events:", err);
        setEventsError("Unable to load events right now.");
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    };

    fetchEvents();
  }, [city]);

  const upcomingEvents = useMemo(() => {
    if (!events.length) return [];
    const now = Date.now();
    const recentWindow = now - 1000 * 60 * 60 * 24; // 24h lookback for recent events

    return events.filter((ev) => {
      const start = new Date(ev.starts_at).getTime();
      return start >= recentWindow;
    });
  }, [events]);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!city || !newEventTitle || !newEventTime) return;

    const mergedDescription = [
      newEventDescription.trim(),
      newEventUrl ? `More info: ${newEventUrl.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      setCreatingEvent(true);
      setEventCreateError(null);

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          title: newEventTitle,
          description: mergedDescription || undefined,
          location: newEventLocation,
          starts_at: newEventTime,
        }),
      });

      let data: EventsApiResponse | null = null;
      try {
        data = (await res.json()) as EventsApiResponse;
      } catch {
        // ignore json errors
      }

      if (!res.ok) {
        const message = getErrorMessage(
          data,
          `Failed to create event (status ${res.status})`
        );
        throw new Error(message);
      }

      if (data && data.event && isEventItem(data.event)) {
        setEvents((prev) =>
          [...prev, data.event].sort(
            (a: EventItem, b: EventItem) =>
              new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
          )
        );
      }

      setNewEventTitle("");
      setNewEventLocation("");
      setNewEventDescription("");
      setNewEventUrl("");
      setNewEventTime(new Date().toISOString().slice(0, 16));
    } catch (err: unknown) {
      console.error("Error creating event:", err);
      const message =
        err instanceof Error ? err.message : "Unable to create event right now.";
      setEventCreateError(message);
    } finally {
      setCreatingEvent(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <header className="rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 p-[1px] shadow-lg">
          <div className="rounded-3xl bg-slate-950/90 px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-300/80">
                Local happenings
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Events for <span className="text-pink-300">{city}</span>
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Create and browse upcoming gatherings, meetups, and pop-ups powered by the existing Community Pulse events feed.
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 self-start sm:self-end">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100/10 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-100/20 transition"
                >
                  <span>Back to pulses</span>
                  <span aria-hidden>↩</span>
                </Link>
              </div>
              <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                <label className="text-xs text-slate-400 uppercase tracking-wide">
                  City
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full sm:w-52 rounded-2xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                  placeholder="City"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
          <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Create an event
                </p>
                <h2 className="text-lg font-semibold text-slate-100">
                  Share something happening in {city}
                </h2>
              </div>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Title</label>
                <input
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  required
                  className="w-full rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                  placeholder="Community cleanup, coworking, etc."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Date & time</label>
                  <input
                    type="datetime-local"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    required
                    className="w-full rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Location</label>
                  <input
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    className="w-full rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                    placeholder="Coffee shop, park, venue"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Description</label>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                  placeholder="What should people know?"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Optional link</label>
                <input
                  type="url"
                  value={newEventUrl}
                  onChange={(e) => setNewEventUrl(e.target.value)}
                  className="w-full rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                  placeholder="RSVP or info link"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs text-slate-400">
                📎 Flyer upload placeholder — drag and drop coming soon.
              </div>

              {eventCreateError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-2xl px-3 py-2">
                  {eventCreateError}
                </p>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={creatingEvent || !newEventTitle || !newEventTime}
                  className="inline-flex items-center gap-2 rounded-2xl bg-pink-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-lg shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {creatingEvent ? "Saving…" : "Create event"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Upcoming & recent
                </p>
                <h2 className="text-lg font-semibold text-slate-100">Events list</h2>
              </div>
              <span className="text-[11px] text-slate-500">
                {eventsLoading ? "Loading events…" : `${upcomingEvents.length} events`}
              </span>
            </div>

            {eventsError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-2xl px-3 py-2">
                {eventsError}
              </p>
            )}

            {eventsLoading && upcomingEvents.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-20 rounded-2xl bg-slate-800/60 border border-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="rounded-2xl bg-slate-950/60 border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
                No events yet for <span className="text-slate-100">{city}</span>. Be the first to share something happening.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-2xl bg-slate-950/70 border border-slate-800 p-4 flex flex-col gap-2 hover:border-pink-500/60 hover:shadow-pink-500/20 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-50">
                          {event.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatDateTime(event.starts_at)}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                      {event.category && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/30">
                          {event.category}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                        {event.description}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
