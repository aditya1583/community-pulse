"use client";

import React from "react";
import type { LocalNewsArticle } from "@/types/news";
import NewsCard from "@/components/NewsCard";

type NewsGridProps = {
  articles: LocalNewsArticle[];
  minDisplay?: number;
  maxDisplay?: number;
};

function NewsCardSkeleton() {
  return (
    <div className="bg-slate-800/60 rounded-xl overflow-hidden border border-slate-700/50">
      <div className="aspect-video bg-gradient-to-r from-slate-900/70 via-slate-700/40 to-slate-900/70 animate-shimmer" />

      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <div className="h-4 bg-gradient-to-r from-slate-700/40 via-slate-600/50 to-slate-700/40 rounded animate-shimmer w-full" />
          <div className="h-4 bg-gradient-to-r from-slate-700/40 via-slate-600/50 to-slate-700/40 rounded animate-shimmer w-3/4" />
        </div>

        <div className="space-y-2">
          <div className="h-3 bg-gradient-to-r from-slate-700/30 via-slate-600/40 to-slate-700/30 rounded animate-shimmer w-full" />
          <div className="h-3 bg-gradient-to-r from-slate-700/30 via-slate-600/40 to-slate-700/30 rounded animate-shimmer w-5/6" />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="h-3 bg-slate-700/40 rounded w-20 animate-pulse" />
          <div className="h-3 bg-slate-700/40 rounded w-16 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function NewsGrid({
  articles,
  minDisplay = 3,
  maxDisplay = 6,
}: NewsGridProps) {
  const displayArticles = articles.slice(0, maxDisplay);
  const skeletonCount = Math.max(0, minDisplay - displayArticles.length);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayArticles.map((article, idx) => (
        <NewsCard key={article.url || idx} article={article} />
      ))}

      {Array.from({ length: skeletonCount }).map((_, idx) => (
        <NewsCardSkeleton key={`skeleton-${idx}`} />
      ))}
    </div>
  );
}

