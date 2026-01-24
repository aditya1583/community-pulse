"use client";

import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getApiUrl } from "@/lib/api-config";

type ReportReason = "spam" | "harassment" | "inappropriate" | "misinformation" | "other";

type ReportPulseButtonProps = {
  pulseId: number;
  reporterId: string;
  onReported?: () => void;
};

const REPORT_REASONS: { value: ReportReason; label: string; emoji: string }[] = [
  { value: "spam", label: "Spam", emoji: "🚫" },
  { value: "harassment", label: "Harassment", emoji: "😠" },
  { value: "inappropriate", label: "Inappropriate Content", emoji: "⚠️" },
  { value: "misinformation", label: "Misinformation", emoji: "❌" },
  { value: "other", label: "Other", emoji: "📝" },
];

export default function ReportPulseButton({
  pulseId,
  reporterId,
  onReported,
}: ReportPulseButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError("Please select a reason");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken) {
        throw new Error("Sign in to report");
      }

      const response = await fetch(getApiUrl("/api/report-pulse"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pulseId,
          reporterId,
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      setSubmitted(true);
      onReported?.();

      // Close modal after short delay
      setTimeout(() => {
        setIsModalOpen(false);
        // Reset state after modal closes
        setTimeout(() => {
          setSubmitted(false);
          setSelectedReason(null);
          setDetails("");
        }, 300);
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setSelectedReason(null);
      setDetails("");
      setError(null);
      setSubmitted(false);
    }
  };

  return (
    <>
      {/* Report Button */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="text-slate-500 hover:text-amber-400 transition"
        title="Report this pulse"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
          />
        </svg>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="relative bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-xl">
            {submitted ? (
              /* Success State */
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Report Submitted</h3>
                <p className="text-sm text-slate-400">Thank you for helping keep the community safe.</p>
              </div>
            ) : (
              /* Report Form */
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Report Pulse</h3>
                  <button
                    onClick={handleClose}
                    className="text-slate-400 hover:text-white transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-slate-400 mb-4">
                  Why are you reporting this pulse?
                </p>

                {/* Reason Selection */}
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason.value}
                      type="button"
                      onClick={() => setSelectedReason(reason.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition ${
                        selectedReason === reason.value
                          ? "border-emerald-500 bg-emerald-500/10 text-white"
                          : "border-slate-700 hover:border-slate-600 text-slate-300"
                      }`}
                    >
                      <span className="text-lg">{reason.emoji}</span>
                      <span className="text-sm font-medium">{reason.label}</span>
                      {selectedReason === reason.value && (
                        <svg className="w-4 h-4 ml-auto text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Optional Details */}
                <div className="mb-4">
                  <label className="block text-xs text-slate-400 mb-1">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Provide more context..."
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedReason}
                  className={`w-full py-3 rounded-lg font-medium transition ${
                    isSubmitting || !selectedReason
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-amber-500 hover:bg-amber-600 text-white"
                  }`}
                >
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </button>

                <p className="text-xs text-slate-500 text-center mt-3">
                  False reports may result in account restrictions.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
