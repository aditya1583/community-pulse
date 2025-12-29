"use client";

import React from "react";
import type { TrafficLevel, Pulse } from "./types";

type TrafficContentProps = {
  trafficLevel: TrafficLevel | null;
  trafficLoading: boolean;
  trafficError: string | null;
  trafficPulses: Pulse[];
  cityName: string;
};

/**
 * Traffic Tab Content
 *
 * Shows real-time traffic section with road conditions
 * Plus community traffic reports from pulses
 */
export default function TrafficContent({
  trafficLevel,
  trafficLoading,
  trafficError,
  trafficPulses,
  cityName,
}: TrafficContentProps) {
  // Traffic level config
  const getTrafficConfig = () => {
    switch (trafficLevel) {
      case "Light":
        return {
          color: "text-emerald-400",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/30",
          icon: "🟢",
          description: "Roads are clear. Great time to travel!",
        };
      case "Moderate":
        return {
          color: "text-amber-400",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/30",
          icon: "🟡",
          description: "Some congestion in busy areas. Allow extra time.",
        };
      case "Heavy":
        return {
          color: "text-red-400",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/30",
          icon: "🔴",
          description: "Significant delays expected. Consider alternate routes.",
        };
      default:
        return {
          color: "text-slate-400",
          bgColor: "bg-slate-800/60",
          borderColor: "border-slate-700/50",
          icon: "⚪",
          description: "Traffic data not available.",
        };
    }
  };

  const config = getTrafficConfig();

  return (
    <div className="space-y-4">
      {/* Main traffic status card */}
      <div
        className={`${config.bgColor} border ${config.borderColor} rounded-xl p-6 text-center`}
      >
        {trafficLoading ? (
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto bg-slate-700/50 rounded-full animate-pulse" />
            <div className="h-6 w-40 mx-auto bg-slate-700/50 rounded animate-pulse" />
            <div className="h-4 w-64 mx-auto bg-slate-700/50 rounded animate-pulse" />
          </div>
        ) : trafficError ? (
          <div>
            <span className="text-3xl mb-3 block">⚠️</span>
            <p className="text-sm text-red-400">{trafficError}</p>
          </div>
        ) : (
          <>
            <span className="text-5xl mb-3 block">{config.icon}</span>
            <h3 className={`text-xl font-semibold ${config.color} mb-2`}>
              {trafficLevel ? `${trafficLevel} Traffic` : "No Data"}
            </h3>
            <p className="text-sm text-slate-400">{config.description}</p>
          </>
        )}
      </div>

      {/* Traffic info cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <svg
            className="w-6 h-6 mx-auto text-emerald-400 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-slate-400">Best Time</p>
          <p className="text-sm font-medium text-white">Before 7am</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-center">
          <svg
            className="w-6 h-6 mx-auto text-amber-400 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p className="text-xs text-slate-400">Rush Hour</p>
          <p className="text-sm font-medium text-white">5pm - 7pm</p>
        </div>
      </div>

      {/* Community traffic reports */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
          Community Reports
        </h4>

        {trafficPulses.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No recent traffic reports from the community in {cityName}.
            <br />
            <span className="text-xs text-slate-500">
              Be the first to share traffic conditions!
            </span>
          </p>
        ) : (
          <div className="space-y-2">
            {trafficPulses.slice(0, 5).map((pulse) => (
              <div
                key={pulse.id}
                className="flex items-start gap-2 p-2 bg-slate-900/50 rounded-lg"
              >
                <span className="text-lg flex-shrink-0">{pulse.mood}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white line-clamp-2">
                    {pulse.message}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="text-cyan-400">{pulse.author}</span>
                    <span className="font-mono">
                      {" "}
                      ·{" "}
                      {new Date(pulse.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
