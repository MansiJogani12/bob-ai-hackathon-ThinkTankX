"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "../../src/lib/store";
import { getDashboard, getRootCauses, type DashboardResponse, type RootCausesResponse } from "../../src/services/api";

/* â”€â”€ Radar sweep animation â”€â”€ */
const radarKeyframes = `
@keyframes radarSweep {
  0%   { transform: translateY(-100%); opacity: 0; }
  50%  { opacity: 0.35; }
  100% { transform: translateY(240px); opacity: 0; }
}
@keyframes beaconPulse {
  0%,100% { transform: scale(1); opacity:0.9; box-shadow:0 0 10px #ef4444; }
  50%      { transform: scale(1.15); opacity:1; box-shadow:0 0 18px #f87171; }
}
@keyframes liveGreenGlow {
  0%,100% { opacity:0.8; box-shadow:0 0 8px #10b981; }
  50%      { opacity:1; box-shadow:0 0 14px #34d399; }
}
@keyframes criticalPulse {
  0%,100% { r: 4; }
  50%     { r: 6.5; }
}
`;

/* â”€â”€ KPI Card â”€â”€ */
function KPICard({ label, value, sub, subColor = "#f59e0b", valueColor = "#fff" }: {
  label: string; value: string; sub: string; subColor?: string; valueColor?: string;
}) {
  return (
    <div style={{
      background: "rgba(10,13,18,0.9)",
      border: "1px solid rgba(30,38,52,1)",
      borderRadius: 12,
      padding: "16px",
      transition: "border-color 0.2s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(48,60,80,1)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(30,38,52,1)")}
    >
      <div style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
        letterSpacing: "0.12em", color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.875rem", fontFamily: "ui-monospace,monospace", fontWeight: 800,
        color: valueColor, letterSpacing: "-0.02em", margin: "4px 0", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: subColor,
        display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontWeight: 500 }}>
        {sub}
      </div>
    </div>
  );
}

/* â”€â”€ Root Cause Bar â”€â”€ */
function RCBar({ rank, label, corr, corrColor, pct, barColor }: {
  rank: string; label: string; corr: string; corrColor: string; pct: number; barColor: string;
}) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { setAnimated(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem",
        fontFamily: "ui-monospace,monospace", marginBottom: 4 }}>
        <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{rank}. {label}</span>
        <span style={{ color: corrColor, fontWeight: 700 }}>{corr}</span>
      </div>
      <div style={{ width: "100%", height: 8, background: "rgba(20,26,36,1)", borderRadius: 999, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: animated ? `${pct}%` : 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: "100%", borderRadius: 999, background: barColor }}
        />
      </div>
    </div>
  );
}

/* â”€â”€ Batch Risk Item â”€â”€ */
function BatchRiskItem({ id, score, badge }: { id: string; score: string; badge: "HIGH" | "MED" | "LOW" }) {
  const badgeStyles: Record<string, { bg: string; color: string; border: string }> = {
    HIGH: { bg: "rgba(127,29,29,0.6)", color: "#f87171", border: "rgba(185,28,28,0.8)" },
    MED:  { bg: "rgba(120,53,15,0.6)", color: "#fb923c", border: "rgba(180,83,9,0.8)"  },
    LOW:  { bg: "rgba(20,83,45,0.6)",  color: "#4ade80", border: "rgba(22,101,52,0.8)" },
  };
  const s = badgeStyles[badge];
  return (
    <div style={{
      background: "rgba(15,20,28,0.9)", border: "1px solid rgba(27,34,48,0.7)", borderRadius: 8,
      padding: "10px", display: "flex", alignItems: "center", justifyContent: "space-between",
      transition: "background 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(20,26,36,0.9)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(15,20,28,0.9)")}
    >
      <div>
        <div style={{ fontFamily: "ui-monospace,monospace", fontSize: "0.75rem", fontWeight: 700, color: "#fff", letterSpacing: "0.05em" }}>{id}</div>
        <div style={{ fontFamily: "ui-monospace,monospace", fontSize: "0.625rem", color: "#94a3b8", marginTop: 2 }}>Risk Score: {score}</div>
      </div>
      <span style={{
        padding: "2px 8px", borderRadius: 4, fontSize: "0.625rem", fontFamily: "ui-monospace,monospace",
        fontWeight: 800, textTransform: "uppercase", background: s.bg, color: s.color,
        border: `1px solid ${s.border}`, boxShadow: badge === "HIGH" ? "0 0 6px rgba(239,68,68,0.2)" : undefined,
      }}>{badge}</span>
    </div>
  );
}

/* â”€â”€ Live latency ticker â”€â”€ */
function useLatency() {
  const [ms, setMs] = useState("1.2");
  useEffect(() => {
    const id = setInterval(() => setMs((1.1 + Math.random() * 0.4).toFixed(1)), 3200);
    return () => clearInterval(id);
  }, []);
  return ms;
}

export default function CommandCenter() {
  const router = useRouter();
  const latency = useLatency();
  const [shift, setShift] = useState(0);
  const { batchResult } = useAppContext();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [rcData, setRcData] = useState<RootCausesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDashboard()
      .then(data => { if (!cancelled) setDashboard(data); })
      .catch(() => { /* dashboard stays null â€” UI shows "--" */ })
      .finally(() => { if (!cancelled) setDashLoading(false); });
    getRootCauses()
      .then(data => { if (!cancelled) setRcData(data); })
      .catch(() => { /* rcData stays null â€” bars show "--" */ });
    return () => { cancelled = true; };
  }, []);

  /* If a real CSV batch has been run, use those values for the top KPIs.
     Otherwise fall back to the /dashboard endpoint values. */
  const yieldPct = batchResult
    ? `${(batchResult.pass_rate ?? 0).toFixed(2)}%`
    : dashboard
    ? `${dashboard.current_yield_pct.toFixed(2)}%`
    : dashLoading ? "..." : "--";

  const failRate = batchResult
    ? `${(batchResult.fail_rate ?? 0).toFixed(2)}%`
    : dashboard
    ? `${Math.abs(dashboard.yield_delta_pct).toFixed(2)}%`
    : dashLoading ? "..." : "--";

  const atRiskVal = batchResult
    ? String(batchResult.fail_count ?? 0)
    : dashboard
    ? String(dashboard.at_risk_lots)
    : dashLoading ? "..." : "--";

  const totalWafers = batchResult ? (batchResult.total_wafers ?? 0) : null;

  /* Dashboard-derived values for widgets below KPIs */
  const activeAlert = dashboard?.active_alert ?? null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: radarKeyframes }} />
      {/* â”€â”€ Scrollable page wrapper â”€â”€ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Page header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.4rem,2.5vw,1.875rem)", fontWeight: 800, color: "#fff",
              letterSpacing: "-0.02em", fontFamily: "Inter,system-ui,sans-serif", margin: 0 }}>
              Command Center
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                letterSpacing: "0.14em", color: "#f59e0b" }}>FAB 01 / 3NM â€¢ LIVE OPERATIONS</span>
              <span style={{ fontSize: "0.6875rem", color: "#374151", fontFamily: "ui-monospace,monospace" }}>//</span>
              <span style={{ fontSize: "0.6875rem", color: "#94a3b8", fontFamily: "ui-monospace,monospace" }}>NODE LOT 4022-X</span>
            </div>
          </div>
          {/* Shift selector */}
          <div style={{ display: "flex", alignItems: "center", background: "rgba(15,20,28,0.9)",
            border: "1px solid rgba(27,34,48,0.8)", borderRadius: 8, padding: 4, gap: 2 }}>
            {["Shift 1 (Active)", "Shift 2", "Shift 3"].map((s, i) => (
              <button key={i} onClick={() => setShift(i)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: "0.6875rem",
                fontFamily: "ui-monospace,monospace", fontWeight: 600, cursor: "pointer",
                background: shift === i ? "rgba(245,158,11,0.2)" : "transparent",
                color: shift === i ? "#fbbf24" : "#94a3b8",
                border: shift === i ? "1px solid rgba(245,158,11,0.3)" : "1px solid transparent",
                transition: "all 0.15s",
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* â”€â”€ 5 KPI Cards â”€â”€ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
          <KPICard label="Current Yield" value={yieldPct} valueColor="#fff"
            sub={<><span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:"#f59e0b", marginRight:4 }} />{batchResult ? `${batchResult.total_wafers} wafers analyzed` : "Awaiting batch data"}</>  as any} />
          <KPICard label="Fail Rate" value={failRate} valueColor={batchResult ? "#ef4444" : "#94a3b8"}
            sub={<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4}}><path d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>{batchResult ? "From batch inference" : "Run CSV batch first"}</>  as any}
            subColor={batchResult ? "#f87171" : "#64748b"} />
          <KPICard label="At Risk Wafers" value={atRiskVal}
            sub={<><span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:"#ef4444", animation:"beaconPulse 2.4s ease-in-out infinite", marginRight:4 }} />{batchResult ? "FAIL predictions" : "Awaiting Data"}</> as any}
            subColor={batchResult ? "#f87171" : "#64748b"} />
          <KPICard label="Total Analyzed" value={totalWafers !== null ? String(totalWafers) : "--"}
            sub={<><span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:"#fbbf24", marginRight:4 }} />{batchResult ? "Wafers in batch" : "Run a batch first"}</> as any}
            subColor="#94a3b8" />
          <KPICard label="Pass Count" value={batchResult ? String(batchResult.pass_count) : "--"} valueColor={batchResult ? "#10b981" : "#94a3b8"}
            sub={<><span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:"#10b981", marginRight:4 }} />{batchResult ? "Cleared wafers" : "Awaiting Data"}</> as any}
            subColor={batchResult ? "#4ade80" : "#64748b"} />
        </div>

        {/* â”€â”€ Middle: Yield Trend + Active Alert â”€â”€ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          {/* Yield trend chart */}
          <div style={{ background: "rgba(10,13,18,0.9)", border: "1px solid rgba(20,26,36,1)",
            borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f1f5f9", fontFamily: "Inter,sans-serif",
                  letterSpacing: "-0.01em", margin: 0 }}>Yield Trend (Last 7 Days)</h3>
                <span style={{ color: "#374151", fontFamily: "ui-monospace,monospace", fontSize: "0.75rem" }}>|</span>
                <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>TARGET: 99.2%</span>
              </div>
              <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:4,
                fontSize:"0.6875rem", fontFamily:"ui-monospace,monospace", fontWeight:500,
                color:"#f87171", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)" }}>
                â–¼ Dropping
              </span>
            </div>

            {/* Chart area */}
            <div style={{ position: "relative", width: "100%", height: 224 }}>
              {/* Radar sweep */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", opacity: 0.2 }}>
                <div style={{ width: "100%", height: 4, background: "linear-gradient(to right, transparent, #f59e0b, transparent)",
                  animation: "radarSweep 6s cubic-bezier(0.4,0,0.2,1) infinite" }} />
              </div>
              <svg viewBox="0 0 740 180" preserveAspectRatio="none" fill="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
                <defs>
                  <linearGradient id="yieldGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.30" />
                    <stop offset="65%" stopColor="#f59e0b" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* Grid lines */}
                <line x1="0" x2="740" y1="20" y2="20" stroke="#1f2937" strokeDasharray="4 4" strokeWidth="1" />
                <text x="690" y="24" fill="#4b5563" fontSize="10" fontFamily="monospace">99.5%</text>
                <line x1="0" x2="740" y1="58" y2="58" stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1" strokeOpacity="0.35" />
                <text x="690" y="62" fill="#ef4444" fontSize="10" fontFamily="monospace">99.0%</text>
                <line x1="0" x2="740" y1="110" y2="110" stroke="#1f2937" strokeDasharray="4 4" strokeWidth="1" />
                <text x="690" y="114" fill="#4b5563" fontSize="10" fontFamily="monospace">97.5%</text>
                <line x1="0" x2="740" y1="160" y2="160" stroke="#1f2937" strokeWidth="1" />
                {/* Area fill */}
                <path d="M 0,60 L 70,60 L 140,64 L 210,61 L 280,72 L 350,75 L 420,98 L 490,104 L 560,128 L 630,146 L 700,165 L 700,180 L 0,180 Z"
                  fill="url(#yieldGrad)" />
                {/* Yield line */}
                <path d="M 0,60 L 70,60 L 140,64 L 210,61 L 280,72 L 350,75 L 420,98 L 490,104 L 560,128 L 630,146 L 700,165"
                  stroke="#f59e0b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                {/* Nodes */}
                <circle cx="210" cy="61" r="3" fill="#f59e0b" stroke="#000" strokeWidth="1.5" />
                <circle cx="420" cy="98" r="3.5" fill="#f59e0b" stroke="#000" strokeWidth="1.5" />
                {/* Critical endpoint */}
                <circle cx="700" cy="165" r="4.5" fill="#ef4444" stroke="#fff" strokeWidth="2">
                  <animate attributeName="r" values="4;6.5;4" dur="2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>

            {/* X-axis labels */}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12,
              borderTop: "1px solid rgba(20,26,36,1)", marginTop: 4 }}>
              {["DAY -6 (09/08)","DAY -5","DAY -4","DAY -3 (SHIFT BAL)","DAY -2","YESTERDAY","TODAY (LIVE)"].map((l, i) => (
                <span key={i} style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace",
                  color: i === 6 ? "#f59e0b" : "#64748b", fontWeight: i === 6 ? 600 : 400 }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Active Alert Card */}
          <div style={{ background: "rgba(10,13,18,0.9)", border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between",
            position: "relative", boxShadow: "0 0 25px rgba(239,68,68,0.08)" }}>
            {/* Radial glow */}
            <div style={{ position: "absolute", top: -32, right: -32, width: 128, height: 128,
              background: "rgba(220,38,38,0.1)", borderRadius: "50%", filter: "blur(32px)", pointerEvents: "none" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#f87171",
                      animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.75 }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", display: "block",
                      position: "relative", animation: "beaconPulse 2.4s ease-in-out infinite" }} />
                  </span>
                  <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                    letterSpacing: "0.1em", color: "#f87171", textTransform: "uppercase" }}>Active Alert</span>
                </div>
                <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", color: "#64748b",
                  textTransform: "uppercase" }}>
                  {activeAlert ? activeAlert.severity : dashLoading ? "..." : "--"}
                </span>
              </div>

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.1em", display: "block" }}>Lot ID</span>
                  <span style={{ fontSize: "1rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                    color: "#fff", letterSpacing: "0.05em" }}>
                    {activeAlert ? activeAlert.lot_id : dashLoading ? "..." : "--"}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.1em", display: "block" }}>Yield Impact</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "ui-monospace,monospace",
                    color: "#ef4444", filter: "drop-shadow(0 0 6px rgba(239,68,68,0.4))" }}>
                    {activeAlert ? activeAlert.yield_impact : dashLoading ? "..." : "--"}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.1em", display: "block" }}>Primary Correlation</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e2e8f0",
                    background: "rgba(20,26,36,0.9)", padding: "4px 8px", borderRadius: 6,
                    border: "1px solid rgba(27,34,48,0.6)", display: "inline-block", marginTop: 2,
                    fontFamily: "Inter,sans-serif" }}>
                    {activeAlert ? activeAlert.primary_correlation : dashLoading ? "..." : "--"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 12 }}>
              <button onClick={() => router.push("/dashboard/rootcause")} style={{
                width: "100%", padding: "10px 16px", borderRadius: 8,
                background: "rgba(127,29,29,0.4)", border: "1px solid rgba(185,28,28,0.5)",
                color: "#fecaca", fontFamily: "ui-monospace,monospace", fontSize: "0.75rem",
                fontWeight: 600, letterSpacing: "0.1em", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s", boxShadow: "0 2px 10px rgba(239,68,68,0.15)",
              }}
                onMouseEnter={e => { e.currentTarget.style.background="rgba(153,27,27,0.6)"; e.currentTarget.style.borderColor="rgba(220,38,38,1)"; e.currentTarget.style.color="#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(127,29,29,0.4)"; e.currentTarget.style.borderColor="rgba(185,28,28,0.5)"; e.currentTarget.style.color="#fecaca"; }}
              >
                <span>Investigate Lot</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* â”€â”€ Bottom: Root Cause Ranking + Upcoming Batch Risk â”€â”€ */}
        <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 20 }}>
          {/* Root Cause Ranking */}
          <div style={{ background: "rgba(10,13,18,0.9)", border: "1px solid rgba(20,26,36,1)",
            borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 220 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f1f5f9",
                  fontFamily: "Inter,sans-serif", letterSpacing: "-0.01em", margin: 0 }}>Root Cause Ranking</h3>
                <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", color: "#f59e0b",
                  background: "rgba(245,158,11,0.1)", padding: "2px 8px", borderRadius: 4,
                  border: "1px solid rgba(245,158,11,0.2)" }}>LIVE DRIFT DETECTED</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                {rcData
                  ? rcData.causes.map(c => {
                      const pct = Math.round(c.correlation * 100);
                      const corrLabel = c.correlation >= 0.8 ? "High" : c.correlation >= 0.6 ? "Med" : "Low";
                      const corrColor = c.correlation >= 0.8 ? "#f87171" : c.correlation >= 0.6 ? "#fbbf24" : "#64748b";
                      const barColor = c.correlation >= 0.8
                        ? "linear-gradient(to right, #f59e0b, #ef4444)"
                        : c.correlation >= 0.6 ? "#f59e0b" : "#64748b";
                      return (
                        <RCBar
                          key={c.rank}
                          rank={String(c.rank)}
                          label={`${c.label} (${c.equipment})`}
                          corr={`r = ${c.correlation.toFixed(2)} (${corrLabel})`}
                          corrColor={corrColor}
                          pct={pct}
                          barColor={barColor}
                        />
                      );
                    })
                  : dashLoading
                  ? [1, 2, 3].map(n => (
                      <div key={n} style={{ height: 28, background: "rgba(20,26,36,0.6)", borderRadius: 4,
                        animation: "radarSweep 2s ease-in-out infinite" }} />
                    ))
                  : <div style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
                      color: "#64748b", padding: "12px 0" }}>Root cause data unavailable</div>
                }
              </div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(20,26,36,1)",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#64748b" }}>
                {rcData
                  ? `Model: ${rcData.model_version}${rcData.model_confidence_pct == null ? "" : ` (Confidence: ${rcData.model_confidence_pct}%)`}`
                  : "Model: Connecting..."}
              </span>
              <button onClick={() => router.push("/dashboard/rootcause")} style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8",
                background: "none", border: "none", padding: 0,
                cursor: "pointer", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f59e0b")}
                onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}>
                Inspect Weights â†’
              </button>
            </div>
          </div>

          {/* Upcoming Batch Risk */}
          <div style={{ background: "rgba(10,13,18,0.9)", border: "1px solid rgba(20,26,36,1)",
            borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f1f5f9",
                  fontFamily: "Inter,sans-serif", letterSpacing: "-0.01em", margin: 0 }}>Upcoming Batch Risk</h3>
                <Link href="/dashboard/batchrisk" style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace",
                  color: "#f59e0b", textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                  transition: "color 0.15s" }}>
                  <span>View All</span><span>â†’</span>
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {batchResult
                  ? (batchResult.wafers ?? []).slice(0, 3).map(w => (
                    <BatchRiskItem
                      key={w.wafer_id}
                      id={w.wafer_id}
                      score={`${w.fail_probability.toFixed(1)}%`}
                      badge={w.fail_probability >= 0.7 ? "HIGH" : w.fail_probability >= 0.4 ? "MED" : "LOW"}
                    />
                  ))
                  : (
                    <div style={{ padding: "20px 0", textAlign: "center",
                      fontFamily: "ui-monospace,monospace", fontSize: "0.65rem",
                      color: "#64748b", letterSpacing: "0.08em" }}>
                      Upload a CSV batch to see wafer risk predictions
                    </div>
                  )
                }
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 8, fontSize: "0.625rem",
              fontFamily: "ui-monospace,monospace", color: "#64748b", textAlign: "right" }}>
              {batchResult
                ? `Queue: ${batchResult.total_wafers} wafers â€” ${batchResult.estimated_execution_time_ms} exec`
                : "Queue Buffer: Awaiting Data"}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

