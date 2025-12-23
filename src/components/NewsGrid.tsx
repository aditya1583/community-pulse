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
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 animate-pulse">
      <div className="aspect-video bg-slate-900/60 rounded-lg mb-3" />
      <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-700/50 rounded w-1/2" />
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

