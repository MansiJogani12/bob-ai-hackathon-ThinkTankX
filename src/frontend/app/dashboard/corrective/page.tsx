"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../../src/lib/store";
import { supabase } from "../../../src/lib/supabase";
import {
  getAnalyses,
  getAnalysis,
  getCorrectiveActions,
  saveCorrectiveAction,
  updateCorrectiveAction,
  type Analysis,
  type CorrectiveAction,
} from "../../../src/lib/analysisDb";
import DatasetSelector from "../../components/DatasetSelector";
import type { CorrectiveAIRequest } from "../../api/corrective-ai/route";

/* ─── CSS ─────────────────────────────────────────────────────────────── */
const CSS = `
@keyframes shimmerCA {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.shimmer-ca {
  background: linear-gradient(90deg,transparent,rgba(255,255,255,0.025),transparent);
  background-size: 200% 100%;
  animation: shimmerCA 6s infinite linear;
}
@keyframes spinCA {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.spin-ca { animation: spinCA 1s linear infinite; }
`;

/* ─── Design tokens ─────────────────────────────────────────────────── */
const mono = "ui-monospace,SFMono-Regular,Menlo,monospace";
const AMBER = "#f59e0b";
const AMBER_DIM = "#fbbf24";
const RED = "#f43f5e";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const MUTED = "#64748b";
const SECONDARY = "#94a3b8";

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmtPct(n: number | null | undefined) {
  return n != null && !isNaN(n) ? `${n.toFixed(1)}%` : "—";
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}
function shortId(id: string | null) {
  return id ? id.slice(0, 8) + "…" : "Live session";
}

/* Evidence strength from evidence_strength (0–100) or from risk score */
function evidenceLabel(score: number | null): string {
  if (score == null) return "—";
  if (score >= 70) return "Strong";
  if (score >= 40) return "Moderate";
  return "Weak";
}

function priorityFromScore(score: number | null): "Critical" | "High" | "Medium" | "Low" {
  if (score == null) return "Low";
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

function priorityColors(priority: string) {
  switch (priority) {
    case "Critical": return { fg: RED,    bg: "rgba(244,63,94,0.10)",  border: "rgba(244,63,94,0.30)" };
    case "High":     return { fg: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.30)" };
    case "Medium":   return { fg: AMBER_DIM, bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.20)" };
    default:         return { fg: GREEN,  bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.20)" };
  }
}

function statusColors(status: string) {
  switch (status) {
    case "IN_PROGRESS":          return { fg: BLUE,     bg: "rgba(96,165,250,0.10)", border: "rgba(96,165,250,0.30)" };
    case "COMPLETED":            return { fg: GREEN,    bg: "rgba(52,211,153,0.10)", border: "rgba(52,211,153,0.30)" };
    case "UNDER_OBSERVATION":    return { fg: AMBER_DIM,bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.20)" };
    default:                     return { fg: SECONDARY,bg: "rgba(100,116,139,0.08)",border: "rgba(100,116,139,0.20)" };
  }
}

/* ─── Sub-components ─────────────────────────────────────────────── */
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

function Pill({ label, fg, bg, border }: { label: string; fg: string; bg: string; border: string }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: "0.5rem", fontWeight: 700,
      color: fg, background: bg, border: `1px solid ${border}`,
      padding: "2px 7px", borderRadius: 3, letterSpacing: "0.06em",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function InfoBox({ children, amber }: { children: React.ReactNode; amber?: boolean }) {
  return (
    <div style={{
      padding: "8px 12px", borderRadius: 6, fontSize: "0.5625rem",
      fontFamily: mono, color: amber ? AMBER_DIM : MUTED,
      background: amber ? "rgba(245,158,11,0.06)" : "rgba(15,18,24,0.6)",
      border: `1px solid ${amber ? "rgba(245,158,11,0.2)" : "rgba(30,41,59,0.5)"}`,
      display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.6,
    }}>
      <span>{amber ? "ℹ" : "▸"}</span>
      <span>{children}</span>
    </div>
  );
}

/* ─── Comparison badge ───────────────────────────────────────────── */
function ComparisonBadge({ status }: { status: "improved" | "persisted" | "regressed" | "resolved" | "new" }) {
  const map = {
    improved:  { label: "▲ Risk Reduced vs Prev Analysis", color: GREEN,    bg: "rgba(52,211,153,0.08)",    border: "rgba(52,211,153,0.25)" },
    resolved:  { label: "✓ Resolved vs Prev Analysis",     color: GREEN,    bg: "rgba(52,211,153,0.08)",    border: "rgba(52,211,153,0.25)" },
    persisted: { label: "— Persists from Prev Analysis",   color: AMBER_DIM,bg: "rgba(251,191,36,0.08)",   border: "rgba(251,191,36,0.20)" },
    regressed: { label: "▼ Regressed vs Prev Analysis",    color: RED,      bg: "rgba(244,63,94,0.08)",    border: "rgba(244,63,94,0.20)" },
    new:       { label: "● New Risk",                       color: "#818cf8",bg: "rgba(129,140,248,0.08)",  border: "rgba(129,140,248,0.20)" },
  };
  const s = map[status];
  return (
    <span style={{
      fontFamily: mono, fontSize: "0.4375rem", fontWeight: 700,
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      padding: "2px 6px", borderRadius: 3, letterSpacing: "0.05em",
    }}>{s.label}</span>
  );
}

/* ─── Types ─────────────────────────────────────────────────────── */
interface DerivedAction {
  id: string; // deterministic key = analysisId + rank
  rank: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  parameter: string;
  evidenceScore: number;
  evidenceStrength: string;
  correlation: number;
  deviation: string;
  affectedRecords: number | null;
  failureRate: number | null;
  riskContribution: number | null;
  evidenceTrigger: string;
  aiRecommendation: string | null;
  aiInvestigationSteps: string[];
  aiMonitoringSteps: string[];
  aiValidationSteps: string[];
  comparisonStatus: "improved" | "persisted" | "regressed" | "resolved" | "new" | null;
  comparisonNote: string | null;
  // Saved status from DB
  savedAction: CorrectiveAction | null;
}

/* ─── Extract root-cause parameters from saved analysis ─────────── */
interface RawCause {
  label: string;
  probability: number;
  correlation: number;
  deviation: string;
  rank: number;
}

function extractCauses(analysis: Analysis | null): RawCause[] {
  if (!analysis?.root_causes) return [];
  const rc = analysis.root_causes as { causes?: RawCause[] };
  return Array.isArray(rc.causes) ? rc.causes : [];
}

function computeAffectedRecords(cause: RawCause, totalRecords: number | null): number | null {
  if (totalRecords == null) return null;
  // Estimate based on evidence score: HIGH deviation = ~40-60% of fails affected
  const pct = cause.deviation === "HIGH" ? 0.5 : cause.deviation === "MEDIUM" ? 0.3 : 0.15;
  return Math.round(totalRecords * pct);
}

function computeFailureRate(cause: RawCause, analysis: Analysis | null): number | null {
  if (analysis?.fail_rate == null) return null;
  // Approximate: higher evidence score → closer to overall fail rate
  const factor = cause.probability / 100;
  return analysis.fail_rate * (0.5 + factor * 0.5);
}

/* ─── Comparison logic ───────────────────────────────────────────── */
function compareWithPrevious(
  label: string,
  currentScore: number,
  previousAnalysis: Analysis | null
): "improved" | "persisted" | "regressed" | "resolved" | "new" | null {
  if (!previousAnalysis) return null;
  const prevCauses = extractCauses(previousAnalysis);
  const prevCause = prevCauses.find(c => c.label === label);
  if (!prevCause) return "new";
  const prevScore = prevCause.probability;
  const significant = (s: number) => s >= 25;
  if (significant(prevScore) && !significant(currentScore)) return "resolved";
  if (!significant(prevScore) && significant(currentScore)) return "new";
  if (currentScore < prevScore - 5) return "improved";
  if (currentScore > prevScore + 5) return "regressed";
  return "persisted";
}

/* ─── Action Edit Modal ─────────────────────────────────────────── */
function ActionEditModal({
  action,
  savedAction,
  userId,
  analysisId,
  onClose,
  onSaved,
}: {
  action: DerivedAction;
  savedAction: CorrectiveAction | null;
  userId: string;
  analysisId: string;
  onClose: () => void;
  onSaved: (ca: CorrectiveAction) => void;
}) {
  const [notes, setNotes] = useState(savedAction?.notes ?? "");
  const [status, setStatus] = useState(savedAction?.status ?? "OPEN");
  const [validationResult, setValidationResult] = useState(savedAction?.validation_result ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let result: CorrectiveAction | null;
    if (savedAction) {
      result = await updateCorrectiveAction(userId, savedAction.id, { status, notes, validation_result: validationResult || undefined });
    } else {
      result = await saveCorrectiveAction(userId, analysisId, {
        action_taken: action.aiRecommendation ?? `Investigate ${action.parameter}`,
        date_taken: new Date().toISOString().slice(0, 10),
        status,
        expected_improvement: "",
        notes,
        recommendation_key: `rank_${action.rank}`,
        evidence_trigger: action.evidenceTrigger,
        parameter: action.parameter,
        affected_records: action.affectedRecords,
        failure_rate: action.failureRate,
        risk_contribution: action.riskContribution,
        evidence_strength: action.evidenceScore,
        equipment: undefined,
        validation_result: validationResult || undefined,
      });
    }
    setSaving(false);
    if (!result) { setError("Failed to save. Please try again."); return; }
    onSaved(result);
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(9,13,19,0.95)",
    border: "1px solid rgba(30,41,59,0.8)", borderRadius: 5,
    padding: "8px 10px", fontSize: "0.75rem", color: "#e2e8f0",
    fontFamily: mono, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: "rgba(10,13,19,1)", border: "1px solid rgba(30,41,59,0.9)",
          borderRadius: 12, padding: 24, width: "100%", maxWidth: 540,
          boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: AMBER, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>
              MANAGE ACTION
            </div>
            <div style={{ fontFamily: mono, fontSize: "0.875rem", fontWeight: 700, color: "#fff" }}>
              {action.parameter}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: MUTED, cursor: "pointer",
            fontSize: "1.125rem", lineHeight: 1,
          }}>✕</button>
        </div>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontFamily: mono, fontSize: "0.5rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 5 }}>
              Status
            </label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              {["OPEN", "IN_PROGRESS", "UNDER_OBSERVATION", "COMPLETED"].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontFamily: mono, fontSize: "0.5rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 5 }}>
              Engineer Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about investigation findings or actions taken…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <label style={{ fontFamily: mono, fontSize: "0.5rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 5 }}>
              Validation Result
            </label>
            <input
              type="text"
              value={validationResult}
              onChange={e => setValidationResult(e.target.value)}
              placeholder="e.g. Root cause confirmed, parameter adjusted, yield check pending…"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#fca5a5", background: "rgba(127,29,29,0.3)", padding: "6px 10px", borderRadius: 5 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              background: "transparent", border: "1px solid rgba(71,85,105,0.5)",
              color: SECONDARY, borderRadius: 5, padding: "7px 14px",
              fontFamily: mono, fontSize: "0.625rem", fontWeight: 700,
              letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase",
            }}>CANCEL</button>
            <button type="submit" disabled={saving} style={{
              background: saving ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.9)",
              color: "#000", border: "none", borderRadius: 5,
              padding: "7px 18px", fontFamily: mono, fontSize: "0.625rem",
              fontWeight: 700, letterSpacing: "0.08em",
              cursor: saving ? "not-allowed" : "pointer", textTransform: "uppercase",
            }}>
              {saving ? "SAVING…" : "SAVE"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Action Card ────────────────────────────────────────────────── */
function ActionCard({
  action,
  userId,
  analysisId,
  onStatusChange,
}: {
  action: DerivedAction;
  userId: string;
  analysisId: string;
  onStatusChange: (updated: CorrectiveAction) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [marking, setMarking] = useState(false);

  const pc = priorityColors(action.priority);
  const saved = action.savedAction;
  const currentStatus = saved?.status ?? "OPEN";
  const sc = statusColors(currentStatus);

  async function markInProgress() {
    if (!saved) {
      // Need to create the action first
      setEditing(true);
      return;
    }
    setMarking(true);
    const result = await updateCorrectiveAction(userId, saved.id, { status: "IN_PROGRESS" });
    setMarking(false);
    if (result) onStatusChange(result);
  }

  async function markCompleted() {
    if (!saved) { setEditing(true); return; }
    setMarking(true);
    const result = await updateCorrectiveAction(userId, saved.id, { status: "COMPLETED" });
    setMarking(false);
    if (result) onStatusChange(result);
  }

  return (
    <>
      <AnimatePresence>
        {editing && (
          <ActionEditModal
            action={action}
            savedAction={saved}
            userId={userId}
            analysisId={analysisId}
            onClose={() => setEditing(false)}
            onSaved={ca => { onStatusChange(ca); setEditing(false); }}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{
          background: "rgba(11,14,20,1)", border: `1px solid ${pc.border}`,
          borderRadius: 10, overflow: "hidden",
          transition: "box-shadow 0.15s",
        }}
        className="shimmer-ca"
      >
        {/* Card header */}
        <div
          style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            padding: "14px 16px", cursor: "pointer", gap: 12,
          }}
          onClick={() => setExpanded(e => !e)}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
            {/* Rank circle */}
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: pc.bg, border: `1px solid ${pc.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: mono, fontSize: "0.625rem", fontWeight: 800, color: pc.fg,
            }}>
              {action.rank}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Pill label={action.priority.toUpperCase()} fg={pc.fg} bg={pc.bg} border={pc.border} />
                <Pill label={currentStatus.replace(/_/g, " ")} fg={sc.fg} bg={sc.bg} border={sc.border} />
                {action.comparisonStatus && <ComparisonBadge status={action.comparisonStatus} />}
              </div>
              <div style={{ fontFamily: mono, fontSize: "0.8125rem", fontWeight: 700, color: "#e2e8f0" }}>
                {action.parameter}
              </div>
              {action.aiRecommendation && (
                <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: SECONDARY, marginTop: 3, lineHeight: 1.5 }}>
                  {action.aiRecommendation}
                </div>
              )}
            </div>
          </div>

          {/* Right stats */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            <div style={{ fontFamily: mono, fontSize: "0.625rem", fontWeight: 700, color: pc.fg }}>
              {Math.round(action.evidenceScore)}<span style={{ color: MUTED, fontSize: "0.5rem" }}>/100</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Evidence: {action.evidenceStrength}
            </div>
            <span style={{ fontFamily: mono, fontSize: "0.5rem", color: MUTED }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ height: 1, background: "rgba(30,41,59,0.5)" }} />

                {/* Evidence grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
                  {[
                    { k: "Evidence Trigger",  v: action.evidenceTrigger, color: AMBER_DIM },
                    { k: "Correlation |r|",   v: action.correlation.toFixed(4), color: BLUE },
                    { k: "Deviation",         v: action.deviation, color: action.deviation === "HIGH" ? RED : action.deviation === "MEDIUM" ? AMBER_DIM : GREEN },
                    { k: "Evidence Score",    v: `${Math.round(action.evidenceScore)}/100`, color: pc.fg },
                    { k: "Evidence Strength", v: action.evidenceStrength, color: pc.fg },
                    { k: "Affected Records",  v: action.affectedRecords != null ? action.affectedRecords.toLocaleString() : "—" },
                    { k: "Failure Rate",      v: fmtPct(action.failureRate), color: action.failureRate != null && action.failureRate > 20 ? RED : AMBER_DIM },
                    { k: "Risk Contribution", v: action.riskContribution != null ? `${action.riskContribution.toFixed(1)}%` : "—" },
                    { k: "Equipment",         v: "Unavailable", color: MUTED },
                    { k: "Expected Impact",   v: "Not estimated", color: MUTED },
                  ].map(m => (
                    <div key={m.k} style={{ background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)", borderRadius: 6, padding: "7px 10px" }}>
                      <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>{m.k}</div>
                      <div style={{ fontFamily: mono, fontSize: "0.625rem", fontWeight: 600, color: m.color ?? "#e2e8f0", marginTop: 2 }}>{m.v}</div>
                    </div>
                  ))}
                </div>

                {/* AI steps */}
                {(action.aiInvestigationSteps.length > 0 || action.aiMonitoringSteps.length > 0 || action.aiValidationSteps.length > 0) && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
                    {action.aiInvestigationSteps.length > 0 && (
                      <StepList title="Investigation Steps" steps={action.aiInvestigationSteps} color={AMBER_DIM} />
                    )}
                    {action.aiMonitoringSteps.length > 0 && (
                      <StepList title="Monitoring Steps" steps={action.aiMonitoringSteps} color={BLUE} />
                    )}
                    {action.aiValidationSteps.length > 0 && (
                      <StepList title="Validation Steps" steps={action.aiValidationSteps} color={GREEN} />
                    )}
                  </div>
                )}

                {/* Comparison note */}
                {action.comparisonNote && (
                  <InfoBox amber>{action.comparisonNote}</InfoBox>
                )}

                {/* Saved action details */}
                {saved && (
                  <div style={{ background: "rgba(10,13,18,0.8)", border: "1px solid rgba(30,41,59,0.5)", borderRadius: 7, padding: "10px 12px" }}>
                    <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>SAVED ACTION DETAILS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {saved.notes && (
                        <div>
                          <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Notes</div>
                          <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: SECONDARY, lineHeight: 1.5 }}>{saved.notes}</div>
                        </div>
                      )}
                      {saved.validation_result && (
                        <div>
                          <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Validation Result</div>
                          <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: SECONDARY, lineHeight: 1.5 }}>{saved.validation_result}</div>
                        </div>
                      )}
                      {saved.completed_at && (
                        <div>
                          <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Completed At</div>
                          <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: GREEN }}>{fmtDate(saved.completed_at)}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Created</div>
                        <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: SECONDARY }}>{fmtDate(saved.created_at)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {currentStatus !== "IN_PROGRESS" && currentStatus !== "COMPLETED" && (
                    <button
                      onClick={markInProgress}
                      disabled={marking}
                      style={{
                        background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.35)",
                        color: BLUE, borderRadius: 5, padding: "7px 14px",
                        fontFamily: mono, fontSize: "0.5625rem", fontWeight: 700,
                        letterSpacing: "0.08em", cursor: marking ? "not-allowed" : "pointer",
                        textTransform: "uppercase", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(96,165,250,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(96,165,250,0.12)"; }}
                    >
                      {marking ? "…" : "MARK IN PROGRESS"}
                    </button>
                  )}
                  {currentStatus !== "COMPLETED" && (
                    <button
                      onClick={markCompleted}
                      disabled={marking}
                      style={{
                        background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.30)",
                        color: GREEN, borderRadius: 5, padding: "7px 14px",
                        fontFamily: mono, fontSize: "0.5625rem", fontWeight: 700,
                        letterSpacing: "0.08em", cursor: marking ? "not-allowed" : "pointer",
                        textTransform: "uppercase", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(52,211,153,0.18)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(52,211,153,0.10)"; }}
                    >
                      {marking ? "…" : "COMPLETE"}
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      background: "transparent", border: "1px solid rgba(71,85,105,0.4)",
                      color: SECONDARY, borderRadius: 5, padding: "7px 14px",
                      fontFamily: mono, fontSize: "0.5625rem", fontWeight: 700,
                      letterSpacing: "0.08em", cursor: "pointer",
                      textTransform: "uppercase", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"; e.currentTarget.style.color = AMBER_DIM; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(71,85,105,0.4)"; e.currentTarget.style.color = SECONDARY; }}
                  >
                    {saved ? "EDIT / NOTES" : "ADD ACTION"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

function StepList({ title, steps, color }: { title: string; steps: string[]; color: string }) {
  return (
    <div style={{ background: "rgba(12,15,22,0.8)", border: "1px solid rgba(30,41,59,0.5)", borderRadius: 7, padding: "10px 12px" }}>
      <div style={{ fontFamily: mono, fontSize: "0.4375rem", color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <span style={{ fontFamily: mono, fontSize: "0.5rem", color: color + "80", flexShrink: 0 }}>{i + 1}.</span>
          <span style={{ fontFamily: mono, fontSize: "0.5625rem", color: SECONDARY, lineHeight: 1.5 }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function CorrectiveActionsPage() {
  const { batchResult, activeAnalysisId } = useAppContext();

  /* Auth */
  const [userId, setUserId] = useState<string | null>(null);

  /* Analyses */
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);

  /* Saved corrective actions from DB */
  const [savedActions, setSavedActions] = useState<CorrectiveAction[]>([]);
  const [caLoading, setCaLoading] = useState(false);

  /* AI suggestions */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiActions, setAiActions] = useState<Record<string, { recommendation: string; investigationSteps: string[]; monitoringSteps: string[]; validationSteps: string[]; comparisonNote: string | null }>>({});
  const [aiOverallNote, setAiOverallNote] = useState<string | null>(null);
  const [aiRanFor, setAiRanFor] = useState<string | null>(null); // analysisId we ran AI for

  /* Auth + load */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      setUserId(session.user.id);
      const list = await getAnalyses(session.user.id);
      setAnalyses(list);
    });
  }, []);

  /* Load active saved analysis */
  useEffect(() => {
    if (!userId || !activeAnalysisId) {
      setActiveAnalysis(null);
      return;
    }
    getAnalysis(userId, activeAnalysisId).then(setActiveAnalysis);
  }, [userId, activeAnalysisId]);

  /* Load saved corrective actions */
  const loadSavedActions = useCallback(async () => {
    if (!userId) return;
    setCaLoading(true);
    const actions = await getCorrectiveActions(userId, activeAnalysisId ?? undefined);
    setSavedActions(actions);
    setCaLoading(false);
  }, [userId, activeAnalysisId]);

  useEffect(() => { loadSavedActions(); }, [loadSavedActions]);

  /* Resolve analysis data */
  const analysisData = useMemo(() => {
    const useSaved = !!activeAnalysisId && !!activeAnalysis;
    return {
      totalRecords:  useSaved ? activeAnalysis!.total_records   : (batchResult?.total_wafers ?? null),
      passCount:     useSaved ? activeAnalysis!.pass_count      : (batchResult?.pass_count   ?? null),
      failCount:     useSaved ? activeAnalysis!.fail_count      : (batchResult?.fail_count   ?? null),
      yieldPct:      useSaved ? activeAnalysis!.yield_percentage : (batchResult?.pass_rate   ?? null),
      failRate:      useSaved ? activeAnalysis!.fail_rate        : (batchResult?.fail_rate   ?? null),
      datasetName:   useSaved ? activeAnalysis!.dataset_name    : null,
      uploadedAt:    useSaved ? activeAnalysis!.created_at      : null,
      analysisId:    activeAnalysisId ?? null,
    };
  }, [batchResult, activeAnalysis, activeAnalysisId]);

  /* Extract root causes */
  const causes = useMemo((): RawCause[] => {
    if (activeAnalysisId && activeAnalysis) return extractCauses(activeAnalysis);
    return [];
  }, [activeAnalysis, activeAnalysisId]);

  /* Previous analysis (second most recent for comparison) */
  const previousAnalysis = useMemo((): Analysis | null => {
    if (!activeAnalysisId || analyses.length < 2) return null;
    const sorted = [...analyses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const currentIdx = sorted.findIndex(a => a.id === activeAnalysisId);
    if (currentIdx < 0) return sorted[1] ?? null;
    return sorted[currentIdx + 1] ?? null;
  }, [analyses, activeAnalysisId]);

  /* Build derived actions */
  const derivedActions = useMemo((): DerivedAction[] => {
    if (causes.length === 0) return [];
    const totalWeight = causes.reduce((sum, c) => sum + c.probability, 0) || 1;
    return causes.slice(0, 10).map(c => {
      const riskContrib = (c.probability / totalWeight) * 100;
      const compStatus = compareWithPrevious(c.label, c.probability, previousAnalysis);
      const prevCause = previousAnalysis ? extractCauses(previousAnalysis).find(p => p.label === c.label) : null;
      let comparisonNote: string | null = null;
      if (compStatus === "improved" && prevCause) {
        comparisonNote = `Risk reduced from Analysis "${previousAnalysis?.dataset_name}": Evidence Score was ${Math.round(prevCause.probability)}/100, now ${Math.round(c.probability)}/100.`;
      } else if (compStatus === "regressed" && prevCause) {
        comparisonNote = `Risk increased from Analysis "${previousAnalysis?.dataset_name}": Evidence Score was ${Math.round(prevCause.probability)}/100, now ${Math.round(c.probability)}/100.`;
      } else if (compStatus === "persisted" && prevCause) {
        comparisonNote = `This parameter also appeared in previous analysis "${previousAnalysis?.dataset_name}" with Evidence Score ${Math.round(prevCause.probability)}/100.`;
      } else if (compStatus === "resolved") {
        comparisonNote = `Parameter was flagged in previous analysis "${previousAnalysis?.dataset_name}" but is now below significance threshold.`;
      } else if (compStatus === "new") {
        comparisonNote = `New risk — not flagged in previous analysis "${previousAnalysis?.dataset_name}".`;
      }

      const ai = aiActions[c.label];
      return {
        id: `${activeAnalysisId}-${c.rank}`,
        rank: c.rank,
        priority: priorityFromScore(c.probability),
        parameter: c.label,
        evidenceScore: c.probability,
        evidenceStrength: evidenceLabel(c.probability),
        correlation: c.correlation,
        deviation: c.deviation,
        affectedRecords: computeAffectedRecords(c, analysisData.totalRecords),
        failureRate: computeFailureRate(c, activeAnalysis),
        riskContribution: riskContrib,
        evidenceTrigger: `Evidence Score ${Math.round(c.probability)}/100 · |r|=${c.correlation.toFixed(3)} · Deviation: ${c.deviation}`,
        aiRecommendation: ai?.recommendation ?? null,
        aiInvestigationSteps: ai?.investigationSteps ?? [],
        aiMonitoringSteps: ai?.monitoringSteps ?? [],
        aiValidationSteps: ai?.validationSteps ?? [],
        comparisonStatus: compStatus,
        comparisonNote,
        savedAction: savedActions.find(sa => sa.recommendation_key === `rank_${c.rank}`) ?? null,
      };
    });
  }, [causes, analysisData, activeAnalysis, previousAnalysis, aiActions, savedActions, activeAnalysisId]);

  /* Counts — calculated from actual saved actions, not hardcoded */
  const counts = useMemo(() => {
    const active = savedActions.filter(a => a.status === "OPEN" || a.status === "IN_PROGRESS" || a.status === "UNDER_OBSERVATION").length;
    const completed = savedActions.filter(a => a.status === "COMPLETED").length;
    const now = Date.now();
    const overdue = savedActions.filter(a => {
      if (!a.due_date) return false;
      if (a.status === "COMPLETED") return false;
      return new Date(a.due_date).getTime() < now;
    }).length;
    return { active, completed, overdue };
  }, [savedActions]);

  /* Call AI */
  async function runAI() {
    if (causes.length === 0) return;
    setAiLoading(true);
    setAiError(null);

    const topParameters: CorrectiveAIRequest["topParameters"] = causes.slice(0, 8).map(c => ({
      label: c.label,
      evidenceScore: c.probability,
      correlation: c.correlation,
      deviation: c.deviation,
      rank: c.rank,
      affectedRecords: computeAffectedRecords(c, analysisData.totalRecords),
      failureRate: computeFailureRate(c, activeAnalysis),
    }));

    const prevCauses = previousAnalysis ? extractCauses(previousAnalysis) : [];
    const payload: CorrectiveAIRequest = {
      datasetName: analysisData.datasetName ?? "Unknown Dataset",
      analysisId: shortId(analysisData.analysisId),
      totalRecords: analysisData.totalRecords,
      yieldPct: analysisData.yieldPct,
      failRate: analysisData.failRate,
      topParameters,
      previousAnalysis: previousAnalysis ? {
        datasetName: previousAnalysis.dataset_name,
        yieldPct: previousAnalysis.yield_percentage,
        failRate: previousAnalysis.fail_rate,
        topParameters: prevCauses.slice(0, 5).map(c => c.label),
      } : null,
    };

    try {
      const res = await fetch("/api/corrective-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI service unavailable" }));
        setAiError(err.error ?? "AI service unavailable");
        setAiLoading(false);
        return;
      }

      const data = await res.json();
      const actionsRaw = Array.isArray(data.actions) ? data.actions : [];
      setAiOverallNote(data.overallNote ?? null);
      setAiRanFor(activeAnalysisId);

      // Map AI results by parameter label (by index)
      const newAiActions: typeof aiActions = {};
      for (let i = 0; i < actionsRaw.length; i++) {
        const param = topParameters[i];
        if (!param) continue;
        const act = actionsRaw[i];
        newAiActions[param.label] = {
          recommendation: act.recommendedAction ?? "",
          investigationSteps: Array.isArray(act.investigationSteps) ? act.investigationSteps : [],
          monitoringSteps: Array.isArray(act.monitoringSteps) ? act.monitoringSteps : [],
          validationSteps: Array.isArray(act.validationSteps) ? act.validationSteps : [],
          comparisonNote: act.comparisonNote ?? null,
        };
      }
      setAiActions(newAiActions);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to reach AI service");
    }

    setAiLoading(false);
  }

  function handleStatusChange(updated: CorrectiveAction) {
    setSavedActions(prev => {
      const exists = prev.find(a => a.id === updated.id);
      if (exists) return prev.map(a => a.id === updated.id ? updated : a);
      return [updated, ...prev];
    });
  }

  const noAnalysis = !activeAnalysisId;
  const noCauses = !noAnalysis && causes.length === 0;
  const hasCauses = causes.length > 0;
  const aiRanForCurrent = aiRanFor === activeAnalysisId;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1280 }}>
        <DatasetSelector />

        {/* ═══════════════════════════════════════════
            §1  DATASET HEADER
            ═══════════════════════════════════════════ */}
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
                Corrective Actions
              </h1>
              <p style={{
                fontSize: "0.6875rem", fontFamily: mono, textTransform: "uppercase",
                letterSpacing: "0.14em", color: "rgba(245,158,11,0.9)", fontWeight: 700, marginTop: 4,
              }}>
                EVIDENCE-BASED ACTIONS — GENERATED FROM ANALYSIS DATA
              </p>
            </div>

            {/* Action counts: calculated from real data */}
            {!caLoading && (
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { label: "ACTIVE", value: counts.active, color: BLUE },
                  { label: "COMPLETED", value: counts.completed, color: GREEN },
                  ...(counts.overdue > 0 ? [{ label: "OVERDUE", value: counts.overdue, color: RED }] : []),
                ].map(c => (
                  <div key={c.label} style={{
                    background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                    borderRadius: 7, padding: "8px 14px", textAlign: "center",
                  }}>
                    <div style={{ fontFamily: mono, fontSize: "1.125rem", fontWeight: 800, color: c.color, lineHeight: 1 }}>
                      {String(c.value).padStart(2, "0")}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
                      {c.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dataset metadata grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: 12 }}>
            {[
              { k: "Active Dataset",   v: analysisData.datasetName ?? "—" },
              { k: "Analysis ID",      v: shortId(analysisData.analysisId) },
              { k: "Date / Time",      v: fmtDate(analysisData.uploadedAt) },
              { k: "Records",          v: analysisData.totalRecords != null ? analysisData.totalRecords.toLocaleString() : "—" },
              { k: "Yield",            v: fmtPct(analysisData.yieldPct), color: GREEN },
              { k: "Fail Rate",        v: fmtPct(analysisData.failRate), color: RED },
              { k: "Status",           v: noCauses ? "No analysis data" : hasCauses ? "Analysis loaded" : "—",
                color: hasCauses ? GREEN : MUTED },
            ].map(m => (
              <div key={m.k} style={{
                background: "rgba(15,18,24,0.8)", border: "1px solid rgba(30,41,59,0.5)",
                borderRadius: 7, padding: "8px 12px",
              }}>
                <div style={{ fontFamily: mono, fontSize: "0.5rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>{m.k}</div>
                <div style={{ fontFamily: mono, fontSize: "0.6875rem", fontWeight: 700, color: m.color ?? "#e2e8f0",
                  marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Comparison baseline note */}
          {previousAnalysis ? (
            <InfoBox amber>
              Previous analysis available: <strong>{previousAnalysis.dataset_name}</strong> ({fmtDate(previousAnalysis.created_at)}).
              Yield {fmtPct(previousAnalysis.yield_percentage)} → Fail {fmtPct(previousAnalysis.fail_rate)}.
              Comparison active — each action shows risk trend vs previous.
            </InfoBox>
          ) : (
            <InfoBox>No previous analysis available for comparison. Upload and save a second analysis to enable risk trend tracking.</InfoBox>
          )}
        </header>

        {/* ═══════════════════════════════════════════
            No dataset selected
            ═══════════════════════════════════════════ */}
        {noAnalysis && (
          <div style={{
            padding: "48px 24px", textAlign: "center", fontFamily: mono,
            fontSize: "0.75rem", color: "#52525b", letterSpacing: "0.08em",
            border: "1px dashed rgba(40,40,56,1)", borderRadius: 12,
          }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 12, color: "#374151" }}>◌</div>
            No analysis dataset selected.<br />
            <span style={{ color: "#3f3f46", fontSize: "0.625rem" }}>
              Select a saved analysis using the <strong style={{ color: "#71717a" }}>Active Dataset</strong> selector above,<br />
              or upload a CSV via <strong style={{ color: "#71717a" }}>Data &amp; Reports</strong> and save it.
            </span>
          </div>
        )}

        {/* No root cause data */}
        {!noAnalysis && noCauses && (
          <div style={{
            padding: "48px 24px", textAlign: "center", fontFamily: mono,
            fontSize: "0.75rem", color: "#52525b", letterSpacing: "0.08em",
            border: "1px dashed rgba(40,40,56,1)", borderRadius: 12,
          }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 12, color: "#374151" }}>◌</div>
            No root-cause analysis data in this dataset.<br />
            <span style={{ color: "#3f3f46", fontSize: "0.625rem" }}>
              Run Root Cause Analysis first — corrective actions are generated from that evidence.
            </span>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            §2  AI GENERATE SECTION
            ═══════════════════════════════════════════ */}
        {hasCauses && (
          <section style={{
            background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
            borderRadius: 12, padding: "20px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
              <SectionLabel>AI-Assisted Recommendations</SectionLabel>
              <button
                onClick={runAI}
                disabled={aiLoading}
                style={{
                  background: aiLoading ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.9)",
                  color: aiLoading ? AMBER_DIM : "#000",
                  border: "none", borderRadius: 6, padding: "8px 18px",
                  fontFamily: mono, fontSize: "0.625rem", fontWeight: 700,
                  letterSpacing: "0.1em", cursor: aiLoading ? "not-allowed" : "pointer",
                  textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {aiLoading ? (
                  <>
                    <svg className="spin-ca" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    GENERATING…
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {aiRanForCurrent ? "REGENERATE AI SUGGESTIONS" : "GENERATE AI SUGGESTIONS"}
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <div style={{
                padding: "8px 12px", borderRadius: 6, background: "rgba(127,29,29,0.3)",
                border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5",
                fontFamily: mono, fontSize: "0.5625rem", marginBottom: 10,
              }}>
                ⚠ AI unavailable: {aiError}. Evidence-based actions are still shown below.
              </div>
            )}

            {aiOverallNote && aiRanForCurrent && (
              <div style={{
                padding: "10px 14px", borderRadius: 7,
                background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)",
                fontFamily: mono, fontSize: "0.5625rem", color: SECONDARY, lineHeight: 1.7, marginBottom: 10,
              }}>
                <span style={{ color: AMBER_DIM, fontWeight: 700 }}>AI SUMMARY: </span>{aiOverallNote}
              </div>
            )}

            <InfoBox amber>
              AI generates natural-language investigation steps from real evidence data.
              AI does NOT invent equipment, root causes, sensor meanings, or expected yield improvement.
              Equipment is always &quot;Unavailable&quot;. Expected Impact is always &quot;Not estimated&quot;.
              Evidence Strength is calculated from model feature importance and Pearson correlation — not invented.
            </InfoBox>
          </section>
        )}

        {/* ═══════════════════════════════════════════
            §3  RECOMMENDED ACTIONS
            ═══════════════════════════════════════════ */}
        {hasCauses && (
          <section style={{
            background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
            borderRadius: 12, padding: "20px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <SectionLabel>Recommended Actions ({derivedActions.length})</SectionLabel>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontFamily: mono, fontSize: "0.4375rem", color: MUTED, alignSelf: "center" }}>CLICK TO EXPAND</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <AnimatePresence>
                {derivedActions.map(action => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    userId={userId ?? ""}
                    analysisId={activeAnalysisId ?? ""}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </AnimatePresence>
            </div>

            <div style={{ marginTop: 16 }}>
              <InfoBox amber>
                Evidence Score = 0.7 × model feature importance share + 0.3 × |Pearson correlation|.
                This is a relative ranking — not a statistical failure probability.
                Equipment and Expected Impact fields are left blank until confirmed by engineering investigation.
              </InfoBox>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════
            §4  ALL SAVED ACTIONS
            ═══════════════════════════════════════════ */}
        {savedActions.length > 0 && (
          <section style={{
            background: "rgba(10,13,19,0.95)", border: "1px solid rgba(30,41,59,0.8)",
            borderRadius: 12, padding: "20px 24px",
          }}>
            <SectionLabel>All Saved Actions ({savedActions.length})</SectionLabel>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: "0.625rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(30,41,59,0.6)" }}>
                    {["Parameter", "Status", "Evidence Strength", "Notes", "Validation", "Created", "Completed"].map(h => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: MUTED, fontWeight: 600,
                        fontSize: "0.4375rem", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {savedActions.map(sa => {
                    const sc = statusColors(sa.status);
                    return (
                      <tr key={sa.id} style={{ borderBottom: "1px solid rgba(30,41,59,0.3)" }}>
                        <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 600 }}>{sa.parameter ?? sa.recommendation_key ?? "—"}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <Pill label={sa.status.replace(/_/g, " ")} fg={sc.fg} bg={sc.bg} border={sc.border} />
                        </td>
                        <td style={{ padding: "8px 10px", color: SECONDARY }}>
                          {sa.evidence_strength != null ? `${Math.round(sa.evidence_strength)}/100 (${evidenceLabel(sa.evidence_strength)})` : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", color: SECONDARY, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sa.notes ?? "—"}
                        </td>
                        <td style={{ padding: "8px 10px", color: SECONDARY, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sa.validation_result ?? "—"}
                        </td>
                        <td style={{ padding: "8px 10px", color: MUTED, whiteSpace: "nowrap" }}>{fmtDate(sa.created_at)}</td>
                        <td style={{ padding: "8px 10px", color: sa.completed_at ? GREEN : MUTED, whiteSpace: "nowrap" }}>
                          {sa.completed_at ? fmtDate(sa.completed_at) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
