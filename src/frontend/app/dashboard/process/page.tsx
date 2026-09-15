"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getRootCauses, type RootCausesResponse } from "../../../src/services/api";
import { useAppContext } from "../../../src/lib/store";
import { getAnalysis } from "../../../src/lib/analysisDb";
import { supabase } from "../../../src/lib/supabase";
import DatasetSelector from "../../components/DatasetSelector";

const CSS = `
@keyframes lineDrawProc {
  from { stroke-dashoffset: 800; }
  to   { stroke-dashoffset: 0; }
}
.regression-line-proc {
  stroke-dasharray: 800;
  animation: lineDrawProc 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes procPulse {
  0%,100% { opacity:0.7; } 50% { opacity:1; }
}
`;

/* ── Design tokens ── */
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const amber = "#f59e0b";

/* ── Scatter point: derived from actual wafer fail_probability ──────────── */
interface ScatterPoint {
  cx: number;
  cy: number;
  failProb: number;
  waferId: string;
}

/** Convert an array of {wafer_id, fail_probability} into SVG scatter coords.
 *  X-axis = wafer index (upload order), Y-axis = fail probability.
 *  SVG viewBox is 0 0 600 420.
 *  Y mapping: failProb=1.0 → cy=padT (top), failProb=0.0 → cy=svgH-padB (bottom).
 *  i.e.  cy = padT + (1 - failProb) * plotH  */
function buildScatterPoints(
  wafers: { wafer_id: string; fail_probability: number }[],
  svgW = 600,
  svgH = 420,
  padL = 60, padR = 30, padT = 20, padB = 40,
): ScatterPoint[] {
  if (!wafers.length) return [];
  const n = wafers.length;
  const plotH = svgH - padT - padB;           // 360
  return wafers.map((w, i) => ({
    cx: padL + (i / Math.max(n - 1, 1)) * (svgW - padL - padR),
    // High fail prob → small cy (near top). Low fail prob → large cy (near bottom).
    cy: padT + (1 - w.fail_probability) * plotH,
    failProb: w.fail_probability,
    waferId: w.wafer_id,
  }));
}

/** Simple linear regression: returns {slope, intercept} for a list of {x,y} */
function linReg(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return null;
  const n = pts.length;
  const sumX = pts.reduce((s, p) => s + p.x, 0);
  const sumY = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/* ── Stat box ── */
function StatBox({ label, value, color = "#f4f4f5", sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)", borderRadius: 12, padding: 16 }}>
      <span style={{ display: "block", fontSize: "0.5625rem", fontFamily: mono, textTransform: "uppercase",
        letterSpacing: "0.12em", color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>{label}</span>
      <div style={{ fontSize: "1.875rem", fontWeight: 900, color, fontFamily: mono, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.5625rem", fontFamily: mono, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── Empty / error state ── */
function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: "60px 32px", textAlign: "center",
      background: "rgba(10,13,18,0.9)", border: "1px solid rgba(30,38,52,1)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: "0.6875rem", fontFamily: mono, color: "#64748b",
        letterSpacing: "0.1em", textTransform: "uppercase" }}>{message}</div>
    </div>
  );
}

export default function ProcessCorrelation() {
  const { batchResult, activeAnalysisId } = useAppContext();
  const [activeDriver, setActiveDriver] = useState(0);
  const [tooltip, setTooltip] = useState<{ waferId: string; failProb: number; px: number; py: number } | null>(null);
  const [rcData, setRcData] = useState<RootCausesResponse | null>(null);
  const [rcLoading, setRcLoading] = useState(true);
  const [rcError, setRcError] = useState<string | null>(null);
  const [savedRcData, setSavedRcData] = useState<RootCausesResponse | null>(null);
  const [savedWafers, setSavedWafers] = useState<{ wafer_id: string; fail_probability: number }[]>([]);
  const [savedDatasetName, setSavedDatasetName] = useState<string | null>(null);

  /* ── When dataset selector changes: reset everything, then load the right source ── */
  useEffect(() => {
    // Reset stale state immediately on every dataset switch
    setActiveDriver(0);
    setTooltip(null);
    setSavedRcData(null);
    setSavedWafers([]);
    setSavedDatasetName(null);
    setRcData(null);
    setRcError(null);

    if (activeAnalysisId) {
      // ── Saved analysis selected: load from Supabase, skip live backend ──
      setRcLoading(true);
      supabase.auth.getSession().then(async ({ data }) => {
        if (!data.session?.user?.id) { setRcLoading(false); return; }
        const analysis = await getAnalysis(data.session.user.id, activeAnalysisId);
        if (!analysis) { setRcLoading(false); return; }

        // Root causes
        const rc = analysis.root_causes;
        if (rc && typeof rc === "object" && "causes" in rc) {
          setSavedRcData(rc as unknown as RootCausesResponse);
        }

        // Wafers
        const ps = analysis.prediction_summary as Record<string, unknown> | null;
        const w = ps?.["wafers"] as { wafer_id: string; fail_probability: number }[] | undefined;
        if (w?.length) setSavedWafers(w);

        setSavedDatasetName(analysis.dataset_name ?? null);
        setRcLoading(false);
      });
    } else {
      // ── Live session: fetch from backend ──
      setRcLoading(true);
      getRootCauses()
        .then(d => { setRcData(d); setRcLoading(false); })
        .catch(e => {
          setRcError(e instanceof Error ? e.message : String(e));
          setRcLoading(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnalysisId]);

  /* ── Priority: saved analysis ALWAYS wins when activeAnalysisId is set ── */
  const effectiveRc: RootCausesResponse | null =
    activeAnalysisId ? savedRcData : rcData;

  /* ── Wafers: saved analysis takes priority when activeAnalysisId is set ── */
  const wafers: { wafer_id: string; fail_probability: number }[] = useMemo(() => {
    if (activeAnalysisId) return savedWafers;          // saved dataset selected
    return batchResult?.wafers ?? [];                   // live session
  }, [activeAnalysisId, savedWafers, batchResult]);

  /* ── Scatter points from real wafer data ── */
  const scatterPts = useMemo(() => buildScatterPoints(wafers), [wafers]);

  /* ── Trend line from actual data ── */
  const trendLine = useMemo(() => {
    if (scatterPts.length < 2) return null;
    const reg = linReg(scatterPts.map(p => ({ x: p.cx, y: p.cy })));
    if (!reg) return null;
    const x1 = 60, x2 = 570;
    return { x1, y1: reg.slope * x1 + reg.intercept, x2, y2: reg.slope * x2 + reg.intercept };
  }, [scatterPts]);

  /* ── Computed stats ── */
  const failCount = useMemo(() => wafers.filter(w => w.fail_probability >= 0.5).length, [wafers]);
  const passCount = wafers.length - failCount;
  const avgFailProb = useMemo(() =>
    wafers.length ? wafers.reduce((s, w) => s + w.fail_probability, 0) / wafers.length : 0,
    [wafers]);
  const yieldPct = wafers.length ? (passCount / wafers.length * 100) : null;
  const failRate = wafers.length ? (failCount / wafers.length * 100) : null;

  /* ── Driver list from backend root causes ── */
  const drivers = effectiveRc
    ? effectiveRc.causes.map(c => ({
        label: c.label,
        tool: c.equipment,
        corr: c.correlation,
        corrColor: c.correlation >= 0.7 ? "#ef4444" : c.correlation >= 0.5 ? "#f59e0b" : "#10b981",
        probability: c.probability,
        deviation: c.deviation,
      }))
    : [];

  const topDriver = drivers[Math.min(activeDriver, Math.max(drivers.length - 1, 0))];
  const noData = !wafers.length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <DatasetSelector />

        {/* ── Title + active dataset banner ── */}
        <header>
          <h1 style={{ fontSize: "clamp(1.5rem,3vw,2.25rem)", fontWeight: 900, color: "#fff",
            letterSpacing: "-0.03em", fontFamily: "Inter,sans-serif", margin: 0 }}>
            Process Correlation
          </h1>
          <p style={{ fontSize: "0.6875rem", fontFamily: mono, textTransform: "uppercase",
            letterSpacing: "0.14em", color: amber, fontWeight: 700, marginTop: 6 }}>
            SENSOR DATA VS YIELD ANALYSIS — REAL BATCH DATA
          </p>
          {/* Active dataset pill */}
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8,
            fontFamily: mono, fontSize: "0.5625rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%",
              background: activeAnalysisId ? amber : "#10b981", flexShrink: 0 }} />
            <span style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Active dataset:
            </span>
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
              {activeAnalysisId
                ? (savedDatasetName ?? "Loading…")
                : (batchResult ? "Current session batch" : "No data")}
            </span>
            {wafers.length > 0 && (
              <span style={{ color: "#64748b" }}>· {wafers.length.toLocaleString()} records</span>
            )}
          </div>
        </header>

        {/* ── No data state ── */}
        {noData && (
          <div style={{
            padding: "20px 24px", borderRadius: 8,
            background: "rgba(30,20,5,0.5)", border: "1px solid rgba(245,158,11,0.35)",
            fontFamily: mono, fontSize: "0.7rem", color: "#fbbf24",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: "1rem" }}>⚠</span>
            <span>
              No batch data — upload a CSV in <strong>Data &amp; Reports</strong> or select a saved dataset above to see real process correlations.
            </span>
          </div>
        )}

        {/* ── 4 KPI cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          <StatBox
            label="Total Wafers"
            value={wafers.length ? wafers.length.toLocaleString() : "--"}
            color="#f4f4f5"
          />
          <StatBox
            label="Yield %"
            value={yieldPct != null ? `${yieldPct.toFixed(1)}%` : "--"}
            color={yieldPct != null ? (yieldPct >= 90 ? "#10b981" : yieldPct >= 70 ? "#f59e0b" : "#ef4444") : "#64748b"}
            sub={passCount > 0 ? `${passCount} PASS` : undefined}
          />
          <StatBox
            label="Fail Rate"
            value={failRate != null ? `${failRate.toFixed(1)}%` : "--"}
            color={failRate != null ? (failRate < 10 ? "#10b981" : failRate < 30 ? "#f59e0b" : "#ef4444") : "#64748b"}
            sub={failCount > 0 ? `${failCount} FAIL` : undefined}
          />
          <StatBox
            label="Avg Fail Probability"
            value={wafers.length ? `${(avgFailProb * 100).toFixed(1)}%` : "--"}
            color={avgFailProb < 0.3 ? "#10b981" : avgFailProb < 0.6 ? "#f59e0b" : "#ef4444"}
          />
        </div>

        {/* ── RC error banner ── */}
        {rcError && !savedRcData && (
          <div style={{
            padding: "10px 16px", borderRadius: 6,
            background: "rgba(30,15,5,0.5)", border: "1px solid rgba(245,158,11,0.3)",
            fontFamily: mono, fontSize: "0.65rem", color: "#fbbf24",
          }}>
            ⚠ Root-cause analysis unavailable: {rcError.includes("404") || rcError.includes("Upload")
              ? "Run a batch prediction first to compute sensor correlations"
              : rcError}
          </div>
        )}

        {/* ── Main 2-col layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 24, alignItems: "start" }}>

          {/* ── Left: Root Cause Drivers ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Threshold summary from real data */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                {
                  label: "Pass Threshold",
                  value: effectiveRc ? "Model-defined" : "--",
                  color: "#10b981",
                  border: "rgba(28,32,43,1)",
                },
                {
                  label: "Fail Count",
                  value: wafers.length ? String(failCount) : "--",
                  color: failCount > 0 ? "#ef4444" : "#10b981",
                  border: failCount > 0 ? "rgba(220,38,38,0.6)" : "rgba(28,32,43,1)",
                },
                {
                  label: "Yield Impact",
                  value: failRate != null ? (failRate >= 20 ? "High" : failRate >= 5 ? "Medium" : "Low") : "--",
                  color: failRate != null ? (failRate >= 20 ? "#ef4444" : failRate >= 5 ? "#f59e0b" : "#10b981") : "#64748b",
                  border: "rgba(28,32,43,1)",
                },
              ].map((k, i) => (
                <div key={i} style={{ background: "rgba(16,18,23,1)", border: `1px solid ${k.border}`, borderRadius: 10, padding: 12 }}>
                  <span style={{ fontSize: "0.5625rem", fontFamily: mono, textTransform: "uppercase",
                    letterSpacing: "0.1em", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 4 }}>{k.label}</span>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: k.color, fontFamily: mono }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Strongest Yield Drivers */}
            <div style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                  Strongest Yield Drivers
                </h2>
                {rcLoading && !effectiveRc && (
                  <span style={{ fontSize: "0.5625rem", fontFamily: mono, color: "#64748b",
                    animation: "procPulse 1.5s infinite" }}>LOADING...</span>
                )}
                {effectiveRc && (
                  <span style={{ fontSize: "0.5625rem", fontFamily: mono, color: "#64748b",
                    background: "rgba(30,38,52,1)", padding: "2px 8px", borderRadius: 3 }}>
                    {effectiveRc.analyzed_parameters.toLocaleString()} params analyzed
                  </span>
                )}
              </div>

              {/* Empty state */}
              {!effectiveRc && !rcLoading && (
                <div style={{ padding: "20px 0", textAlign: "center",
                  fontFamily: mono, fontSize: "0.65rem", color: "#64748b", letterSpacing: "0.06em" }}>
                  Run a batch prediction to compute driver rankings
                </div>
              )}

              {/* Skeleton */}
              {rcLoading && !effectiveRc && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 52, borderRadius: 8,
                      background: "rgba(20,26,36,0.5)", animation: "procPulse 1.6s infinite" }} />
                  ))}
                </div>
              )}

              {/* Driver cards */}
              {effectiveRc && drivers.map((d, i) => {
                const isActive = activeDriver === i;
                return (
                  <div key={i} onClick={() => setActiveDriver(i)} style={{
                    padding: 14, borderRadius: 8, cursor: "pointer", marginBottom: 8,
                    border: isActive ? `1px solid ${amber}` : "1px solid rgba(27,31,42,1)",
                    background: isActive ? "rgba(245,158,11,0.06)" : "rgba(12,14,19,1)",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = "rgba(71,85,105,1)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = "rgba(27,31,42,1)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 600,
                          color: isActive ? "#fff" : "#e2e8f0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.label}
                        </div>
                        <div style={{ fontSize: "0.5625rem", color: "#94a3b8", fontFamily: mono, marginTop: 2 }}>
                          {d.tool || "No equipment data"} · {d.deviation}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0, marginLeft: 12 }}>
                        <span style={{ fontSize: "0.75rem", fontFamily: mono, fontWeight: 700, color: d.corrColor }}>
                          r = {d.corr.toFixed(3)}
                        </span>
                        <span style={{ fontSize: "0.5625rem", fontFamily: mono, color: "#64748b" }}>
                          Score: {d.probability.toFixed(1)}/100
                        </span>
                      </div>
                    </div>
                    {/* Correlation bar */}
                    <div style={{ marginTop: 8, height: 3, background: "rgba(30,38,52,1)", borderRadius: 999 }}>
                      <div style={{ height: "100%", width: `${Math.abs(d.corr) * 100}%`,
                        background: d.corrColor, borderRadius: 999,
                        boxShadow: `0 0 6px ${d.corrColor}66` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Limitations note */}
            {effectiveRc?.limitations && (
              <div style={{ padding: "10px 14px", borderRadius: 6,
                background: "rgba(7,9,13,0.7)", border: "1px solid rgba(30,38,52,1)",
                fontFamily: mono, fontSize: "0.6rem", color: "#4a5568", lineHeight: 1.6 }}>
                ℹ {effectiveRc.limitations[0]}
              </div>
            )}
          </div>

          {/* ── Right: Scatter Chart (real wafer fail probability over time) ── */}
          <div style={{ background: "rgba(16,18,23,1)", border: "1px solid rgba(28,32,43,1)",
            borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", minHeight: 500 }}>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                  {topDriver ? `${topDriver.label} — Fail Probability Distribution` : "Wafer Fail Probability Distribution"}
                </h2>
                <p style={{ fontSize: "0.5625rem", fontFamily: mono, color: "#64748b", marginTop: 4 }}>
                  Each dot = one wafer · X = upload order · Y = predicted fail probability
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.5625rem",
                fontFamily: mono, color: "#94a3b8", flexShrink: 0 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                  FAIL (≥20%)
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  PASS
                </span>
                {trendLine && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 14, height: 2, background: amber, display: "inline-block" }} />
                    Trend
                  </span>
                )}
              </div>
            </div>

            {/* Chart */}
            <div style={{ flex: 1, position: "relative", background: "rgba(10,12,16,1)",
              borderRadius: 8, border: "1px solid rgba(24,27,36,1)", overflow: "hidden", minHeight: 320 }}>

              {/* Tooltip */}
              {tooltip && (
                <div style={{
                  position: "absolute", zIndex: 20, pointerEvents: "none",
                  left: Math.min(tooltip.px + 14, 480), top: Math.max(tooltip.py - 40, 4),
                  background: "rgba(9,13,19,0.98)", border: `1px solid ${amber}`,
                  fontSize: "0.6rem", fontFamily: mono, color: "#fff",
                  padding: "6px 10px", borderRadius: 4,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
                }}>
                  <div style={{ fontWeight: 700, color: amber }}>{tooltip.waferId}</div>
                  <div style={{ color: "#cbd5e1", marginTop: 2 }}>
                    Fail Prob: <strong style={{ color: tooltip.failProb >= 0.20 ? "#f87171" : "#4ade80" }}>
                      {(tooltip.failProb * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <div style={{ color: "#64748b", marginTop: 1 }}>
                    {tooltip.failProb >= 0.20 ? "⚠ FAIL (≥20%)" : "✓ PASS (<20%)"}
                  </div>
                </div>
              )}

              {noData ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", fontFamily: mono, fontSize: "0.6875rem",
                  color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  No data — upload a CSV batch first
                </div>
              ) : (
                <svg viewBox="0 0 600 420" fill="none" style={{ width: "100%", height: "100%" }}>
                  {/* Y-axis grid lines: v=failProb value, cy = 20 + (1-v)*360
                      so v=1.0 → cy=20 (top=100%), v=0.0 → cy=380 (bottom=0%) */}
                  {[0, 0.25, 0.5, 0.75, 1.0].map(v => {
                    // threshold line at model threshold (0.20); otherwise standard grid
                    const MODEL_THRESHOLD = 0.20;
                    const y = 20 + (1 - v) * 360;
                    const label = `${Math.round(v * 100)}%`;
                    const isThreshold = v === MODEL_THRESHOLD;
                    return (
                      <g key={v}>
                        <line x1="55" x2="590" y1={y} y2={y}
                          stroke="rgba(28,32,43,0.9)"
                          strokeDasharray="4 4" strokeWidth="1" />
                        <text x="50" y={y + 4} textAnchor="end" fill="#4a5568"
                          fontSize="9" fontFamily="monospace">{label}</text>
                        {isThreshold && null /* handled separately */}
                      </g>
                    );
                  })}

                  {/* Model threshold line at 20% */}
                  {(() => {
                    const MODEL_THRESHOLD = 0.20;
                    const ty = 20 + (1 - MODEL_THRESHOLD) * 360;
                    return (
                      <g>
                        <line x1="55" x2="590" y1={ty} y2={ty}
                          stroke="rgba(239,68,68,0.45)" strokeDasharray="6 3" strokeWidth="1.5" />
                        <text x="592" y={ty - 3} fill="rgba(239,68,68,0.7)"
                          fontSize="8" fontFamily="monospace" textAnchor="end">20% threshold (model)</text>
                      </g>
                    );
                  })()}

                  {/* Trend line */}
                  {trendLine && (
                    <line
                      key={activeDriver}
                      className="regression-line-proc"
                      x1={trendLine.x1} y1={Math.min(420, Math.max(0, trendLine.y1))}
                      x2={trendLine.x2} y2={Math.min(420, Math.max(0, trendLine.y2))}
                      stroke={amber} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"
                      strokeDasharray="6 3"
                    />
                  )}

                  {/* Scatter dots — subsample if > 300 wafers for perf */}
                  {(scatterPts.length > 300
                    ? scatterPts.filter((_, i) => i % Math.ceil(scatterPts.length / 300) === 0)
                    : scatterPts
                  ).map((p, i) => {
                    const isFail = p.failProb >= 0.20;
                    const color = isFail ? "#ef4444" : "#10b981";
                    return (
                      <motion.circle
                        key={`${activeDriver}-${i}`}
                        cx={p.cx} cy={p.cy} r={6}
                        fill={color} fillOpacity={isFail ? 0.8 : 0.55}
                        stroke={isFail ? "#f87171" : "#34d399"} strokeWidth="0.5"
                        style={{ cursor: "pointer" }}
                        whileHover={{ r: 9, fillOpacity: 1 } as never}
                        onMouseEnter={e => {
                          const svg = (e.target as SVGCircleElement).ownerSVGElement!;
                          const rect = svg.getBoundingClientRect();
                          setTooltip({
                            waferId: p.waferId,
                            failProb: p.failProb,
                            px: (p.cx / 600) * rect.width,
                            py: (p.cy / 420) * rect.height,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </svg>
              )}
            </div>

            {/* Footer stats */}
            <div style={{
              marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(24,27,36,1)",
              display: "flex", flexWrap: "wrap", alignItems: "center",
              justifyContent: "space-between", gap: 12,
              fontSize: "0.6875rem", fontFamily: mono, color: "#94a3b8",
            }}>
              <div style={{ display: "flex", gap: 20 }}>
                <span>
                  <span style={{ color: "#64748b" }}>Wafers: </span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{wafers.length || "--"}</span>
                </span>
                <span>
                  <span style={{ color: "#64748b" }}>Yield: </span>
                  <span style={{ color: "#10b981", fontWeight: 600 }}>
                    {yieldPct != null ? `${yieldPct.toFixed(1)}%` : "--"}
                  </span>
                </span>
                <span>
                  <span style={{ color: "#64748b" }}>Fail: </span>
                  <span style={{ color: "#ef4444", fontWeight: 600 }}>
                    {failCount || "--"}
                  </span>
                </span>
              </div>
              {topDriver && (
                <span>
                  <span style={{ color: "#64748b" }}>Top driver: </span>
                  <span style={{ color: amber, fontWeight: 600 }}>{topDriver.label}</span>
                  <span style={{ color: "#64748b", marginLeft: 6 }}>r = {topDriver.corr.toFixed(3)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom: Full root cause table ── */}
        {effectiveRc && effectiveRc.causes.length > 0 && (
          <div style={{ background: "rgba(10,13,18,0.9)", border: "1px solid rgba(30,38,52,1)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(20,26,36,1)",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                Full Root Cause Rankings
              </h3>
              <span style={{ fontSize: "0.5625rem", fontFamily: mono, color: "#64748b" }}>
                {effectiveRc.model_version} · {effectiveRc.analyzed_parameters} parameters
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 120px 120px 100px 80px",
              padding: "8px 20px", background: "rgba(0,0,0,0.3)",
              borderBottom: "1px solid rgba(20,26,36,1)",
              fontFamily: mono, fontSize: "0.5rem", textTransform: "uppercase",
              letterSpacing: "0.12em", color: "#52525b" }}>
              <span>#</span><span>Sensor / Feature</span>
              <span>Correlation r</span><span>Evidence Score</span>
              <span>Deviation</span><span>Rank</span>
            </div>
            {effectiveRc.causes.map((c, i) => {
              const corrColor = c.correlation >= 0.7 ? "#f87171" : c.correlation >= 0.5 ? "#fbbf24" : "#4ade80";
              return (
                <div key={i} onClick={() => setActiveDriver(i)} style={{
                  display: "grid", gridTemplateColumns: "40px 1fr 120px 120px 100px 80px",
                  padding: "10px 20px", borderBottom: "1px solid rgba(20,26,36,0.5)",
                  fontFamily: mono, fontSize: "0.75rem", cursor: "pointer",
                  background: activeDriver === i ? "rgba(245,158,11,0.05)" : "transparent",
                  transition: "background 0.15s",
                }}
                  onMouseEnter={e => { if (activeDriver !== i) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = activeDriver === i ? "rgba(245,158,11,0.05)" : "transparent"; }}
                >
                  <span style={{ color: "#52525b" }}>{c.rank}</span>
                  <span style={{ color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.label}</span>
                  <span style={{ color: corrColor, fontWeight: 700 }}>{c.correlation.toFixed(4)}</span>
                  <span style={{ color: "#94a3b8" }}>{c.probability.toFixed(1)}/100</span>
                  <span style={{
                    fontSize: "0.5625rem", padding: "2px 8px", borderRadius: 3,
                    background: c.deviation === "HIGH" ? "rgba(239,68,68,0.12)" : c.deviation === "MEDIUM" ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)",
                    color: c.deviation === "HIGH" ? "#f87171" : c.deviation === "MEDIUM" ? "#fbbf24" : "#4ade80",
                    border: c.deviation === "HIGH" ? "1px solid rgba(239,68,68,0.3)" : c.deviation === "MEDIUM" ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(16,185,129,0.3)",
                    display: "inline-block",
                  }}>{c.deviation}</span>
                  <span style={{ color: activeDriver === i ? amber : "#64748b", fontWeight: activeDriver === i ? 700 : 400 }}>
                    {activeDriver === i ? "ACTIVE" : `#${c.rank}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </>
  );
}
