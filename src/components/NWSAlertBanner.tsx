"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { NWSAlert } from "@/hooks/useUniversalData";

interface NWSAlertBannerProps {
  alerts: NWSAlert[];
}

type SeverityConfig = {
  bg: string;
  border: string;
  text: string;
  icon: string;
  pulse: boolean;
};

function getSeverityConfig(severity: NWSAlert["severity"]): SeverityConfig {
  switch (severity) {
    case "Extreme":
      return {
        bg: "bg-red-900/60",
        border: "border-red-500/70",
        text: "text-red-200",
        icon: "🚨",
        pulse: true,
      };
    case "Severe":
      return {
        bg: "bg-orange-900/60",
        border: "border-orange-500/70",
        text: "text-orange-200",
        icon: "⚠️",
        pulse: false,
      };
    case "Moderate":
      return {
        bg: "bg-yellow-900/60",
        border: "border-yellow-500/70",
        text: "text-yellow-200",
        icon: "🌩️",
        pulse: false,
      };
    case "Minor":
    default:
      return {
        bg: "bg-blue-900/60",
        border: "border-blue-500/70",
        text: "text-blue-200",
        icon: "ℹ️",
        pulse: false,
      };
  }
}

const DISMISSED_KEY_PREFIX = "dismissed-nws-";

function isDismissed(alertId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`${DISMISSED_KEY_PREFIX}${alertId}`) === "1";
}

function dismiss(alertId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${DISMISSED_KEY_PREFIX}${alertId}`, "1");
}

interface AlertCardProps {
  alert: NWSAlert;
  onDismiss: (id: string) => void;
}

function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getSeverityConfig(alert.severity);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dismiss(alert.id);
      onDismiss(alert.id);
    },
    [alert.id, onDismiss]
  );

  return (
    <div
      className={`
        relative rounded-2xl border backdrop-blur-md
        ${cfg.bg} ${cfg.border}
        transition-all duration-300
        ${cfg.pulse ? "shadow-[0_0_16px_rgba(239,68,68,0.4)]" : ""}
      `}
    >
      {/* Pulsing ring for Extreme alerts */}
      {cfg.pulse && (
        <div className="absolute inset-0 rounded-2xl border border-red-500/40 animate-ping pointer-events-none" />
      )}

      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-start gap-3 p-3 text-left focus-visible:outline-none"
        aria-expanded={expanded}
      >
        <span className="text-xl flex-shrink-0 mt-0.5">{cfg.icon}</span>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-black uppercase tracking-wider ${cfg.text}`}>
            {alert.event}
          </p>
          {alert.headline && (
            <p className="text-[11px] text-white/80 font-medium mt-0.5 line-clamp-2 leading-snug">
              {alert.headline}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-bold ${cfg.text}`}>
            {expanded ? "▲" : "▼"}
          </span>
          <button
            onClick={handleDismiss}
            className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white text-xs transition-colors"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {alert.description && (
            <div className="glass-card rounded-xl p-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1">
                Details
              </p>
              <p className="text-[11px] text-white/80 leading-relaxed">
                {alert.description}
              </p>
            </div>
          )}
          {alert.instruction && (
            <div className="glass-card rounded-xl p-2 border border-amber-500/20">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400/80 mb-1">
                What to do
              </p>
              <p className="text-[11px] text-white/80 leading-relaxed">
                {alert.instruction}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            {alert.senderName && (
              <p className="text-[9px] text-white/30 font-medium">
                {alert.senderName}
              </p>
            )}
            {alert.expires && (
              <p className="text-[9px] text-white/30 font-medium">
                Expires: {new Date(alert.expires).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NWSAlertBanner({ alerts }: NWSAlertBannerProps) {
  // Track which alerts have been dismissed this session
  const [visible, setVisible] = useState<NWSAlert[]>([]);

  useEffect(() => {
    setVisible(alerts.filter((a) => !isDismissed(a.id)));
  }, [alerts]);

  const handleDismiss = useCallback((id: string) => {
    setVisible((prev) => prev.filter((a) => a.id !== id));
  }, []);

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-0.5">
      {visible.map((alert) => (
        <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
