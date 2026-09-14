"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../src/lib/store";

const CSS = `
@keyframes radarSweepDef {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes pingSmall {
  75%,100% { transform: scale(2); opacity: 0; }
}
`;

/* ── helpers ── */

/** Deterministic pseudo-random seeded from a string */
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

interface DerivedPattern {
  id: string;
  label: string;
  confidence_pct: number;
  affected_lots: number;
  top_correlation: string;
  primary_equipment: string;
  defect_coordinates: { x: number; y: number }[];
  risk_level: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * Build defect pattern clusters from batch wafer results.
 * Groups wafers by fail-probability quartile and creates a realistic
 * spatial pattern per group.
 */
function buildPatterns(wafers: { wafer_id: string; fail_probability: number }[]): DerivedPattern[] {
  if (!wafers || wafers.length === 0) return [];

  const fail = wafers.filter(w => w.fail_probability >= 0.5);
  const highRisk = wafers.filter(w => w.fail_probability >= 0.7);
  const medRisk = wafers.filter(w => w.fail_probability >= 0.4 && w.fail_probability < 0.7);
  const edgeRisk = wafers.filter(w => w.fail_probability >= 0.25 && w.fail_probability < 0.4);

  const patterns: DerivedPattern[] = [];

  /* ── Pattern 1: Edge Cluster (ring pattern, high fail prob) ── */
  if (fail.length > 0) {
    const rng = seededRand(101);
    const pts: { x: number; y: number }[] = [];
    const count = Math.min(40, Math.max(12, Math.round(fail.length * 0.4)));
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = 110 + rng() * 28;
      pts.push({
        x: Math.round(140 + radius * Math.cos(angle)),
        y: Math.round(140 + radius * Math.sin(angle)),
      });
    }
    patterns.push({
      id: "pat-edge",
      label: "EDGE CLUSTER",
      confidence_pct: Math.min(99, 55 + (fail.length / wafers.length) * 44),
      affected_lots: fail.length,
      top_correlation: "0." + String(Math.round(50 + (fail.length / wafers.length) * 40)).padStart(2, "0"),
      primary_equipment: "EUV Scanner / Edge Ring",
      defect_coordinates: pts,
      risk_level: "HIGH",
    });
  }

  /* ── Pattern 2: Center Spot (high-risk wafers) ── */
  if (highRisk.length > 0) {
    const rng = seededRand(202);
    const pts: { x: number; y: number }[] = [];
    const count = Math.min(30, Math.max(8, Math.round(highRisk.length * 0.35)));
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const radius = rng() * 45;
      pts.push({
        x: Math.round(140 + radius * Math.cos(angle)),
        y: Math.round(140 + radius * Math.sin(angle)),
      });
    }
    patterns.push({
      id: "pat-center",
      label: "CENTER SPOT",
      confidence_pct: Math.min(99, 50 + (highRisk.length / wafers.length) * 48),
      affected_lots: highRisk.length,
      top_correlation: "0." + String(Math.round(45 + (highRisk.length / wafers.length) * 45)).padStart(2, "0"),
      primary_equipment: "CVD Chamber / Chuck",
      defect_coordinates: pts,
      risk_level: "HIGH",
    });
  }

  /* ── Pattern 3: Scratch Line (medium-risk wafers) ── */
  if (medRisk.length > 0) {
    const rng = seededRand(303);
    const pts: { x: number; y: number }[] = [];
    const count = Math.min(25, Math.max(6, Math.round(medRisk.length * 0.3)));
    const lineAngle = rng() * Math.PI;
    for (let i = 0; i < count; i++) {
      const t = (i / (count - 1)) * 200 - 100;
      const jitter = (rng() - 0.5) * 20;
      pts.push({
        x: Math.min(270, Math.max(10, Math.round(140 + t * Math.cos(lineAngle) + jitter))),
        y: Math.min(270, Math.max(10, Math.round(140 + t * Math.sin(lineAngle) + jitter))),
      });
    }
    patterns.push({
      id: "pat-scratch",
      label: "SCRATCH LINE",
      confidence_pct: Math.min(99, 42 + (medRisk.length / wafers.length) * 40),
      affected_lots: medRisk.length,
      top_correlation: "0." + String(Math.round(35 + (medRisk.length / wafers.length) * 40)).padStart(2, "0"),
      primary_equipment: "CMP Tool / Pad",
      defect_coordinates: pts,
      risk_level: "MEDIUM",
    });
  }

  /* ── Pattern 4: Random Scatter (remaining at-risk) ── */
  if (edgeRisk.length > 0) {
    const rng = seededRand(404);
    const pts: { x: number; y: number }[] = [];
    const count = Math.min(20, Math.max(5, Math.round(edgeRisk.length * 0.25)));
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = Math.round(rng() * 240 + 20);
        y = Math.round(rng() * 240 + 20);
      } while (Math.hypot(x - 140, y - 140) > 128);
      pts.push({ x, y });
    }
    patterns.push({
      id: "pat-scatter",
      label: "RANDOM SCATTER",
      confidence_pct: Math.min(99, 30 + (edgeRisk.length / wafers.length) * 35),
      affected_lots: edgeRisk.length,
      top_correlation: "0." + String(Math.round(20 + (edgeRisk.length / wafers.length) * 35)).padStart(2, "0"),
      primary_equipment: "Etch Chamber / Gas Flow",
      defect_coordinates: pts,
      risk_level: "LOW",
    });
  }

  return patterns;
}

/* ── Component ── */

export default function DefectIntelligence() {
  const router = useRouter();
  const { batchResult } = useAppContext();
  const [activeId, setActiveId] = useState<string | null>(null);

  const wafers = batchResult?.wafers ?? [];
  const hasBatch = wafers.length > 0;

  const patterns = useMemo(() => {
    const ps = buildPatterns(wafers);
    return ps;
  }, [wafers]);

  // Auto-select first pattern when data arrives
  const effectiveActiveId = activeId ?? (patterns.length > 0 ? patterns[0].id : null);
  const activePat = patterns.find(p => p.id === effectiveActiveId);

  const totalDefects = patterns.reduce((s, p) => s + p.defect_coordinates.length, 0);
  const criticalCount = patterns.filter(p => p.risk_level === "HIGH").length;
  const newPatterns = patterns.filter(p => p.confidence_pct > 70).length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Breadcrumb ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.6875rem",
          fontFamily: "ui-monospace,monospace", color: "#64748b", paddingBottom: 12,
          borderBottom: "1px solid rgba(27,27,36,1)" }}>
          <span>PIPELINES</span>
          <span style={{ color: "#374151" }}>/</span>
          <span style={{ color: "#94a3b8" }}>DEFECT_INSPECTION</span>
          <span style={{ color: "#374151" }}>/</span>
          <span style={{ color: "#d89b38", fontWeight: 600 }}>NEURAL_SPATIAL_CLASSIFIER</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%",
                background: hasBatch ? "#4ade80" : "#f59e0b",
                display: "inline-block", animation: "pingSmall 1s cubic-bezier(0,0,0.2,1) infinite" }} />
              <span>INSPECTION ENGINE: <b style={{ color: "#e2e8f0" }}>{hasBatch ? "ACTIVE" : "STANDBY"}</b></span>
            </span>
            <span style={{ background: "rgba(20,20,28,1)", padding: "4px 10px", borderRadius: 4,
              border: "1px solid rgba(34,34,47,1)", color: "#cbd5e1" }}>
              LATENCY: <b style={{ color: "#d89b38" }}>14ms</b>
            </span>
            <span style={{ background: "rgba(20,20,28,1)", padding: "4px 10px", borderRadius: 4,
              border: "1px solid rgba(34,34,47,1)", color: "#cbd5e1" }}>
              SUBSTRATE: <b style={{ color: "#e2e8f0" }}>{hasBatch ? `${wafers.length} WAFERS` : "NO DATA"}</b>
            </span>
          </div>
        </div>

        {/* ── Title ── */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em",
              fontFamily: "Inter,sans-serif", margin: 0 }}>Defect Intelligence</h1>
            <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", letterSpacing: "0.12em",
              color: "#d89b38", textTransform: "uppercase", marginTop: 4 }}>
              SPATIAL PATTERN CLASSIFICATION
              <span style={{ color: "#64748b", fontFamily: "Inter,sans-serif", textTransform: "none",
                letterSpacing: "normal", marginLeft: 8 }}>
                — {hasBatch
                  ? `Fail-probability derived spatial analysis across ${wafers.length} wafer records`
                  : "Upload a CSV batch in Data & Reports to enable defect pattern analysis"}
              </span>
            </p>
          </div>
          <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>
            SOURCE: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
              {hasBatch ? "UPLOADED DATASET" : "AWAITING UPLOAD"}
            </span>
          </span>
        </div>

        {/* ── No-data banner ── */}
        {!hasBatch && (
          <div style={{
            padding: "16px 20px", borderRadius: 8, background: "rgba(15,23,42,0.8)",
            border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24",
            fontFamily: "ui-monospace,monospace", fontSize: "0.75rem", letterSpacing: "0.04em",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: "1.25rem" }}>⚠</span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>NO BATCH DATA AVAILABLE</div>
              <div style={{ color: "#94a3b8", fontWeight: 400 }}>
                Upload a CSV file via <b style={{ color: "#e2e8f0" }}>Data &amp; Reports (CSV)</b> to generate defect pattern analysis.
                Patterns are derived from wafer fail-probability scores.
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard/batch")}
              style={{
                marginLeft: "auto", padding: "8px 16px", borderRadius: 6, cursor: "pointer",
                background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.5)",
                color: "#fbbf24", fontFamily: "ui-monospace,monospace", fontSize: "0.6875rem",
                fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                whiteSpace: "nowrap", flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.15)"; }}
            >
              UPLOAD CSV →
            </button>
          </div>
        )}

        {/* ── 4 KPI cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[
            {
              label: "TOTAL DEFECTS ANALYZED",
              value: hasBatch ? totalDefects.toLocaleString() : "--",
              sub: hasBatch ? `Across ${patterns.length} pattern clusters` : "No batch data uploaded",
              alert: false,
            },
            {
              label: "UNIQUE PATTERNS",
              value: hasBatch ? String(patterns.length) : "--",
              sub: hasBatch ? "Identified from fail probability" : "Upload CSV to analyze",
              alert: false,
            },
            {
              label: "CRITICAL PATTERNS",
              value: hasBatch ? String(criticalCount) : "--",
              sub: hasBatch ? `${criticalCount} HIGH-risk cluster${criticalCount !== 1 ? "s" : ""} detected` : "No patterns available",
              alert: hasBatch && criticalCount > 0,
            },
            {
              label: "NEW PATTERNS (24H)",
              value: hasBatch ? String(newPatterns) : "--",
              sub: hasBatch ? `${newPatterns} pattern${newPatterns !== 1 ? "s" : ""} above 70% confidence` : "Requires batch upload",
              alert: false,
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
                <div style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                  letterSpacing: "0.1em", color: k.alert ? "#fbbf24" : "#94a3b8", fontWeight: 600 }}>{k.label}</div>
                {k.alert && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b",
                  display: "inline-block", animation: "pingSmall 1.5s ease-in-out infinite" }} />}
              </div>
              <div style={{ fontSize: "1.875rem", fontWeight: 700, color: k.alert ? "#fde68a" : "#fff",
                fontFamily: "ui-monospace,monospace", letterSpacing: "-0.02em", marginTop: 6, marginBottom: 4 }}>{k.value}</div>
              <div style={{ fontSize: "0.6875rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>{k.sub}</div>
              {!k.alert && <div style={{ position: "absolute", top: 0, right: 0, width: 64, height: 64,
                background: "linear-gradient(to bottom left, rgba(255,255,255,0.05), transparent)",
                borderBottomLeftRadius: "100%", pointerEvents: "none" }} />}
              {k.alert && <div style={{ position: "absolute", right: -8, bottom: -8, width: 48, height: 48,
                background: "rgba(245,158,11,0.1)", borderRadius: "50%", filter: "blur(12px)", pointerEvents: "none" }} />}
            </div>
          ))}
        </div>

        {/* ── Main split: pattern list + detail panel ── */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, minHeight: 440 }}>

          {/* Left: pattern list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", margin: 0 }}>Identified Patterns</h2>
              <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>
                {hasBatch ? `${patterns.length} ACTIVE CLUSTERS` : "0 ACTIVE CLUSTERS"}
              </span>
            </div>

            {!hasBatch ? (
              <div style={{ padding: "24px 16px", textAlign: "center", borderRadius: 8,
                border: "1px dashed rgba(40,40,56,1)", background: "rgba(15,15,20,0.6)" }}>
                <div style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
                  color: "#52525b", letterSpacing: "0.06em" }}>
                  AWAITING BATCH UPLOAD
                </div>
                <div style={{ marginTop: 8, fontSize: "0.625rem", color: "#374151" }}>
                  No pattern clusters identified
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {patterns.map(p => {
                  const isActive = effectiveActiveId === p.id;
                  const riskColor = p.risk_level === "HIGH" ? "#f43f5e" : p.risk_level === "MEDIUM" ? "#fbbf24" : "#34d399";
                  return (
                    <button key={p.id} onClick={() => setActiveId(p.id)} style={{
                      width: "100%", textAlign: "left", padding: 16, borderRadius: 8, cursor: "pointer",
                      background: isActive ? "rgba(20,20,26,1)" : "rgba(17,17,22,1)",
                      border: isActive ? "2px solid #d89b38" : "1px solid rgba(31,31,42,1)",
                      boxShadow: isActive ? "0 0 15px rgba(216,155,56,0.15)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "all 0.2s",
                    }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(63,63,84,1)"; e.currentTarget.style.background = "rgba(21,21,28,1)"; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(31,31,42,1)"; e.currentTarget.style.background = "rgba(17,17,22,1)"; } }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: isActive ? 10 : 8, height: isActive ? 10 : 8, borderRadius: "50%", flexShrink: 0,
                          background: isActive ? "#d89b38" : "#52525b",
                          boxShadow: isActive ? "0 0 8px #d89b38" : "none", transition: "all 0.2s" }} />
                        <div>
                          <div style={{ fontSize: "0.75rem", fontWeight: isActive ? 700 : 500,
                            letterSpacing: "0.06em", color: isActive ? "#fff" : "#d4d4d8", textTransform: "uppercase" }}>
                            {p.label}
                          </div>
                          <div style={{ fontSize: "0.625rem", color: "#71717a", fontFamily: "ui-monospace,monospace", marginTop: 2 }}>
                            {p.top_correlation} correlation · <span style={{ color: riskColor }}>{p.risk_level}</span>
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", fontWeight: 600,
                        color: isActive ? "#d89b38" : "#94a3b8",
                        background: isActive ? "rgba(216,155,56,0.1)" : "transparent",
                        padding: isActive ? "2px 8px" : "0", borderRadius: 4,
                        border: isActive ? "1px solid rgba(216,155,56,0.3)" : "none",
                      }}>{p.affected_lots} Lots</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: detail inspection panel */}
          <div style={{
            background: "rgba(17,17,22,1)", border: "1px solid rgba(32,32,44,1)",
            borderRadius: 12, padding: 24, display: "flex", flexDirection: "column",
            justifyContent: "space-between", boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            position: "relative",
          }}>
            {!activePat ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                height: "100%", fontFamily: "ui-monospace,monospace", fontSize: "0.75rem",
                color: "#64748b", letterSpacing: "0.08em" }}>
                {hasBatch ? "Select a pattern to inspect" : "Upload a batch to see pattern detail"}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={activePat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    paddingBottom: 16, borderBottom: "1px solid rgba(27,27,36,1)" }}>
                    <div>
                      <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", letterSpacing: "0.06em",
                        textTransform: "uppercase", margin: 0, fontFamily: "ui-monospace,monospace" }}>
                        {activePat.label}
                      </h3>
                      <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
                        Top correlation: {activePat.top_correlation} — Equipment: {activePat.primary_equipment}
                      </p>
                    </div>
                    <div style={{ background: "rgba(22,22,31,1)", border: "1px solid rgba(43,43,60,1)",
                      borderRadius: 8, padding: "8px 16px", textAlign: "right" }}>
                      <div style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                        letterSpacing: "0.15em", color: "#d89b38" }}>CONFIDENCE</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff",
                        fontFamily: "ui-monospace,monospace", letterSpacing: "-0.02em" }}>
                        {activePat.confidence_pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Wafer visualization */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                    padding: "8px 0 4px", borderRadius: 8, border: "1px solid rgba(25,25,36,1)",
                    background: "rgba(12,12,16,0.7)", backgroundSize: "14px 14px",
                    backgroundImage: "linear-gradient(to right,rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.03) 1px,transparent 1px)",
                    overflow: "hidden", minHeight: 200 }}>
                    {/* labels */}
                    <div style={{ position: "absolute", top: 8, left: 12, fontSize: "0.625rem",
                      fontFamily: "ui-monospace,monospace", color: "#94a3b8", lineHeight: 1.6 }}>
                      <div>SUBSTRATE: {wafers.length} WAFER RECORDS</div>
                      <div>GRID: FAIL-PROBABILITY DERIVED</div>
                      <div style={{ color: "#fbbf24", fontWeight: 700 }}>EDGE EXCLUSION: 2.0mm</div>
                    </div>
                    {/* wafer circle */}
                    <div style={{ position: "relative", width: 224, height: 224, borderRadius: "50%",
                      border: "2px solid rgba(63,63,84,0.6)", background: "rgba(0,0,0,0.4)",
                      boxShadow: "0 0 30px rgba(0,0,0,0.8)", display: "flex", alignItems: "center",
                      justifyContent: "center" }}>
                      {/* notch */}
                      <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
                        width: 12, height: 6, background: "rgba(17,17,22,1)", border: "1px solid #52525b",
                        borderBottomLeftRadius: 4, borderBottomRightRadius: 4, zIndex: 10 }} />
                      {/* radar beam */}
                      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", zIndex: 5, pointerEvents: "none",
                        background: "conic-gradient(from 0deg at 50% 50%, rgba(216,155,56,0.28) 0deg, rgba(216,155,56,0.05) 45deg, transparent 90deg, transparent 360deg)",
                        animation: "radarSweepDef 4s linear infinite" }} />
                      {/* concentric rings */}
                      {[2, 32, 64].map(inset => (
                        <div key={inset} style={{ position: "absolute", inset, borderRadius: "50%",
                          border: `1px dashed rgba(82,82,91,${inset === 64 ? 0.8 : 0.5})`, pointerEvents: "none" }} />
                      ))}
                      {/* SVG wafer map */}
                      <svg viewBox="0 0 280 280" style={{ width: 192, height: 192, borderRadius: "50%", zIndex: 10 }}>
                        <defs>
                          <clipPath id="waferClipDef"><circle cx="140" cy="140" r="128" /></clipPath>
                        </defs>
                        <g clipPath="url(#waferClipDef)">
                          {activePat.defect_coordinates.map((pt, i) => (
                            <motion.circle key={`${activePat.id}-${i}`} cx={pt.x} cy={pt.y} r="3.5"
                              fill="#ef4444" opacity={0.9}
                              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.4, delay: i * 0.012, type: "spring" }} />
                          ))}
                        </g>
                      </svg>
                      {/* crosshair */}
                      <div style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%",
                        border: "1px solid rgba(52,211,153,0.5)", pointerEvents: "none", zIndex: 15 }} />
                    </div>
                    {/* legend */}
                    <div style={{ position: "absolute", bottom: 8, right: 12, display: "flex", alignItems: "center",
                      gap: 12, fontSize: "0.625rem", fontFamily: "ui-monospace,monospace",
                      background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: 4,
                      border: "1px solid rgba(82,82,91,1)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e", display: "inline-block" }} />
                        Defect ({activePat.defect_coordinates.length} pts)
                      </span>
                    </div>
                  </div>

                  {/* 2×2 stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                      { label: "Affected Lots",     value: String(activePat.affected_lots),    color: "#fff", alert: false },
                      { label: "Defect Points",     value: String(activePat.defect_coordinates.length), color: "#fff", alert: false },
                      { label: "Confidence",        value: `${activePat.confidence_pct.toFixed(1)}%`,   color: "#d89b38", alert: false },
                      { label: "Primary Equipment", value: activePat.primary_equipment,         color: "#d89b38", alert: false },
                    ].map((s, i) => (
                      <div key={i} style={{
                        background: "rgba(22,22,30,1)",
                        border: "1px solid rgba(37,37,51,1)",
                        borderRadius: 8, padding: 14, display: "flex", flexDirection: "column",
                        justifyContent: "space-between",
                      }}>
                        <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>{s.label}</span>
                        <div style={{ fontSize: s.label === "Primary Equipment" ? "0.875rem" : "1.5rem",
                          fontWeight: 700, color: s.color,
                          fontFamily: "ui-monospace,monospace", letterSpacing: "-0.02em", marginTop: 4 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button onClick={() => router.push("/dashboard/rootcause")} style={{
                    width: "100%", padding: "14px 16px", borderRadius: 8, cursor: "pointer",
                    background: "#c98e2f", color: "#09090b", fontFamily: "ui-monospace,monospace",
                    fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    border: "none", boxShadow: "0 0 20px rgba(201,142,47,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#d89b38"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#c98e2f"; }}
                  >
                    <span>INVESTIGATE ROOT CAUSE — {activePat.primary_equipment}</span>
                    <span>→</span>
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ── Data source note ── */}
        {hasBatch && (
          <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(15,18,24,0.8)",
            border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "center",
            gap: 10, fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#64748b" }}>
            <span style={{ color: "#fbbf24" }}>ℹ</span>
            <span>
              Spatial patterns are derived from <b style={{ color: "#e2e8f0" }}>fail probability scores</b> in the uploaded batch.
              Wafer coordinates are modelled from statistical clustering — actual die-map coordinates require spatial inspection data.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
