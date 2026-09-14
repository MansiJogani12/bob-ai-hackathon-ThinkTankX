"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getRootCauses, type RootCausesResponse } from "../../../src/services/api";

const CSS = `
@keyframes lineDrawProc {
  from { stroke-dashoffset: 800; }
  to   { stroke-dashoffset: 0; }
}
.regression-line-proc {
  stroke-dasharray: 800;
  animation: lineDrawProc 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

/* Scatter visual coordinates — fixed SVG positions that represent the
   negative correlation trend. Lot labels are spliced in from the API
   historical_lots array so tooltips show real lot IDs. */
const SCATTER_CX_CY = [
  {cx:85,cy:75},{cx:102,cy:74},{cx:98,cy:94},{cx:132,cy:74},{cx:148,cy:75},
  {cx:162,cy:108},{cx:190,cy:190},{cx:180,cy:202},{cx:204,cy:202},{cx:120,cy:148},
  {cx:132,cy:158},{cx:145,cy:178},{cx:160,cy:206},{cx:180,cy:225},{cx:230,cy:225},
  {cx:250,cy:255},{cx:270,cy:245},{cx:295,cy:230},{cx:318,cy:255},{cx:330,cy:290},
  {cx:348,cy:300},{cx:370,cy:328},{cx:390,cy:310},{cx:410,cy:335},{cx:425,cy:355},
  {cx:440,cy:370},{cx:448,cy:405},{cx:465,cy:405},{cx:482,cy:405},{cx:470,cy:365},
  {cx:492,cy:380},{cx:505,cy:405},
];

export default function ProcessCorrelation() {
  const [activeDriver, setActiveDriver] = useState(0);
  const [tooltip, setTooltip] = useState<{ lot: string; x: string; y: string; px: number; py: number } | null>(null);
  const [rcData, setRcData] = useState<RootCausesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRootCauses()
      .then(d => { if (!cancelled) setRcData(d); })
      .catch(() => { /* drivers fall back to "--" */ });
    return () => { cancelled = true; };
  }, []);

  /* Build driver list from API or show placeholder while loading */
  const drivers = rcData
    ? rcData.causes.map(c => ({
        label: c.label,
        tool:  c.equipment,
        corr:  -Math.abs(c.correlation),  // show as negative (higher param → lower yield)
        corrColor: c.correlation >= 0.7 ? "#ef4444" : c.correlation >= 0.5 ? "#f59e0b" : "#10b981",
        lots: c.historical_lots,           // real lot IDs from API
      }))
    : [
        { label: "Loading...", tool: "...", corr: 0, corrColor: "#64748b", lots: [] as string[] },
      ];

  /* Top driver for the scatter chart header */
  const topDriver = drivers[Math.min(activeDriver, drivers.length - 1)];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Title ── */}
        <header>
          <h1 style={{ fontSize: "clamp(1.5rem,3vw,2.25rem)", fontWeight: 900, color: "#fff",
            letterSpacing: "-0.03em", fontFamily: "Inter,sans-serif", margin: 0 }}>Process Correlation</h1>
          <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
            letterSpacing: "0.14em", color: "#E5A93C", fontWeight: 700, marginTop: 6 }}>
            SENSOR DATA VS YIELD ANALYSIS
          </p>
        </header>

        {/* ── 3 summary KPI cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            { label: "PARAMETERS ANALYZED", value: rcData ? rcData.analyzed_parameters.toLocaleString() : "..." },
            { label: "EQUIPMENT TOOLS",      value: rcData ? String(rcData.causes.length) : "..."    },
            { label: "ANALYZED LOT",         value: rcData ? rcData.lot_id : "..."  },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)",
              borderRadius: 12, padding: 20 }}>
              <span style={{ display: "block", fontSize: "0.625rem", fontFamily: "ui-monospace,monospace",
                textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>{k.label}</span>
              <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#fff", fontFamily: "ui-monospace,monospace",
                letterSpacing: "-0.03em" }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Lower 2-col layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 24, alignItems: "start" }}>

          {/* Left: sensor thresholds + drivers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Threshold cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)", borderRadius: 12, padding: 14 }}>
                <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                  letterSpacing: "0.1em", color: "#94a3b8", fontWeight: 600, display: "block" }}>Normal Range</span>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#10b981", fontFamily: "ui-monospace,monospace", marginTop: 4 }}>
                  120-125 <span style={{ fontSize: "0.625rem", fontWeight: 400, color: "#94a3b8" }}>mTorr</span>
                </div>
              </div>
              <div style={{ background: "rgba(20,18,23,1)", border: "1px solid rgba(220,38,38,0.8)",
                borderRadius: 12, padding: 14, boxShadow: "0 0 0 1px rgba(220,38,38,0.3)" }}>
                <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                  letterSpacing: "0.1em", color: "#94a3b8", fontWeight: 600, display: "block" }}>Observed</span>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#ef4444", fontFamily: "ui-monospace,monospace", marginTop: 4 }}>
                  131 <span style={{ fontSize: "0.625rem", fontWeight: 400, color: "#94a3b8" }}>mTorr</span>
                </div>
              </div>
              <div style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)", borderRadius: 12, padding: 14 }}>
                <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                  letterSpacing: "0.1em", color: "#94a3b8", fontWeight: 600, display: "block" }}>Yield Impact</span>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#fff", fontFamily: "ui-monospace,monospace",
                  marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  High
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                </div>
              </div>
            </div>

            {/* Strongest yield drivers */}
            <div style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)", borderRadius: 12, padding: 20 }}>
              <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: "0 0 16px" }}>Strongest Yield Drivers</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {drivers.map((d, i) => {
                  const isActive = activeDriver === i;
                  return (
                    <div key={i} onClick={() => setActiveDriver(i)} style={{
                      padding: 14, borderRadius: 8, cursor: "pointer",
                      border: isActive ? "1px solid #B88728" : "1px solid rgba(27,31,42,1)",
                      background: isActive ? "rgba(23,22,24,1)" : "rgba(12,14,19,1)",
                      boxShadow: isActive ? "0 4px 20px rgba(229,169,60,0.05)" : "none",
                      transition: "all 0.2s",
                    }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = "rgba(71,85,105,1)"; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = "rgba(27,31,42,1)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: isActive ? "#fff" : "#e2e8f0" }}>{d.label}</div>
                          <div style={{ fontSize: "0.625rem", color: "#94a3b8", fontFamily: "ui-monospace,monospace", marginTop: 2 }}>{d.tool}</div>
                        </div>
                        <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", fontWeight: 700, color: d.corrColor }}>
                          {d.corr.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: scatter plot */}
          <div style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)",
            borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", minHeight: 500, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                {topDriver.label} vs. Yield
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "0.625rem",
                fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E5A93C", display: "inline-block" }} />Historical Lots
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 2, background: "#ef4444", display: "inline-block" }} />Trend ({topDriver.corr.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Chart area */}
            <div style={{ position: "relative", flex: 1, background: "rgba(10,12,16,1)",
              borderRadius: 8, border: "1px solid rgba(24,27,36,1)", overflow: "hidden", padding: 16 }}>
              {/* Tooltip */}
              {tooltip && (
                <div style={{
                  position: "absolute", zIndex: 20, pointerEvents: "none",
                  left: tooltip.px + 15, top: tooltip.py - 35,
                  background: "rgba(22,25,34,1)", border: "1px solid #E5A93C",
                  fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", color: "#fff",
                  padding: "6px 10px", borderRadius: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                }}>
                  <div style={{ fontWeight: 700, color: "#E5A93C" }}>Lot: #{tooltip.lot}</div>
                  <div style={{ color: "#cbd5e1" }}>Etch: {tooltip.x} mTorr | Yield: {tooltip.y}%</div>
                </div>
              )}
              <svg viewBox="0 0 600 450" fill="none" style={{ width: "100%", height: "100%" }}>
                {/* grid lines */}
                <line x1="330" x2="330" y1="30" y2="410" stroke="#1D222E" strokeDasharray="4 4" strokeWidth="1.5" />
                <line x1="40" x2="570" y1="260" y2="260" stroke="#1D222E" strokeDasharray="4 4" strokeWidth="1.5" />
                {/* regression line - dynamic based on correlation direction */}
                <line key={activeDriver} className="regression-line-proc"
                  x1="130" x2="490"
                  y1={topDriver.corr < 0 ? "75" : "380"}
                  y2={topDriver.corr < 0 ? "380" : "75"}
                  stroke={topDriver.corr < 0 ? "#ef4444" : "#10b981"} strokeWidth="2.5" strokeLinecap="round" />
                {/* scatter points — dynamic Y position based on correlation */}
                {SCATTER_CX_CY.map((p, i) => {
                  const activeLots = topDriver.lots ?? [];
                  const lotLabel = activeLots[i % Math.max(activeLots.length, 1)] ?? `LOT-${9821 + i}`;
                  const dynamicCy = topDriver.corr < 0 ? p.cy : 450 - p.cy;
                  return (
                    <circle key={`${activeDriver}-${i}`} cx={p.cx} cy={dynamicCy} r={i >= 26 ? 8 : 7.5}
                      fill={topDriver.corr < 0 ? "#D99B35" : "#34d399"} fillOpacity="0.85" style={{ cursor: "pointer", transition: "all 0.3s ease" }}
                      onMouseEnter={e => {
                        (e.target as SVGCircleElement).setAttribute("r", "10");
                        const svg = (e.target as SVGCircleElement).ownerSVGElement!;
                        const rect = svg.getBoundingClientRect();
                        const svgW = rect.width, svgH = rect.height;
                        const px = (p.cx / 600) * svgW;
                        const py = (dynamicCy / 450) * svgH;
                        setTooltip({ lot: lotLabel, x: "--", y: "--", px, py });
                      }}
                      onMouseLeave={e => {
                        (e.target as SVGCircleElement).setAttribute("r", i >= 26 ? "8" : "7.5");
                        setTooltip(null);
                      }}
                    />
                  );
                })}
              </svg>
              {/* axis labels */}
              <span style={{ position: "absolute", left: 2, top: "50%", transform: "translateY(-50%) rotate(-90deg)",
                fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", letterSpacing: "0.1em",
                color: "#64748b", textTransform: "uppercase" }}>Yield %</span>
              <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
                fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", letterSpacing: "0.1em",
                color: "#64748b", textTransform: "uppercase" }}>Parameter Value</span>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(24,27,36,1)",
              display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
              fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#64748b" }}>Correlation r:</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>
                  {topDriver.corr.toFixed(2)} — {Math.abs(topDriver.corr) > 0.7 ? "Strong" : Math.abs(topDriver.corr) > 0.5 ? "Moderate" : "Weak"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#64748b" }}>Lot:</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>
                  {rcData ? rcData.lot_id : "..."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
