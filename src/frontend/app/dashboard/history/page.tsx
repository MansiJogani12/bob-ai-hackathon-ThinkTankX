"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../src/lib/supabase";
import {
  getAnalyses,
  getCorrectiveActions,
  saveCorrectiveAction,
  type Analysis,
  type CorrectiveAction,
  type NewCorrectiveAction,
} from "../../../src/lib/analysisDb";

/* ── Design tokens ── */
const C = {
  bg: "#07090d",
  card: "rgba(10,13,18,0.9)",
  border: "rgba(30,38,52,1)",
  amber: "#f59e0b",
  amberDim: "#fbbf24",
  text: "#f4f4f5",
  secondary: "#94a3b8",
  muted: "#64748b",
  green: "#10b981",
  red: "#ef4444",
  font: "Inter, system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/* ── Helper: extract root cause labels from stored jsonb ── */
function extractRootCauseLabels(rootCauses: Record<string, unknown> | null): string[] {
  if (!rootCauses) return [];
  const causes = rootCauses["causes"];
  if (!Array.isArray(causes)) return [];
  return (causes as { label?: string }[]).slice(0, 5).map(c => c.label ?? "Unknown").filter(Boolean);
}

/* ── Helper: format date ── */
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/* ── Export helpers ── */
function exportJSON(analysis: Analysis) {
  const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analysis_${analysis.dataset_name.replace(/\s+/g, "_")}_${analysis.id.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportWaferCSV(analysis: Analysis) {
  const summary = analysis.prediction_summary as Record<string, unknown> | null;
  if (!summary) return;
  const wafers = summary["wafers"] as { wafer_id?: string; prediction?: string; fail_probability?: number; pass_probability?: number }[] | undefined;
  if (!wafers?.length) return;
  const header = "#,Wafer ID,Status,Fail Probability,Pass Probability";
  const rows = wafers.map((w, i) =>
    `${i + 1},${w.wafer_id ?? ""},${w.prediction ?? ""},${((w.fail_probability ?? 0) * 100).toFixed(2)}%,${((w.pass_probability ?? 0) * 100).toFixed(2)}%`
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wafers_${analysis.dataset_name.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportReport(analysis: Analysis) {
  const rcLabels = extractRootCauseLabels(analysis.root_causes);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Analysis Report — ${analysis.dataset_name}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:40px auto;color:#1f2328;background:#fff}
h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:24px}table{border-collapse:collapse;width:100%}
td,th{padding:8px 12px;border:1px solid #e5e7eb;font-size:0.875rem}th{background:#f7f8fa;font-weight:600}
</style></head><body>
<h1>Analysis Report: ${analysis.dataset_name}</h1>
<p>Generated: ${new Date().toLocaleString()} | ID: ${analysis.id}</p>
<h2>Summary</h2>
<table><tr><th>Metric</th><th>Value</th></tr>
<tr><td>Total Wafers</td><td>${analysis.total_records ?? "N/A"}</td></tr>
<tr><td>Pass Count</td><td>${analysis.pass_count ?? "N/A"}</td></tr>
<tr><td>Fail Count</td><td>${analysis.fail_count ?? "N/A"}</td></tr>
<tr><td>Yield %</td><td>${analysis.yield_percentage != null ? analysis.yield_percentage.toFixed(2) + "%" : "N/A"}</td></tr>
<tr><td>Fail Rate</td><td>${analysis.fail_rate != null ? analysis.fail_rate.toFixed(2) + "%" : "N/A"}</td></tr>
</table>
<h2>Top Root Causes</h2>
<ul>${rcLabels.length ? rcLabels.map(l => `<li>${l}</li>`).join("") : "<li>Data unavailable</li>"}</ul>
<h2>Created</h2><p>${fmtDate(analysis.created_at)}</p>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

/* ── Skeleton card ── */
function SkeletonCard() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
      {[80, 50, 100].map((w, i) => (
        <div key={i} style={{
          height: 12, borderRadius: 6, background: "rgba(30,38,52,0.7)", marginBottom: 10,
          width: `${w}%`, animation: "skelPulse 1.6s ease-in-out infinite",
        }} />
      ))}
    </div>
  );
}

/* ── Corrective Action Form ── */
function CorrectiveActionForm({ analysisId, userId, onSaved }: {
  analysisId: string;
  userId: string;
  onSaved: (action: CorrectiveAction) => void;
}) {
  const [form, setForm] = useState<NewCorrectiveAction>({
    action_taken: "",
    date_taken: new Date().toISOString().slice(0, 10),
    status: "OPEN",
    expected_improvement: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    if (!form.action_taken.trim()) { setErr("Action taken is required."); return; }
    setSaving(true);
    setErr(null);
    const result = await saveCorrectiveAction(userId, analysisId, form);
    setSaving(false);
    if (result) {
      onSaved(result);
      setForm({ action_taken: "", date_taken: new Date().toISOString().slice(0, 10), status: "OPEN", expected_improvement: "", notes: "" });
    } else {
      setErr("Failed to save. Please try again.");
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", background: "rgba(7,9,13,0.8)", border: `1px solid rgba(30,38,52,1)`,
    borderRadius: 6, padding: "8px 10px", color: C.text, fontFamily: C.mono, fontSize: "0.75rem",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ background: "rgba(7,9,13,0.6)", border: `1px solid rgba(245,158,11,0.2)`, borderRadius: 10, padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", marginBottom: 12, fontWeight: 700 }}>
        ADD CORRECTIVE ACTION
      </div>
      {err && <div style={{ color: "#fca5a5", fontSize: "0.7rem", fontFamily: C.mono, marginBottom: 8 }}>⚠ {err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: "0.625rem", color: C.muted, fontFamily: C.mono, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Date Taken</div>
          <input type="date" value={form.date_taken} onChange={e => setForm(f => ({ ...f, date_taken: e.target.value }))} style={fieldStyle} />
        </div>
        <div>
          <div style={{ fontSize: "0.625rem", color: C.muted, fontFamily: C.mono, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...fieldStyle, appearance: "none" }}>
            <option value="OPEN">OPEN</option>
            <option value="IN PROGRESS">IN PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: "0.625rem", color: C.muted, fontFamily: C.mono, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Action Taken *</div>
        <textarea rows={2} value={form.action_taken} onChange={e => setForm(f => ({ ...f, action_taken: e.target.value }))} style={{ ...fieldStyle, resize: "vertical" }} placeholder="Describe the corrective action taken..." />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: "0.625rem", color: C.muted, fontFamily: C.mono, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Expected Improvement</div>
        <input type="text" value={form.expected_improvement} onChange={e => setForm(f => ({ ...f, expected_improvement: e.target.value }))} style={fieldStyle} placeholder="e.g. Yield +2%" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.625rem", color: C.muted, fontFamily: C.mono, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</div>
        <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...fieldStyle, resize: "vertical" }} placeholder="Additional notes..." />
      </div>
      <button onClick={handleSave} disabled={saving} style={{
        padding: "8px 20px", borderRadius: 6, background: C.amber, color: "#000",
        fontFamily: C.mono, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em",
        border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
        textTransform: "uppercase",
      }}>
        {saving ? "SAVING..." : "SAVE ACTION"}
      </button>
    </div>
  );
}

/* ── Detail Panel ── */
function DetailPanel({ analysis, userId }: { analysis: Analysis; userId: string }) {
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLoadingActions(true);
    getCorrectiveActions(userId, analysis.id).then(a => {
      setActions(a);
      setLoadingActions(false);
    });
  }, [analysis.id, userId]);

  const rcLabels = extractRootCauseLabels(analysis.root_causes);
  const summary = analysis.prediction_summary as Record<string, unknown> | null;
  const rcCauses = (analysis.root_causes?.["causes"] as { label?: string; probability?: number; correlation?: number }[] | undefined) ?? [];
  const defects = analysis.defect_patterns as Record<string, unknown> | null;
  const defectPatternList = (defects?.["patterns"] as { id?: string; label?: string; confidence_pct?: number; primary_equipment?: string }[] | undefined) ?? [];
  const recommendations = analysis.recommendations as Record<string, unknown> | null;

  const statusColor = (s: string) => s === "COMPLETED" ? C.green : s === "IN PROGRESS" ? C.amber : C.muted;

  return (
    <div style={{ padding: "16px 0 0" }}>
      {/* Export buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          { label: "EXPORT JSON", fn: () => exportJSON(analysis) },
          { label: "EXPORT CSV", fn: () => exportWaferCSV(analysis) },
          { label: "EXPORT REPORT", fn: () => exportReport(analysis) },
        ].map(b => (
          <button key={b.label} onClick={b.fn} style={{
            padding: "6px 14px", borderRadius: 6, background: "transparent",
            border: `1px solid rgba(245,158,11,0.4)`, color: C.amber,
            fontFamily: C.mono, fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
            cursor: "pointer", textTransform: "uppercase",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >{b.label}</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Total Wafers", value: analysis.total_records ?? "N/A", color: C.text },
          { label: "Pass Count", value: analysis.pass_count ?? "N/A", color: C.green },
          { label: "Fail Count", value: analysis.fail_count ?? "N/A", color: C.red },
          { label: "Exec Time", value: (summary?.["estimated_execution_time_ms"] as string | undefined) ?? "N/A", color: C.secondary },
        ].map(k => (
          <div key={k.label} style={{ background: "rgba(7,9,13,0.7)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: "0.5625rem", fontFamily: C.mono, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: C.mono, color: k.color }}>{String(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Root Cause ranking */}
      {rcCauses.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", marginBottom: 10, fontWeight: 700 }}>ROOT CAUSE RANKING</div>
          {rcCauses.slice(0, 6).map((c, i) => {
            const pct = Math.round((c.probability ?? 0) * 100);
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: "0.75rem", color: C.text, fontFamily: C.mono }}>{c.label ?? "Unknown"}</span>
                  <span style={{ fontSize: "0.6875rem", color: C.amber, fontFamily: C.mono }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: "rgba(30,38,52,1)", borderRadius: 999 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.amber}, ${C.amberDim})`, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Defect patterns */}
      {defectPatternList.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", marginBottom: 10, fontWeight: 700 }}>DEFECT PATTERNS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {defectPatternList.slice(0, 5).map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 10px", background: "rgba(7,9,13,0.6)", border: `1px solid ${C.border}`, borderRadius: 6 }}>
                <span style={{ fontSize: "0.75rem", color: C.text, fontFamily: C.mono }}>{d.label ?? "Unknown"}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "0.625rem", color: C.muted, fontFamily: C.mono }}>{d.primary_equipment ?? ""}</span>
                  <span style={{ fontSize: "0.625rem", fontFamily: C.mono, padding: "1px 6px", borderRadius: 4,
                    background: "rgba(245,158,11,0.15)", color: C.amber, border: `1px solid rgba(245,158,11,0.3)` }}>
                    {d.confidence_pct != null ? `${d.confidence_pct}%` : "N/A"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", marginBottom: 8, fontWeight: 700 }}>RECOMMENDATIONS</div>
          <div style={{ fontSize: "0.75rem", color: C.secondary, fontFamily: C.mono, lineHeight: 1.7,
            padding: "10px 12px", background: "rgba(7,9,13,0.6)", border: `1px solid ${C.border}`, borderRadius: 8 }}>
            {JSON.stringify(recommendations, null, 2)}
          </div>
        </div>
      )}

      {/* Corrective actions list */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", fontWeight: 700 }}>
            CORRECTIVE ACTIONS {actions.length > 0 && `(${actions.length})`}
          </div>
          <button onClick={() => setShowForm(f => !f)} style={{
            padding: "4px 12px", borderRadius: 4, background: showForm ? "rgba(245,158,11,0.2)" : "transparent",
            border: `1px solid rgba(245,158,11,0.4)`, color: C.amber,
            fontFamily: C.mono, fontSize: "0.625rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em",
          }}>
            {showForm ? "CANCEL" : "+ ADD"}
          </button>
        </div>
        {showForm && <CorrectiveActionForm analysisId={analysis.id} userId={userId} onSaved={a => { setActions(prev => [a, ...prev]); setShowForm(false); }} />}
        {loadingActions ? (
          <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono }}>Loading actions...</div>
        ) : actions.length === 0 ? (
          <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono, padding: "8px 0" }}>No corrective actions logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {actions.map(a => (
              <div key={a.id} style={{ padding: "10px 14px", background: "rgba(7,9,13,0.6)", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.75rem", color: C.text, fontFamily: C.mono, fontWeight: 600 }}>{a.action_taken ?? "—"}</span>
                  <span style={{ fontSize: "0.6rem", fontFamily: C.mono, padding: "2px 6px", borderRadius: 4,
                    background: "rgba(30,38,52,0.8)", color: statusColor(a.status), border: `1px solid rgba(30,38,52,1)` }}>
                    {a.status}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: "0.625rem", color: C.muted, fontFamily: C.mono }}>
                  <span>{a.date_taken ?? "No date"}</span>
                  {a.expected_improvement && <span>Expected: {a.expected_improvement}</span>}
                </div>
                {a.notes && <div style={{ marginTop: 4, fontSize: "0.625rem", color: C.secondary, fontFamily: C.mono }}>{a.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [caFormId, setCaFormId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setError("Not authenticated."); setLoading(false); return; }
      setUserId(session.user.id);
      const data = await getAnalyses(session.user.id);
      setAnalyses(data);
    } catch {
      setError("Failed to load analyses.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* KPI computations */
  const latestYield = analyses[0]?.yield_percentage;
  const avgYield = analyses.length
    ? analyses.reduce((s, a) => s + (a.yield_percentage ?? 0), 0) / analyses.length
    : null;
  const totalWafers = analyses.reduce((s, a) => s + (a.total_records ?? 0), 0);

  const kpis = [
    { label: "Total Analyses", value: String(analyses.length), color: C.text },
    { label: "Latest Yield", value: latestYield != null ? `${latestYield.toFixed(1)}%` : "N/A", color: latestYield != null && latestYield >= 90 ? C.green : C.amber },
    { label: "Average Yield", value: avgYield != null ? `${avgYield.toFixed(1)}%` : "N/A", color: C.amberDim },
    { label: "Total Wafers", value: totalWafers > 0 ? String(totalWafers) : "N/A", color: C.secondary },
  ];

  return (
    <div style={{ fontFamily: C.font, color: C.text }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes skelPulse{0%,100%{opacity:0.4}50%{opacity:0.7}}` }} />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.15em",
          textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
          UPLOAD HISTORY &amp; DATASET MANAGEMENT
        </div>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#fff", marginBottom: 6 }}>
          Analysis History
        </h1>
        <p style={{ fontSize: "0.875rem", color: C.secondary }}>
          Review past batch analyses, root causes, defect patterns, and corrective actions.
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: "0.5625rem", fontFamily: C.mono, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: C.mono, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(127,29,29,0.4)",
          border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5",
          fontFamily: C.mono, fontSize: "0.65rem", letterSpacing: "0.04em", marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && analyses.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", background: C.card,
          border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: "1rem", color: C.text, fontWeight: 600, marginBottom: 8 }}>No analyses yet</div>
          <div style={{ fontSize: "0.875rem", color: C.muted }}>Upload a CSV batch to begin — analyses will appear here.</div>
        </div>
      )}

      {/* Analysis cards */}
      {!loading && analyses.map((analysis, idx) => {
        const isExpanded = expandedId === analysis.id;
        const showCAForm = caFormId === analysis.id;
        const rcLabels = extractRootCauseLabels(analysis.root_causes);
        const yieldColor = (analysis.yield_percentage ?? 0) >= 90 ? C.green : (analysis.yield_percentage ?? 0) >= 70 ? C.amber : C.red;

        return (
          <div key={analysis.id} style={{
            background: C.card, border: `1px solid ${isExpanded ? "rgba(245,158,11,0.4)" : C.border}`,
            borderRadius: 12, marginBottom: 12, overflow: "hidden",
            transition: "border-color 0.2s",
          }}>
            {/* Card header */}
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: "0.6rem", fontFamily: C.mono, color: C.muted, padding: "2px 6px",
                      background: "rgba(30,38,52,0.8)", borderRadius: 4, border: `1px solid ${C.border}` }}>
                      #{analyses.length - idx}
                    </span>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, color: C.text, margin: 0 }}>{analysis.dataset_name}</h3>
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: C.muted, fontFamily: C.mono }}>{fmtDate(analysis.created_at)}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setCaFormId(caFormId === analysis.id ? null : analysis.id)} style={{
                    padding: "6px 12px", borderRadius: 6, background: "transparent",
                    border: `1px solid rgba(16,185,129,0.4)`, color: C.green,
                    fontFamily: C.mono, fontSize: "0.625rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em",
                  }}>
                    + CORRECTIVE ACTION
                  </button>
                  <button onClick={() => setExpandedId(isExpanded ? null : analysis.id)} style={{
                    padding: "6px 12px", borderRadius: 6,
                    background: isExpanded ? "rgba(245,158,11,0.15)" : "transparent",
                    border: `1px solid rgba(245,158,11,0.4)`, color: C.amber,
                    fontFamily: C.mono, fontSize: "0.625rem", fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em",
                  }}>
                    {isExpanded ? "CLOSE" : "VIEW DETAILS"}
                  </button>
                </div>
              </div>

              {/* Inline CA form (quick add without needing details open) */}
              {showCAForm && !isExpanded && userId && (
                <CorrectiveActionForm analysisId={analysis.id} userId={userId}
                  onSaved={() => setCaFormId(null)} />
              )}

              {/* Metrics row */}
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: rcLabels.length > 0 ? 12 : 0 }}>
                {[
                  { label: "WAFERS", value: String(analysis.total_records ?? "N/A") },
                  { label: "PASS", value: String(analysis.pass_count ?? "N/A"), color: C.green },
                  { label: "FAIL", value: String(analysis.fail_count ?? "N/A"), color: C.red },
                  { label: "YIELD", value: analysis.yield_percentage != null ? `${analysis.yield_percentage.toFixed(1)}%` : "N/A", color: yieldColor },
                  { label: "FAIL RATE", value: analysis.fail_rate != null ? `${analysis.fail_rate.toFixed(1)}%` : "N/A", color: C.secondary },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.5rem", fontFamily: C.mono, color: C.muted, letterSpacing: "0.1em", marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, fontFamily: C.mono, color: m.color ?? C.text }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Root cause chips */}
              {rcLabels.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {rcLabels.map((label, i) => (
                    <span key={i} style={{
                      fontSize: "0.5625rem", fontFamily: C.mono, padding: "2px 8px", borderRadius: 4,
                      background: "rgba(245,158,11,0.1)", color: C.amberDim,
                      border: `1px solid rgba(245,158,11,0.25)`, letterSpacing: "0.04em",
                    }}>{label}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Expanded detail */}
            {isExpanded && userId && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "0 20px 20px" }}>
                <DetailPanel analysis={analysis} userId={userId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
