"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

/**
 * InstallPrompt - PWA Onboarding
 * 
 * Explains how to install Voxlo as a native-feeling app.
 * Essential for mobile-first community apps.
 */
export default function InstallPrompt() {
    const [show, setShow] = useState(false);
    const [platform] = useState<"ios" | "android" | "other">(() => {
        if (typeof window === "undefined") return "other";
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        if (isIOS) return "ios";
        if (isAndroid) return "android";
        return "other";
    });

    useEffect(() => {
        const hasSeen = localStorage.getItem("voxlo-install-prompt-seen");

        // Show after 30 seconds of first visit
        const timer = setTimeout(() => {
            if (!hasSeen && window.matchMedia('(display-mode: browser)').matches) {
                setShow(true);
            }
        }, 30000);

        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-700">
            <div className="glass-card premium-border rounded-3xl p-6 backdrop-blur-2xl bg-slate-900/90 shadow-2xl relative border-emerald-500/30">
                <button
                    onClick={() => {
                        setShow(false);
                        localStorage.setItem("voxlo-install-prompt-seen", "true");
                    }}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                        <Download className="w-6 h-6 text-slate-950" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight">Install App</h3>
                        <p className="text-xs text-slate-400 font-medium">Add to your home screen for the full hyperlocal experience.</p>
                    </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    {platform === "ios" ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-200">
                                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center">
                                    <Share className="w-4 h-4 text-emerald-400" />
                                </div>
                                <span>Tap the <strong>Share</strong> button below</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-200">
                                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center">
                                    <span className="text-emerald-400 font-bold">+</span>
                                </div>
                                <span>Select <strong>Add to Home Screen</strong></span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-200">
                                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-emerald-400 font-bold">⋮</div>
                                <span>Tap the <strong>Menu</strong> icon</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-200">
                                <Download className="w-4 h-4 text-emerald-400" />
                                <span>Select <strong>Install App</strong></span>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => setShow(false)}
                    className="w-full mt-4 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl text-sm uppercase tracking-widest hover:bg-emerald-400 transition-colors"
                >
                    Got it
                </button>
            </div>
        </div>
    );
}
