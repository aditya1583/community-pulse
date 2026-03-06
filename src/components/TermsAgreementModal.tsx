"use client";

import React, { useState } from "react";

type TermsAgreementModalProps = {
  onAccept: () => void;
  onCancel: () => void;
  loading?: boolean;
};

/**
 * Terms Agreement Modal
 *
 * Apple Review requirement (1.2): Users must agree to terms/EULA
 * that make clear there is no tolerance for objectionable content
 * or abusive users before they can post content.
 */
export default function TermsAgreementModal({ onAccept, onCancel, loading }: TermsAgreementModalProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-card premium-border rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl">📋</div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Community Guidelines</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Required to post</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-slate-300 leading-relaxed">
            By posting on Voxlo, you agree to our community standards:
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">✓</span>
              <p className="text-sm text-slate-400">
                <strong className="text-white">No objectionable content</strong> — No hate speech, harassment, threats, explicit content, or content promoting violence.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">✓</span>
              <p className="text-sm text-slate-400">
                <strong className="text-white">No abuse</strong> — Abusive users will be removed. We have zero tolerance for bullying or targeting individuals.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">✓</span>
              <p className="text-sm text-slate-400">
                <strong className="text-white">Keep it local</strong> — Voxlo is for your neighborhood. Post relevant, helpful content about your community.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-emerald-400 text-sm mt-0.5">✓</span>
              <p className="text-sm text-slate-400">
                <strong className="text-white">Content moderation</strong> — All posts are reviewed. Objectionable content will be removed within 24 hours and the poster may be permanently banned.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-slate-500">
              Full details in our{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">
                Terms of Service
              </a>
              {" "}and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group pt-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-2 border-white/20 bg-transparent text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
              I agree to the <strong>Terms of Service</strong> and <strong>Community Guidelines</strong>. I understand that objectionable content or abusive behavior will result in removal.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-bold text-slate-400 hover:text-white rounded-2xl border border-white/10 hover:border-white/20 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={!agreed || loading}
            className="flex-1 py-3 text-sm font-black text-black bg-emerald-500 hover:bg-emerald-400 rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 uppercase tracking-wider"
          >
            {loading ? "..." : "Accept & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
