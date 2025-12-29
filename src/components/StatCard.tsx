"use client";

import React from "react";

type AccentColor = "emerald" | "purple" | "amber";

export type StatCardProps = {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  onClick: () => void;
  accentColor?: AccentColor;
  isClickable?: boolean;
  ariaLabel?: string;
};

export default function StatCard({
  icon,
  value,
  label,
  onClick,
  accentColor = "emerald",
  isClickable = true,
  ariaLabel,
}: StatCardProps) {
  const colorClasses: Record<AccentColor, string> = {
    emerald: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    purple: "hover:border-purple-500/50 hover:shadow-purple-500/10",
    amber: "hover:border-amber-500/50 hover:shadow-amber-500/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      aria-label={ariaLabel ?? `${label}: ${value}`}
      className={[
        "stat-card-hover",
        "flex flex-col items-center justify-center gap-2 p-3",
        "bg-slate-800/60 border border-slate-700/50 rounded-xl",
        "transition-all duration-200 motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
        isClickable
          ? `cursor-pointer hover:shadow-lg active:scale-[0.98] ${colorClasses[accentColor]}`
          : "cursor-default opacity-60",
      ].join(" ")}
    >
      <div className="text-slate-400">{icon}</div>
      <div className="text-white font-bold text-sm">{value}</div>
      <div className="text-slate-500 text-[11px] uppercase tracking-wide">
        {label}
      </div>
    </button>
  );
}

