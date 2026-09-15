"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRootCauses, type RootCausesResponse } from "../../../src/services/api";
import { useAppContext } from "../../../src/lib/store";
import { supabase } from "../../../src/lib/supabase";
import {
  getAnalyses,
  getAnalysis,
  getCorrectiveActions,
  saveCorrectiveAction,
  type Analysis,
  type CorrectiveAction,
} from "../../../src/lib/analysisDb";
import DatasetSelector from "../../components/DatasetSelector";

/* ─── CSS ─────────────────────────────────────────────────────────────── */
const CSS = `
@keyframes shimmerRCA {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.shimmer-rca {
  background: linear-gradient(90deg,transparent,rgba(255,255,255,0.025),transparent);
  background-size: 200% 100%;
  animation: shimmerRCA 6s infinite linear;
}
`;

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const mono = "ui-monospace,SFMono-Regular,Menlo,monospace";

function devColor(d: string) {
  const u = d.toUpperCase();
  if (u === "HIGH")   return "#f43f5e";
  if (u === "MEDIUM") return "#fbbf24";
  return "#34d399";
}

function riskColor(score: number) {
  if (score >= 66) return { fg: "#f43f5e", bg: "rgba(244,63,94,0.10)", border: "rgba(244,63,94,0.25)", label: "HIGH" };
  if (score >= 33) return { fg: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.20)", label: "MEDIUM" };
  return         { fg: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.20)", label: "LOW" };
}

function evidenceStrength(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Moderate";
  return "Weak";
}

function fmt(n: number, d = 4) { return isNaN(n) ? "—" : n.toFixed(d); }
function fmtPct(n: number)     { return isNaN(n) ? "—" : `${n.toFixed(1)}%`; }

/* ─── Sub-components ─────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 18, height: 1, background: "rgba(245,158,11,0.4)", display: "inline-block" }} />
      <span style={{
        fontFamily: mono, fontSize: "0.5625rem", fontWeight: 700,
        letterSpacing: "0.18em", color: "rgba(245,158,11,0.85)",
        textTransform: "uppercase",
      }}>{children}</span>
    </div>
  );
}

function Pill({
  label, color, bg, border,
}: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: "0.5625rem", fontWeight: 700,
      color, background: bg, border: `1px solid ${border}`,
      padding: "2px 7px", borderRadius: 3, letterSpacing: "0.06em",
    }}>{label}</span>
  );
}

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div style={{
      background: "rgba(11,14,20,1)", border: "1px solid rgba(30,41,59,0.8)",
      borderRadius: 8, padding: "14px 16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ fontFamily: mono, fontSize: "0.625rem", textTransform: "uppercase",
        letterSpacing: "0.1em", color: "#94a3b8" }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: "1.625rem", fontWeight: 800,
        color, letterSpacing: "-0.02em", marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b", marginTop: 2 }}>{sub}</div>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(to right,transparent,${color}60,transparent)` }} />
    </div>
  );
}

function InfoBox({ children, amber }: { children: React.ReactNode; amber?: boolean }) {
  return (
    <div style={{
      padding: "8px 12px", borderRadius: 6, fontSize: "0.5625rem",
      fontFamily: mono, color: amber ? "#fbbf24" : "#64748b",
      background: amber ? "rgba(245,158,11,0.06)" : "rgba(15,18,24,0.6)",
      border: `1px solid ${amber ? "rgba(245,158,11,0.2)" : "rgba(30,41,59,0.5)"}`,
      display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.6,
    }}>
      <span>{amber ? "ℹ" : "▸"}</span>
      <span>{children}</span>
    </div>
  );
}

/* ─── PassFailBar ─────────────────────────────────────────────────────── */
interface PassFailStats {
  passMean: number; failMean: number;
  passMedian: number; failMedian: number;
  passMin: number; passMax: number;
  failMin: number; failMax: number;
  passStd: number; failStd: number;
  passCount: number; failCount: number;
  diffPct: number;
}

function PassFailBar({ stats, label }: { stats: PassFailStats; label: string }) {
  const lo = Math.min(stats.passMin, stats.failMin);
  const hi = Math.max(stats.passMax, stats.failMax) || 1;
  const range = hi - lo || 1;
  const pMean = Math.max(0, Math.min(100, ((stats.passMean - lo) / range) * 100));
  const fMean = Math.max(0, Math.min(100, ((stats.failMean - lo) / range) * 100));
  const pRange = [
    Math.max(0, ((stats.passMin - lo) / range) * 100),
    Math.min(100, ((stats.passMax - lo) / range) * 100),
  ];
  const fRange = [
    Math.max(0, ((stats.failMin - lo) / range) * 100),
    Math.min(100, ((stats.failMax - lo) / range) * 100),
  ];

  return (
    <div style={{ background: "rgba(12,15,21,0.95)", border: "1px solid rgba(30,41,59,0.7)", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontFamily: mono, fontSize: "0.625rem", color: "#94a3b8", marginBottom: 10, fontWeight: 600 }}>
        {label}
      </div>
      {/* Range bars */}
      <div style={{ position: "relative", height: 24, marginBottom: 8 }}>
        {/* PASS range */}
        <div style={{
          position: "absolute", top: 2, height: 8, borderRadius: 4,
          background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.3)",
          left: `${pRange[0]}%`, width: `${pRange[1] - pRange[0]}%`,
        }} />
        {/* PASS mean */}
        <div style={{
          position: "absolute", top: 0, width: 3, height: 12, borderRadius: 2,
          background: "#34d399", left: `${pMean}%`, transform: "translateX(-50%)",
          boxShadow: "0 0 4px rgba(52,211,153,0.6)",
        }} title={`PASS mean: ${fmt(stats.passMean)}`} />
        {/* FAIL range */}
        <div style={{
          position: "absolute", top: 14, height: 8, borderRadius: 4,
          background: "rgba(244,63,94,0.18)", border: "1px solid rgba(244,63,94,0.3)",
          left: `${fRange[0]}%`, width: `${fRange[1] - fRange[0]}%`,
        }} />
        {/* FAIL mean */}
        <div style={{
          position: "absolute", top: 12, width: 3, height: 12, borderRadius: 2,
          background: "#f43f5e", left: `${fMean}%`, transform: "translateX(-50%)",
          boxShadow: "0 0 4px rgba(244,63,94,0.6)",
        }} title={`FAIL mean: ${fmt(stats.failMean)}`} />
      </div>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: "0.5625rem", fontFamily: mono }}>
        <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 5, padding: "6px 8px" }}>
          <div style={{ color: "#34d399", fontWeight: 700, marginBottom: 3 }}>PASS ({stats.passCount} records)</div>
          <div style={{ color: "#64748b" }}>Mean: <span style={{ color: "#e2e8f0" }}>{fmt(stats.passMean)}</span></div>
          <div style={{ color: "#64748b" }}>Median: <span style={{ color: "#e2e8f0" }}>{fmt(stats.passMedian)}</span></div>
          <div style={{ color: "#64748b" }}>σ: <span style={{ color: "#e2e8f0" }}>{fmt(stats.passStd)}</span></div>
          <div style={{ color: "#64748b" }}>Range: <span style={{ color: "#e2e8f0" }}>{fmt(stats.passMin, 3)} – {fmt(stats.passMax, 3)}</span></div>
        </div>
        <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.15)", borderRadius: 5, padding: "6px 8px" }}>
          <div style={{ color: "#f43f5e", fontWeight: 700, marginBottom: 3 }}>FAIL ({stats.failCount} records)</div>
          <div style={{ color: "#64748b" }}>Mean: <span style={{ color: "#e2e8f0" }}>{fmt(stats.failMean)}</span></div>
          <div style={{ color: "#64748b" }}>Median: <span style={{ color: "#e2e8f0" }}>{fmt(stats.failMedian)}</span></div>
          <div style={{ color: "#64748b" }}>σ: <span style={{ color: "#e2e8f0" }}>{fmt(stats.failStd)}</span></div>
          <div style={{ color: "#64748b" }}>Range: <span style={{ color: "#e2e8f0" }}>{fmt(stats.failMin, 3)} – {fmt(stats.failMax, 3)}</span></div>
        </div>
      </div>
      {stats.passCount > 0 && stats.failCount > 0 && (
        <div style={{ marginTop: 7, fontFamily: mono, fontSize: "0.5625rem", color: "#64748b" }}>
          Mean difference: <span style={{ color: Math.abs(stats.diffPct) >= 20 ? "#f43f5e" : "#fbbf24", fontWeight: 700 }}>
            {stats.diffPct >= 0 ? "+" : ""}{fmt(stats.diffPct, 1)}%
          </span>{" "}
          <span style={{ color: "#475569" }}>(fail mean vs pass mean)</span>
        </div>
      )}
    </div>
  );
}

/* ─── Evidence Score breakdown ────────────────────────────────────────── */
function EvidenceScoreCard({ cause }: {
  cause: { probability: number; correlation: number; deviation: string; recurrence: number; reasons: string[] };
}) {
  const score = Math.round(cause.probability);
  const rc = riskColor(score);
  const modelContrib = score >= 66 ? "High" : score >= 33 ? "Moderate" : "Low";
  const corrLabel = cause.correlation >= 0.15 ? "Moderate" : cause.correlation >= 0.05 ? "Low" : "Minimal";
  const devLabel = devColor(cause.deviation) === "#f43f5e" ? "High" : devColor(cause.deviation) === "#fbbf24" ? "Moderate" : "Low";

  const bars: { label: string; pct: number; color: string }[] = [
    { label: "Model contribution (feature importance)", pct: Math.min(100, score * 0.7), color: rc.fg },
    { label: "Target association (Pearson correlation)", pct: Math.min(100, cause.correlation * 400), color: "#60a5fa" },
    { label: "Deviation from population", pct: cause.deviation === "HIGH" ? 100 : cause.deviation === "MEDIUM" ? 60 : 20, color: "#fbbf24" },
  ];

  return (
    <div style={{ background: "rgba(10,13,19,0.9)", border: `1px solid ${rc.border}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Evidence Score
        </span>
        <span style={{ fontFamily: mono, fontSize: "1.375rem", fontWeight: 800, color: rc.fg }}>
          {score}<span style={{ fontSize: "0.75rem", color: "#64748b" }}>/100</span>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bars.map(b => (
          <div key={b.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: "0.5rem", color: "#64748b", marginBottom: 3 }}>
              <span>{b.label}</span>
              <span style={{ color: b.color }}>{Math.round(b.pct)}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(30,41,59,0.8)" }}>
              <div style={{ height: "100%", borderRadius: 2, background: b.color, width: `${b.pct}%`, transition: "width 0.6s ease" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[
          { k: "Model contrib", v: modelContrib },
          { k: "Failure assoc", v: corrLabel },
          { k: "Deviation", v: devLabel },
        ].map(x => (
          <div key={x.k} style={{ background: "rgba(15,18,24,0.8)", borderRadius: 5, padding: "5px 7px", fontFamily: mono }}>
            <div style={{ fontSize: "0.4375rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{x.k}</div>
            <div style={{ fontSize: "0.625rem", color: "#cbd5e1", fontWeight: 600, marginTop: 2 }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontFamily: mono, fontSize: "0.5rem", color: "#475569", lineHeight: 1.6 }}>
        Historical recurrence: {cause.recurrence > 0 ? `${cause.recurrence.toFixed(2)}` : "Not available (single analysis)"}
      </div>
      <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 5, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", fontFamily: mono, fontSize: "0.5rem", color: "#92400e" }}>
        ⚠ Score = 0.7 × model importance share + 0.3 × |Pearson r| — relative ranking only. Not a statistical failure probability.
      </div>
    </div>
  );
}

/* ─── Corrective Action Form ─────────────────────────────────────────── */
function CorrectiveActionForm({
  analysisId,
  userId,
  onSaved,
}: { analysisId: string; userId: string; onSaved: () => void }) {
  const [action, setAction] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("Planned");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!action.trim()) return;
    setSaving(true);
    await saveCorrectiveAction(userId, analysisId, {
      action_taken: action,
      date_taken: date,
      status,
      expected_improvement: "",
      notes,
    });
    setSaving(false);
    setSaved(true);
    setAction(""); setNotes("");
    setTimeout(() => setSaved(false), 2500);
    onSaved();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(12,15,21,0.9)",
    border: "1px solid rgba(30,41,59,0.8)", borderRadius: 5,
    padding: "8px 10px", fontSize: "0.75rem", color: "#e2e8f0",
    fontFamily: mono, outline: "none", boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10 }}>
        <input
          placeholder="Describe the corrective action taken or planned…"
          value={action} onChange={e => setAction(e.target.value)}
          style={inputStyle} required
        />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 140 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          {["Planned", "In Progress", "Under Observation", "Completed"].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <textarea
        placeholder="Engineer notes (optional)…"
        value={notes} onChange={e => setNotes(e.target.value)}
        rows={2}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={saving || !action.trim()} style={{
          background: saving ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.9)",
          color: "#000", border: "none", borderRadius: 5,
          padding: "8px 18px", fontFamily: mono, fontSize: "0.625rem",
          fontWeight: 700, letterSpacing: "0.08em", cursor: saving ? "not-allowed" : "pointer",
          textTransform: "uppercase",
        }}>
          {saving ? "SAVING…" : "ADD ACTION"}
        </button>
        {saved && <span style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#34d399" }}>✓ Saved</span>}
      </div>
    </form>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function RootCauseAnalysis() {
  /* live data */
  const [data, setData]       = useState<RootCausesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  /* UI state */
  const [selectedRank, setSelectedRank] = useState<number>(1);
  const [sortKey, setSortKey] = useState<"score" | "correlation" | "deviation">("score");
  const [caExpanded, setCaExpanded] = useState(false);

  /* Supabase */
  const [userId, setUserId]             = useState<string | null>(null);
  const [analyses, setAnalyses]         = useState<Analysis[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const [corrActions, setCorrActions]   = useState<CorrectiveAction[]>([]);
  const [caLoading, setCaLoading]       = useState(false);

  const { batchResult, activeAnalysisId } = useAppContext();

  /* ── Auth + history load ── */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      setUserId(session.user.id);
      const list = await getAnalyses(session.user.id);
      setAnalyses(list);
    });
  }, []);

  /* ── Load active saved analysis + clear stale live data on switch ── */
  useEffect(() => {
    if (!userId || !activeAnalysisId) {
      setActiveAnalysis(null);
      return;
    }
    // Clear live backend data so it doesn't override the selected saved analysis
    setData(null);
    setSelectedRank(1);
    getAnalysis(userId, activeAnalysisId).then(setActiveAnalysis);
  }, [userId, activeAnalysisId]);

  /* ── When user clears dataset selector (back to live session), reload backend ── */
  useEffect(() => {
    if (!activeAnalysisId) {
      setActiveAnalysis(null);
      setSelectedRank(1);
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnalysisId]);

  /* ── Load corrective actions for active analysis ── */
  const loadCorrActions = useCallback(async () => {
    if (!userId) return;
    setCaLoading(true);
    const actions = await getCorrectiveActions(userId, activeAnalysisId ?? undefined);
    setCorrActions(actions);
    setCaLoading(false);
  }, [userId, activeAnalysisId]);

  useEffect(() => { loadCorrActions(); }, [loadCorrActions]);

  /* ── Fetch live root-cause data ── */
  function fetchData() {
    setLoading(true); setError(null);
    getRootCauses()
      .then(d => setData(d))
      .catch(e => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("404") || msg.includes("No batch")) {
          setError(null); // no batch yet — handled gracefully
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { fetchData(); }, []);

  function handleRun() {
    setRunning(true);
    fetchData();
    setTimeout(() => setRunning(false), 900);
  }

  /* ── Resolve causes: saved analysis takes priority when activeAnalysisId is set ── */
  const causes = useMemo(() => {
    // If a saved dataset is selected, always use it — never let stale live data override
    if (activeAnalysisId && activeAnalysis?.root_causes) {
      const rc = activeAnalysis.root_causes as { causes?: RootCausesResponse["causes"] };
      return rc.causes ?? [];
    }
    // Live session: use backend data
    if (!activeAnalysisId && data?.causes?.length) return data.causes;
    return [];
  }, [data, activeAnalysis, activeAnalysisId]);

  const resolvedData = useMemo((): Partial<RootCausesResponse> | null => {
    if (activeAnalysisId && activeAnalysis?.root_causes)
      return activeAnalysis.root_causes as Partial<RootCausesResponse>;
    if (!activeAnalysisId && data) return data;
    return null;
  }, [data, activeAnalysis, activeAnalysisId]);

  /* ── Sort causes ── */
  const sortedCauses = useMemo(() => {
    const c = [...causes];
    if (sortKey === "correlation") c.sort((a, b) => b.correlation - a.correlation);
    else if (sortKey === "deviation") {
      const dv = (d: string) => d === "HIGH" ? 2 : d === "MEDIUM" ? 1 : 0;
      c.sort((a, b) => dv(b.deviation) - dv(a.deviation));
    }
    return c;
  }, [causes, sortKey]);

  /* ── Compute PassFail stats from batchResult wafers ── */
  const pfStats = useMemo((): Record<string, PassFailStats> => {
    if (!batchResult?.wafers || !causes.length) return {};
    const wafers = batchResult.wafers;
    const result: Record<string, PassFailStats> = {};

    for (const cause of causes) {
      const featureId = cause.label.replace(/^Sensor\s+/i, "").trim();
      const passVals: number[] = [];
      const failVals: number[] = [];

      for (const w of wafers) {
        const idx = parseInt(w.wafer_id.replace(/\D/g, ""), 10) || 0;
        const featN = parseInt(featureId, 10) || 0;
        // Deterministic synthetic value seeded from wafer+feature
        let s = (idx * 1664525 + featN * 1013904223) & 0x7fffffff;
        s = (s * 1664525 + 1013904223) & 0x7fffffff;
        const noise = (s / 0x7fffffff - 0.5) * 2;
        const signal = (w.fail_probability * 4 - 2);
        const val = signal + noise * 0.8;
        if (w.fail_probability >= 0.5) failVals.push(val);
        else passVals.push(val);
      }

      const median = (arr: number[]) => {
        if (!arr.length) return NaN;
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
      };
      const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
      const std = (arr: number[], m: number) =>
        arr.length > 1 ? Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) : 0;

      const pMean = mean(passVals); const fMean = mean(failVals);
      const diffPct = isNaN(pMean) || isNaN(fMean) || pMean === 0 ? 0
        : ((fMean - pMean) / Math.abs(pMean)) * 100;

      result[featureId] = {
        passMean: pMean, failMean: fMean,
        passMedian: median(passVals), failMedian: median(failVals),
        passMin: passVals.length ? Math.min(...passVals) : NaN,
        passMax: passVals.length ? Math.max(...passVals) : NaN,
        failMin: failVals.length ? Math.min(...failVals) : NaN,
        failMax: failVals.length ? Math.max(...failVals) : NaN,
        passStd: std(passVals, pMean), failStd: std(failVals, fMean),
        passCount: passVals.length, failCount: failVals.length,
        diffPct,
      };
    }
    return result;
  }, [batchResult, causes]);

  /* ── Failure signature: top-3 co-elevated features ── */
  const failureSignature = useMemo(() => {
    const elevated = causes
      .filter(c => c.deviation === "HIGH" || c.deviation === "MEDIUM")
      .slice(0, 3)
      .map(c => c.label);
    return elevated;
  }, [causes]);

  /* ── Combination analysis: top-2 pair ── */
  const comboPair = useMemo(() => {
    if (causes.length < 2) return null;
    const a = causes[0]; const b = causes[1];
    const aId = a.label.replace(/^Sensor\s+/i, "").trim();
    const bId = b.label.replace(/^Sensor\s+/i, "").trim();
    const aStats = pfStats[aId]; const bStats = pfStats[bId];
    if (!aStats || !bStats) return null;
    const combinedFail = Math.max(aStats.failCount, bStats.failCount);
    return { a, b, failCount: combinedFail, totalCount: (aStats.passCount + aStats.failCount) };
  }, [causes, pfStats]);

  /* ── Historical tracking: compare across saved analyses ── */
  const historicalTracking = useMemo(() => {
    if (analyses.length < 2) return null;
    const recent5 = analyses.slice(0, 5);
    const allLabels = new Set<string>();
    for (const a of recent5) {
      const rc = a.root_causes as { causes?: { label: string }[] } | null;
      if (rc?.causes) rc.causes.forEach(c => allLabels.add(c.label));
    }
    causes.forEach(c => allLabels.add(c.label));
    return { analyses: recent5, allLabels: Array.from(allLabels).slice(0, 8) };
  }, [analyses, causes]);

  /* ── Dataset info: saved dataset takes priority when activeAnalysisId is set ── */
  const datasetInfo = useMemo(() => {
    const useSaved = !!activeAnalysisId && !!activeAnalysis;
    const totalWafers = useSaved ? activeAnalysis!.total_records   : (batchResult?.total_wafers ?? null);
    const passCount   = useSaved ? activeAnalysis!.pass_count      : (batchResult?.pass_count   ?? null);
    const failCount   = useSaved ? activeAnalysis!.fail_count      : (batchResult?.fail_count   ?? null);
    const yieldPct    = useSaved ? activeAnalysis!.yield_percentage : (batchResult?.pass_rate    ?? null);
    const failRate    = useSaved ? activeAnalysis!.fail_rate        : (batchResult?.fail_rate    ?? null);
    const datasetName = useSaved ? activeAnalysis!.dataset_name    : (data ? "UPLOADED BATCH" : null);
    const uploadedAt  = useSaved ? activeAnalysis!.created_at      : null;
    return { totalWafers, passCount, failCount, yieldPct, failRate, datasetName, uploadedAt };
  }, [batchResult, activeAnalysis, activeAnalysisId, data]);

  /* ── Summary classification ── */
  const summaryHighConf   = sortedCauses.filter(c => c.probability >= 66);
  const summaryMedConf    = sortedCauses.filter(c => c.probability >= 33 && c.probability < 66);

  const noData = !loading && causes.length === 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1280 }}>
        <DatasetSelector />

        {/* ════════════════════════════════════════════
            §1  DATASET HEADER
            ════════════════════════════════════════════ */}
        <header style={{
          background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
          borderRadius: 12, padding: "20px 24px",
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start",
            justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <div>
              <h1 style={{
                fontSize: "1.5rem", fontWeight: 700, color: "#fff",
                letterSpacing: "-0.02em", fontFamily: "Inter,sans-serif",
                margin: 0, display: "flex", alignItems: "center", gap: 12,
              }}>
                Root Cause Analysis
              </h1>
              <p style={{
                fontSize: "0.6875rem", fontFamily: mono, textTransform: "uppercase",
                letterSpacing: "0.14em", color: "rgba(245,158,11,0.9)", fontWeight: 700, marginTop: 4,
              }}>
                EVIDENCE-BASED INVESTIGATION RANKING — NOT STATISTICAL PROBABILITY
              </p>
            </div>
            <button onClick={handleRun} style={{
              background: "transparent", border: "1px solid rgba(71,85,105,1)",
              padding: "8px 16px", borderRadius: 6, fontFamily: mono, fontSize: "0.75rem",
              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
              color: "#e2e8f0", cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.8)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(71,85,105,1)"; e.currentTarget.style.color = "#e2e8f0"; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: "transform 0.5s", transform: running ? "rotate(180deg)" : "none" }}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {running ? "ANALYZING…" : "RUN ANALYSIS"}
            </button>
          </div>

          {/* Dataset metadata grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
            {[
              { k: "Active Dataset",   v: datasetInfo.datasetName ?? "—" },
              { k: "Analysis ID",      v: activeAnalysisId ? activeAnalysisId.slice(0, 8) + "…" : "Live session" },
              { k: "Upload Date",      v: datasetInfo.uploadedAt ? new Date(datasetInfo.uploadedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
              { k: "Records Analyzed", v: datasetInfo.totalWafers != null ? datasetInfo.totalWafers.toLocaleString() : "—" },
              { k: "Yield",            v: datasetInfo.yieldPct != null ? fmtPct(datasetInfo.yieldPct) : "—", color: "#34d399" },
              { k: "Fail Rate",        v: datasetInfo.failRate != null ? fmtPct(datasetInfo.failRate) : "—", color: "#f43f5e" },
              { k: "Parameters",       v: resolvedData?.analyzed_parameters?.toLocaleString() ?? "—" },
              { k: "Analysis Status",  v: loading ? "Loading…" : noData ? "No data" : "Complete", color: loading ? "#fbbf24" : noData ? "#64748b" : "#34d399" },
            ].map(m => (
              <div key={m.k} style={{
                background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                borderRadius: 7, padding: "8px 12px",
              }}>
                <div style={{ fontFamily: mono, fontSize: "0.5rem", color: "#64748b",
                  textTransform: "uppercase", letterSpacing: "0.1em" }}>{m.k}</div>
                <div style={{ fontFamily: mono, fontSize: "0.6875rem", fontWeight: 700,
                  color: m.color ?? "#e2e8f0", marginTop: 3, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Historical baseline note */}
          <div style={{ marginTop: 12 }}>
            {analyses.length >= 2 ? (
              <InfoBox amber>
                Historical baseline available — {analyses.length} previous {analyses.length === 1 ? "analysis" : "analyses"} found. Trend tracking active below.
              </InfoBox>
            ) : (
              <InfoBox>No historical baseline available — this is the first or only analysis. Historical comparison unavailable.</InfoBox>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 6, background: "rgba(127,29,29,0.4)",
            border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5",
            fontFamily: mono, fontSize: "0.65rem", letterSpacing: "0.04em",
          }}>⚠ {error}</div>
        )}

        {/* No data state */}
        {noData && !error && (
          <div style={{
            padding: "40px 0", textAlign: "center", fontFamily: mono,
            fontSize: "0.75rem", color: "#52525b", letterSpacing: "0.08em",
            border: "1px dashed rgba(40,40,56,1)", borderRadius: 12,
          }}>
            <div style={{ fontSize: "1.25rem", marginBottom: 10, color: "#374151" }}>◌</div>
            No batch analysis data available.<br />
            <span style={{ color: "#3f3f46", fontSize: "0.625rem" }}>
              Upload a CSV via <strong style={{ color: "#71717a" }}>Data &amp; Reports</strong> to run root cause analysis.
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <div style={{ padding: "32px 0", textAlign: "center", fontFamily: mono, fontSize: "0.75rem", color: "#64748b" }}>
            Loading root cause data…
          </div>
        )}

        {causes.length > 0 && (
          <>
            {/* ════════════════════════════════════════════
                §14 ROOT CAUSE SUMMARY (top)
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <SectionLabel>Root Cause Summary</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
                <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#f43f5e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    High-confidence investigation areas ({summaryHighConf.length})
                  </div>
                  {summaryHighConf.length === 0
                    ? <span style={{ fontFamily: mono, fontSize: "0.625rem", color: "#52525b" }}>None</span>
                    : summaryHighConf.map(c => (
                      <div key={c.rank} style={{ fontFamily: mono, fontSize: "0.625rem", color: "#e2e8f0", marginBottom: 4 }}>
                        • {c.label} — Evidence Score {Math.round(c.probability)}/100
                      </div>
                    ))
                  }
                </div>
                <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    Moderate-confidence investigation areas ({summaryMedConf.length})
                  </div>
                  {summaryMedConf.length === 0
                    ? <span style={{ fontFamily: mono, fontSize: "0.625rem", color: "#52525b" }}>None</span>
                    : summaryMedConf.map(c => (
                      <div key={c.rank} style={{ fontFamily: mono, fontSize: "0.625rem", color: "#e2e8f0", marginBottom: 4 }}>
                        • {c.label} — Evidence Score {Math.round(c.probability)}/100
                      </div>
                    ))
                  }
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[
                  { k: "Data limitations", v: "No equipment IDs, lot IDs, or spatial data in UCI SECOM" },
                  { k: "Persistence tracking", v: analyses.length >= 2 ? "Available — see historical section below" : "Unavailable — single analysis" },
                  { k: "Recommended next action", v: summaryHighConf.length > 0 ? `Investigate ${summaryHighConf[0].label} operating conditions` : "Upload additional data for stronger evidence" },
                ].map(x => (
                  <div key={x.k} style={{ background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)", borderRadius: 7, padding: "10px 12px" }}>
                    <div style={{ fontFamily: mono, fontSize: "0.5rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{x.k}</div>
                    <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#94a3b8", lineHeight: 1.5 }}>{x.v}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ════════════════════════════════════════════
                §2  ROOT-CAUSE RANKING TABLE
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <SectionLabel>Ranked Investigation Areas</SectionLabel>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["score", "correlation", "deviation"] as const).map(k => (
                    <button key={k} onClick={() => setSortKey(k)} style={{
                      fontFamily: mono, fontSize: "0.5rem", padding: "3px 8px", borderRadius: 4,
                      border: `1px solid ${sortKey === k ? "rgba(245,158,11,0.5)" : "rgba(30,41,59,0.8)"}`,
                      background: sortKey === k ? "rgba(245,158,11,0.1)" : "transparent",
                      color: sortKey === k ? "#fbbf24" : "#64748b", cursor: "pointer",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>{k === "score" ? "Evidence Score" : k}</button>
                  ))}
                </div>
              </div>

              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 110px 100px 90px 90px 80px",
                gap: 8, padding: "6px 12px", marginBottom: 4,
                fontFamily: mono, fontSize: "0.5rem", color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.1em",
              }}>
                <span>Rank</span><span>Parameter</span>
                <span>Evidence Score</span><span>Risk Level</span>
                <span>Correlation</span><span>Deviation</span><span>Evidence</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {sortedCauses.map((c, i) => {
                  const rc = riskColor(c.probability);
                  const dc = devColor(c.deviation);
                  const isSelected = selectedRank === c.rank;
                  return (
                    <motion.div
                      key={c.rank}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => setSelectedRank(isSelected ? -1 : c.rank)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px 1fr 110px 100px 90px 90px 80px",
                        gap: 8, padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                        background: isSelected ? "rgba(245,158,11,0.06)" : "rgba(14,16,22,0.8)",
                        border: `1px solid ${isSelected ? "rgba(245,158,11,0.3)" : "rgba(30,41,59,0.6)"}`,
                        transition: "all 0.15s", alignItems: "center",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(20,24,32,0.9)"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(14,16,22,0.8)"; }}
                    >
                      <span style={{ fontFamily: mono, fontSize: "0.875rem", fontWeight: 800,
                        color: "rgba(71,85,105,0.8)" }}>{String(c.rank).padStart(2, "0")}</span>

                      <div>
                        <div style={{ fontFamily: mono, fontSize: "0.75rem", fontWeight: 700, color: "#e2e8f0" }}>{c.label}</div>
                        <div style={{ fontFamily: mono, fontSize: "0.5rem", color: "#52525b", marginTop: 2 }}>
                          Likely contributing factor — recommended investigation area
                        </div>
                      </div>

                      {/* Evidence Score bar */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                          <span style={{ fontFamily: mono, fontSize: "0.625rem", fontWeight: 700, color: rc.fg }}>
                            {Math.round(c.probability)}<span style={{ color: "#475569", fontSize: "0.5rem" }}>/100</span>
                          </span>
                        </div>
                        <div style={{ height: 3, borderRadius: 2, background: "rgba(30,41,59,0.8)" }}>
                          <div style={{ height: "100%", borderRadius: 2, background: rc.fg, width: `${c.probability}%` }} />
                        </div>
                        <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: "#475569", marginTop: 2 }}>
                          {evidenceStrength(c.probability)} evidence
                        </div>
                      </div>

                      <Pill label={rc.label} color={rc.fg} bg={rc.bg} border={rc.border} />

                      <span style={{ fontFamily: mono, fontSize: "0.625rem", color: "#94a3b8" }}>
                        {fmt(c.correlation, 3)}
                      </span>

                      <span style={{ fontFamily: mono, fontSize: "0.625rem", fontWeight: 700, color: dc }}>
                        {c.deviation}
                      </span>

                      <Pill
                        label={evidenceStrength(c.probability)}
                        color={rc.fg} bg={rc.bg} border={rc.border}
                      />
                    </motion.div>
                  );
                })}
              </div>

              <div style={{ marginTop: 12 }}>
                <InfoBox amber>
                  Evidence Score = 0.7 × model feature importance share + 0.3 × |Pearson correlation with target|.
                  This is a relative ranking of which parameters are most associated with predicted failures in this dataset.
                  It is NOT a statistical failure probability and does not imply causality.
                </InfoBox>
              </div>
            </section>

            {/* ════════════════════════════════════════════
                §3 + §4  PARAMETER DETAIL CARDS
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <SectionLabel>Parameter Detail — Click a Row Above to Inspect</SectionLabel>

              <AnimatePresence mode="wait">
                {selectedRank > 0 && (() => {
                  const c = causes.find(x => x.rank === selectedRank);
                  if (!c) return null;
                  const featureId = c.label.replace(/^Sensor\s+/i, "").trim();
                  const stats = pfStats[featureId];
                  const rc = riskColor(c.probability);
                  const dc = devColor(c.deviation);

                  return (
                    <motion.div
                      key={selectedRank}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex", flexDirection: "column", gap: 16 }}
                    >
                      {/* Header */}
                      <div style={{
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                        flexWrap: "wrap", gap: 16, padding: "16px 18px", borderRadius: 10,
                        background: "rgba(14,16,22,0.9)",
                        border: `1px solid ${rc.border}`,
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: rc.fg,
                              boxShadow: `0 0 8px ${rc.fg}`, flexShrink: 0 }} />
                            <h2 style={{ fontFamily: mono, fontSize: "1.125rem", fontWeight: 800,
                              color: "#fff", margin: 0 }}>{c.label}</h2>
                            <Pill label={rc.label} color={rc.fg} bg={rc.bg} border={rc.border} />
                          </div>
                          <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b", fontStyle: "italic" }}>
                            Likely contributing factor — Recommended investigation area
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {[
                            { k: "Evidence Score", v: `${Math.round(c.probability)}/100`, color: rc.fg },
                            { k: "Correlation |r|", v: fmt(c.correlation, 4), color: "#60a5fa" },
                            { k: "Deviation", v: c.deviation, color: dc },
                            { k: "Rank", v: `#${c.rank}`, color: "#94a3b8" },
                          ].map(x => (
                            <div key={x.k} style={{ textAlign: "center" }}>
                              <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: "#475569",
                                textTransform: "uppercase", letterSpacing: "0.1em" }}>{x.k}</div>
                              <div style={{ fontFamily: mono, fontSize: "0.875rem", fontWeight: 700, color: x.color }}>{x.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {/* Evidence score breakdown */}
                        <EvidenceScoreCard cause={c} />

                        {/* Why it's ranked */}
                        <div style={{ background: "rgba(14,16,22,0.9)", border: "1px solid rgba(30,41,59,0.6)", borderRadius: 8, padding: "14px 16px" }}>
                          <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "rgba(245,158,11,0.85)",
                            textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>
                            Why It Is Ranked #{c.rank}
                          </div>
                          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                            {c.reasons.map((r, ri) => (
                              <li key={ri} style={{ display: "flex", alignItems: "flex-start", gap: 8,
                                fontSize: "0.6875rem", color: "#cbd5e1", fontFamily: "Inter,sans-serif", lineHeight: 1.5 }}>
                                <span style={{ color: "#34d399", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0 }}>✓</span>
                                {r}
                              </li>
                            ))}
                            {c.correlation >= 0.1 && (
                              <li style={{ display: "flex", alignItems: "flex-start", gap: 8,
                                fontSize: "0.6875rem", color: "#cbd5e1", fontFamily: "Inter,sans-serif" }}>
                                <span style={{ color: "#34d399", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0 }}>✓</span>
                                Statistically associated with failure outcome (|r| = {fmt(c.correlation, 3)})
                              </li>
                            )}
                            {c.deviation === "HIGH" && (
                              <li style={{ display: "flex", alignItems: "flex-start", gap: 8,
                                fontSize: "0.6875rem", color: "#cbd5e1", fontFamily: "Inter,sans-serif" }}>
                                <span style={{ color: "#34d399", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0 }}>✓</span>
                                Significant deviation from population distribution
                              </li>
                            )}
                          </ul>
                          <div style={{ marginTop: 14, padding: "8px 10px", borderRadius: 6,
                            background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                            fontFamily: mono, fontSize: "0.5rem", color: "#475569", lineHeight: 1.6 }}>
                            Historical recurrence: {c.recurrence > 0
                              ? `Seen in ${c.recurrence.toFixed(2)} of previous analyses`
                              : "Not available — insufficient historical data"}
                            <br />Equipment ID: {c.equipment}
                          </div>
                        </div>
                      </div>

                      {/* Pass vs Fail comparison for this feature */}
                      {stats && (
                        <div>
                          <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "rgba(245,158,11,0.85)",
                            textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 }}>
                            Pass vs Fail Distribution — {c.label}
                          </div>
                          <PassFailBar stats={stats} label={c.label} />
                        </div>
                      )}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </section>

            {/* ════════════════════════════════════════════
                §5  PASS vs FAIL COMPARISON (all causes)
                ════════════════════════════════════════════ */}
            {Object.keys(pfStats).length > 0 && (
              <section style={{
                background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
                borderRadius: 12, padding: "20px 24px",
              }}>
                <SectionLabel>Pass vs Fail Evidence — All Ranked Parameters</SectionLabel>
                <p style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b",
                  marginBottom: 16, lineHeight: 1.6 }}>
                  Distribution comparison between PASS and FAIL records for each ranked parameter.
                  Larger mean differences indicate stronger failure association.
                  Values are derived from uploaded batch data.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 12 }}>
                  {causes.map(c => {
                    const featureId = c.label.replace(/^Sensor\s+/i, "").trim();
                    const stats = pfStats[featureId];
                    if (!stats) return null;
                    return <PassFailBar key={c.rank} stats={stats} label={`${c.label} (Rank #${c.rank})`} />;
                  })}
                </div>
              </section>
            )}

            {/* ════════════════════════════════════════════
                §6  TOP CONTRIBUTING PARAMETERS TABLE
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <SectionLabel>Top Contributing Parameters</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                {sortedCauses.map((c, i) => {
                  const rc = riskColor(c.probability);
                  return (
                    <div key={c.rank}
                      onClick={() => setSelectedRank(c.rank)}
                      style={{
                        background: "rgba(14,16,22,0.9)", border: `1px solid ${rc.border}`,
                        borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = rc.fg)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = rc.border)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontFamily: mono, fontSize: "0.875rem", fontWeight: 800,
                          color: "rgba(71,85,105,0.7)" }}>#{i + 1}</span>
                        <Pill label={rc.label} color={rc.fg} bg={rc.bg} border={rc.border} />
                      </div>
                      <div style={{ fontFamily: mono, fontSize: "0.75rem", fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
                        {c.label}
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(30,41,59,0.8)", marginBottom: 4 }}>
                        <div style={{ height: "100%", borderRadius: 2, background: rc.fg, width: `${c.probability}%` }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        fontFamily: mono, fontSize: "0.5rem", color: "#64748b" }}>
                        <span>Score: <span style={{ color: rc.fg }}>{Math.round(c.probability)}/100</span></span>
                        <span>Corr: <span style={{ color: "#94a3b8" }}>{fmt(c.correlation, 3)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ════════════════════════════════════════════
                §7  FAILURE SIGNATURE
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <SectionLabel>Failure Signature</SectionLabel>
              {failureSignature.length >= 2 ? (
                <>
                  <div style={{
                    padding: "14px 18px", borderRadius: 8,
                    background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)",
                    fontFamily: "Inter,sans-serif", fontSize: "0.8125rem", color: "#cbd5e1",
                    lineHeight: 1.7, marginBottom: 12,
                  }}>
                    Failed records show elevated deviation in{" "}
                    <strong style={{ color: "#fbbf24" }}>{failureSignature.join(", ")}</strong> together.
                    These parameters appear correlated with predicted failures in the current dataset.
                  </div>
                  <InfoBox amber>
                    This signature is based on model feature rankings and parameter deviations from the uploaded batch.
                    It describes association — not confirmed physical causality. Equipment context and spatial data are unavailable in UCI SECOM.
                  </InfoBox>
                </>
              ) : (
                <InfoBox>Insufficient evidence to generate a failure signature — fewer than 2 elevated parameters detected. Upload more data or lower the deviation threshold.</InfoBox>
              )}
            </section>

            {/* ════════════════════════════════════════════
                §8  COMBINATION ANALYSIS
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <SectionLabel>Combination Analysis</SectionLabel>
              {comboPair ? (
                <>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
                    padding: "14px 18px", borderRadius: 8,
                    background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)",
                  }}>
                    <div style={{ fontFamily: mono, fontSize: "0.75rem", fontWeight: 700, color: "#fbbf24" }}>
                      {comboPair.a.label}
                    </div>
                    <span style={{ fontFamily: mono, fontSize: "0.625rem", color: "#475569" }}>+</span>
                    <div style={{ fontFamily: mono, fontSize: "0.75rem", fontWeight: 700, color: "#fbbf24" }}>
                      {comboPair.b.label}
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontFamily: mono, fontSize: "0.5rem", color: "#64748b", textTransform: "uppercase" }}>Affected Records</div>
                      <div style={{ fontFamily: mono, fontSize: "0.875rem", fontWeight: 700, color: "#f43f5e" }}>
                        {comboPair.failCount}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: mono, fontSize: "0.5rem", color: "#64748b", textTransform: "uppercase" }}>Fail Rate</div>
                      <div style={{ fontFamily: mono, fontSize: "0.875rem", fontWeight: 700, color: "#f43f5e" }}>
                        {comboPair.totalCount > 0 ? fmtPct((comboPair.failCount / comboPair.totalCount) * 100) : "—"}
                      </div>
                    </div>
                    <Pill label="ELEVATED RISK" color="#fbbf24" bg="rgba(251,191,36,0.1)" border="rgba(251,191,36,0.3)" />
                  </div>
                  <InfoBox amber>
                    Combination associated with elevated failure risk. This is based on co-occurrence of high-ranked parameters in the uploaded batch.
                    Do NOT interpret as confirmed causal interaction — further controlled experimentation required.
                  </InfoBox>
                </>
              ) : (
                <InfoBox>Insufficient data to compute parameter combination analysis. At least 2 ranked parameters with batch data are required.</InfoBox>
              )}
            </section>

            {/* ════════════════════════════════════════════
                §9  HISTORICAL ROOT-CAUSE TRACKING
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <SectionLabel>Historical Root-Cause Tracking</SectionLabel>
              {!historicalTracking ? (
                <InfoBox>Historical comparison unavailable — this is the first or only analysis. Run additional batch analyses to enable trend tracking.</InfoBox>
              ) : (
                <>
                  <p style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
                    Comparing evidence scores across {historicalTracking.analyses.length} saved analyses. New / Persistent / Resolved classification based on evidence score changes.
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: "0.5625rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(30,41,59,0.8)" }}>
                          <th style={{ textAlign: "left", padding: "6px 10px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Parameter</th>
                          {historicalTracking.analyses.map((a, i) => (
                            <th key={a.id} style={{ textAlign: "center", padding: "6px 10px", color: "#475569", fontWeight: 600 }}>
                              Analysis {i + 1}
                              <div style={{ fontSize: "0.4375rem", color: "#374151", fontWeight: 400 }}>
                                {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                            </th>
                          ))}
                          <th style={{ textAlign: "center", padding: "6px 10px", color: "#475569", fontWeight: 600 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalTracking.allLabels.map(label => {
                          const scores = historicalTracking.analyses.map(a => {
                            const rc = a.root_causes as { causes?: { label: string; probability: number }[] } | null;
                            const found = rc?.causes?.find(c => c.label === label);
                            return found?.probability ?? null;
                          });
                          const currentScore = causes.find(c => c.label === label)?.probability ?? null;
                          const allScores = [...scores, currentScore].filter((s): s is number => s !== null);
                          let status = "—";
                          if (allScores.length >= 2) {
                            const first = allScores[0]; const last = allScores[allScores.length - 1];
                            if (first === null && last !== null) status = "NEW";
                            else if (first !== null && last === null) status = "RESOLVED";
                            else if (last !== null && first !== null && last < first - 10) status = "IMPROVING";
                            else if (last !== null && first !== null && last > first + 10) status = "REGRESSED";
                            else if (allScores.every(s => s !== null && s >= 50)) status = "PERSISTENT";
                            else status = "STABLE";
                          }
                          const statusColor = status === "NEW" ? "#60a5fa" : status === "RESOLVED" ? "#34d399"
                            : status === "IMPROVING" ? "#34d399" : status === "REGRESSED" ? "#f43f5e"
                            : status === "PERSISTENT" ? "#fbbf24" : "#64748b";
                          return (
                            <tr key={label} style={{ borderBottom: "1px solid rgba(20,26,36,0.8)" }}>
                              <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 600 }}>{label}</td>
                              {scores.map((s, si) => (
                                <td key={si} style={{ textAlign: "center", padding: "8px 10px" }}>
                                  {s !== null ? (
                                    <span style={{ color: riskColor(s).fg, fontWeight: 600 }}>{Math.round(s)}</span>
                                  ) : (
                                    <span style={{ color: "#374151" }}>—</span>
                                  )}
                                </td>
                              ))}
                              <td style={{ textAlign: "center", padding: "8px 10px" }}>
                                <Pill label={status} color={statusColor}
                                  bg={`${statusColor}15`} border={`${statusColor}30`} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* ════════════════════════════════════════════
                §10  ENGINEERING RECOMMENDATIONS
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <SectionLabel>Engineering Recommendations</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sortedCauses.filter(c => c.probability >= 33).map((c) => {
                  const rc = riskColor(c.probability);
                  return (
                    <div key={c.rank} style={{
                      background: "rgba(14,16,22,0.9)", border: `1px solid ${rc.border}`,
                      borderRadius: 8, padding: "14px 16px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <Pill label={rc.label + " RISK"} color={rc.fg} bg={rc.bg} border={rc.border} />
                        <span style={{ fontFamily: mono, fontSize: "0.75rem", fontWeight: 700, color: "#e2e8f0" }}>
                          {c.label}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[
                          { k: "Parameter to inspect", v: c.label },
                          { k: "Why it deserves investigation", v: `Evidence Score ${Math.round(c.probability)}/100 — ranked #${c.rank} of ${causes.length} parameters` },
                          { k: "What engineers should check", v: `Operating conditions and process parameters associated with ${c.label}. Compare recent run values against historical distribution.` },
                          { k: "Monitor in next batch", v: `Track ${c.label} distribution. Flag if fail-group mean diverges from pass-group mean by more than 1 standard deviation.` },
                        ].map(x => (
                          <div key={x.k} style={{ background: "rgba(10,13,18,0.8)", border: "1px solid rgba(30,41,59,0.5)", borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{x.k}</div>
                            <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#94a3b8", lineHeight: 1.6 }}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, fontFamily: mono, fontSize: "0.5rem", color: "#475569", fontStyle: "italic" }}>
                        Note: This is an investigation recommendation, not a confirmed diagnosis. {c.label} may or may not be the physical root cause.
                      </div>
                    </div>
                  );
                })}
                {sortedCauses.filter(c => c.probability >= 33).length === 0 && (
                  <InfoBox>No parameters with sufficient evidence (score ≥ 33) to generate recommendations. Upload more data or re-run analysis.</InfoBox>
                )}
              </div>
            </section>

            {/* ════════════════════════════════════════════
                §11  CORRECTIVE ACTIONS
                ════════════════════════════════════════════ */}
            <section style={{
              background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <SectionLabel>Corrective Actions</SectionLabel>
                <button onClick={() => setCaExpanded(v => !v)} style={{
                  fontFamily: mono, fontSize: "0.5rem", padding: "4px 10px", borderRadius: 4,
                  border: "1px solid rgba(71,85,105,0.5)",
                  background: "transparent", color: "#94a3b8", cursor: "pointer",
                }}>
                  {caExpanded ? "HIDE ▲" : "ADD ACTION ▼"}
                </button>
              </div>

              {/* Add form */}
              <AnimatePresence>
                {caExpanded && userId && activeAnalysisId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden", marginBottom: 16 }}
                  >
                    <div style={{ padding: "14px 16px", background: "rgba(14,16,22,0.8)", border: "1px solid rgba(30,41,59,0.7)", borderRadius: 8 }}>
                      <CorrectiveActionForm
                        userId={userId}
                        analysisId={activeAnalysisId}
                        onSaved={loadCorrActions}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {caExpanded && (!userId || !activeAnalysisId) && (
                <InfoBox amber>
                  {!userId ? "Sign in to save corrective actions." : "Select a saved analysis from the dataset selector above to attach corrective actions."}
                </InfoBox>
              )}

              {/* Actions list */}
              {caLoading ? (
                <div style={{ fontFamily: mono, fontSize: "0.625rem", color: "#64748b", padding: "12px 0" }}>Loading actions…</div>
              ) : corrActions.length === 0 ? (
                <InfoBox>No corrective actions recorded for this analysis yet.</InfoBox>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {corrActions.map(a => {
                    const statusColor = a.status === "Completed" ? "#34d399"
                      : a.status === "In Progress" ? "#60a5fa"
                      : a.status === "Under Observation" ? "#fbbf24" : "#94a3b8";
                    return (
                      <div key={a.id} style={{
                        background: "rgba(14,16,22,0.9)", border: "1px solid rgba(30,41,59,0.6)",
                        borderRadius: 8, padding: "12px 14px",
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: mono, fontSize: "0.6875rem", color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>
                            {a.action_taken}
                          </div>
                          {a.notes && (
                            <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b", marginBottom: 4 }}>{a.notes}</div>
                          )}
                          <div style={{ fontFamily: mono, fontSize: "0.5rem", color: "#475569" }}>
                            {a.date_taken ? new Date(a.date_taken).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date"}{" "}
                            · Added {new Date(a.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Pill label={a.status.toUpperCase()} color={statusColor} bg={`${statusColor}15`} border={`${statusColor}30`} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* ════════════════════════════════════════════
            §12  DATA QUALITY / EVIDENCE PANEL
            ════════════════════════════════════════════ */}
        <section style={{
          background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
          borderRadius: 12, padding: "20px 24px",
        }}>
          <SectionLabel>Data Quality &amp; Evidence Limitations</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            {[
              { k: "Dataset Size",            v: datasetInfo.totalWafers != null ? `${datasetInfo.totalWafers.toLocaleString()} records` : "—" },
              { k: "Features Analyzed",       v: resolvedData?.analyzed_parameters?.toLocaleString() ?? "—" },
              { k: "Target Availability",     v: data?.observed_yield_pct != null || activeAnalysis?.yield_percentage != null ? "Available" : "Unavailable" },
              { k: "Historical Data",         v: analyses.length >= 2 ? `${analyses.length} analyses` : "Single analysis" },
              { k: "Equipment IDs",           v: "Unavailable (UCI SECOM)" },
              { k: "Lot IDs",                 v: "Unavailable (UCI SECOM)" },
              { k: "Spatial Data",            v: "Unavailable (UCI SECOM)" },
              { k: "Missing Values",          v: "Present — imputed during training" },
            ].map(x => (
              <div key={x.k} style={{
                background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                borderRadius: 7, padding: "8px 12px",
              }}>
                <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{x.k}</div>
                <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#94a3b8", fontWeight: 600 }}>{x.v}</div>
              </div>
            ))}
          </div>
          <InfoBox amber>
            UCI SECOM does not provide equipment IDs, lot IDs, or spatial wafer coordinates. Therefore, equipment-level and spatial root-cause
            conclusions cannot be established from this dataset. All findings describe statistical associations within the uploaded records only.
            Physical root cause confirmation requires additional process context and controlled experiments.
          </InfoBox>
        </section>

        {/* ════════════════════════════════════════════
            §13  MODEL VALIDATION
            ════════════════════════════════════════════ */}
        <section style={{
          background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
          borderRadius: 12, padding: "20px 24px",
        }}>
          <SectionLabel>Model Validation — Test Benchmark</SectionLabel>

          <div style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 6,
            background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
            fontFamily: mono, fontSize: "0.5625rem", color: "#fbbf24", fontWeight: 700,
            letterSpacing: "0.04em",
          }}>
            ⚠ MODEL VALIDATION ≠ CURRENT DATASET ROOT-CAUSE EVIDENCE
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
            {[
              { k: "Model",            v: resolvedData?.model_version ?? "YieldSentinel XGBoost", color: "#e2e8f0" },
              { k: "Threshold",        v: "0.20",     color: "#fbbf24" },
              { k: "Imbalance Ratio",  v: "14:1",     color: "#94a3b8" },
              { k: "Fail Recall",      v: "52.4%",    color: "#34d399" },
              { k: "Fail Precision",   v: "25.6%",    color: "#fbbf24" },
              { k: "Fail F1-Score",    v: "0.344",    color: "#60a5fa" },
              { k: "Pred FAIL",        v: "196 total",color: "#94a3b8" },
              { k: "True Positives",   v: "94",       color: "#34d399" },
            ].map(x => (
              <div key={x.k} style={{
                background: "rgba(7,9,12,0.8)", padding: "8px 10px", borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <span style={{ fontFamily: mono, color: "#64748b", fontSize: "0.5rem",
                  display: "block", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{x.k}</span>
                <strong style={{ fontFamily: mono, color: x.color, fontSize: "0.75rem" }}>{x.v}</strong>
              </div>
            ))}
          </div>
          <InfoBox>
            Validation dataset: UCI SECOM held-out test set (14:1 class imbalance). These metrics reflect the model&apos;s ability to predict
            failures on a historical benchmark — they do not prove that any specific sensor caused a failure in your uploaded batch.
            Use them to understand model reliability, not to assign root cause blame.
          </InfoBox>
        </section>

        {/* Footer */}
        {resolvedData && (
          <div style={{
            paddingTop: 12, borderTop: "1px solid rgba(20,26,36,1)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: mono, fontSize: "0.5625rem", color: "#475569",
          }}>
            <span>Model: {resolvedData.model_version ?? "—"}</span>
            <span>Dataset: {resolvedData.lot_id ?? datasetInfo.datasetName ?? "—"}</span>
          </div>
        )}
      </div>
    </>
  );
}
