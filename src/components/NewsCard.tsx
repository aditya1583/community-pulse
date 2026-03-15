"use client";

import React, { useCallback } from "react";
import type { NewsItem } from "@/hooks/useUniversalData";

interface NewsCardProps {
  item: NewsItem;
}

function timeAgo(pubDate: string): string {
  if (!pubDate) return "";
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function NewsCard({ item }: NewsCardProps) {
  const handleTap = useCallback(() => {
    if (item.link) {
      window.open(item.link, "_blank", "noopener,noreferrer");
    }
  }, [item.link]);

  const ago = timeAgo(item.pubDate);

  return (
    <button
      onClick={handleTap}
      className="
        w-full text-left group
        glass-card premium-border rounded-2xl p-3
        border border-blue-500/20 hover:border-blue-400/40
        transition-all duration-300
        hover:scale-[1.01] active:scale-[0.99]
        focus-visible:outline-none
      "
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-base flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300">
          📰
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-[12px] font-bold text-white leading-snug line-clamp-2">
            {item.title}
          </p>
          <div className="flex items-center gap-2">
            {item.source && (
              <span className="text-[10px] font-semibold text-blue-400 truncate max-w-[120px]">
                {item.source}
              </span>
            )}
            {item.source && ago && (
              <span className="text-[10px] text-white/20">·</span>
            )}
            {ago && (
              <span className="text-[10px] text-white/40">{ago}</span>
            )}
          </div>
        </div>

        {/* External link indicator */}
        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-white/20 group-hover:text-blue-400 transition-colors mt-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 9L9 1M9 1H4M9 1V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </button>
  );
}
