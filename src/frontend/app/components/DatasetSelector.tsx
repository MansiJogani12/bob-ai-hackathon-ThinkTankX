"use client";
/**
 * DatasetSelector
 * ───────────────
 * A compact "Active Dataset" banner shown at the top of analysis pages.
 * If the user has saved analyses, they can pick which one to use.
 * Selecting an analysis sets activeAnalysisId in the global store so all
 * pages read from the same chosen dataset.
 *
 * Usage:
 *   import DatasetSelector from "../../components/DatasetSelector";
 *   // at the top of your page JSX:
 *   <DatasetSelector />
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../src/lib/supabase";
import { getAnalyses, type Analysis } from "../../src/lib/analysisDb";
import { useAppContext } from "../../src/lib/store";

export default function DatasetSelector() {
  const { activeAnalysisId, setActiveAnalysisId } = useAppContext();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) { setLoading(false); return; }
    const list = await getAnalyses(session.user.id);
    setAnalyses(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = analyses.find(a => a.id === activeAnalysisId);
  const label = active
    ? active.dataset_name
    : activeAnalysisId
    ? "Selected dataset"
    : "Current session";

  const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
  const amber = "#f59e0b";

  if (loading || analyses.length === 0) return null;

  return (
    <div style={{ position: "relative", marginBottom: 20 }}>
      {/* Banner */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", borderRadius: 8, cursor: "pointer",
          background: "rgba(10,13,18,0.9)",
          border: `1px solid ${activeAnalysisId ? "rgba(245,158,11,0.4)" : "rgba(30,38,52,1)"}`,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.5)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = activeAnalysisId ? "rgba(245,158,11,0.4)" : "rgba(30,38,52,1)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: activeAnalysisId ? amber : "#64748b", flexShrink: 0 }} />
          <span style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#64748b",
            textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
            ACTIVE DATASET
          </span>
          <span style={{ fontFamily: mono, fontSize: "0.75rem", color: activeAnalysisId ? "#e2e8f0" : "#94a3b8",
            fontWeight: activeAnalysisId ? 600 : 400, maxWidth: 280,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
          {active && (
            <span style={{ fontSize: "0.5625rem", fontFamily: mono,
              padding: "1px 6px", borderRadius: 3,
              background: "rgba(245,158,11,0.12)", color: amber,
              border: "1px solid rgba(245,158,11,0.3)" }}>
              {active.yield_percentage != null ? `${active.yield_percentage.toFixed(1)}% yield` : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activeAnalysisId && (
            <button
              onClick={e => { e.stopPropagation(); setActiveAnalysisId(null); setOpen(false); }}
              style={{
                fontSize: "0.5625rem", fontFamily: mono, padding: "2px 8px", borderRadius: 3,
                background: "transparent", color: "#64748b",
                border: "1px solid rgba(71,85,105,0.4)", cursor: "pointer",
                letterSpacing: "0.06em",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(71,85,105,0.4)"; }}
            >
              CLEAR
            </button>
          )}
          <span style={{ fontFamily: mono, fontSize: "0.6875rem", color: "#64748b",
            transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s",
            display: "inline-block" }}>▾</span>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "rgba(9,13,19,0.98)", border: "1px solid rgba(30,38,52,1)",
          borderRadius: 8, marginTop: 4, maxHeight: 280, overflowY: "auto",
          boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
        }}>
          {/* Reset row */}
          <div
            onClick={() => { setActiveAnalysisId(null); setOpen(false); }}
            style={{
              padding: "10px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              borderBottom: "1px solid rgba(20,26,36,0.8)",
              background: !activeAnalysisId ? "rgba(245,158,11,0.06)" : "transparent",
              transition: "background 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = !activeAnalysisId ? "rgba(245,158,11,0.06)" : "transparent")}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#64748b", display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontFamily: mono, fontSize: "0.6875rem", color: "#94a3b8" }}>
              Current session (latest batch run)
            </span>
            {!activeAnalysisId && <span style={{ marginLeft: "auto", fontSize: "0.5625rem", color: amber }}>ACTIVE</span>}
          </div>

          {analyses.map(a => {
            const isActive = activeAnalysisId === a.id;
            const date = new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
            return (
              <div
                key={a.id}
                onClick={() => { setActiveAnalysisId(a.id); setOpen(false); }}
                style={{
                  padding: "10px 16px", cursor: "pointer", display: "flex",
                  alignItems: "center", gap: 10,
                  borderBottom: "1px solid rgba(20,26,36,0.6)",
                  background: isActive ? "rgba(245,158,11,0.06)" : "transparent",
                  borderLeft: isActive ? `2px solid ${amber}` : "2px solid transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = isActive ? "rgba(245,158,11,0.06)" : "transparent")}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%",
                  background: isActive ? amber : "#374151", display: "inline-block", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: "0.75rem", color: isActive ? "#e2e8f0" : "#94a3b8",
                    fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.dataset_name}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: "0.5625rem", color: "#4a5568", marginTop: 1 }}>
                    {date} · {a.total_records ?? "?"} wafers
                    {a.yield_percentage != null ? ` · ${a.yield_percentage.toFixed(1)}% yield` : ""}
                  </div>
                </div>
                {isActive && <span style={{ fontSize: "0.5625rem", color: amber, flexShrink: 0 }}>ACTIVE</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
