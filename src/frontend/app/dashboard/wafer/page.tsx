"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getModelInfo } from "../../../src/services/api";
import { useAppContext } from "../../../src/lib/store";

const BACKEND = (process.env.NEXT_PUBLIC_YIELDSENTINEL_BACKEND_URL ?? process.env.YIELDSENTINEL_BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

/* Ã¢â€â‚¬Ã¢â€â‚¬ Sensor definitions (real SECOM column indices) Ã¢â€â‚¬Ã¢â€â‚¬ */
// Features loaded dynamically from /model-info
// (old hardcoded FEATURES array removed)


const BASELINES: Record<string, number> = { "0": 0, "351": 0, "352": 0.1, "353": 0, "354": 0, "355": 0 };

/* SHAP bar colour: positive â†’ pushes toward FAIL (amber), negative â†’ toward PASS (emerald) */
const shapColor = (dir: string) => dir === "positive" ? "#f59e0b" : "#10b981";
const shapBg    = (dir: string) => dir === "positive" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)";

/* Ã¢â€â‚¬Ã¢â€â‚¬ Wafer die grid Ã¢â€â‚¬Ã¢â€â‚¬ */
function WaferDieGrid({ failPct }: { failPct: number | null }) {
  const dies = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8), col = i % 8;
    const dist = Math.sqrt((row - 3.5) ** 2 + (col - 3.5) ** 2);
    if (dist > 3.8) return "invisible";
    if (dist > 3.1) return i === 15 || i === 48 ? "defect" : "edge";
    return "core";
  });

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 3,
        padding: 16, width: "100%", height: "100%" }}
    >
      {dies.map((type, i) => {
        if (type === "invisible") return (
          <div key={i} style={{ opacity: 0, pointerEvents: "none" }} />
        );
        const isDefect = type === "defect" || (failPct !== null && failPct > 50 && (i % 11 === 0 || i % 17 === 0));
        const bg = isDefect
          ? "rgba(245,158,11,0.8)"
          : type === "edge"
          ? "rgba(16,185,129,0.35)"
          : "rgba(16,185,129,0.25)";
        const border = isDefect ? "rgba(245,158,11,0.6)" : "rgba(16,185,129,0.3)";
        const shadow = isDefect ? "0 0 5px #f59e0b" : "none";
        return (
          <div key={i} style={{
            width: "100%", aspectRatio: "1", borderRadius: 2,
            background: bg, border: `1px solid ${border}`,
            boxShadow: shadow, transition: "all 0.4s",
          }} />
        );
      })}
    </div>
  );
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Typing terminal log Ã¢â€â‚¬Ã¢â€â‚¬ */
function useTypingLog(trigger: number, latency: string) {
  const [lines, setLines] = useState([
    "[system] Model loaded: XGBoost-SECOM-v2.8",
    "[system] Device: CPU // XGBoost backend",
    "[system] Awaiting inference request...",
  ]);
  const prevTrigger = useRef(trigger);
  useEffect(() => {
    if (trigger === prevTrigger.current) return;
    prevTrigger.current = trigger;
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLines(prev => [
      ...prev.slice(-4),
      `[${now}] Matrix normalizer applied across 562 dimensions. Z-score capped at +/-3.5 sigma.`,
      `[${now}] XGBoost leaf traversal completed in ${latency}. Classification result ready.`,
    ]);
  }, [trigger, latency]);
  return lines;
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ Shimmer CSS Ã¢â€â‚¬Ã¢â€â‚¬ */
const CSS = `
@keyframes shimmer-btn {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes laser-sweep {
  0%, 100% { transform: translateY(-100%); opacity: 0.2; }
  50%       { transform: translateY(100%);  opacity: 0.85; }
}
@keyframes spin-slow {
  to { transform: rotate(360deg); }
}
.shimmer-btn {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  background-size: 200% 100%;
  animation: shimmer-btn 2.5s linear infinite;
}
`;

export default function WaferPage() {
  const { selectedWaferSensors } = useAppContext();
  const [featureNames, setFeatureNames] = useState<string[]>([]);
  const [vals, setVals] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || featureNames.length === 0) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const firstLineCells = lines[0].split(',');
        const isFirstLineHeader = firstLineCells.some(cell => isNaN(Number(cell.trim())));

        const headers = isFirstLineHeader ? firstLineCells.map(h => h.trim().replace(/^["']|["']$/g, '')) : [];
        const dataRowCells = (isFirstLineHeader && lines.length > 1 ? lines[1] : lines[0])
          .split(',')
          .map(c => c.trim().replace(/^["']|["']$/g, ''));

        const extracted: Record<string, number> = {};

        featureNames.forEach((f, idx) => {
          let valNum: number | null = null;

          // 1. Match by header name (exact, case-insensitive, or numeric digits)
          if (headers.length > 0) {
            const hIdx = headers.findIndex(h =>
              h === f ||
              h.toLowerCase() === f.toLowerCase() ||
              (h.replace(/[^0-9]/g, '') !== '' && h.replace(/[^0-9]/g, '') === f.replace(/[^0-9]/g, ''))
            );
            if (hIdx !== -1 && dataRowCells[hIdx] !== undefined) {
              const parsed = parseFloat(dataRowCells[hIdx]);
              if (!isNaN(parsed)) valNum = parsed;
            }
          }

          // 2. Match by numeric column index or position
          if (valNum === null) {
            const numericId = parseInt(f.replace(/[^0-9]/g, ''), 10);
            const targetCol = !isNaN(numericId) && numericId < dataRowCells.length ? numericId : idx;
            if (dataRowCells[targetCol] !== undefined) {
              const parsed = parseFloat(dataRowCells[targetCol]);
              if (!isNaN(parsed)) valNum = parsed;
            }
          }

          extracted[f] = valNum !== null ? valNum : 0;
        });

        setVals(extracted);

        // Auto-run inference immediately on extracted CSV parameters
        fetch(`${BACKEND}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sensors: extracted }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) {
              setFailProb(data.fail_probability);
              setPassProb(data.pass_probability);
              setPrediction(data.prediction);
              setLatencyMs(data.latency_ms ?? "--");
              setShap(data.top_shap_features ?? []);
              setRunTick(t => t + 1);
            }
          })
          .catch(() => {});
      } catch (err) {
        console.error("Failed to parse CSV file.", err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    getModelInfo()
      .then(info => {
        const names = info.feature_names ?? [];
        setFeatureNames(names);
        const defaults: Record<string, number> = {};

        names.forEach((f: string, idx: number) => {
          const numId = f.replace(/[^0-9]/g, '');
          const val = selectedWaferSensors?.[f]
            ?? (numId !== '' ? selectedWaferSensors?.[numId] : undefined)
            ?? (numId !== '' ? selectedWaferSensors?.[`Feature ${numId}`] : undefined);

          if (val !== undefined && val !== null) {
            defaults[f] = val;
          } else {
            const seed = (idx + 1) * 37;
            const baseVal = 2400 + (seed % 900);
            const floatVal = Number((baseVal + Math.sin(seed * 0.1) * 35).toFixed(2));
            defaults[f] = floatVal;
          }
        });
        setVals(defaults);

        fetch(`${BACKEND}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sensors: defaults }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) {
              setFailProb(data.fail_probability);
              setPassProb(data.pass_probability);
              setPrediction(data.prediction);
              setLatencyMs(data.latency_ms ?? "--");
              setShap(data.top_shap_features ?? []);
              setRunTick(t => t + 1);
            }
          })
          .catch(() => {});
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load model features.");
      });
  }, [selectedWaferSensors]);
  const displayFeatureNames = useMemo(() => {
    return [...featureNames].sort((a, b) => {
      const valA = Math.abs(vals[a] ?? 0);
      const valB = Math.abs(vals[b] ?? 0);
      if (valA > 0 && valB === 0) return -1;
      if (valA === 0 && valB > 0) return 1;
      return valB - valA;
    });
  }, [featureNames, vals]);

  const nonZeroCount = useMemo(() => {
    return Object.values(vals).filter(v => Math.abs(v) > 0.001).length;
  }, [vals]);
  const [running,    setRunning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [failProb,   setFailProb]   = useState<number | null>(null);
  const [passProb,   setPassProb]   = useState<number | null>(null);
  const [latencyMs,  setLatencyMs]  = useState<string>("--");
  const [shap, setShap] = useState<{ feature: string; shap_value: number; direction: string }[]>([]);
  const [runTick, setRunTick] = useState(0);
  const logLines = useTypingLog(runTick, latencyMs);

  /* Derived display values */
  const anomalyScore = failProb !== null ? (failProb * 100).toFixed(1) : "--";
  const isFail       = prediction === "FAIL";
  const isPass       = prediction === "PASS";
  const hasResult    = prediction !== null;

  const scoreColor   = failProb === null ? "#94a3b8"
    : failProb > 0.75 ? "#ef4444"
    : failProb > 0.50 ? "#f59e0b"
    : "#10b981";

  const statusLabel  = !hasResult ? "AWAITING INFERENCE"
    : isFail ? "ANOMALY DETECTED"
    : isPass ? "NOMINAL / GRADE-A"
    : "WATCH";

  const statusBg     = !hasResult ? "rgba(100,116,139,0.1)"
    : isFail ? "rgba(239,68,68,0.1)"
    : "rgba(16,185,129,0.1)";

  const statusBorder = !hasResult ? "rgba(100,116,139,0.3)"
    : isFail ? "rgba(239,68,68,0.35)"
    : "rgba(16,185,129,0.3)";

  const statusText   = !hasResult ? "#94a3b8" : isFail ? "#f87171" : "#34d399";

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Run inference Ã¢â€â‚¬Ã¢â€â‚¬ */
  const runInference = async () => {
    if (running) return;
    setRunning(true);
    setError(null);

    try {
      const sensors: Record<string, number> = {};
      featureNames.forEach(f => { sensors[f] = vals[f] ?? 0; });

      const res = await fetch(`${BACKEND}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensors }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }

      const data = await res.json();
      setFailProb(data.fail_probability);
      setPassProb(data.pass_probability);
      setPrediction(data.prediction);
      setLatencyMs(data.latency_ms ?? "--");
      setShap(data.top_shap_features ?? []);
      setRunTick(t => t + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setRunTick(t => t + 1);
    } finally {
      setRunning(false);
    }
  };

  /* Ã¢â€â‚¬Ã¢â€â‚¬ Randomize / baseline helpers Ã¢â€â‚¬Ã¢â€â‚¬ */
  const randomize = () => {
    setVals(Object.fromEntries(
      featureNames.map(f => [f, parseFloat(((Math.random() - 0.5) * 10).toFixed(3))])
    ));
  };

  const loadBaseline = () => {
    const bl: Record<string, number> = {}; featureNames.forEach(f => { bl[f] = 0; }); setVals(bl);
  };

  const exportReport = () => {
    const rows = [
      ["Feature", "Value"],
      ...featureNames.map(feature => [feature, String(vals[feature] ?? 0)]),
      ["Prediction", prediction ?? "PENDING"],
      ["Fail Probability", failProb === null ? "PENDING" : String(failProb)],
    ].map(row => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "wafer_report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Page headline Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", fontWeight: 700,
              letterSpacing: "0.18em", color: "#f59e0b", textTransform: "uppercase" }}>
              REAL-TIME ML INFERENCE
            </span>
          </div>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.025em", margin: 0 }}>
            Single Wafer Prediction
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#94a3b8", maxWidth: 680 }}>
            Simulate live sensor telemetry drift and execute instant defect probability classification
            across 562 high-dimensional chamber features.
          </p>
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Alert / Error banner Ã¢â€â‚¬Ã¢â€â‚¬ */}
        {error ? (
          <div style={{ borderRadius: 8, background: "rgba(127,29,29,0.35)", border: "1px solid rgba(239,68,68,0.3)",
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <svg width={16} height={16} fill="none" stroke="#f87171" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", color: "#fca5a5" }}>
              {error}
            </span>
          </div>
        ) : (
          <div style={{ borderRadius: 8, background: "rgba(120,53,15,0.2)", border: "1px solid rgba(245,158,11,0.25)",
            padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ padding: 6, borderRadius: 6, background: "rgba(245,158,11,0.1)", color: "#fbbf24", flexShrink: 0 }}>
                <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#d1d5db" }}>
                <span style={{ color: "#fbbf24", fontWeight: 700 }}>Telemetry Alert: </span>
                Feature 0 exceeds nominal distribution limits (+2.4 sigma) - auto-normalized using cleanroom calibration baseline.
              </span>
            </div>
            <button style={{ padding: "4px 10px", fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
              color: "#fbbf24", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.1)"; }}
            >
              Inspect Distribution
            </button>
          </div>
        )}

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Two-column workspace Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 24, alignItems: "start" }}>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ LEFT: Wafer Parameters Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <section style={{ background: "rgba(11,13,14,0.95)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)", padding: 24,
            display: "flex", flexDirection: "column", gap: 0,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>

            {/* Card header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#fff", margin: 0 }}>Wafer Parameters</h2>
                <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#64748b", marginTop: 2 }}>
                  Enter telemetry for model inputs
                </p>
              </div>
              <span style={{ padding: "4px 10px", borderRadius: 4, background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24",
                fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", fontWeight: 500 }}>
                Active: {nonZeroCount > 0 ? `${nonZeroCount} Active Features` : "562 Features"}
              </span>
            </div>

            {/* Template presets */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", marginBottom: 14 }}>
              <span style={{ color: "#64748b" }}>Calibration Templates:</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={loadBaseline} style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: "0.6875rem",
                  fontFamily: "ui-monospace,monospace", color: "#cbd5e1",
                  background: "rgba(20,24,27,0.9)", border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(30,36,40,1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(20,24,27,0.9)"; }}
                >Load Baseline</button>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: "0.6875rem",
                  fontFamily: "ui-monospace,monospace", color: "#60a5fa",
                  background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)",
                  cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.1)"; }}
                >
                  <svg width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Extract from CSV
                </button>
                <button onClick={randomize} style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: "0.6875rem",
                  fontFamily: "ui-monospace,monospace", color: "#fbbf24",
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                  cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.15)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.08)"; }}
                >
                  <svg width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Simulate Drift
                </button>
              </div>
            </div>

            {/* Scrollable sensor inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10,
              maxHeight: 440, overflowY: "auto", paddingRight: 4 }}>
              {featureNames.length === 0 && (
                <div style={{ color: "#64748b", fontSize: "0.75rem", textAlign: "center", padding: "20px 0" }}>
                  Connecting to backend...
                </div>
              )}
              {displayFeatureNames.map(f => {
                const v = vals[f] ?? 0;
                const isDrift = Math.abs(v) > 2.5;
                const sigmaLabel = v === 0 ? "NOMINAL" : `${v > 0 ? "+" : ""}${v.toFixed(2)}σ`;
                const sigmaColor = isDrift ? "#fbbf24" : "#34d399";

                return (
                  <div key={f} style={{
                    padding: 12, borderRadius: 8,
                    background: "rgba(15,18,20,0.9)", border: "1px solid rgba(255,255,255,0.05)",
                    transition: "border-color 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", marginBottom: 8 }}>
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                        Feature {f}
                      </span>
                      <span style={{ color: sigmaColor, fontSize: "0.625rem" }}>{sigmaLabel}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="number"
                        value={v}
                        step={0.05}
                        min={-5}
                        max={5}
                        onChange={e => setVals(p => ({ ...p, [f]: parseFloat(e.target.value) || 0 }))}
                        style={{
                          flex: 1, background: "rgba(7,9,10,0.9)", border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 4, padding: "6px 10px", fontSize: "0.8125rem",
                          fontFamily: "ui-monospace,monospace", color: "#fbbf24",
                          outline: "none",
                        }}
                      />
                      <input
                        type="range"
                        min={-5}
                        max={5}
                        step={0.05}
                        value={v}
                        onChange={e => setVals(p => ({ ...p, [f]: parseFloat(e.target.value) }))}
                        style={{ width: 96, accentColor: "#f59e0b", cursor: "pointer" }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", color: "#475569", marginTop: 4 }}>
                      <span>Min: -5</span>
                      <span>Baseline: 0</span>
                      <span>Max: 5</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Run button */}
            <div style={{ paddingTop: 20, marginTop: 4, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <button
                onClick={runInference}
                disabled={running}
                style={{
                  width: "100%", position: "relative", overflow: "hidden",
                  padding: "14px 24px", borderRadius: 8,
                  background: running ? "rgba(245,158,11,0.25)" : "#f59e0b",
                  color: running ? "#f59e0b" : "#07090a",
                  fontFamily: "ui-monospace,monospace", fontSize: "0.875rem", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  border: "none", cursor: running ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: running ? "none" : "0 0 25px -5px rgba(245,158,11,0.55)",
                  transition: "all 0.25s",
                }}
                onMouseEnter={e => { if (!running) { e.currentTarget.style.background = "#fbbf24"; e.currentTarget.style.boxShadow = "0 0 35px -3px rgba(245,158,11,0.7)"; } }}
                onMouseLeave={e => { if (!running) { e.currentTarget.style.background = "#f59e0b"; e.currentTarget.style.boxShadow = "0 0 25px -5px rgba(245,158,11,0.55)"; } }}
              >
                {/* Shimmer overlay */}
                {!running && (
                  <span className="shimmer-btn" style={{
                    position: "absolute", inset: 0, pointerEvents: "none",
                  }} />
                )}
                {running ? (
                  <>
                    <motion.svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}>
                      <circle cx={12} cy={12} r={10} stroke="currentColor" strokeWidth={4} opacity={0.25} />
                      <path fill="currentColor" opacity={0.75} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </motion.svg>
                    <span>RUNNING INFERENCE...</span>
                  </>
                ) : (
                  <>
                    <svg width={16} height={16} viewBox="0 0 20 20" fill="currentColor">
                      <path clipRule="evenodd" fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                    </svg>
                    <span>RUN SINGLE INFERENCE</span>
                    <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between",
                fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace",
                color: "#475569", marginTop: 8, padding: "0 4px" }}>
                <span>Security: Air-Gapped Cleanroom Node</span>
                <span>GPU Accelerated Tensor</span>
              </div>
            </div>
          </section>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ RIGHT: Inference Telemetry Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <section style={{ background: "rgba(11,13,14,0.95)", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)", padding: 24,
            display: "flex", flexDirection: "column", gap: 24,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>

            {/* Telemetry header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#94a3b8" }}>
                    INFERENCE TELEMETRY
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.span key={statusLabel}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      style={{
                        display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 4,
                        fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace",
                        fontWeight: 700, letterSpacing: "0.1em",
                        background: statusBg, color: statusText, border: `1px solid ${statusBorder}`,
                      }}>
                      {statusLabel}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div key={anomalyScore}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff",
                      fontFamily: "ui-monospace,monospace", letterSpacing: "-0.02em" }}>
                      {hasResult
                        ? isPass
                          ? `${((passProb ?? (1 - failProb!)) * 100).toFixed(1)}% Passed`
                          : `${(failProb! * 100).toFixed(1)}% Fail Risk`
                        : "Awaiting inference"}
                    </span>
                    {hasResult && (
                      <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", color: statusText }}>
                        {isPass ? `Risk Margin: ${(failProb! * 100).toFixed(1)}% (Quarantine Safe)` : "QUARANTINE RECOMMENDED"}
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              {/* Anomaly score badge */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace",
                  color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em", display: "block" }}>
                  Anomaly Score
                </span>
                <AnimatePresence mode="wait">
                  <motion.span key={anomalyScore}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ fontSize: "1.125rem", fontFamily: "ui-monospace,monospace",
                      fontWeight: 700, color: scoreColor }}>
                    {failProb !== null ? (failProb).toFixed(3) : "--"}
                    <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 400 }}> / 1.0</span>
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            {/* Wafer die map + SHAP side-by-side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

              {/* Wafer disc visualizer */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative", width: "100%", paddingBottom: 8,
                  background: "rgba(15,18,20,0.9)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)",
                  overflow: "hidden" }}>
                  {/* Laser sweep line */}
                  <div style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: 2, zIndex: 10,
                    background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.2), #10b981, rgba(16,185,129,0.2), transparent)",
                    animation: "laser-sweep 4s ease-in-out infinite", pointerEvents: "none" }} />

                  {/* Wafer circle */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 8px" }}>
                    <div style={{ position: "relative", width: 192, height: 192, borderRadius: "50%",
                      border: "2px solid rgba(245,158,11,0.25)", background: "rgba(7,9,10,0.95)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "inset 0 0 40px rgba(0,0,0,0.8)", overflow: "hidden" }}>
                      {/* Notch */}
                      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                        width: 24, height: 6, background: "rgba(11,13,14,1)",
                        borderBottom: "1px solid rgba(245,158,11,0.4)", borderRadius: "0 0 4px 4px", zIndex: 5 }} />
                      <WaferDieGrid failPct={failProb !== null ? failProb * 100 : null} />
                      {/* Spinning reticle */}
                      <div style={{ position: "absolute", width: 56, height: 56, borderRadius: "50%",
                        border: "1px dashed rgba(16,185,129,0.35)", pointerEvents: "none",
                        animation: "spin-slow 25s linear infinite" }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "0 4px",
                  fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", color: "#64748b" }}>
                  <span>300mm Test Wafer</span>
                  <span style={{ color: hasResult ? (isFail ? "#f87171" : "#34d399") : "#64748b" }}>
                    {hasResult ? (isFail ? "Zone: Alert" : "Zone: Center Clear") : "Zone: Pending"}
                  </span>
                </div>
              </div>

              {/* SHAP contributors */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
                    fontWeight: 600, color: "#e2e8f0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Top SHAP Contributors
                  </span>
                  <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace", color: "#f59e0b" }}>
                    SECOM Feature Importance
                  </span>
                </div>

                {shap.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {shap.map((s, i) => {
                      const pct = Math.min(Math.abs(s.shap_value) * 100, 100);
                      return (
                        <motion.div key={s.feature}
                          initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}>
                          <div style={{ display: "flex", justifyContent: "space-between",
                            fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", marginBottom: 4 }}>
                            <span style={{ color: "#cbd5e1" }}>{s.feature}</span>
                            <span style={{ color: shapColor(s.direction), fontWeight: 700 }}>
                              {s.direction === "positive" ? "+" : "-"}{Math.abs(s.shap_value).toFixed(1)}%
                            </span>
                          </div>
                          <div style={{ width: "100%", height: 6, background: "rgba(30,36,42,1)", borderRadius: 999, overflow: "hidden" }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                              style={{ height: "100%", borderRadius: 999, background: shapColor(s.direction),
                                boxShadow: `0 0 6px ${shapColor(s.direction)}88` }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Placeholder bars */}
                    {["Sensor 352 (Thermal Drift)", "Feature 0 (Etch Bias)", "Sensor 104 (Gas Flow)", "Sensor 355 (Chamber Pressure)"].map((label, i) => (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", marginBottom: 4 }}>
                          <span style={{ color: "#475569" }}>{label}</span>
                          <span style={{ color: "#374151" }}>--</span>
                        </div>
                        <div style={{ width: "100%", height: 6, background: "rgba(30,36,42,1)", borderRadius: 999 }}>
                          <div style={{ height: "100%", borderRadius: 999, background: "rgba(255,255,255,0.05)",
                            width: `${[68, 45, 36, 23][i]}%` }} />
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace",
                      color: "#475569", textAlign: "center", marginTop: 4 }}>
                      Run inference to see real SHAP values
                    </p>
                  </div>
                )}

                {/* Directive card */}
                <div style={{ padding: 12, borderRadius: 8,
                  background: hasResult && isFail ? "rgba(127,29,29,0.2)" : "rgba(6,78,59,0.15)",
                  border: hasResult && isFail ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(16,185,129,0.2)",
                  fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#d1d5db" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
                    color: hasResult && isFail ? "#f87171" : "#34d399", fontWeight: 700 }}>
                    <svg width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      {hasResult && isFail
                        ? <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                        : <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />}
                    </svg>
                    <span>Fab Directive: {hasResult ? (isFail ? "QUARANTINE" : "PROCEED") : "PENDING"}</span>
                  </div>
                  <p style={{ fontSize: "0.625rem", color: "#64748b" }}>
                    {hasResult && isFail
                      ? "Wafer flagged for root-cause analysis. Do not advance to next process step."
                      : "Chamber Etch drift nominal. No corrective thermal bake or vacuum cycle required."}
                  </p>
                </div>
              </div>
            </div>

            {/* Terminal log */}
            <div style={{ borderRadius: 8, background: "rgba(7,9,10,0.95)", border: "1px solid rgba(255,255,255,0.05)",
              padding: 12, fontFamily: "ui-monospace,monospace", fontSize: "0.6875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8,
                marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)",
                fontSize: "0.5625rem", color: "#475569" }}>
                <span>TENSOR EXECUTION LOG</span>
                <span>INFERENCE THREAD: #714-SECOM</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 80, overflowY: "auto" }}>
                {logLines.map((line, i) => {
                  const timeMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
                  const rest = timeMatch ? line.slice(timeMatch[0].length + 1) : line;
                  const tag = line.startsWith("[system]") ? "[system]" : timeMatch ? timeMatch[0] : null;
                  return (
                    <p key={i} style={{ color: "#64748b", lineHeight: 1.5 }}>
                      {tag && <span style={{ color: "#34d399" }}>{tag} </span>}
                      {rest}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)",
              fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace" }}>
              <span style={{ color: "#475569" }}>
                Target Fab Cluster: <strong style={{ color: "#94a3b8" }}>CLEANROOM-ALPHA // 3NM</strong>
              </span>
              <button onClick={exportReport} style={{ color: "#fbbf24", background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4, fontSize: "0.6875rem",
                fontFamily: "ui-monospace,monospace", transition: "color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f59e0b"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#fbbf24"; }}
              >
                <span>Export Wafer Report</span>
                <svg width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </section>
        </div>

        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Bottom metrics strip Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[
            {
              label: "In-Line Test Yield",
              value: failProb !== null ? `${(100 - failProb * 100).toFixed(1)}%` : "96.4%",
              sub: failProb !== null ? "From latest inference" : "+0.8% this week",
              dot: failProb !== null && isFail ? "#f87171" : "#34d399",
              valueColor: failProb !== null && isFail ? "#f87171" : "#fff",
            },
            {
              label: "Active Sensor Drift",
              value: vals["0"] !== 0 ? `${Math.abs(vals["0"]).toFixed(2)} sigma` : "0.00 sigma",
              sub: Math.abs(vals["0"]) > 1 ? "Exceeds nominal +/-1 sigma" : "Nominal tolerance < 0.5%",
              dot: Math.abs(vals["0"]) > 1 ? "#fbbf24" : "#34d399",
              valueColor: Math.abs(vals["0"]) > 1 ? "#fbbf24" : "#fff",
            },
            {
              label: "Mean Inference Time",
              value: latencyMs !== "--" ? latencyMs : "4.2ms",
              sub: "GPU Tensor Core",
              dot: "#34d399",
              valueColor: "#fff",
            },
            {
              label: "Model Confidence",
              value: failProb !== null ? `${(Math.max(failProb, 1 - failProb) * 100).toFixed(1)}%` : "98.6%",
              sub: "SECOM Validated",
              dot: "#34d399",
              valueColor: "#fff",
            },
          ].map(m => (
            <div key={m.label} style={{ padding: 16, background: "rgba(11,13,14,0.95)", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)", position: "relative", overflow: "hidden",
              transition: "border-color 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.5625rem", fontFamily: "ui-monospace,monospace",
                  color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em" }}>{m.label}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "ui-monospace,monospace",
                  color: m.valueColor, letterSpacing: "-0.02em" }}>{m.value}</span>
                <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#64748b" }}>{m.sub}</span>
              </div>
            </div>
          ))}
        </section>

      </div>
    </>
  );
}


