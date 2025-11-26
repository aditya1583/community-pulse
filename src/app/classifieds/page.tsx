"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabaseClient";
import { isCleanText } from "../../../lib/contentFilter";

type Classified = {
  id: number;
  city: string;
  type: "offer" | "need";
  title: string;
  description: string;
  contact_hint: string;
  created_at: string;
};

const CLASSIFIED_TYPES: Classified["type"][] = ["offer", "need"];

export default function ClassifiedsPage() {
  const [city, setCity] = useState("Austin");
  const [classifieds, setClassifieds] = useState<Classified[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [formValues, setFormValues] = useState({
    type: "offer" as Classified["type"],
    title: "",
    description: "",
    contact_hint: "",
  });

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setAccessToken(data.session?.access_token ?? null);
    };

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAccessToken(session?.access_token ?? null);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchClassifieds = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch(
          `/api/classifieds?city=${encodeURIComponent(city)}`
        );
        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error || "Unable to load classifieds right now.");
          setClassifieds([]);
          return;
        }

        setClassifieds(data.classifieds || []);
      } catch (error) {
        console.error("Error fetching classifieds:", error);
        setErrorMsg("Unable to load classifieds right now.");
        setClassifieds([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClassifieds();
  }, [city]);

  const orderedClassifieds = useMemo(
    () =>
      [...classifieds].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [classifieds]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user || !accessToken) {
      setErrorMsg("You must be signed in to post a listing.");
      return;
    }

    if (!isCleanText(formValues.title) || !isCleanText(formValues.description)) {
      setErrorMsg("Listing contains disallowed language.");
      return;
    }

    setPosting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/classifieds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ city, ...formValues }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Unable to post listing.");
        return;
      }

      setFormValues({ type: "offer", title: "", description: "", contact_hint: "" });

      setClassifieds((prev) =>
        data.classified
          ? [data.classified as Classified, ...prev]
          : prev
      );
    } catch (error) {
      console.error("Error creating classified:", error);
      setErrorMsg("Unable to post listing.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Marketplace
            </p>
            <h1 className="text-3xl font-semibold">Community Classifieds</h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Post what you have or need in your city. Listings are lightweight and text-only.
            </p>
            <p className="text-xs text-slate-500">
              Listings are user-generated. Use caution and common sense.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/"
              className="text-sm text-pink-200 hover:text-pink-100 underline underline-offset-4"
            >
              ← Back to pulses
            </Link>
            <label className="text-xs text-slate-400 uppercase tracking-wide">
              City
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-40 rounded-2xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
              placeholder="City"
            />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl bg-slate-900/80 border border-slate-800 p-4 shadow-lg"
        >
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400 uppercase tracking-wide">
                Type
              </label>
              <div className="flex gap-2">
                {CLASSIFIED_TYPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormValues((prev) => ({ ...prev, type: value }))}
                    className={`rounded-full px-3 py-1 text-sm border transition ${
                      formValues.type === value
                        ? "bg-pink-600 text-white border-pink-500"
                        : "bg-slate-800/80 text-slate-200 border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    {value === "offer" ? "Offering" : "Need"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs text-slate-400 uppercase tracking-wide">
                Title
              </label>
              <input
                required
                value={formValues.title}
                onChange={(e) =>
                  setFormValues((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full rounded-2xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
                placeholder="Short summary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide">
              Description
            </label>
            <textarea
              required
              value={formValues.description}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full rounded-2xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
              placeholder="Include details like timing or preferences"
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide">
              Contact hint
            </label>
            <input
              required
              value={formValues.contact_hint}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, contact_hint: e.target.value }))
              }
              className="w-full rounded-2xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/70 focus:border-transparent"
              placeholder="e.g., text me @handle or email"
            />
          </div>
          {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={posting}
              className="rounded-full bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-pink-500 disabled:opacity-50"
            >
              {posting ? "Posting..." : "Post listing"}
            </button>
            <p className="text-xs text-slate-500">
              Listings are user-generated. Use caution and common sense.
            </p>
          </div>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Latest in {city}</h2>
            {loading && <p className="text-sm text-slate-400">Loading…</p>}
          </div>
          {orderedClassifieds.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">
              No listings yet. Be the first to post!
            </p>
          ) : (
            <div className="grid gap-3">
              {orderedClassifieds.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        item.type === "offer"
                          ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-200 border border-amber-500/50"
                      }`}
                    >
                      {item.type === "offer" ? "Offering" : "Need"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">
                    {item.description}
                  </p>
                  <p className="mt-2 text-sm text-pink-200">
                    Contact: {item.contact_hint}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
