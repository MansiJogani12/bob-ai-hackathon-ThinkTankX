"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getRootCauses, type RootCausesResponse } from "../../../src/services/api";

const CSS = `
.btn-complete {
  background-color: #f59e0b;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn-complete:hover {
  background-color: #d97706;
  box-shadow: 0 0 18px rgba(245, 158, 11, 0.4);
  transform: translateY(-1px);
}
`;

type Priority = "CRITICAL" | "MEDIUM" | "LOW";
type ActionStatus = "OPEN" | "IN PROGRESS" | "COMPLETED";

interface Action {
  id: string;
  priority: Priority;
  status: ActionStatus;
  action: string;
  rootCause: string;
  equipment: string;
  impact: string;
  confidence: number;
}

/* Derive corrective actions from root-cause API causes */
function causesToActions(data: RootCausesResponse): Action[] {
  return data.causes.map((c, i) => ({
    id:        `CRX-${String(i + 1).padStart(3, "0")}`,
    priority:  c.probability >= 66 ? "CRITICAL" : c.probability >= 33 ? "MEDIUM" : "LOW",
    status:    "OPEN" as ActionStatus,
    action:    `Investigate ${c.label} and validate the sensor against the trained-model risk signal.`,
    rootCause: c.label,
    equipment: c.equipment,
    impact:    "Impact not estimated",
    confidence: c.probability,
  }));
}

const BADGE_PRIORITY: Record<Priority, { bg: string; color: string; border: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(239,68,68,0.35)"  },
  MEDIUM:   { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "rgba(245,158,11,0.35)" },
  LOW:      { bg: "rgba(148,163,184,0.1)", color: "#cbd5e1", border: "rgba(148,163,184,0.25)"},
};

const BADGE_STATUS: Record<ActionStatus, { bg: string; color: string; border: string }> = {
  "OPEN":        { bg: "rgba(30,41,59,0.5)",   color: "#94a3b8", border: "rgba(71,85,105,0.35)"  },
  "IN PROGRESS": { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "rgba(245,158,11,0.35)" },
  "COMPLETED":   { bg: "rgba(16,185,129,0.12)", color: "#4ade80", border: "rgba(16,185,129,0.35)" },
};

function Badge({ label, style }: { label: string; style: { bg: string; color: string; border: string } }) {
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 4, fontSize: "0.625rem",
      fontFamily: "ui-monospace,monospace", fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", background: style.bg, color: style.color, border: `1px solid ${style.border}`,
    }}>{label}</span>
  );
}

export default function CorrectiveActions() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  /* Fetch root-cause data on mount and derive action items */
  useEffect(() => {
    let cancelled = false;
    getRootCauses()
      .then(data => {
        if (!cancelled) {
          setActions(causesToActions(data));
          setError(null);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function markInProgress(id: string) {
    setActions(a => a.map(x => x.id === id ? { ...x, status: "IN PROGRESS" } : x));
  }
  function markComplete(id: string) {
    setActions(a => a.map(x => x.id === id ? { ...x, status: "COMPLETED" } : x));
  }
  function reopenAction(id: string) {
    setActions(a => a.map(x => x.id === id ? { ...x, status: "OPEN" } : x));
  }

  const active    = actions.filter(a => a.status !== "COMPLETED").length;
  const completed = actions.filter(a => a.status === "COMPLETED").length;
  const overdue   = actions.filter(a => a.priority === "CRITICAL" && a.status === "OPEN").length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Header ── */}
        <header>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em",
            fontFamily: "Inter,sans-serif", margin: 0 }}>Corrective Actions</h1>
          <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
            letterSpacing: "0.1em", color: "rgba(245,158,11,0.9)", fontWeight: 700, marginTop: 4 }}>
            ACTION MANAGEMENT & RECOMMENDATIONS
          </p>
        </header>

        {/* ── Error banner ── */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 6, background: "rgba(127,29,29,0.4)",
            border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5",
            fontFamily: "ui-monospace,monospace", fontSize: "0.65rem", letterSpacing: "0.04em",
          }}>
            ⚠ {error} — Backend may be offline
          </div>
        )}

        {/* ── 3 metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {[
            { label: "ACTIVE ACTIONS",  value: loading ? "..." : String(active).padStart(2,"0"),    hoverBorder: "rgba(245,158,11,0.3)" },
            { label: "COMPLETED",       value: loading ? "..." : String(completed).padStart(2,"0"), hoverBorder: "rgba(16,185,129,0.3)" },
            { label: "OVERDUE",         value: loading ? "..." : String(overdue).padStart(2,"0"),   hoverBorder: "rgba(239,68,68,0.3)"  },
          ].map((m, i) => (
            <div key={i} style={{ borderRadius: 12, border: "1px solid rgba(27,30,38,1)",
              background: "rgba(12,13,18,0.9)", padding: 20, transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = m.hoverBorder)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(27,30,38,1)")}
            >
              <div style={{ fontSize: "0.625rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
                letterSpacing: "0.12em", color: "#94a3b8", fontWeight: 700 }}>{m.label}</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#fff", fontFamily: "ui-monospace,monospace",
                letterSpacing: "-0.03em", marginTop: 8 }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div style={{ padding: "32px 0", textAlign: "center",
            fontFamily: "ui-monospace,monospace", fontSize: "0.75rem",
            color: "#64748b", letterSpacing: "0.08em" }}>
            Loading corrective actions from API...
          </div>
        )}

        {/* ── Action cards ── */}
        {!loading && actions.length === 0 && !error && (
          <div style={{ padding: "32px 0", textAlign: "center",
            fontFamily: "ui-monospace,monospace", fontSize: "0.75rem",
            color: "#64748b", letterSpacing: "0.08em" }}>
            No corrective actions available
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {actions.map((action, i) => {
            const priStyle  = BADGE_PRIORITY[action.priority];
            const statStyle = BADGE_STATUS[action.status];
            const isCompleted = action.status === "COMPLETED";

            return (
              <motion.article key={action.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: isCompleted ? 0.6 : 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16,1,0.3,1] }}
                style={{
                  borderRadius: 12, border: isCompleted
                    ? "1px solid rgba(16,185,129,0.3)"
                    : "1px solid rgba(29,32,41,1)",
                  background: "rgba(13,14,19,1)", padding: 24,
                  transition: "all 0.2s",
                }}
                onHoverStart={e => { if (!isCompleted) (e.target as HTMLElement).style?.setProperty?.("border-color", "rgba(43,48,61,1)"); }}
              >
                {/* Top row: badges + impact */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
                  justifyContent: "space-between", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge label={action.priority} style={priStyle} />
                    <Badge label={action.status} style={statStyle} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ display: "block", fontSize: "0.625rem", fontFamily: "ui-monospace,monospace",
                      textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b" }}>EXPECTED IMPACT</span>
                    <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "ui-monospace,monospace",
                      color: "#4ade80", textShadow: "0 0 16px rgba(16,185,129,0.45)" }}>{action.impact}</span>
                  </div>
                </div>

                {/* Content grid */}
                <div style={{ display: "grid", gridTemplateColumns: "6fr 3fr 3fr", gap: 24,
                  marginTop: 16, paddingTop: 8, borderTop: "1px solid rgba(22,24,32,1)" }}>
                  <div>
                    <span style={{ display: "block", fontSize: "0.6875rem", color: "#94a3b8", marginBottom: 4 }}>
                      Recommended Action
                    </span>
                    <p style={{ fontSize: "1rem", fontWeight: 500, color: "#fff", margin: 0, lineHeight: 1.4 }}>
                      {action.action}
                    </p>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: "0.6875rem", color: "#94a3b8", marginBottom: 4 }}>Root Cause</span>
                    <p style={{ fontSize: "1rem", fontWeight: 500, color: "#e2e8f0", margin: 0 }}>{action.rootCause}</p>
                  </div>
                  <div>
                    <span style={{ display: "block", fontSize: "0.6875rem", color: "#94a3b8", marginBottom: 4 }}>Equipment</span>
                    <p style={{ fontSize: "1rem", fontWeight: 600, color: "#f59e0b", fontFamily: "ui-monospace,monospace", margin: 0 }}>{action.equipment}</p>
                  </div>
                </div>

                {/* Footer: confidence + actions */}
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(22,24,32,1)",
                  display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>AI Confidence:</span>
                    <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", fontWeight: 700, color: "#fff" }}>
                      {action.confidence}%
                    </span>
                  </div>
                  {!isCompleted && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {action.status === "OPEN" && (
                        <button onClick={() => markInProgress(action.id)} style={{
                          padding: "8px 16px", fontSize: "0.75rem", fontFamily: "ui-monospace,monospace",
                          fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em",
                          color: "#fbbf24", border: "1px solid rgba(245,158,11,0.4)",
                          borderRadius: 6, background: "transparent", cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.1)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >MARK IN PROGRESS</button>
                      )}
                      <button onClick={() => markComplete(action.id)}
                        className="btn-complete"
                        style={{
                          padding: "8px 20px", fontSize: "0.75rem", fontFamily: "ui-monospace,monospace",
                          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                          color: "#000", border: "none", borderRadius: 6, cursor: "pointer",
                        }}
                      >COMPLETE</button>
                    </div>
                  )}
                  {isCompleted && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace,monospace",
                        color: "#4ade80", fontWeight: 700 }}>✓ COMPLETED</span>
                      <button onClick={() => reopenAction(action.id)} style={{
                        padding: "6px 12px", fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
                        color: "#94a3b8", border: "1px solid rgba(71,85,105,0.4)",
                        borderRadius: 4, background: "transparent", cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                      >RE-OPEN</button>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </>
  );
}
