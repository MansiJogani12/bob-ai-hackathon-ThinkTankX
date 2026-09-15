"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../src/lib/store";
import { supabase } from "../../../src/lib/supabase";
import { getAnalysis } from "../../../src/lib/analysisDb";
import DatasetSelector from "../../components/DatasetSelector";

/* ─── CSS ─────────────────────────────────────────────────────────────── */
const CSS = `
@keyframes pingSmall {
  75%,100% { transform: scale(2); opacity: 0; }
}
@keyframes defPulse {
  0%,100% { opacity: 0.6; } 50% { opacity: 1; }
}
`;

const mono = "ui-monospace,SFMono-Regular,Menlo,monospace";
const MODEL_THRESHOLD = 0.20;

/* ─── Types ───────────────────────────────────────────────────────────── */
interface WaferRow {
  wafer_id: string;
  fail_probability: number;
  pass_probability?: number;
}

interface ProbabilityPattern {
  id: string;
  label: string;
  /** Human-readable description of what this group represents */
  description: string;
  /** Actual records in this group */
  records: WaferRow[];
  /** Fail rate within this group (0–100) */
  failRate: number;
  /** Average fail probability (0–1) */
  avgFailProb: number;
  /** Min / max fail probability in this group */
  probRange: [number, number];
  /** Evidence strength 0–100: based on group size and fail separation */
  evidenceScore: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

/* ─── Build probability-based patterns from real wafer data ───────────── */
/**
 * Groups wafers into statistically distinct probability bands.
 * NO spatial coordinates. NO equipment IDs. NO fake labels.
 * Every value is derived directly from the fail_probability values
 * returned by the existing ML model.
 */
function buildProbabilityPatterns(wafers: WaferRow[]): ProbabilityPattern[] {
  if (!wafers.length) return [];

  const total = wafers.length;

  // Group 1: Predicted FAIL (above model threshold)
  const failGroup = wafers.filter(w => w.fail_probability >= MODEL_THRESHOLD);
  // Group 2: High-risk but below threshold (0.10–0.20)
  const borderGroup = wafers.filter(w => w.fail_probability >= 0.10 && w.fail_probability < MODEL_THRESHOLD);
  // Group 3: Very high confidence fail (≥ 0.50)
  const highConfFail = wafers.filter(w => w.fail_probability >= 0.50);
  // Group 4: Low-risk pass (< 0.05)
  const stablePass = wafers.filter(w => w.fail_probability < 0.05);

  const patterns: ProbabilityPattern[] = [];

  const makePattern = (
    id: string,
    label: string,
    description: string,
    group: WaferRow[],
    severity: "HIGH" | "MEDIUM" | "LOW",
  ): ProbabilityPattern | null => {
    if (!group.length) return null;
    const probs = group.map(w => w.fail_probability);
    const avgProb = probs.reduce((s, v) => s + v, 0) / probs.length;
    const minProb = Math.min(...probs);
    const maxProb = Math.max(...probs);
    const failCount = group.filter(w => w.fail_probability >= MODEL_THRESHOLD).length;
    const failRate = (failCount / group.length) * 100;

    // Evidence score: larger group + higher avg prob = stronger evidence
    // Capped at 95 — we never claim 100% without a proper probability model
    const sizeScore = Math.min(40, (group.length / total) * 200);
    const probScore = Math.min(55, avgProb * 110);
    const evidenceScore = Math.min(95, Math.round(sizeScore + probScore));

    return { id, label, description, records: group, failRate, avgFailProb: avgProb, probRange: [minProb, maxProb], evidenceScore, severity };
  };

  if (failGroup.length > 0) {
    const p = makePattern(
      "grp-fail",
      "PREDICTED FAIL GROUP",
      `Records predicted to fail by model (fail probability ≥ ${(MODEL_THRESHOLD * 100).toFixed(0)}% threshold).`,
      failGroup, "HIGH",
    );
    if (p) patterns.push(p);
  }

  if (highConfFail.length > 0) {
    const p = makePattern(
      "grp-highconf",
      "HIGH-CONFIDENCE FAIL",
      "Records with fail probability ≥ 50% — model is confident these will fail.",
      highConfFail, "HIGH",
    );
    if (p) patterns.push(p);
  }

  if (borderGroup.length > 0) {
    const p = makePattern(
      "grp-border",
      "BORDERLINE RISK",
      `Records near the decision boundary (fail probability 10–${(MODEL_THRESHOLD * 100).toFixed(0)}%). Requires monitoring.`,
      borderGroup, "MEDIUM",
    );
    if (p) patterns.push(p);
  }

  if (stablePass.length > 0) {
    const p = makePattern(
      "grp-stable",
      "STABLE PASS",
      "Records with very low predicted fail probability (< 5%). These are the most stable records in the batch.",
      stablePass, "LOW",
    );
    if (p) patterns.push(p);
  }

  return patterns;
}

/* ─── Probability distribution bar chart ─────────────────────────────── */
function ProbDistChart({ wafers }: { wafers: WaferRow[] }) {
  if (!wafers.length) return null;

  // Build a histogram: 20 buckets from 0 to 1
  const BUCKETS = 20;
  const counts = Array(BUCKETS).fill(0);
  for (const w of wafers) {
    const idx = Math.min(BUCKETS - 1, Math.floor(w.fail_probability * BUCKETS));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);
  const svgH = 120;
  const svgW = 560;
  const barW = Math.floor((svgW - 40) / BUCKETS) - 2;
  const thresholdX = 40 + MODEL_THRESHOLD * (svgW - 40);

  return (
    <div style={{ background: "rgba(10,12,16,1)", borderRadius: 8, border: "1px solid rgba(25,25,36,1)", padding: "12px 16px" }}>
      <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Fail Probability Distribution — {wafers.length} records
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH + 20}`} style={{ width: "100%", overflow: "visible" }}>
        {counts.map((c, i) => {
          const x = 40 + i * ((svgW - 40) / BUCKETS);
          const barH = (c / maxCount) * svgH;
          const probMid = (i + 0.5) / BUCKETS;
          const color = probMid >= MODEL_THRESHOLD ? "#ef4444" : probMid >= 0.10 ? "#fbbf24" : "#10b981";
          return (
            <g key={i}>
              <rect x={x} y={svgH - barH} width={barW} height={barH}
                fill={color} opacity={0.75} rx={1} />
              {c > 0 && (
                <title>{`Prob ${(i / BUCKETS * 100).toFixed(0)}–${((i + 1) / BUCKETS * 100).toFixed(0)}%: ${c} records`}</title>
              )}
            </g>
          );
        })}
        {/* Threshold line */}
        <line x1={thresholdX} y1={0} x2={thresholdX} y2={svgH}
          stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={thresholdX + 3} y={10} fill="rgba(239,68,68,0.8)"
          fontSize="7" fontFamily="monospace">threshold {(MODEL_THRESHOLD * 100).toFixed(0)}%</text>
        {/* X-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(v => {
          const lx = 40 + v * (svgW - 40);
          return (
            <g key={v}>
              <line x1={lx} y1={svgH} x2={lx} y2={svgH + 4} stroke="#374151" strokeWidth={1} />
              <text x={lx} y={svgH + 13} textAnchor="middle"
                fill="#4b5563" fontSize="7" fontFamily="monospace">{(v * 100).toFixed(0)}%</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Pattern detail scatter (prob vs record index) ──────────────────── */
function PatternScatter({ pattern, allWafers }: { pattern: ProbabilityPattern; allWafers: WaferRow[] }) {
  const svgW = 520; const svgH = 140;
  const padL = 36; const padB = 24; const padT = 10; const padR = 10;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  // Show all records in batch, highlight the ones in this pattern
  const patSet = new Set(pattern.records.map(w => w.wafer_id));
  const pts = allWafers.map((w, i) => ({
    x: padL + (i / Math.max(allWafers.length - 1, 1)) * plotW,
    y: padT + (1 - w.fail_probability) * plotH,
    prob: w.fail_probability,
    id: w.wafer_id,
    inPattern: patSet.has(w.wafer_id),
  }));

  const thresholdY = padT + (1 - MODEL_THRESHOLD) * plotH;

  return (
    <div style={{ background: "rgba(10,12,16,1)", borderRadius: 8, border: "1px solid rgba(25,25,36,1)", padding: "12px 16px" }}>
      <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
        Pattern highlight — {pattern.records.length} of {allWafers.length} records
        <span style={{ marginLeft: 12, color: "#94a3b8" }}>
          (amber = this pattern · grey = other records)
        </span>
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%" }}>
        {/* Threshold */}
        <line x1={padL} y1={thresholdY} x2={svgW - padR} y2={thresholdY}
          stroke="rgba(239,68,68,0.4)" strokeDasharray="4 3" strokeWidth={1} />
        <text x={svgW - padR - 2} y={thresholdY - 2} textAnchor="end"
          fill="rgba(239,68,68,0.6)" fontSize="6" fontFamily="monospace">
          {(MODEL_THRESHOLD * 100).toFixed(0)}% threshold
        </text>
        {/* Y grid */}
        {[0, 0.5, 1].map(v => {
          const gy = padT + (1 - v) * plotH;
          return (
            <g key={v}>
              <line x1={padL} y1={gy} x2={svgW - padR} y2={gy}
                stroke="rgba(30,35,45,0.9)" strokeDasharray="3 3" strokeWidth={0.8} />
              <text x={padL - 3} y={gy + 3} textAnchor="end"
                fill="#374151" fontSize="6" fontFamily="monospace">{(v * 100).toFixed(0)}%</text>
            </g>
          );
        })}
        {/* Points: background records first, then pattern records on top */}
        {pts.filter(p => !p.inPattern).map((p, i) => (
          <circle key={`bg-${i}`} cx={p.x} cy={p.y} r={2}
            fill="#374151" opacity={0.5} />
        ))}
        {pts.filter(p => p.inPattern).map((p, i) => (
          <circle key={`fg-${i}`} cx={p.x} cy={p.y} r={3.5}
            fill={p.prob >= MODEL_THRESHOLD ? "#f59e0b" : "#6b7280"} opacity={0.9}>
            <title>{`${p.id}: ${(p.prob * 100).toFixed(1)}%`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* ─── Stat mini-card ──────────────────────────────────────────────────── */
function StatCard({ label, value, color = "#e2e8f0", sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div style={{ background: "rgba(22,22,30,1)", border: "1px solid rgba(37,37,51,1)", borderRadius: 8, padding: 14 }}>
      <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: "1.375rem", fontWeight: 700, color, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: "0.5rem", color: "#64748b", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */
export default function DefectIntelligence() {
  const router = useRouter();
  const { batchResult, activeAnalysisId } = useAppContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedWafers, setSavedWafers] = useState<WaferRow[]>([]);
  const [savedDatasetName, setSavedDatasetName] = useState<string | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  /* ── Load saved analysis when dataset selector changes ── */
  useEffect(() => {
    setSavedWafers([]);
    setSavedDatasetName(null);
    setActiveId(null);          // reset selection on every dataset switch

    if (!activeAnalysisId) return;

    setLoadingSaved(true);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.id) { setLoadingSaved(false); return; }
      const analysis = await getAnalysis(session.user.id, activeAnalysisId);
      if (!analysis) { setLoadingSaved(false); return; }

      const ps = analysis.prediction_summary as Record<string, unknown> | null;
      const w = ps?.["wafers"] as WaferRow[] | undefined;
      if (w?.length) setSavedWafers(w);
      setSavedDatasetName(analysis.dataset_name ?? null);
      setLoadingSaved(false);
    });
  }, [activeAnalysisId]);

  /* ── Resolve active wafer list (priority: saved > live session) ── */
  const wafers: WaferRow[] = useMemo(() => {
    if (activeAnalysisId) return savedWafers;         // saved dataset selected
    return batchResult?.wafers ?? [];                  // live session
  }, [activeAnalysisId, savedWafers, batchResult]);

  const hasBatch = wafers.length > 0;

  /* ── Build patterns from real data ── */
  const patterns = useMemo(() => {
    setActiveId(null);   // reset selection when wafers change
    return buildProbabilityPatterns(wafers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wafers]);

  const effectiveActiveId = activeId ?? (patterns.length > 0 ? patterns[0].id : null);
  const activePat = patterns.find(p => p.id === effectiveActiveId) ?? null;

  /* ── KPI summary ── */
  const totalRecords = wafers.length;
  const totalPredFail = wafers.filter(w => w.fail_probability >= MODEL_THRESHOLD).length;
  const highPatterns = patterns.filter(p => p.severity === "HIGH").length;
  const datasetLabel = activeAnalysisId
    ? (savedDatasetName ?? "Saved analysis")
    : (batchResult ? "Current session batch" : null);

  const severityColor = (s: "HIGH" | "MEDIUM" | "LOW") =>
    s === "HIGH" ? "#f43f5e" : s === "MEDIUM" ? "#fbbf24" : "#34d399";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <DatasetSelector />

        {/* ── Breadcrumb ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.6875rem",
          fontFamily: mono, color: "#64748b", paddingBottom: 12,
          borderBottom: "1px solid rgba(27,27,36,1)" }}>
          <span>PIPELINES</span>
          <span style={{ color: "#374151" }}>/</span>
          <span style={{ color: "#94a3b8" }}>FAIL_PROBABILITY_ANALYSIS</span>
          <span style={{ color: "#374151" }}>/</span>
          <span style={{ color: "#d89b38", fontWeight: 600 }}>PATTERN_CLASSIFIER</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%",
                background: hasBatch ? "#4ade80" : "#f59e0b", display: "inline-block",
                animation: "pingSmall 1s cubic-bezier(0,0,0.2,1) infinite" }} />
              <span>STATUS: <b style={{ color: "#e2e8f0" }}>
                {loadingSaved ? "LOADING…" : hasBatch ? "ACTIVE" : "STANDBY"}
              </b></span>
            </span>
            <span style={{ background: "rgba(20,20,28,1)", padding: "4px 10px", borderRadius: 4,
              border: "1px solid rgba(34,34,47,1)", color: "#cbd5e1" }}>
              RECORDS: <b style={{ color: "#d89b38" }}>{hasBatch ? totalRecords.toLocaleString() : "--"}</b>
            </span>
          </div>
        </div>

        {/* ── Title ── */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em",
              fontFamily: "Inter,sans-serif", margin: 0 }}>Defect Intelligence</h1>
            <p style={{ fontSize: "0.6875rem", fontFamily: mono, letterSpacing: "0.12em",
              color: "#d89b38", textTransform: "uppercase", marginTop: 4 }}>
              FAIL-PROBABILITY PATTERN ANALYSIS
              <span style={{ color: "#64748b", fontFamily: "Inter,sans-serif", textTransform: "none",
                letterSpacing: "normal", marginLeft: 8 }}>
                — {hasBatch
                  ? `${totalRecords.toLocaleString()} records from ${datasetLabel ?? "uploaded batch"}`
                  : "Upload a CSV batch in Data & Reports to enable analysis"}
              </span>
            </p>
          </div>
          <span style={{ fontSize: "0.625rem", fontFamily: mono, color: "#64748b",
            background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)",
            padding: "4px 10px", borderRadius: 4 }}>
            THRESHOLD: {(MODEL_THRESHOLD * 100).toFixed(0)}%
          </span>
        </div>

        {/* ── Spatial disclaimer ── */}
        <div style={{ padding: "8px 14px", borderRadius: 6,
          background: "rgba(15,18,24,0.8)", border: "1px solid rgba(245,158,11,0.15)",
          fontFamily: mono, fontSize: "0.5625rem", color: "#64748b",
          display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.6 }}>
          <span style={{ color: "#fbbf24", flexShrink: 0 }}>ℹ</span>
          <span>
            <b style={{ color: "#94a3b8" }}>Spatial/die-map analysis unavailable.</b>{" "}
            The uploaded dataset contains no wafer coordinates, die positions, or spatial inspection data.
            Patterns below are derived from <b style={{ color: "#e2e8f0" }}>statistical probability groups</b> only.
            Equipment and lot identifiers are also unavailable in this dataset.
          </span>
        </div>

        {/* ── No-data banner ── */}
        {!hasBatch && !loadingSaved && (
          <div style={{
            padding: "16px 20px", borderRadius: 8, background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24",
            fontFamily: mono, fontSize: "0.75rem", letterSpacing: "0.04em",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: "1.25rem" }}>⚠</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>NO BATCH DATA AVAILABLE</div>
              <div style={{ color: "#94a3b8", fontWeight: 400 }}>
                Upload a CSV file via <b style={{ color: "#e2e8f0" }}>Data &amp; Reports (CSV)</b> or select a saved analysis to enable pattern analysis.
              </div>
            </div>
            <button onClick={() => router.push("/dashboard/batch")} style={{
              marginLeft: "auto", padding: "8px 16px", borderRadius: 6, cursor: "pointer",
              background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.5)",
              color: "#fbbf24", fontFamily: mono, fontSize: "0.6875rem",
              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.15)"; }}
            >UPLOAD CSV →</button>
          </div>
        )}

        {/* Loading spinner */}
        {loadingSaved && (
          <div style={{ padding: "24px", textAlign: "center", fontFamily: mono,
            fontSize: "0.6875rem", color: "#64748b", letterSpacing: "0.08em",
            animation: "defPulse 1.4s infinite" }}>
            LOADING SAVED ANALYSIS…
          </div>
        )}

        {/* ── 4 KPI cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[
            {
              label: "TOTAL RECORDS",
              value: hasBatch ? totalRecords.toLocaleString() : "--",
              sub: hasBatch ? `Analyzed from ${datasetLabel ?? "batch"}` : "No batch data",
              alert: false,
            },
            {
              label: "PATTERNS IDENTIFIED",
              value: hasBatch ? String(patterns.length) : "--",
              sub: hasBatch ? "From probability distribution" : "Upload CSV",
              alert: false,
            },
            {
              label: "HIGH-RISK PATTERNS",
              value: hasBatch ? String(highPatterns) : "--",
              sub: hasBatch ? `${totalPredFail} predicted fail records` : "No patterns",
              alert: hasBatch && highPatterns > 0,
            },
            {
              label: "PREDICTED FAIL",
              value: hasBatch ? String(totalPredFail) : "--",
              sub: hasBatch
                ? `${((totalPredFail / totalRecords) * 100).toFixed(1)}% fail rate`
                : "No data",
              alert: hasBatch && totalPredFail > 0,
            },
          ].map((k, i) => (
            <div key={i} style={{
              background: k.alert ? "rgba(21,18,22,1)" : "rgba(18,18,23,1)",
              border: `1px solid ${k.alert ? "rgba(120,53,15,0.3)" : "rgba(29,29,38,1)"}`,
              borderRadius: 8, padding: 16, position: "relative", overflow: "hidden",
              transition: "border-color 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = k.alert ? "rgba(180,83,9,0.5)" : "rgba(43,43,58,1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = k.alert ? "rgba(120,53,15,0.3)" : "rgba(29,29,38,1)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ fontSize: "0.6875rem", fontFamily: mono, textTransform: "uppercase",
                  letterSpacing: "0.1em", color: k.alert ? "#fbbf24" : "#94a3b8", fontWeight: 600 }}>{k.label}</div>
                {k.alert && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b",
                  display: "inline-block", animation: "pingSmall 1.5s ease-in-out infinite" }} />}
              </div>
              <div style={{ fontSize: "1.875rem", fontWeight: 700,
                color: k.alert ? "#fde68a" : "#fff",
                fontFamily: mono, letterSpacing: "-0.02em", marginTop: 6, marginBottom: 4 }}>{k.value}</div>
              <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Probability distribution chart ── */}
        {hasBatch && <ProbDistChart wafers={wafers} />}

        {/* ── Main split: pattern list + detail panel ── */}
        {hasBatch && (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, minHeight: 420 }}>

            {/* Left: pattern list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                  Probability Groups
                </h2>
                <span style={{ fontSize: "0.5625rem", fontFamily: mono, color: "#64748b" }}>
                  {patterns.length} GROUPS
                </span>
              </div>

              {patterns.map(p => {
                const isActive = effectiveActiveId === p.id;
                const sc = severityColor(p.severity);
                return (
                  <button key={p.id} onClick={() => setActiveId(p.id)} style={{
                    width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                    background: isActive ? "rgba(20,20,26,1)" : "rgba(17,17,22,1)",
                    border: isActive ? "2px solid #d89b38" : "1px solid rgba(31,31,42,1)",
                    boxShadow: isActive ? "0 0 15px rgba(216,155,56,0.15)" : "none",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(63,63,84,1)"; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(31,31,42,1)"; } }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: isActive ? "#d89b38" : sc, opacity: isActive ? 1 : 0.7 }} />
                        <span style={{ fontFamily: mono, fontSize: "0.6875rem", fontWeight: 700,
                          color: isActive ? "#fff" : "#d4d4d8", textTransform: "uppercase",
                          letterSpacing: "0.06em" }}>{p.label}</span>
                      </div>
                      <span style={{ fontFamily: mono, fontSize: "0.5625rem", fontWeight: 700,
                        color: sc, background: `${sc}15`, border: `1px solid ${sc}40`,
                        padding: "1px 6px", borderRadius: 3 }}>{p.severity}</span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#71717a", lineHeight: 1.6 }}>
                      {p.records.length} records · fail rate {p.failRate.toFixed(1)}% · avg prob {(p.avgFailProb * 100).toFixed(1)}%
                    </div>
                    {/* Evidence bar */}
                    <div style={{ marginTop: 7, height: 3, background: "rgba(30,38,52,0.8)", borderRadius: 2 }}>
                      <div style={{ height: "100%", borderRadius: 2, background: sc,
                        width: `${p.evidenceScore}%`, opacity: 0.7 }} />
                    </div>
                    <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: "#475569", marginTop: 3 }}>
                      Evidence score: {p.evidenceScore}/100
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: detail panel */}
            <div style={{
              background: "rgba(17,17,22,1)", border: "1px solid rgba(32,32,44,1)",
              borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 20,
            }}>
              {!activePat ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", fontFamily: mono, fontSize: "0.75rem",
                  color: "#64748b", letterSpacing: "0.08em" }}>
                  Select a pattern group to inspect
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div key={activePat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                      paddingBottom: 16, borderBottom: "1px solid rgba(27,27,36,1)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%",
                            background: severityColor(activePat.severity), flexShrink: 0 }} />
                          <h3 style={{ fontFamily: mono, fontSize: "1rem", fontWeight: 700,
                            color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                            {activePat.label}
                          </h3>
                          <span style={{ fontFamily: mono, fontSize: "0.5625rem", fontWeight: 700,
                            color: severityColor(activePat.severity),
                            background: `${severityColor(activePat.severity)}15`,
                            border: `1px solid ${severityColor(activePat.severity)}40`,
                            padding: "2px 7px", borderRadius: 3 }}>{activePat.severity}</span>
                        </div>
                        <p style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                          {activePat.description}
                        </p>
                      </div>
                      <div style={{ background: "rgba(22,22,31,1)", border: "1px solid rgba(43,43,60,1)",
                        borderRadius: 8, padding: "8px 14px", textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: mono, fontSize: "0.4375rem", textTransform: "uppercase",
                          letterSpacing: "0.15em", color: "#d89b38", marginBottom: 2 }}>Evidence Score</div>
                        <div style={{ fontFamily: mono, fontSize: "1.375rem", fontWeight: 700, color: "#fff",
                          letterSpacing: "-0.02em" }}>{activePat.evidenceScore}<span style={{ fontSize: "0.625rem", color: "#64748b" }}>/100</span>
                        </div>
                        <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: "#475569", marginTop: 2 }}>
                          Not a probability — relative ranking only
                        </div>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                      <StatCard
                        label="Records in Group"
                        value={activePat.records.length.toLocaleString()}
                        sub={`${((activePat.records.length / totalRecords) * 100).toFixed(1)}% of batch`}
                      />
                      <StatCard
                        label="Fail Rate"
                        value={`${activePat.failRate.toFixed(1)}%`}
                        color={activePat.failRate >= 50 ? "#f43f5e" : activePat.failRate >= 20 ? "#fbbf24" : "#34d399"}
                        sub={`${activePat.records.filter(w => w.fail_probability >= MODEL_THRESHOLD).length} predicted fail`}
                      />
                      <StatCard
                        label="Avg Fail Probability"
                        value={`${(activePat.avgFailProb * 100).toFixed(1)}%`}
                        color={activePat.avgFailProb >= MODEL_THRESHOLD ? "#f43f5e" : "#fbbf24"}
                        sub={`Range: ${(activePat.probRange[0] * 100).toFixed(1)}–${(activePat.probRange[1] * 100).toFixed(1)}%`}
                      />
                    </div>

                    {/* Pattern scatter highlight */}
                    <PatternScatter pattern={activePat} allWafers={wafers} />

                    {/* Record list (top 10 by fail probability) */}
                    <div style={{ background: "rgba(12,14,19,0.9)", border: "1px solid rgba(25,25,36,1)",
                      borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(20,26,36,1)",
                        fontFamily: mono, fontSize: "0.5625rem", color: "#64748b",
                        textTransform: "uppercase", letterSpacing: "0.1em", display: "flex",
                        justifyContent: "space-between" }}>
                        <span>Top records by fail probability (showing max 10)</span>
                        <span>{activePat.records.length} total in group</span>
                      </div>
                      <div style={{ maxHeight: 180, overflowY: "auto",
                        scrollbarWidth: "thin", scrollbarColor: "rgba(71,85,105,0.4) transparent" }}>
                        {[...activePat.records]
                          .sort((a, b) => b.fail_probability - a.fail_probability)
                          .slice(0, 10)
                          .map((w, i) => {
                            const isFail = w.fail_probability >= MODEL_THRESHOLD;
                            return (
                              <div key={i} style={{
                                display: "grid", gridTemplateColumns: "1fr 120px 80px",
                                padding: "7px 14px", borderBottom: "1px solid rgba(15,18,24,0.8)",
                                fontFamily: mono, fontSize: "0.625rem",
                                background: isFail ? "rgba(239,68,68,0.04)" : "transparent",
                              }}>
                                <span style={{ color: "#94a3b8" }}>{w.wafer_id}</span>
                                <span style={{ color: isFail ? "#f87171" : "#4ade80", fontWeight: 600 }}>
                                  {(w.fail_probability * 100).toFixed(2)}% fail prob
                                </span>
                                <span style={{ color: isFail ? "#f43f5e" : "#34d399", fontWeight: 700,
                                  fontSize: "0.5rem", textAlign: "right" }}>
                                  {isFail ? "⚠ FAIL" : "✓ PASS"}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* CTA */}
                    <button onClick={() => router.push("/dashboard/rootcause")} style={{
                      width: "100%", padding: "12px 16px", borderRadius: 8, cursor: "pointer",
                      background: "#c98e2f", color: "#09090b", fontFamily: mono,
                      fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em",
                      textTransform: "uppercase", border: "none",
                      boxShadow: "0 0 20px rgba(201,142,47,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "background 0.2s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#d89b38"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#c98e2f"; }}
                    >
                      <span>INVESTIGATE ROOT CAUSE FOR {activePat.label}</span>
                      <span>→</span>
                    </button>

                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        )}

        {/* ── Data source note ── */}
        {hasBatch && (
          <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(15,18,24,0.8)",
            border: "1px solid rgba(30,41,59,0.5)", display: "flex", alignItems: "flex-start",
            gap: 10, fontSize: "0.5625rem", fontFamily: mono, color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#fbbf24", flexShrink: 0 }}>ℹ</span>
            <span>
              All patterns are derived from <b style={{ color: "#94a3b8" }}>fail probability scores</b> output by the trained XGBoost model.
              Pattern groups are statistical, not spatial. Evidence score = size × probability weight, capped at 95.
              Equipment/lot/spatial root-cause analysis is unavailable for this dataset.
              Dataset: <b style={{ color: "#e2e8f0" }}>{datasetLabel ?? "uploaded batch"}</b> · {totalRecords.toLocaleString()} records · threshold {(MODEL_THRESHOLD * 100).toFixed(0)}%.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
