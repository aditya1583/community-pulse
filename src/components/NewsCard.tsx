"use client";

import React from "react";
import type { LocalNewsArticle } from "@/types/news";
import { formatRelativeTime } from "@/lib/time";

export default function NewsCard({ article }: { article: LocalNewsArticle }) {
  const hasImage = !!article.urlToImage;
  const showInlineFallback = !!article._fallbackSource && !hasImage;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-slate-800/60 rounded-xl overflow-hidden border border-slate-700/50 hover:border-emerald-500/30 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
    >
      {article.urlToImage && (
        <div className="aspect-video bg-slate-900/60 overflow-hidden relative">
          <img
            src={article.urlToImage}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          {article._fallbackSource && (
            <span className="absolute top-2 left-2 px-2 py-1 text-[11px] font-medium bg-amber-400/90 text-slate-950 rounded-full">
              From {article._fallbackSource}
            </span>
          )}
        </div>
      )}

      <div className="p-4 space-y-2">
        {showInlineFallback && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full">
            From {article._fallbackSource}
          </span>
        )}

        <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-emerald-300 transition-colors">
          {article.title}
        </h3>

        {article.description && (
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
            {article.description}
          </p>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate pr-2">{article.source}</span>
          <span className="flex-shrink-0 font-mono">
            {formatRelativeTime(article.publishedAt)}
          </span>
        </div>
      </div>
    </a>
  );
}

