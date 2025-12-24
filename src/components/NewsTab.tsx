"use client";

import React from "react";
import type { LocalNewsResponse } from "@/types/news";
import NewsGrid from "@/components/NewsGrid";
import { formatRelativeTime } from "@/lib/time";

type NewsTabProps = {
  city: string;
  data: LocalNewsResponse | null;
  loading: boolean;
  error: string | null;
  minDisplay?: number;
};

export default function NewsTab({
  city,
  data,
  loading,
  error,
  minDisplay = 3,
}: NewsTabProps) {
  // Loading state
  if (loading) {
    return <NewsGrid articles={[]} minDisplay={minDisplay} />;
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <svg
          className="w-8 h-8 mx-auto text-red-400 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  // Not configured state
  if (data?.notConfigured) {
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
            d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
          />
        </svg>
        <p className="text-sm text-slate-400 mb-1">News API not configured</p>
        <p className="text-xs text-slate-500">
          Set up the NEWS_API_KEY environment variable to enable local news
        </p>
      </div>
    );
  }

  const articles = data?.articles ?? [];

  const displayCity = city.split(",")[0]?.trim() || city;
  const hasMinimumArticles = articles.length >= minDisplay;
  const articleLabel = articles.length === 1 ? "article" : "articles";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">
          Local News for <span className="text-emerald-400">{displayCity}</span>
        </h3>
        <span className="text-xs text-slate-500 font-mono">
          {articles.length} {articleLabel}
        </span>
      </div>

      {/* Nearby fallback notice */}
      {data?.isNearbyFallback && (data.fallbackSources?.length ?? 0) > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <span>
            Including news from nearby: {data.fallbackSources.join(", ")}
          </span>
        </div>
      )}

      {/* Empty state (still fills layout with placeholders) */}
      {articles.length === 0 && (
        <div className="bg-slate-800/60 border border-dashed border-slate-700/50 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-400 mb-1">
            No local news found for {displayCity} yet
          </p>
          <p className="text-xs text-slate-500">
            Check back soon — we&apos;ll keep looking.
          </p>
        </div>
      )}

      <NewsGrid articles={articles} minDisplay={minDisplay} />

      {/* See all link */}
      {hasMinimumArticles && (
        <a
          href={`https://news.google.com/search?q=${encodeURIComponent(city)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 text-center text-emerald-400 hover:text-emerald-300 text-sm font-medium transition border border-slate-700/50 rounded-xl bg-slate-900/40 hover:border-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
        >
          See all news →
        </a>
      )}

      {/* Attribution */}
      <div className="flex items-center justify-between text-[10px] text-slate-600 pt-2">
        <span>News powered by {data?.provider === "gnews" ? "GNews" : "NewsAPI"}</span>
        {data?.fetchedAt && <span>Updated {formatRelativeTime(data.fetchedAt)}</span>}
      </div>
    </div>
  );
}
