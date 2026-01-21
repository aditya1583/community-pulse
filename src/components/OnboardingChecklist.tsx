"use client";

import React from "react";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

type OnboardingStep = {
    id: string;
    label: string;
    description: string;
    completed: boolean;
    action: () => void;
    actionLabel: string;
};

type OnboardingChecklistProps = {
    onboardingCompleted: boolean;
    steps: OnboardingStep[];
    onDismiss: () => void;
};

/**
 * OnboardingChecklist - CRO Optimized
 * 
 * Follows 'Progress Creates Motivation' principle.
 * Shows users a clear path to activation (The 'Aha' moment).
 */
export default function OnboardingChecklist({
    onboardingCompleted,
    steps,
    onDismiss,
}: OnboardingChecklistProps) {
    if (onboardingCompleted) return null;

    const completedCount = steps.filter((s) => s.completed).length;
    const progressPercent = Math.round((completedCount / steps.length) * 100);

    return (
        <div className="mx-4 mb-8 glass-card premium-border rounded-3xl p-6 backdrop-blur-xl bg-white/5 shadow-xl relative overflow-hidden group">
            {/* Progress background glow */}
            <div
                className="absolute top-0 left-0 h-1 bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_10px_#10b981]"
                style={{ width: `${progressPercent}%` }}
            />

            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                        Welcome to Voxlo
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">
                            {progressPercent}% Done
                        </span>
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">Complete these to master the radius.</p>
                </div>
                <button
                    onClick={onDismiss}
                    className="text-slate-500 hover:text-white transition-colors"
                >
                    <span className="text-xs font-bold uppercase tracking-widest">Skip</span>
                </button>
            </div>

            <div className="space-y-3">
                {steps.map((step) => (
                    <button
                        key={step.id}
                        onClick={step.completed ? undefined : step.action}
                        disabled={step.completed}
                        className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 text-left ${step.completed
                            ? "bg-emerald-500/5 opacity-60"
                            : "bg-white/5 hover:bg-white/10 active:scale-[0.98]"
                            }`}
                    >
                        <div className="shrink-0">
                            {step.completed ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                            ) : (
                                <Circle className="w-6 h-6 text-slate-600 group-hover:text-slate-400" />
                            )}
                        </div>

                        <div className="flex-1">
                            <h3 className={`text-sm font-bold ${step.completed ? "text-slate-400 line-through" : "text-slate-100"}`}>
                                {step.label}
                            </h3>
                            {!step.completed && (
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    {step.description}
                                </p>
                            )}
                        </div>

                        {!step.completed && (
                            <ChevronRight className="w-4 h-4 text-emerald-500" />
                        )}
                    </button>
                ))}
            </div>

            {progressPercent === 100 && (
                <div className="mt-4 p-3 rounded-2xl bg-emerald-500 flex items-center justify-center gap-2 animate-in zoom-in duration-500">
                    <span className="text-slate-950 font-black text-xs uppercase tracking-widest">
                        You&apos;re a Local Pulse Maker!
                    </span>
                    <span className="text-lg">🏆</span>
                </div>
            )}
        </div>
    );
}
