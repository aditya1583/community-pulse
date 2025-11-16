"use client";

import { useEffect, useState } from "react";
//import { supabase } from "../../lib/supabaseClient";
import { supabase } from "../../lib/supabaseClient";


type Pulse = {
  id: number;
  city: string;
  mood: string;
  tag: string;
  message: string;
  createdAt: string;
};

const TAGS = ["All", "Traffic", "Weather", "Events", "General"];
const MOODS = ["😊", "😐", "😢", "😡", "😴", "🤩"];

export default function Home() {
  const [city, setCity] = useState("Austin");
  const [tagFilter, setTagFilter] = useState("All");
  const [mood, setMood] = useState("😊");
  const [tag, setTag] = useState("General");
  const [message, setMessage] = useState("");
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load pulses from Supabase when city changes
  useEffect(() => {
    const fetchPulses = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("pulses")
        .select("*")
        .eq("city", city)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching pulses:", error.message);
        setErrorMsg("Could not load pulses. Try again in a bit.");
        setPulses([]);
      } else if (data) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          city: row.city,
          mood: row.mood,
          tag: row.tag,
          message: row.message,
          createdAt: new Date(row.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setPulses(mapped);
      }

      setLoading(false);
    };

    fetchPulses();
  }, [city]);

  const filteredPulses = pulses.filter(
    (p) => tagFilter === "All" || p.tag === tagFilter
  );

  const handleAddPulse = async () => {
    if (!message.trim()) return;

    setErrorMsg(null);

    const { data, error } = await supabase
      .from("pulses")
      .insert([
        {
          city,
          mood,
          tag,
          message: message.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error inserting pulse:", error.message);
      setErrorMsg("Could not post your pulse. Please try again.");
      return;
    }

    if (data) {
      const newPulse: Pulse = {
        id: data.id,
        city: data.city,
        mood: data.mood,
        tag: data.tag,
        message: data.message,
        createdAt: new Date(data.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setPulses((prev) => [newPulse, ...prev]);
      setMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex justify-center px-4 py-6">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <header className="rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 p-[1px] shadow-lg">
          <div className="rounded-3xl bg-slate-950/90 px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Community <span className="text-pink-400">Pulse</span>
              </h1>
              <p className="text-sm text-slate-300 mt-1">
                Real-time vibes from your city. No doom scroll, just quick pulses.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <label className="text-xs text-slate-400 uppercase tracking-wide">
                City
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full sm:w-40 rounded-2xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                placeholder="City"
              />
              <span className="text-[11px] text-slate-500">
                (We&apos;ll keep v1 single-city for now)
              </span>
            </div>
          </div>
        </header>

        {/* New Pulse Card */}
        <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-lg p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-slate-100">
              Drop a <span className="text-pink-400">pulse</span>
            </h2>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {loading ? "Loading…" : "Live board"}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Mood picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Mood</span>
              <div className="flex gap-1.5 bg-slate-950/70 border border-slate-800 rounded-2xl px-2 py-1">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className={`text-lg px-1.5 rounded-2xl transition ${
                      mood === m ? "bg-slate-800 scale-110" : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag select */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Tag</span>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="rounded-2xl bg-slate-950/70 border border-slate-800 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
              >
                <option>Traffic</option>
                <option>Weather</option>
                <option>Events</option>
                <option>General</option>
              </select>
            </div>
          </div>

          {/* Message input */}
          <div className="space-y-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent resize-none"
              placeholder="What’s the vibe right now? (e.g., 'Commute is smooth on 183, sunset looks insane.')"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Pulses are public. Keep it kind & useful.
              </span>
              <button
                onClick={handleAddPulse}
                disabled={!message.trim() || loading}
                className="inline-flex items-center gap-1 rounded-2xl bg-pink-500 px-4 py-1.5 text-xs font-medium text-slate-950 shadow-lg shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <span>Post pulse</span> <span>⚡</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/40 rounded-2xl px-3 py-2 mt-1">
              {errorMsg}
            </p>
          )}
        </section>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={`px-3 py-1.5 rounded-2xl text-xs border transition ${
                tagFilter === t
                  ? "bg-pink-500 text-slate-950 border-pink-400 shadow shadow-pink-500/40"
                  : "bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Pulses list */}
        <section className="space-y-3 pb-12">
          {loading && pulses.length === 0 ? (
            <div className="rounded-3xl bg-slate-900/70 border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
              Loading pulses for{" "}
              <span className="font-semibold text-slate-100">{city}</span>…
            </div>
          ) : filteredPulses.length === 0 ? (
            <div className="rounded-3xl bg-slate-900/70 border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
              No pulses yet for{" "}
              <span className="font-semibold text-slate-100">{city}</span>.  
              Be the first to set the vibe.
            </div>
          ) : (
            filteredPulses.map((pulse) => (
              <article
                key={pulse.id}
                className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 flex gap-3 hover:border-pink-500/60 hover:shadow-pink-500/20 transition"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-950/80 flex items-center justify-center text-2xl">
                    {pulse.mood}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-pink-300 bg-pink-500/10 border border-pink-500/30 px-2 py-0.5 rounded-full">
                    {pulse.tag}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <p className="text-sm text-slate-100 leading-snug">
                    {pulse.message}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{pulse.city}</span>
                    <span>{pulse.createdAt}</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
