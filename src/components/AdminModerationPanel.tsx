"use client";

import React, { useState, useEffect, useCallback } from "react";
import { authBridge } from "@/lib/authBridge";
import { getApiUrl } from "@/lib/api-config";

type Report = {
  id: number;
  pulse_id: number;
  reporter_id: string;
  reason: string;
  details: string | null;
  created_at: string;
};

type ReportedPulse = {
  pulse: {
    id: number;
    author: string;
    message: string;
    tag: string;
    hidden: boolean;
    city: string;
    is_bot: boolean;
    created_at: string;
  } | null;
  reports: Report[];
  reportCount: number;
};

type Stats = {
  totalReports: number;
  hiddenPulses: number;
  activeFlagged: number;
};

type Props = {
  userId: string;
};

// Admin user IDs
const ADMIN_USER_IDS = ["3e06ceda-57d8-42c5-965c-236a486efe71"];

export default function AdminModerationPanel({ userId }: Props) {
  const [data, setData] = useState<{ reportedPulses: ReportedPulse[]; stats: Stats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const isAdmin = ADMIN_USER_IDS.includes(userId);

  const fetchReports = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const token = await authBridge.getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(getApiUrl("/api/admin/reports"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleAction = async (pulseId: number, action: "hide" | "dismiss" | "delete") => {
    setActionLoading(pulseId);
    try {
      const token = await authBridge.getAccessToken();
      if (!token) return;

      await fetch(getApiUrl("/api/admin/reports"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pulseId, action }),
      });

      await fetchReports();
    } catch {
      // Ignore
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">
          🛡️ Moderation
        </h3>
        <button
          onClick={fetchReports}
          className="text-xs text-slate-400 hover:text-white transition"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-white">{data.stats.totalReports}</p>
            <p className="text-[10px] text-slate-400 uppercase">Reports</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-amber-400">{data.stats.activeFlagged}</p>
            <p className="text-[10px] text-slate-400 uppercase">Flagged</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-red-400">{data.stats.hiddenPulses}</p>
            <p className="text-[10px] text-slate-400 uppercase">Hidden</p>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-xs text-slate-500 text-center py-4">Loading reports...</p>
      )}

      {error && (
        <p className="text-xs text-red-400 text-center py-4">Error: {error}</p>
      )}

      {data && data.reportedPulses.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">✅ No reports. Community is clean.</p>
        </div>
      )}

      {/* Reported Pulses */}
      {data?.reportedPulses.map((item) => (
        <div
          key={item.pulse?.id || item.reports[0]?.pulse_id}
          className={`border rounded-xl p-4 space-y-3 ${
            item.pulse?.hidden
              ? "border-red-500/20 bg-red-500/5"
              : item.reportCount >= 3
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-slate-700/50 bg-slate-800/30"
          }`}
        >
          {/* Pulse content */}
          {item.pulse ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-white">{item.pulse.author}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                  {item.pulse.tag}
                </span>
                {item.pulse.is_bot && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">BOT</span>
                )}
                {item.pulse.hidden && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">HIDDEN</span>
                )}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{item.pulse.message}</p>
              <p className="text-[10px] text-slate-500 mt-1">{item.pulse.city}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Pulse deleted</p>
          )}

          {/* Report details */}
          <div className="space-y-1">
            <p className="text-[10px] text-amber-400 font-bold uppercase">
              {item.reportCount} {item.reportCount === 1 ? "Report" : "Reports"}
            </p>
            {item.reports.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">
                  {r.reason}
                </span>
                {r.details && (
                  <span className="text-slate-500 truncate max-w-[200px]">— {r.details}</span>
                )}
                <span className="text-slate-600 ml-auto flex-shrink-0">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>

          {/* Admin Actions */}
          {item.pulse && !item.pulse.hidden && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleAction(item.pulse!.id, "hide")}
                disabled={actionLoading === item.pulse.id}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50"
              >
                {actionLoading === item.pulse.id ? "..." : "Hide"}
              </button>
              <button
                onClick={() => handleAction(item.pulse!.id, "dismiss")}
                disabled={actionLoading === item.pulse.id}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
              >
                Dismiss Reports
              </button>
              <button
                onClick={() => handleAction(item.pulse!.id, "delete")}
                disabled={actionLoading === item.pulse.id}
                className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
