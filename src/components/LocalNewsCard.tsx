"use client";

import React, { useEffect, useState } from "react";
import type { LocalNewsResponse, LocalNewsArticle } from "@/app/api/local-news/route";

type LocalNewsCardProps = {
  city: string;
};

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Skeleton loader for the news card
 */
function NewsCardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-slate-800 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-800 rounded w-full"></div>
        <div className="h-3 bg-slate-800 rounded w-5/6"></div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-800/50 rounded-2xl"></div>
        ))}
      </div>
    </div>
  );
}

/**
 * Single article item in the list
 */
function ArticleItem({ article }: { article: LocalNewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-2.5 hover:border-pink-500/60 hover:shadow-pink-500/10 hover:shadow-md transition group"
    >
      <div className="flex gap-3">
        {article.urlToImage && (
          <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-slate-800">
            <img
              src={article.urlToImage}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm text-slate-100 font-medium line-clamp-2 group-hover:text-pink-300 transition leading-snug">
            {article.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
            <span className="font-medium text-slate-400">{article.source}</span>
            <span>-</span>
            <span>{formatRelativeTime(article.publishedAt)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function LocalNewsCard({ city }: LocalNewsCardProps) {
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

  // Extract city name for display (without state/country)
  const displayCity = city.split(",")[0]?.trim() || city;

  return (
    <section className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-md p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-slate-100 flex items-center gap-2">
            Local News in {displayCity}
            {data?.isNearbyFallback && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                includes {data.sourceCity}
              </span>
            )}
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Auto-generated from multiple sources
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
            <span className="text-sm text-slate-400">
              Fetching today&apos;s local news...
            </span>
          </div>
          <NewsCardSkeleton />
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <p className="text-xs text-slate-500">
            We couldn&apos;t load local news right now. Please try again later.
          </p>
        </div>
      ) : data?.notConfigured ? (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">News feature coming soon</p>
        </div>
      ) : data && data.articles.length > 0 ? (
        <>
          {/* AI Summary Section */}
          {data.aiSummary && (
            <div className="bg-gradient-to-r from-slate-950/80 to-slate-900/60 border border-slate-800 rounded-2xl p-3 space-y-2">
              <p className="text-sm text-slate-200 leading-relaxed">
                {data.aiSummary.paragraph}
              </p>
              {data.aiSummary.bulletPoints.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {data.aiSummary.bulletPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-400 flex items-start gap-2"
                    >
                      <span className="text-pink-400 mt-0.5">-</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Headlines List */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 font-medium">
              Headlines
            </h3>
            {data.articles.slice(0, 5).map((article, index) => (
              <ArticleItem key={`${article.url}-${index}`} article={article} />
            ))}
          </div>
        </>
      ) : (
        <div className="py-6 text-center">
          <p className="text-sm text-slate-500">
            No recent local news found for this area.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
        <span className="text-[10px] text-slate-600">
          Powered by NewsAPI.org
        </span>
        {data?.fetchedAt && (
          <span className="text-[10px] text-slate-600">
            Updated {formatRelativeTime(data.fetchedAt)}
          </span>
        )}
      </div>
    </section>
  );
}
