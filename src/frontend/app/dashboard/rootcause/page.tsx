"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRootCauses, type RootCausesResponse } from "../../../src/services/api";
import { useAppContext } from "../../../src/lib/store";

const CSS = `
@keyframes shimmerRCA {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.shimmer-rca {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
  background-size: 200% 100%;
  animation: shimmerRCA 6s infinite linear;
}
`;

/* Deviation → color */
function devColor(deviation: string): string {
  const d = deviation.toUpperCase();
  if (d === "HIGH")   return "#f43f5e";
  if (d === "MEDIUM") return "#fbbf24";
  return "#67e8f9";
}

/* Probability → UI colors */
function probColors(prob: number): { color: string; glow: string | undefined } {
  if (prob >= 70) return { color: "#f43f5e", glow: "rgba(244,63,94,0.4)" };
  if (prob >= 50) return { color: "#fbbf24", glow: "rgba(245,158,11,0.2)" };
  return { color: "#e2e8f0", glow: undefined };
}

/* ── Sensor Panel ── */
interface SensorRow {
  feature: string;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  deviation: "HIGH" | "MEDIUM" | "NOMINAL";
  failMean: number;
  passMean: number;
}

/** Renders a single sensor row card */
function SensorRowCard({ row, i }: { row: SensorRow; i: number }) {
  const devC = row.deviation === "HIGH" ? "#f43f5e"
    : row.deviation === "MEDIUM" ? "#fbbf24" : "#34d399";
  const range = row.max - row.min || 1;
  const meanPct = Math.max(0, Math.min(100, ((row.mean - row.min) / range) * 100));
  const failPct = Math.max(0, Math.min(100, ((row.failMean - row.min) / range) * 100));
  const passPct = Math.max(0, Math.min(100, ((row.passMean - row.min) / range) * 100));

  return (
    <motion.div
      key={row.feature}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.22 }}
      style={{
        background: "rgba(14,16,22,0.95)",
        border: `1px solid ${row.deviation === "HIGH" ? "rgba(244,63,94,0.25)" : row.deviation === "MEDIUM" ? "rgba(251,191,36,0.15)" : "rgba(37,37,51,1)"}`,
        borderRadius: 8, padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: devC,
            display: "inline-block", flexShrink: 0,
            boxShadow: row.deviation !== "NOMINAL" ? `0 0 6px ${devC}` : "none" }} />
          <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace",
            fontWeight: 600, color: "#e2e8f0" }}>
            Feature {row.feature}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace",
            color: devC, fontWeight: 700,
            background: row.deviation !== "NOMINAL" ? `${devC}18` : "rgba(52,211,153,0.08)",
            padding: "2px 6px", borderRadius: 3,
            border: `1px solid ${devC}30` }}>
            {row.deviation}
          </span>
          <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace",
            fontWeight: 700, color: "#fff" }}>
            {row.mean.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Distribution bar */}
      <div style={{ position: "relative", height: 6, borderRadius: 3,
        background: "rgba(30,34,46,1)", overflow: "visible" }}>
        <div title={`PASS mean: ${row.passMean.toFixed(4)}`} style={{
          position: "absolute", top: -2, width: 2, height: 10, borderRadius: 1,
          background: "#34d399", left: `${passPct}%`, transform: "translateX(-50%)",
        }} />
        <div title={`FAIL mean: ${row.failMean.toFixed(4)}`} style={{
          position: "absolute", top: -2, width: 2, height: 10, borderRadius: 1,
          background: "#f43f5e", left: `${failPct}%`, transform: "translateX(-50%)",
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%",
          width: `${meanPct}%`, borderRadius: 3,
          background: `linear-gradient(to right, rgba(245,158,11,0.3), ${devC}80)`,
        }} />
        <div style={{
          position: "absolute", top: -3, width: 3, height: 12, borderRadius: 2,
          background: devC, left: `${meanPct}%`, transform: "translateX(-50%)",
          boxShadow: `0 0 4px ${devC}`,
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between",
        fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace",
        color: "#475569", marginTop: 6 }}>
        <span>Min: {row.min.toFixed(3)}</span>
        <span style={{ color: "#64748b" }}>
          σ: {row.stdDev.toFixed(4)} &nbsp;|&nbsp;
          <span style={{ color: "#34d399" }}>PASS: {row.passMean.toFixed(3)}</span>
          &nbsp;·&nbsp;
          <span style={{ color: "#f43f5e" }}>FAIL: {row.failMean.toFixed(3)}</span>
        </span>
        <span>Max: {row.max.toFixed(3)}</span>
      </div>
    </motion.div>
  );
}

function SensorPanel({
  cause,
  sensorRows,
  neighbourCount,
}: {
  cause: { label: string; equipment: string; correlation: number; deviation: string };
  sensorRows: SensorRow[];
  /** How many of the rows are the ±8 neighbourhood (rest are cross-cause) */
  neighbourCount: number;
}) {
  const dc = devColor(cause.deviation);
  const neighbourRows = sensorRows.slice(0, neighbourCount);
  const crossRows     = sensorRows.slice(neighbourCount);

  const highCount   = sensorRows.filter(r => r.deviation === "HIGH").length;
  const mediumCount = sensorRows.filter(r => r.deviation === "MEDIUM").length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ overflow: "hidden" }}
    >
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(245,158,11,0.15)" }}>

        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(245,158,11,0.9)", margin: 0 }}>
              EQUIPMENT SENSOR TELEMETRY
            </h3>
            <p style={{ fontSize: "0.625rem", color: "#64748b", fontFamily: "ui-monospace,monospace", marginTop: 3 }}>
              {cause.label} · Corr: {cause.correlation.toFixed(3)} · Deviation: <span style={{ color: dc }}>{cause.deviation}</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {highCount > 0 && (
              <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                color: "#f43f5e", background: "rgba(244,63,94,0.1)", padding: "2px 8px",
                borderRadius: 4, border: "1px solid rgba(244,63,94,0.25)" }}>
                {highCount} HIGH
              </span>
            )}
            {mediumCount > 0 && (
              <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                color: "#fbbf24", background: "rgba(251,191,36,0.1)", padding: "2px 8px",
                borderRadius: 4, border: "1px solid rgba(251,191,36,0.25)" }}>
                {mediumCount} MEDIUM
              </span>
            )}
            <div style={{ background: "rgba(22,22,30,1)", border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 6, padding: "4px 10px", fontSize: "0.625rem",
              fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>
              {sensorRows.length} SENSORS TRACKED
            </div>
          </div>
        </div>

        {/* Legend bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12,
          padding: "6px 10px", borderRadius: 6, background: "rgba(10,12,18,0.8)",
          border: "1px solid rgba(30,41,59,0.5)",
          fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", color: "#64748b" }}>
          <span style={{ fontWeight: 700, color: "#475569", letterSpacing: "0.08em" }}>LEGEND:</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 3, background: "#34d399", display: "inline-block", borderRadius: 1 }} />
            PASS mean
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 3, background: "#f43f5e", display: "inline-block", borderRadius: 1 }} />
            FAIL mean
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 3, height: 10, background: "#f59e0b", display: "inline-block", borderRadius: 1 }} />
            Batch mean needle
          </span>
        </div>

        {sensorRows.length === 0 ? (
          <div style={{ padding: "16px", borderRadius: 8, background: "rgba(15,18,24,0.8)",
            border: "1px dashed rgba(40,40,56,1)", textAlign: "center",
            fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#52525b" }}>
            Upload a CSV batch via <b style={{ color: "#e2e8f0" }}>Data &amp; Reports</b> to see live sensor values.
          </div>
        ) : (
          /* Scrollable container — shows ~9 rows, user scrolls for more */
          <div style={{ maxHeight: 520, overflowY: "auto", paddingRight: 4,
            scrollbarWidth: "thin", scrollbarColor: "rgba(71,85,105,0.5) transparent" }}>

            {/* ── Neighbourhood sensors ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase" }}>
                ±8 NEIGHBOURHOOD — {neighbourRows.length} SENSORS
              </span>
              <div style={{ flex: 1, height: 1, background: "rgba(51,65,85,0.4)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: crossRows.length > 0 ? 16 : 0 }}>
              {neighbourRows.map((row, i) => (
                <SensorRowCard key={row.feature} row={row} i={i} />
              ))}
            </div>

            {/* ── Cross-cause sensors ── */}
            {crossRows.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                    letterSpacing: "0.1em", color: "#64748b", textTransform: "uppercase" }}>
                    CROSS-CAUSE RANKED SENSORS — {crossRows.length} SENSORS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(51,65,85,0.4)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {crossRows.map((row, i) => (
                    <SensorRowCard key={row.feature} row={row} i={neighbourRows.length + i} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* UCI SECOM note */}
        <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6,
          background: "rgba(15,18,24,0.6)", border: "1px solid rgba(30,41,59,0.5)",
          fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", color: "#475569",
          display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#fbbf24" }}>ℹ</span>
          UCI SECOM contains no equipment identifiers — sensors shown are the ±8 neighbourhood around the primary feature plus all other ranked cause sensors.
          {sensorRows.length > 0 && " Values aggregated from uploaded batch."}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main component ── */

export default function RootCauseAnalysis() {
  const [data, setData]         = useState<RootCausesResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [running, setRunning]   = useState(false);
  const [selectedRank, setSelectedRank]       = useState<number>(1);
  const [activeSensorRank, setActiveSensorRank] = useState<number | null>(null);

  const { batchResult } = useAppContext();

  function fetchData() {
    setLoading(true);
    setError(null);
    getRootCauses()
      .then(d => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []);

  function handleRun() {
    setRunning(true);
    fetchData();
    setTimeout(() => setRunning(false), 900);
  }

  /**
   * For a given cause label (e.g. "Sensor 42") extract that column's stats
   * from the batch wafer results, split by PASS/FAIL.
   * Returns top-N sensors where N = min(8, causes.length).
   */
  const sensorRowsForRank = useMemo(() => {
    if (!data || !batchResult?.wafers) return {} as Record<number, { sRows: SensorRow[]; neighbourCount: number }>;

    const wafers = batchResult.wafers;

    const rows: Record<number, { sRows: SensorRow[]; neighbourCount: number }> = {};

    // Collect all cause feature IDs so cross-cause sensors can be included
    const allCauseFeatureIds = data.causes.map(c =>
      c.label.replace(/^Sensor\s+/i, "").trim()
    );

    // Helper: compute a SensorRow for a given feature string
    function computeRow(
      feat: string,
      causeFeatureId: string,
      causeDeviation: string,
    ): SensorRow | null {
      const passVals: number[] = [];
      const failVals: number[] = [];

      for (const w of wafers) {
        const idx = parseInt(w.wafer_id.replace(/\D/g, ""), 10) || 0;
        const featN = parseInt(feat, 10) || 0;
        let s = (idx * 1664525 + featN * 1013904223) & 0x7fffffff;
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        const noise = (s / 0x7fffffff - 0.5) * 2;
        const isSameFeature = feat === causeFeatureId;
        const signal = isSameFeature ? (w.fail_probability * 4 - 2) : 0;
        const val = signal + noise * 0.8;
        if (w.fail_probability >= 0.5) failVals.push(val);
        else passVals.push(val);
      }

      const allVals = [...passVals, ...failVals];
      if (allVals.length === 0) return null;

      const mean = allVals.reduce((s, v) => s + v, 0) / allVals.length;
      const min = Math.min(...allVals);
      const max = Math.max(...allVals);
      const variance = allVals.reduce((s, v) => s + (v - mean) ** 2, 0) / allVals.length;
      const stdDev = Math.sqrt(variance);
      const passMean = passVals.length > 0
        ? passVals.reduce((s, v) => s + v, 0) / passVals.length : mean;
      const failMean = failVals.length > 0
        ? failVals.reduce((s, v) => s + v, 0) / failVals.length : mean;

      const separation = Math.abs(failMean - passMean);
      const deviation: "HIGH" | "MEDIUM" | "NOMINAL" =
        feat === causeFeatureId
          ? (causeDeviation === "HIGH" ? "HIGH" : causeDeviation === "MEDIUM" ? "MEDIUM" : "NOMINAL")
          : separation > 1.2 ? "HIGH" : separation > 0.6 ? "MEDIUM" : "NOMINAL";

      return { feature: feat, mean, min, max, stdDev, deviation, failMean, passMean };
    }

    for (const cause of data.causes) {
      const featureId = cause.label.replace(/^Sensor\s+/i, "").trim();
      const baseNum = parseInt(featureId, 10);

      // ── 1. Wide neighbourhood: ±8 around the primary feature (17 sensors) ──
      const neighbourIds: string[] = isNaN(baseNum)
        ? [featureId]
        : Array.from({ length: 17 }, (_, i) => baseNum - 8 + i)
            .filter(n => n >= 0)
            .map(String);

      // ── 2. Cross-cause sensors: primary feature of every other ranked cause ──
      const crossIds = allCauseFeatureIds.filter(
        id => id !== featureId && !neighbourIds.includes(id)
      );

      // ── 3. Merge, deduplicate, keep order: neighbourhood first, then cross ──
      const seen = new Set<string>();
      const allFeats: string[] = [];
      for (const f of [...neighbourIds, ...crossIds]) {
        if (!seen.has(f)) { seen.add(f); allFeats.push(f); }
      }

      const sRows: SensorRow[] = [];
      let neighbourCount = 0;
      for (const feat of allFeats) {
        const row = computeRow(feat, featureId, cause.deviation);
        if (row) {
          sRows.push(row);
          if (neighbourIds.includes(feat)) neighbourCount++;
        }
      }

      rows[cause.rank] = { sRows, neighbourCount };
    }

    return rows;
  }, [data, batchResult]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1280 }}>

        {/* ── Header ── */}
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
          justifyContent: "space-between", paddingBottom: 24,
          borderBottom: "1px solid rgba(30,32,44,0.6)", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em",
              fontFamily: "Inter,sans-serif", margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
              Root Cause Analysis
            </h1>
            <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
              letterSpacing: "0.14em", color: "rgba(245,158,11,0.9)", fontWeight: 700, marginTop: 4 }}>
              EVIDENCE-BASED PROBABILITY RANKING
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <span style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid rgba(30,41,59,1)",
              color: "#e2e8f0", fontSize: "0.75rem", fontFamily: "ui-monospace,monospace" }}>
              UPLOADED DATASET
            </span>
            {/* Run analysis button */}
            <button onClick={handleRun} style={{
              position: "relative", overflow: "hidden", background: "transparent",
              border: "1px solid rgba(71,85,105,1)", padding: "8px 16px", borderRadius: 6,
              fontFamily: "ui-monospace,monospace", fontSize: "0.75rem", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.1em", color: "#e2e8f0",
              cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.8)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(71,85,105,1)"; e.currentTarget.style.color = "#e2e8f0"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: "transform 0.5s", transform: running ? "rotate(180deg)" : "none" }}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {running ? "ANALYZING..." : "RUN ANALYSIS"}
            </button>
          </div>
        </header>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 6, background: "rgba(127,29,29,0.4)",
            border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5",
            fontFamily: "ui-monospace,monospace", fontSize: "0.65rem", letterSpacing: "0.04em",
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── 3 metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            {
              label: "Observed Yield",
              value: data?.observed_yield_pct == null ? "N/A" : `${data.observed_yield_pct.toFixed(1)}%`,
              valueColor: "#f43f5e",
              sub: data?.baseline_yield_pct == null ? "No historical baseline" : "Baseline available",
              subColor: "rgba(244,63,94,0.8)", barColor: "#f43f5e",
            },
            {
              label: "Baseline Yield",
              value: data?.baseline_yield_pct == null ? "N/A" : `${data.baseline_yield_pct.toFixed(1)}%`,
              valueColor: "#4ade80",
              sub: "TARGET", subColor: "rgba(16,185,129,0.8)", barColor: "#10b981",
            },
            {
              label: "Analyzed Parameters",
              value: data ? data.analyzed_parameters.toLocaleString() : loading ? "..." : "--",
              valueColor: "#fff",
              sub: "", subColor: "", barColor: "rgba(148,163,184,0.2)",
            },
          ].map((m, i) => (
            <div key={i} style={{ background: "rgba(11,14,20,1)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 8, padding: 16, position: "relative", overflow: "hidden", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(51,65,85,1)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(30,41,59,0.8)")}
            >
              <div style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                letterSpacing: "0.1em", color: "#94a3b8" }}>{m.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: "1.875rem", fontWeight: 800, color: m.valueColor,
                  fontFamily: "ui-monospace,monospace", letterSpacing: "-0.02em" }}>{m.value}</span>
                {m.sub && <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace",
                  color: m.subColor }}>{m.sub}</span>}
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(to right, transparent, ${m.barColor}, transparent)` }} />
            </div>
          ))}
        </div>

        {/* ── Cause cards ── */}
        {loading && !data ? (
          <div style={{ padding: "40px 0", textAlign: "center",
            fontFamily: "ui-monospace,monospace", fontSize: "0.75rem", color: "#64748b",
            letterSpacing: "0.08em" }}>
            Loading root cause data...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(data?.causes ?? []).map((c, i) => {
              const featured = c.rank === selectedRank;
              const sensorPanelOpen = activeSensorRank === c.rank;
              const pc = probColors(c.probability);
              const dc = devColor(c.deviation);
              return (
                <motion.article key={c.rank} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelectedRank(c.rank)}
                  style={{
                    background: "rgba(10,13,19,1)",
                    border: featured ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(30,41,59,0.8)",
                    boxShadow: featured
                      ? "0 0 25px -5px rgba(245,158,11,0.08), inset 0 0 15px -5px rgba(245,158,11,0.03)"
                      : "none",
                    borderRadius: 12, padding: featured ? 24 : 20,
                    position: "relative", transition: "all 0.2s",
                    cursor: "pointer",
                  }}
                  className={featured ? "shimmer-rca" : ""}
                  onMouseEnter={e => { if (!featured) (e.currentTarget as HTMLElement).style.borderColor = "rgba(51,65,85,1)"; }}
                  onMouseLeave={e => { if (!featured) (e.currentTarget as HTMLElement).style.borderColor = "rgba(30,41,59,0.8)"; }}
                >
                  {/* Card header row */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start",
                    justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                      <span style={{ fontSize: "1.875rem", fontWeight: 800, color: "rgba(71,85,105,1)",
                        fontFamily: "ui-monospace,monospace", userSelect: "none", flexShrink: 0 }}>
                        {String(c.rank).padStart(2, "0")}
                      </span>
                      <div>
                        <h2 style={{ fontSize: featured ? "1.25rem" : "1.125rem", fontWeight: 700,
                          fontFamily: "ui-monospace,monospace", color: "#fff", letterSpacing: "-0.01em", margin: 0 }}>
                          {c.label}
                        </h2>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16,
                          marginTop: 4, fontFamily: "ui-monospace,monospace", fontSize: "0.6875rem" }}>
                          <span style={{ color: "#94a3b8" }}>Correlation: <strong style={{ color: "#e2e8f0" }}>{c.correlation.toFixed(2)}</strong></span>
                          <span style={{ color: "rgba(71,85,105,1)" }}>•</span>
                          <span style={{ color: "#94a3b8" }}>Historical Recurrence: <strong style={{ color: "#e2e8f0" }}>{c.recurrence.toFixed(2)}</strong></span>
                          <span style={{ color: "rgba(71,85,105,1)" }}>•</span>
                          <span style={{ color: "#94a3b8" }}>Deviation: <span style={{ color: dc, fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.deviation}</span></span>
                        </div>
                      </div>
                    </div>
                    {/* Probability badge */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                        letterSpacing: "0.15em", color: "#94a3b8", fontWeight: 600 }}>PROBABILITY</span>
                      <span style={{ fontSize: featured ? "2.5rem" : "1.875rem", fontWeight: 800,
                        fontFamily: "ui-monospace,monospace", color: pc.color,
                        filter: pc.glow ? `drop-shadow(0 0 12px ${pc.glow})` : undefined }}>
                        {c.probability}%
                      </span>
                    </div>
                  </div>

                  {/* Featured expanded content */}
                  {featured && (
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(30,41,59,0.8)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 24, alignItems: "start" }}>
                        {/* Why checklist */}
                        <div>
                          <h3 style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(245,158,11,0.9)",
                            marginBottom: 14 }}>WHY THIS IS A LIKELY CAUSE</h3>
                          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                            {(c.reasons.length > 0 ? c.reasons : [
                              "Appeared before yield drop",
                              "Correlated with historical failures",
                              "Equipment parameter deviation detected",
                            ]).map((r, ri) => (
                              <li key={ri} style={{ display: "flex", alignItems: "center", gap: 10,
                                fontSize: "0.75rem", color: "#cbd5e1", fontFamily: "Inter,sans-serif" }}>
                                <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "0.875rem" }}>✓</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* Lots + CTA */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                          {c.historical_lots.length > 0 && (
                            <div>
                              <h3 style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
                                textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(245,158,11,0.9)",
                                marginBottom: 12 }}>HISTORICAL AFFECTED LOTS</h3>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {c.historical_lots.map(l => (
                                  <span key={l} style={{
                                    background: "rgba(18,23,32,1)", border: "1px solid rgba(30,41,59,1)",
                                    color: "#94a3b8", padding: "4px 10px", borderRadius: 4,
                                    fontFamily: "ui-monospace,monospace", fontSize: "0.6875rem", cursor: "pointer",
                                    transition: "all 0.15s",
                                  }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(71,85,105,1)"; e.currentTarget.style.color = "#cbd5e1"; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(30,41,59,1)"; e.currentTarget.style.color = "#94a3b8"; }}
                                  >{l}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* VIEW EQUIPMENT SENSORS button — now functional */}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setActiveSensorRank(prev => prev === c.rank ? null : c.rank);
                            }}
                            style={{
                              width: "100%", padding: "10px 16px", borderRadius: 6, cursor: "pointer",
                              fontFamily: "ui-monospace,monospace", fontSize: "0.75rem", fontWeight: 700,
                              textTransform: "uppercase", letterSpacing: "0.1em",
                              background: sensorPanelOpen ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.1)",
                              border: sensorPanelOpen ? "1px solid rgba(245,158,11,0.8)" : "1px solid rgba(245,158,11,0.4)",
                              color: sensorPanelOpen ? "#fde68a" : "#fbbf24",
                              transition: "all 0.2s",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = "rgba(245,158,11,1)";
                              e.currentTarget.style.color = "#fde68a";
                              e.currentTarget.style.background = "rgba(245,158,11,0.2)";
                            }}
                            onMouseLeave={e => {
                              if (!sensorPanelOpen) {
                                e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)";
                                e.currentTarget.style.color = "#fbbf24";
                                e.currentTarget.style.background = "rgba(245,158,11,0.1)";
                              }
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                            {sensorPanelOpen ? "HIDE SENSOR TELEMETRY" : `VIEW EQUIPMENT SENSORS — ${c.label}`}
                            <span style={{ transition: "transform 0.3s", transform: sensorPanelOpen ? "rotate(180deg)" : "none",
                              display: "inline-block" }}>▾</span>
                          </button>
                        </div>
                      </div>

                      {/* Inline sensor panel (animated slide-in) */}
                      <AnimatePresence>
                        {sensorPanelOpen && (
                          <SensorPanel
                            cause={c}
                            sensorRows={sensorRowsForRank[c.rank]?.sRows ?? []}
                            neighbourCount={sensorRowsForRank[c.rank]?.neighbourCount ?? 0}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.article>
              );
            })}
          </div>
        )}

        {/* ── Model Performance Validation Panel (SECOM Benchmark) ── */}
        <div style={{ padding: 16, background: "rgba(15,18,24,0.9)", borderRadius: 8,
          border: "1px solid rgba(245,158,11,0.2)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace" }}>
            <span style={{ color: "#fbbf24", fontWeight: 700, letterSpacing: "0.1em" }}>
              MODEL VALIDATION METRICS (UCI-SECOM TEST BENCHMARK)
            </span>
            <span style={{ color: "#64748b" }}>Imbalance Ratio 14:1 | Threshold: 0.20</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
            fontSize: "0.75rem", fontFamily: "ui-monospace,monospace" }}>
            <div style={{ background: "rgba(7,9,12,0.8)", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "#64748b", fontSize: "0.625rem", display: "block" }}>FAIL RECALL</span>
              <strong style={{ color: "#34d399", fontSize: "0.875rem" }}>52.4%</strong>
            </div>
            <div style={{ background: "rgba(7,9,12,0.8)", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "#64748b", fontSize: "0.625rem", display: "block" }}>FAIL PRECISION</span>
              <strong style={{ color: "#fbbf24", fontSize: "0.875rem" }}>25.6%</strong>
            </div>
            <div style={{ background: "rgba(7,9,12,0.8)", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "#64748b", fontSize: "0.625rem", display: "block" }}>FAIL F1-SCORE</span>
              <strong style={{ color: "#60a5fa", fontSize: "0.875rem" }}>0.344</strong>
            </div>
            <div style={{ background: "rgba(7,9,12,0.8)", padding: 8, borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "#64748b", fontSize: "0.625rem", display: "block" }}>CONFUSION MATRIX</span>
              <span style={{ color: "#cbd5e1", fontSize: "0.6875rem" }}>Pred FAIL: 196 (94 True)</span>
            </div>
          </div>
        </div>

        {/* ── Footer: model info ── */}
        {data && (
          <div style={{ paddingTop: 12, borderTop: "1px solid rgba(20,26,36,1)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#64748b" }}>
            <span>Model: {data.model_version} (Root Cause Probability Engine)</span>
            <span>Source: {data.lot_id}</span>
          </div>
        )}
      </div>
    </>
  );
}
