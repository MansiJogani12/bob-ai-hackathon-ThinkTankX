"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../../src/lib/store";

/* ── CSS keyframes + light-mode filter ── */
const globalStyles = `
@keyframes pingAnim {
  75%, 100% { transform: scale(2); opacity: 0; }
}
@keyframes liveGreenGlow {
  0%,100% { opacity:0.8; box-shadow:0 0 8px #10b981; }
  50%      { opacity:1; box-shadow:0 0 14px #34d399; }
}
@keyframes beaconPulse {
  0%,100% { transform: scale(1); opacity:0.9; box-shadow:0 0 10px #ef4444; }
  50%      { transform: scale(1.15); opacity:1; box-shadow:0 0 18px #f87171; }
}

/* Light-mode: invert the whole shell, then counter-rotate hues so
   amber/green/red stay recognisable. SVGs and images get un-inverted. */
[data-theme="light"] {
  filter: invert(1) hue-rotate(180deg);
}
[data-theme="light"] img,
[data-theme="light"] video,
[data-theme="light"] svg image {
  filter: invert(1) hue-rotate(180deg);
}
`;

/* ── Nav items matching Stitch reference ── */
const NAV = [
  {
    href: "/dashboard",
    label: "Command Center",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/batch",
    label: "Data & Reports (CSV)",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/wafer",
    label: "Single Wafer Prediction",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
        <path d="M12 7v10M7 12h10" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/defects",
    label: "Defect Intelligence",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/process",
    label: "Process Correlation",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/rootcause",
    label: "Root Cause Analysis",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/batchrisk",
    label: "Batch Risk Prediction",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/corrective",
    label: "Corrective Actions",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    ),
  },
];

/* ── Live latency ticker ── */
function useLatency() {
  const [ms, setMs] = useState("1.2");
  useEffect(() => {
    const id = setInterval(() => setMs((1.1 + Math.random() * 0.4).toFixed(1)), 3200);
    return () => clearInterval(id);
  }, []);
  return ms;
}

/* ── Live clock ── */
function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const latency = useLatency();
  const clock = useClock();
  const { isBackendOnline: backendOnline } = useStore();

  /* ── Theme toggle ── */
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("yieldsentinel_theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);
  function toggleTheme() {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("yieldsentinel_theme", next);
      return next;
    });
  }
  const isDark = theme === "dark";

  /* Derive dot color: null = checking (amber), true = green, false = red */
  const dotColor = backendOnline === null ? "#f59e0b" : backendOnline ? "#10b981" : "#ef4444";
  const dotPulse = backendOnline === null ? "pingAnim" : backendOnline ? "liveGreenGlow" : "beaconPulse";
  const connLabel = backendOnline === null
    ? "CONNECTING..."
    : backendOnline
    ? `CONNECTED // ${latency}MS`
    : "BACKEND OFFLINE";
  const connColor = backendOnline === null
    ? "rgba(245,158,11,0.9)"
    : backendOnline
    ? "rgba(52,211,153,0.9)"
    : "rgba(239,68,68,0.9)";

  return (
    <div data-theme={theme} style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#07090d",
      backgroundImage: "linear-gradient(to right,rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.02) 1px,transparent 1px)",
      backgroundSize: "32px 32px",
      fontFamily: "Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    }}>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 256, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "rgba(9,13,19,0.95)", borderRight: "1px solid rgba(30,38,52,0.6)",
        backdropFilter: "blur(12px)", zIndex: 20, padding: 16, minHeight: "100vh",
      }}>
        <div>
          {/* Brand */}
          <div style={{ marginBottom: 24, padding: "8px 12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{
                fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
                fontSize: "0.8125rem", letterSpacing: "0.1em", fontWeight: 800,
                color: "#f59e0b",
                textShadow: "0 0 10px rgba(245,158,11,0.4)",
              }}>
                YIELD//INTELLIGENCE
              </span>

            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}>
                <span style={{
                  position: "absolute", inset: 0, borderRadius: "50%", background: dotColor,
                  opacity: 0.75, animation: `${dotPulse} 1s cubic-bezier(0,0,0.2,1) infinite`,
                }} />
                <span style={{
                  position: "relative", width: 8, height: 8, borderRadius: "50%", background: dotColor,
                  display: "block", animation: `${dotPulse} 2.2s infinite`,
                }} />
              </span>
              <span style={{
                fontSize: "0.625rem", letterSpacing: "0.15em", color: connColor,
                fontFamily: "ui-monospace,monospace", fontWeight: 600,
              }}>
                {connLabel}
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map((n) => {
              const active = path === n.href;
              return (
                <Link key={n.href} href={n.href} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                    background: active
                      ? "linear-gradient(to right, rgba(245,158,11,0.15), rgba(245,158,11,0.05), transparent)"
                      : "transparent",
                    borderLeft: `2px solid ${active ? "#f59e0b" : "transparent"}`,
                    color: active ? "#fbbf24" : "#94a3b8",
                    boxShadow: active ? "inset 0 1px 1px rgba(255,255,255,0.06)" : undefined,
                  }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.background = "rgba(20,26,36,0.6)"; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "transparent"; } }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: active ? "#fbbf24" : "#64748b", display: "flex", transition: "transform 0.15s", width: 16, height: 16 }}>
                        {n.icon}
                      </span>
                      <span style={{
                        fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", fontWeight: 500,
                        letterSpacing: "0.03em",
                      }}>{n.label}</span>
                    </div>
                    {active && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fbbf24",
                        boxShadow: "0 0 8px #f59e0b", flexShrink: 0 }} />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: FAB status widget */}
        <div style={{ marginTop: 24 }}>
          {/* FAB node card */}
          <div style={{
            borderRadius: 12, padding: 12,
            background: "rgba(10,13,18,0.8)", border: "1px solid rgba(30,38,52,0.7)",
            position: "relative", overflow: "hidden", transition: "border-color 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(30,38,52,0.7)")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", marginBottom: 6 }}>
              <span style={{ color: "rgba(245,158,11,0.9)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                FAB 01 / 3NM
              </span>
              <span style={{ color: "#4ade80", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                99.8% UP
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e2e8f0" }}>Live Production Line</div>
            <div style={{ marginTop: 8, fontSize: "0.625rem", color: "#64748b", fontFamily: "ui-monospace,monospace" }}>
              ASML EUV Twinscan NXE:3600D
            </div>
          </div>

          {/* Operator badge */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(20,26,36,1)",
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "linear-gradient(to top right, #d97706, #fbbf24)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "ui-monospace,monospace", fontSize: "0.625rem", fontWeight: 700,
                color: "#000", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
              }}>N</div>
              <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>
                OPERATOR-91
              </span>
            </div>
            <span style={{
              fontSize: "0.5625rem", padding: "2px 6px", borderRadius: 4,
              background: "rgba(20,26,36,1)", color: "#94a3b8", fontFamily: "ui-monospace,monospace",
            }}>SECURE</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0,
        background: "rgba(7,9,13,0.8)", backdropFilter: "blur(4px)" }}>

        {/* Telemetry ribbon */}
        <header style={{
          height: 48, borderBottom: "1px solid rgba(20,26,36,0.8)",
          background: "rgba(10,13,18,0.4)", padding: "0 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: "#64748b" }}>ENVIRONMENT:</span>
            <span style={{ color: "#cbd5e1", fontWeight: 600 }}>CLEANROOM CLASS 1 (ISO 3)</span>
            <span style={{ color: "rgba(20,26,36,1)", fontSize: "1rem" }}>|</span>
            <span style={{ color: "#64748b" }}>CHAMBER TEMP:</span>
            <span style={{ color: "#fbbf24" }}>21.4°C ±0.02</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              padding: "2px 8px", borderRadius: 4,
              background: "rgba(20,26,36,1)", border: "1px solid rgba(30,38,52,1)",
              color: "#cbd5e1",
            }}>AUTO-SYNC: 1s</span>
            <span style={{ color: "#4ade80", fontWeight: 500 }}>TELEMETRY STABLE</span>
            {/* ── Theme toggle pill ── */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 42, height: 22, borderRadius: 999, cursor: "pointer",
                border: "1px solid rgba(71,85,105,0.5)",
                background: isDark ? "rgba(15,20,28,0.9)" : "rgba(251,191,36,0.15)",
                padding: 0, flexShrink: 0, position: "relative", transition: "all 0.25s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.7)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(71,85,105,0.5)"; }}
            >
              {/* Track fill */}
              <span style={{
                position: "absolute", inset: 0, borderRadius: 999,
                background: isDark ? "transparent" : "rgba(245,158,11,0.22)",
                transition: "background 0.25s",
              }} />
              {/* Thumb */}
              <span style={{
                position: "absolute",
                left: isDark ? 3 : 21,
                width: 14, height: 14, borderRadius: "50%",
                background: isDark ? "#64748b" : "#f59e0b",
                boxShadow: isDark ? "none" : "0 0 6px rgba(245,158,11,0.6)",
                transition: "left 0.25s, background 0.25s, box-shadow 0.25s",
              }} />
              {/* Moon / Sun icon */}
              <span style={{
                position: "absolute",
                right: isDark ? 4 : "auto",
                left: isDark ? "auto" : 4,
                fontSize: "0.5rem", lineHeight: 1,
                transition: "opacity 0.2s",
              }}>
                {isDark ? "🌙" : "☀️"}
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
