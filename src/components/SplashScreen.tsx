"use client";

import React, { useState, useEffect, useRef } from "react";

const SplashScreen: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const hasShown = useRef(false);

  useEffect(() => {
    if (hasShown.current) {
      setVisible(false);
      return;
    }
    hasShown.current = true;

    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    const removeTimer = setTimeout(() => setVisible(false), 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#020a06",
        transition: "opacity 500ms ease",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes splash-sweep-rotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes splash-blip-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes splash-ping-expand {
          0% { width: 14px; height: 14px; opacity: 1; }
          100% { width: 80px; height: 80px; opacity: 0; }
        }
      `}</style>

      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", width: "100%", height: "100%", background: "radial-gradient(ellipse 80vw 80vw at 50% 42%, rgba(16,185,129,0.08) 0%, transparent 70%), radial-gradient(ellipse 40vw 60vw at 30% 35%, rgba(5,150,105,0.06) 0%, transparent 60%), radial-gradient(ellipse 40vw 60vw at 70% 50%, rgba(52,211,153,0.04) 0%, transparent 60%)" }} />

        {/* Grain overlay */}
        <div style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.03, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px", zIndex: 30, pointerEvents: "none" }} />

        {/* Radar container */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -52%)" }}>
          {[
            { cls: "r5", size: "82vmin", color: "rgba(16,185,129,0.04)" },
            { cls: "r4", size: "67vmin", color: "rgba(16,185,129,0.08)" },
            { cls: "r3", size: "52vmin", color: "rgba(16,185,129,0.14)" },
            { cls: "r2", size: "37vmin", color: "rgba(16,185,129,0.22)" },
            { cls: "r1", size: "22vmin", color: "rgba(16,185,129,0.35)", shadow: "0 0 30px rgba(16,185,129,0.08)" },
          ].map((r) => (
            <div key={r.cls} style={{ position: "absolute", borderRadius: "50%", border: `1.5px solid ${r.color}`, top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: r.size, height: r.size, boxShadow: r.shadow || "0 0 20px rgba(16,185,129,0.03), inset 0 0 20px rgba(16,185,129,0.02)" }} />
          ))}
          {/* Sweep */}
          <div style={{ position: "absolute", width: "41vmin", height: "41vmin", top: "50%", left: "50%", borderRadius: "50%", background: "conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.15) 30deg, rgba(16,185,129,0.08) 60deg, transparent 90deg)", animation: "splash-sweep-rotate 4s linear infinite" }} />
        </div>

        {/* Blips */}
        {[
          { top: "28%", left: "62%", size: 8, delay: "0s" },
          { top: "58%", left: "30%", size: 6, delay: "0.7s" },
          { top: "24%", left: "38%", size: 7, delay: "1.3s" },
          { top: "48%", left: "72%", size: 5, delay: "0.4s" },
          { top: "64%", left: "58%", size: 8, delay: "1.8s" },
        ].map((b, i) => (
          <div key={i} style={{ position: "absolute", borderRadius: "50%", background: "#10b981", width: b.size, height: b.size, top: b.top, left: b.left, animation: `splash-blip-pulse 2s ease-in-out infinite`, animationDelay: b.delay }} />
        ))}

        {/* Logo mark */}
        <div style={{ position: "relative", zIndex: 20, width: "18vmin", height: "18vmin", minWidth: 100, minHeight: 100, maxWidth: 200, maxHeight: 200, marginBottom: "5vh" }}>
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", filter: "drop-shadow(0 0 30px rgba(16,185,129,0.6)) drop-shadow(0 0 60px rgba(16,185,129,0.3))" }}>
            <path d="M100 160 L100 80" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
            <circle cx="100" cy="72" r="12" fill="#10b981" />
            <path d="M70 110 Q100 70 130 110" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.9" />
            <path d="M54 130 Q100 55 146 130" stroke="#10b981" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
            <path d="M38 150 Q100 40 162 150" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35" />
            <path d="M80 160 L120 160" stroke="#10b981" strokeWidth="5" strokeLinecap="round" />
            <path d="M70 175 L130 175" stroke="#10b981" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          </svg>
          {/* Center ping */}
          <div style={{ position: "absolute", top: "36%", left: "50%", transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 20px #10b981, 0 0 40px rgba(16,185,129,0.6), 0 0 80px rgba(16,185,129,0.3)", zIndex: 25 }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 40, height: 40, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.4)", animation: "splash-ping-expand 2s ease-out infinite" }} />
          </div>
        </div>

        {/* Wordmark area */}
        <div style={{ position: "relative", zIndex: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(48px, 10vw, 144px)", fontWeight: 900, letterSpacing: "clamp(8px, 2vw, 24px)", color: "#f0fdf4", textShadow: "0 0 20px rgba(16,185,129,0.3), 0 0 40px rgba(16,185,129,0.15)" }}>
            V<span style={{ color: "#10b981", textShadow: "0 0 20px rgba(16,185,129,0.8), 0 0 40px rgba(16,185,129,0.5), 0 0 80px rgba(16,185,129,0.3)" }}>O</span>XL<span style={{ color: "#10b981", textShadow: "0 0 20px rgba(16,185,129,0.8), 0 0 40px rgba(16,185,129,0.5), 0 0 80px rgba(16,185,129,0.3)" }}>O</span>
          </div>
          {/* Accent line */}
          <div style={{ width: "clamp(200px, 50vw, 600px)", height: 3, margin: "3vh auto 0", background: "linear-gradient(90deg, transparent, #10b981 30%, #34d399 50%, #10b981 70%, transparent)", boxShadow: "0 0 20px rgba(16,185,129,0.6), 0 0 40px rgba(16,185,129,0.3)", borderRadius: 2 }} />
          {/* Tagline */}
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(14px, 3.5vw, 48px)", fontWeight: 500, letterSpacing: "clamp(4px, 1.5vw, 22px)", color: "rgba(52,211,153,0.7)", textTransform: "uppercase" as const, marginTop: "3vh", textShadow: "0 0 15px rgba(16,185,129,0.3)" }}>
            Hyperlocal Intelligence
          </div>
        </div>

        {/* Corner brackets */}
        {[
          { pos: { top: "5vh", left: "5vw" }, transform: undefined },
          { pos: { top: "5vh", right: "5vw" }, transform: "scaleX(-1)" },
          { pos: { bottom: "5vh", left: "5vw" }, transform: "scaleY(-1)" },
          { pos: { bottom: "5vh", right: "5vw" }, transform: "scale(-1,-1)" },
        ].map((b, i) => (
          <div key={i} style={{ position: "absolute", width: 35, height: 35, zIndex: 20, transform: b.transform, ...b.pos } as React.CSSProperties}>
            <svg viewBox="0 0 50 50" style={{ width: "100%", height: "100%" }}>
              <path d="M0 50 L0 0 L50 0" fill="none" stroke="rgba(16,185,129,0.25)" strokeWidth="1.5" />
            </svg>
          </div>
        ))}

        {/* Tech footer */}
        <div style={{ position: "absolute", bottom: "5vh", display: "flex", gap: 40, zIndex: 20 }}>
          {["Hyperlocal · Intelligence", "v1.2"].map((label) => (
            <div key={label} style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(10px, 1.5vw, 20px)", letterSpacing: 6, color: "rgba(16,185,129,0.25)", textTransform: "uppercase" as const }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
