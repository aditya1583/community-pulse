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

      {/* Fallback notice - shows context about where news is coming from */}
      {data?.isNearbyFallback && (data.fallbackSources?.length ?? 0) > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
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
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
            />
          </svg>
          <span>
            {data.fallbackLevel === "county" && "County news: "}
            {data.fallbackLevel === "metro" && "Area news: "}
            {data.fallbackLevel === "state" && "State news: "}
            {data.fallbackLevel === "nearby" && "Nearby: "}
            {data.fallbackSources.join(", ")}
          </span>
        </div>
      )}

      {/* Empty state - provide Google News link as escape hatch */}
      {articles.length === 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 text-center space-y-3">
          <div className="w-10 h-10 mx-auto bg-slate-700/50 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-300 mb-1">
              Local news is quiet today
            </p>
            <p className="text-xs text-slate-500">
              No breaking stories for {displayCity} right now
            </p>
          </div>
          <a
            href={`https://news.google.com/search?q=${encodeURIComponent(city)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition"
          >
            <span>Search Google News</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
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
