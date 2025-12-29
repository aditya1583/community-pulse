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

          {/* Subtle fallback indicator - small icon in corner */}
          {article._fallbackSource && (
            <span
              className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm text-emerald-400 rounded-full"
              title={`From ${article._fallbackSource}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          )}
        </div>
      )}

      <div className="p-4 space-y-2">
        {showInlineFallback && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-slate-700/50 text-slate-400 rounded">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {article._fallbackSource}
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

