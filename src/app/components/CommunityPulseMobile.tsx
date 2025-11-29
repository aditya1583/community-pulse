"use client";

import React, { useMemo, useState } from "react";

const moods = ["😊", "😐", "😢", "😡", "😴"];
const tags = ["General", "Traffic", "Weather", "Events"];
const filters = ["All", "Traffic", "Weather", "Events", "General"];

function StatPill({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-700/70 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
      <span className="text-base">{icon}</span>
      <span className="uppercase tracking-[0.08em] text-emerald-200/90">{label}</span>
      <span className="font-semibold text-emerald-50">{value}</span>
    </div>
  );
}

export function CommunityPulseMobile() {
  const [activeSegment, setActiveSegment] = useState<"A" | "B">("B");
  const [systemOnline, setSystemOnline] = useState(false);
  const [selectedMood, setSelectedMood] = useState(moods[0]);
  const [tag, setTag] = useState(tags[0]);
  const [message, setMessage] = useState("");
  const [hasPosted, setHasPosted] = useState(false);
  const [filter, setFilter] = useState(filters[0]);

  const vibeText = systemOnline ? "Skyline warming up" : "Gloomy but cozy";
  const badgeText = systemOnline ? "Signal: Live" : "Signal: Dormant";
  const titleText = systemOnline ? "SYSTEM ONLINE." : "SYSTEM DORMANT.";
  const descriptionText = systemOnline
    ? "Human signal detected. AI synthesis is now watching this grid and summarizing local pulses in real time."
    : "Scanning sector... No human signal detected.\nAI synthesis requires a founder input to initialize this zone.";
  const protocolText = systemOnline
    ? "Protocol Engaged – AI analysis is running for this 1-mile sector."
    : "Protocol Required – Ignite the pulse to activate AI analysis for this grid.";

  const aiSummary = useMemo(() => {
    if (!systemOnline || !hasPosted) {
      return "No pulses yet. Start posting to see an AI summary here.";
    }
    return "Early pulses suggest a mellow, after-work mood with light traffic and a soft, overcast sky. Keep posting to refine the grid.";
  }, [systemOnline, hasPosted]);

  const liveFeedText = hasPosted
    ? `Live feed prototype only. Your last pulse would appear here when filtering by ${filter}.`
    : "No pulses yet for Austin. Be the first to set the vibe.";

  const handleToggleSystem = () => {
    setSystemOnline((prev) => !prev);
  };

  const handlePost = () => {
    if (!message.trim()) {
      alert("Type a quick vibe before posting.");
      return;
    }
    setHasPosted(true);
    setMessage("");
  };

  const handleReset = () => {
    setActiveSegment("B");
    setSystemOnline(false);
    setSelectedMood(moods[0]);
    setTag(tags[0]);
    setMessage("");
    setHasPosted(false);
    setFilter(filters[0]);
  };

  const moodPillValue = systemOnline ? selectedMood : "Unknown";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-950 py-8 text-white">
      <div
        className="relative w-[390px] overflow-hidden rounded-[32px] border border-emerald-800/60 bg-neutral-950 shadow-[0_0_40px_rgba(16,185,129,0.25)]"
        style={{ boxShadow: "0 0 0 12px rgba(0,0,0,0.6), inset 0 0 40px rgba(16,185,129,0.18)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16,185,129,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.05) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-emerald-500/10" />
        <div className="absolute -left-24 -top-24 h-52 w-52 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-20 top-24 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col gap-4 px-5 py-6">
          {/* Top bar */}
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-900/60 px-3 py-1 text-sm font-semibold text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
              9:41 AM
            </span>
            <div className="flex flex-1 rounded-full border border-emerald-700/60 bg-emerald-900/40 p-1 text-xs font-semibold text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <button
                className={`flex-1 rounded-full px-3 py-1 transition ${
                  activeSegment === "A"
                    ? "bg-emerald-500/30 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                    : "text-emerald-200/80"
                }`}
                onClick={() => setActiveSegment("A")}
              >
                Option A
              </button>
              <button
                className={`flex-1 rounded-full px-3 py-1 transition ${
                  activeSegment === "B"
                    ? "bg-emerald-500/30 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
                    : "text-emerald-200/80"
                }`}
                onClick={() => setActiveSegment("B")}
              >
                Option B
              </button>
            </div>
            <button
              className="rounded-full border border-emerald-700/70 bg-emerald-900/60 px-3 py-2 text-lg text-emerald-50 shadow-[0_0_14px_rgba(16,185,129,0.35)] transition hover:bg-emerald-700/50"
              onClick={handleReset}
              aria-label="Reset"
            >
              ⟳
            </button>
          </div>

          {/* Chips */}
          <div className="flex gap-3">
            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-emerald-800/70 bg-gradient-to-br from-emerald-900/70 via-emerald-900/60 to-neutral-900/70 p-3 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-800/50 text-2xl shadow-[0_0_20px_rgba(16,185,129,0.35)]">
                🌧️
              </div>
              <div className="flex flex-col text-sm text-emerald-100">
                <span className="text-xs uppercase tracking-[0.12em] text-emerald-300/80">Current Vibe</span>
                <span className="font-semibold text-emerald-50">{vibeText}</span>
              </div>
            </div>
            <div className="flex items-center rounded-2xl border border-emerald-800/70 bg-gradient-to-br from-emerald-900/70 via-emerald-900/60 to-neutral-900/70 px-4 py-3 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
              {badgeText}
            </div>
          </div>

          {/* Hero card */}
          <div className="rounded-3xl border border-emerald-800/70 bg-gradient-to-br from-emerald-950 via-emerald-950/80 to-neutral-950/80 p-5 shadow-[0_0_28px_rgba(16,185,129,0.35)]">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/70 via-emerald-500/70 to-emerald-700/70 text-xl shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                  ⚡
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-300/80">Live Grid Card</p>
                  <p className="font-semibold text-emerald-100">Console Monitor</p>
                </div>
              </div>
              <div className="rounded-full border border-emerald-700/60 bg-emerald-900/50 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,0.25)]">
                Sector: Austin Grid
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-emerald-800/60 bg-black/30 px-4 py-5 shadow-inner shadow-emerald-900/60">
              <div>
                <p className="font-mono text-lg font-semibold uppercase tracking-[0.32em] text-emerald-300">
                  {titleText}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-emerald-100/90">{descriptionText}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatPill icon="☁️" label="Weather" value="66°F" />
                <StatPill icon="🧠" label="Mood" value={moodPillValue} />
                <StatPill icon="🚦" label="Traffic" value="Light" />
              </div>

              <div className="rounded-xl border border-emerald-800/60 bg-emerald-900/40 px-4 py-3 text-sm text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
                {protocolText}
              </div>

              <button
                onClick={handleToggleSystem}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-emerald-950 shadow-[0_0_30px_rgba(52,211,153,0.7)] transition hover:shadow-[0_0_40px_rgba(52,211,153,0.9)]"
              >
                {systemOnline ? "Pause Pulse" : "Ignite Pulse"}
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-emerald-800/60 bg-emerald-900/30 px-3 py-2 text-xs text-emerald-200">
                <span>🛡️</span>
                <p>Your exact location is hidden. Pulse applies to the 1-mile zone.</p>
              </div>
            </div>
          </div>

          {/* Drop a pulse */}
          <div className="space-y-4 rounded-3xl border border-emerald-800/70 bg-gradient-to-br from-neutral-950 via-emerald-950/60 to-neutral-950/70 p-5 shadow-[0_0_26px_rgba(16,185,129,0.28)]">
            <div className="flex items-center justify-between">
              <div className="text-emerald-50">
                <p className="text-lg font-semibold">Drop a pulse</p>
                <p className="text-sm text-emerald-200/80">Set the vibe for Austin</p>
              </div>
              <div className="rounded-full border border-emerald-800/70 bg-emerald-900/40 px-3 py-1 text-xs uppercase tracking-[0.12em] text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.25)]">
                Prototype
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-emerald-800/60 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
              <span>Mood</span>
              <div className="flex gap-2">
                {moods.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMood(m)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                      selectedMood === m
                        ? "border-pink-400/70 bg-pink-500/20 text-pink-200 shadow-[0_0_20px_rgba(244,114,182,0.6)]"
                        : "border-emerald-700/60 bg-emerald-900/40 text-emerald-100 hover:border-emerald-500/60"
                    }`}
                  >
                    <span className="text-xl">{m}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.12em] text-emerald-300/80">Tag</label>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-emerald-800/60 bg-emerald-950/60 px-3 py-3 text-sm text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.25)] focus:border-emerald-400 focus:outline-none"
                >
                  {tags.map((t) => (
                    <option key={t} value={t} className="bg-emerald-950 text-emerald-50">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs uppercase tracking-[0.12em] text-emerald-300/80">Mood value</label>
                <div className="mt-1 rounded-2xl border border-emerald-800/60 bg-emerald-950/40 px-3 py-3 text-sm text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
                  {selectedMood}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.12em] text-emerald-300/80">Pulse</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={240}
                placeholder="Share a quick vibe for this grid..."
                className="mt-1 h-28 w-full resize-none rounded-2xl border border-emerald-800/60 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-50 placeholder:text-emerald-400/60 shadow-[0_0_18px_rgba(16,185,129,0.25)] focus:border-emerald-400 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-emerald-200/80">
                <span>
                  {message.length}/240 · Posting as <span className="font-semibold text-emerald-100">Salty Otter 38</span>
                </span>
                <button
                  onClick={handlePost}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500/90 via-emerald-400/90 to-emerald-600/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-950 shadow-[0_0_18px_rgba(52,211,153,0.65)] transition hover:shadow-[0_0_26px_rgba(52,211,153,0.85)]"
                >
                  Post pulse ➕
                </button>
              </div>
            </div>
          </div>

          {/* AI summary */}
          <div className="space-y-3 rounded-3xl border border-emerald-800/70 bg-gradient-to-br from-emerald-950 via-neutral-950 to-emerald-950/70 p-5 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-emerald-50">AI Summary for Austin</p>
                <p className="text-sm text-emerald-200/80">Automated synthesis for this grid</p>
              </div>
              <div className="rounded-full border border-emerald-800/60 bg-emerald-900/40 px-3 py-1 text-xs uppercase tracking-[0.12em] text-emerald-200">
                Console
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-800/60 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
              {aiSummary}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  filter === f
                    ? "border-emerald-500/80 bg-emerald-500/20 text-emerald-50 shadow-[0_0_18px_rgba(16,185,129,0.4)]"
                    : "border-emerald-800/60 bg-emerald-950/50 text-emerald-200 hover:border-emerald-600/60"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* No pulses box */}
          <div className="space-y-2 rounded-3xl border border-emerald-800/70 bg-emerald-950/60 p-5 text-sm text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
            <p className="font-semibold text-emerald-50">Live Feed Prototype</p>
            <p>{liveFeedText}</p>
            {hasPosted && (
              <p className="text-emerald-200/80">Your pulse has been logged in this prototype.</p>
            )}
          </div>

          {/* Disclaimer */}
          <div className="space-y-3 rounded-3xl border border-emerald-800/60 bg-emerald-950/60 p-5 text-xs leading-relaxed text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.22)]">
            <p>
              Community Pulse displays user-submitted content. Posts may be inaccurate, incomplete, or misleading. Do not rely on this
              information for safety, travel, emergency, or decision-making purposes. All posts reflect the views of individual users, not
              the app’s creators.
            </p>
            <div className="flex flex-col gap-1 text-emerald-300/90">
              <span className="font-semibold">Community Pulse · v0.3 · Built for local vibes</span>
              <span className="text-emerald-200">Terms · Privacy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommunityPulseMobile;
