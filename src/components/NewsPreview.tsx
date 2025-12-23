"use client";

import React, { useEffect, useState } from "react";
import type {
  LocalNewsResponse,
  LocalNewsArticle,
} from "@/types/news";
import { formatRelativeTime } from "@/lib/time";

type NewsPreviewProps = {
  city: string;
  onSeeAll?: () => void;
};

/**
 * Single news card for the preview
 * Flexible width for grid layout
 */
function NewsCard({ article }: { article: LocalNewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-slate-800/80 border border-slate-700/50 rounded-lg p-3 hover:border-emerald-500/50 transition group"
    >
      <h4 className="text-sm text-white font-medium line-clamp-2 leading-snug group-hover:text-emerald-300 transition">
        {article.title}
      </h4>
      <p className="text-xs text-slate-500 font-mono mt-2">
        {formatRelativeTime(article.publishedAt)}
      </p>
    </a>
  );
}

/**
 * News Preview Component - Condensed local news section below AI Summary
 *
 * Shows 3 news cards in a responsive grid
 * Small header: "Local News" + "See all" link
 */
export default function NewsPreview({ city, onSeeAll }: NewsPreviewProps) {
  const [data, setData] = useState<LocalNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!city) return;

    let cancelled = false;

    async function fetchLocalNews() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/local-news?city=${encodeURIComponent(city)}`
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch local news");
        }

        const responseData: LocalNewsResponse = await res.json();

        if (!cancelled) {
          setData(responseData);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "Unable to load local news right now.";
          console.error("Error fetching local news:", err);
          setError(message);
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLocalNews();

    return () => {
      cancelled = true;
    };
  }, [city]);

  // Don't render if no news or error
  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400 font-medium">Local News</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-3 animate-pulse"
            >
              <div className="h-4 w-full bg-slate-700/50 rounded mb-2" />
              <div className="h-4 w-3/4 bg-slate-700/50 rounded mb-4" />
              <div className="h-3 w-16 bg-slate-700/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || data.articles.length === 0 || data.notConfigured) {
    return null;
  }

  // Show up to 3 articles in preview
  const previewArticles = data.articles.slice(0, 3);

  const handleSeeAll = () => {
    if (onSeeAll) {
      onSeeAll();
    } else {
      // Fallback to Google News search if no callback provided
      window.open(
        `https://news.google.com/search?q=${encodeURIComponent(city)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400 font-medium">Local News</span>
        <button
          onClick={handleSeeAll}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition"
        >
          See all &rarr;
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {previewArticles.map((article, index) => (
          <NewsCard key={`${article.url}-${index}`} article={article} />
        ))}
      </div>
    </div>
  );
}
