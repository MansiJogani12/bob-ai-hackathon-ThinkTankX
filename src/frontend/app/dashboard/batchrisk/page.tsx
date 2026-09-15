"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAppContext } from "../../../src/lib/store";
import { getDashboard, type DashboardResponse } from "../../../src/services/api";
import { supabase } from "../../../src/lib/supabase";
import { getAnalysis, type Analysis } from "../../../src/lib/analysisDb";
import DatasetSelector from "../../components/DatasetSelector";

type Badge = "HIGH" | "MEDIUM" | "LOW";
const BADGE_STYLES: Record<Badge, { bg: string; color: string; border: string }> = {
  HIGH:   { bg: "rgba(127,29,29,0.6)",  color: "#f87171", border: "rgba(239,68,68,0.3)"   },
  MEDIUM: { bg: "rgba(120,53,15,0.6)",  color: "#fb923c", border: "rgba(245,158,11,0.3)"  },
  LOW:    { bg: "rgba(6,78,59,0.6)",    color: "#4ade80", border: "rgba(16,185,129,0.3)"  },
};

interface WaferRow { id: string; risk: number; yield: number; badge: Badge; }

function wafersFromBatch(wafers: { wafer_id: string; fail_probability: number; pass_probability: number }[]): WaferRow[] {
  return wafers.map(w => {
    const riskPct = w.fail_probability * 100;
    const badge: Badge = riskPct >= 30 ? "HIGH" : riskPct >= 10 ? "MEDIUM" : "LOW";
    return { id: w.wafer_id, risk: riskPct, yield: w.pass_probability * 100, badge };
  });
}

export default function BatchRiskPage() {
  const router = useRouter();
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const { batchResult, batchWaferSensors, setSelectedWaferSensors, activeAnalysisId } = useAppContext();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<Analysis | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /* ── Auth ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  /* ── Load saved analysis when activeAnalysisId changes ── */
  useEffect(() => {
    if (!userId || !activeAnalysisId) { setSavedAnalysis(null); return; }
    getAnalysis(userId, activeAnalysisId).then(setSavedAnalysis);
  }, [userId, activeAnalysisId]);

  /* ── Fallback: fetch dashboard when no live batch and no saved dataset ── */
  useEffect(() => {
    if (batchResult || activeAnalysisId) return;
    let cancelled = false;
    getDashboard()
      .then(data => { if (!cancelled) setDashboard(data); })
      .catch(() => { if (!cancelled) setDashboard(null); });
    return () => { cancelled = true; };
  }, [batchResult, activeAnalysisId]);

  /* ── Resolve the wafer list from the active source ── */
  const WAFERS = useMemo((): WaferRow[] => {
    // 1. Saved analysis selected → use its prediction_summary wafers
    if (activeAnalysisId && savedAnalysis?.prediction_summary) {
      const ps = savedAnalysis.prediction_summary as {
        wafers?: { wafer_id: string; fail_probability: number; pass_probability: number }[];
      };
      if (ps.wafers?.length) return wafersFromBatch(ps.wafers);
    }
    // 2. Live session batch result
    if (!activeAnalysisId && batchResult?.wafers?.length) {
      return wafersFromBatch(batchResult.wafers);
    }
    // 3. Dashboard fallback (no CSV uploaded yet)
    if (!activeAnalysisId && dashboard?.upcoming_batch_risk?.length) {
      return dashboard.upcoming_batch_risk.map(w => ({
        id: w.wafer_id,
        risk: w.risk_score_pct,
        yield: 100 - w.risk_score_pct,
        badge: (w.badge === "HIGH" ? "HIGH" : w.badge === "MEDIUM" ? "MEDIUM" : "LOW") as Badge,
      }));
    }
    return [];
  }, [activeAnalysisId, savedAnalysis, batchResult, dashboard]);

  /* ── Resolve summary counts from the active source ── */
  const summary = useMemo(() => {
    if (activeAnalysisId && savedAnalysis) {
      return {
        totalWafers: savedAnalysis.total_records ?? WAFERS.length,
        passCount:   savedAnalysis.pass_count    ?? WAFERS.filter(w => w.badge === "LOW").length,
        failCount:   savedAnalysis.fail_count    ?? WAFERS.filter(w => w.badge !== "LOW").length,
        passRate:    savedAnalysis.yield_percentage ?? null,
        execTime:    null as string | null,
      };
    }
    if (!activeAnalysisId && batchResult) {
      return {
        totalWafers: batchResult.total_wafers,
        passCount:   batchResult.pass_count,
        failCount:   batchResult.fail_count,
        passRate:    batchResult.pass_rate ?? null,
        execTime:    batchResult.estimated_execution_time_ms,
      };
    }
    if (!activeAnalysisId && dashboard) {
      return {
        totalWafers: dashboard.total_wafers ?? WAFERS.length,
        passCount:   dashboard.pass_count   ?? null,
        failCount:   dashboard.fail_count   ?? null,
        passRate:    dashboard.pass_rate    ?? null,
        execTime:    null as string | null,
      };
    }
    return { totalWafers: null, passCount: null, failCount: null, passRate: null, execTime: null };
  }, [activeAnalysisId, savedAnalysis, batchResult, dashboard, WAFERS]);

  const highCount = WAFERS.filter(w => w.badge === "HIGH").length;
  const medCount  = WAFERS.filter(w => w.badge === "MEDIUM").length;
  const lowCount  = WAFERS.filter(w => w.badge === "LOW").length;
  const hasData   = !!activeAnalysisId ? !!savedAnalysis : !!(batchResult || dashboard);

  function handleView(i: number) {
    // Only set sensor context when viewing live session wafers
    if (!activeAnalysisId && batchResult?.wafers?.[i]) {
      setSelectedWaferSensors(batchWaferSensors[i] ?? null);
    }
    setLoadingIdx(i);
    setTimeout(() => {
      setLoadingIdx(null);
      router.push("/dashboard/wafer");
    }, 200);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <DatasetSelector />

      {/* ── Breadcrumb ribbon ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", color: "#64748b",
        paddingBottom: 12, borderBottom: "1px solid rgba(20,23,32,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>PIPELINES</span>
          <span style={{ color: "#374151" }}>/</span>
          <span style={{ color: "#cbd5e1" }}>RISK_PREDICTION</span>
          <span style={{ color: "#374151" }}>/</span>
          <span style={{ color: "#fbbf24" }}>REALTIME_INFERENCE_ENGINE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(18,20,26,1)",
            padding: "4px 12px", borderRadius: 4, color: "#cbd5e1", border: "1px solid rgba(30,41,59,1)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            MODEL STATUS: OPTIMAL
          </span>
          <span style={{ color: "#64748b" }}>LATENCY: 18ms</span>
        </div>
      </div>

      {/* ── Title ── */}
      <div>
        <h1 style={{ fontSize: "clamp(1.25rem,2.5vw,1.875rem)", fontWeight: 700, color: "#fff",
          letterSpacing: "-0.02em", fontFamily: "Inter,sans-serif", margin: 0 }}>Upcoming Batch Risk</h1>
        <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
          letterSpacing: "0.14em", color: "#f59e0b", marginTop: 4 }}>Predictive Yield Engine</p>
      </div>

      {/* ── 4 KPI cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {[
          { label: "Total Wafers", value: summary.totalWafers != null ? String(summary.totalWafers) : "--", valueColor: "#fff",     sub: hasData ? "Batch analyzed" : "Awaiting data", subColor: "#94a3b8" },
          { label: "High Risk",    value: String(highCount),  valueColor: "#f43f5e", sub: "Critical alerts", subColor: "rgba(244,63,94,0.7)" },
          { label: "Medium Risk",  value: String(medCount),   valueColor: "#f59e0b", sub: "Watchlist",       subColor: "rgba(245,158,11,0.7)" },
          { label: "Low Risk",     value: String(lowCount),   valueColor: "#fff",    sub: summary.passRate != null ? `${summary.passRate.toFixed(2)}%` : "--", subColor: "#4ade80" },
        ].map((k, i) => (
          <div key={i} style={{ background: "rgba(14,16,21,1)", borderRadius: 12, padding: 20,
            border: "1px solid rgba(26,29,38,1)", transition: "border-color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(26,29,38,1)")}
          >
            <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace", textTransform: "uppercase",
              letterSpacing: "0.1em", color: "#94a3b8", fontWeight: 600, margin: 0 }}>{k.label}</p>
            <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: "1.875rem", fontWeight: 700, color: k.valueColor,
                fontFamily: "ui-monospace,monospace", letterSpacing: "-0.02em" }}>{k.value}</span>
              {k.sub && <span style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
                color: k.subColor }}>{k.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Wafer card grid — empty state ── */}
      {WAFERS.length === 0 && (
        <div style={{ padding: "48px 24px", textAlign: "center",
          background: "rgba(14,16,21,1)", borderRadius: 12,
          border: "1px solid rgba(26,29,38,1)" }}>
          <div style={{ fontFamily: "ui-monospace,monospace", fontSize: "0.75rem",
            color: "#64748b", letterSpacing: "0.08em" }}>
            NO BATCH DATA - Upload a CSV in{" "}
            <span style={{ color: "#f59e0b" }}>Data &amp; Reports</span> to see wafer risk predictions
          </div>
        </div>
      )}

      {/* ── Wafer card grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        {WAFERS.map((w, i) => {
          const bs = BADGE_STYLES[w.badge as Badge];
          const isLoading = loadingIdx === i;
          return (
            <motion.article key={w.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16,1,0.3,1] }}
              style={{
                background: "rgba(12,14,18,1)", borderRadius: 12, padding: 20,
                display: "flex", flexDirection: "column", justifyContent: "space-between",
                border: "1px solid rgba(255,255,255,0.05)", position: "relative",
                transition: "all 0.24s cubic-bezier(0.16,1,0.3,1)",
                cursor: "pointer",
              }}
              whileHover={{ y: -3, borderColor: "rgba(245,158,11,0.35)",
                boxShadow: "0 12px 30px -10px rgba(0,0,0,0.8), 0 0 20px 2px rgba(245,158,11,0.08)" }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.05em",
                    fontFamily: "ui-monospace,monospace", color: "#fff" }}>{w.id}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.625rem",
                    fontFamily: "ui-monospace,monospace", fontWeight: 700, textTransform: "uppercase",
                    background: bs.bg, color: bs.color, border: `1px solid ${bs.border}` }}>{w.badge}</span>
                </div>
                <p style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
                  color: "#94a3b8", margin: "0 0 4px" }}>Predicted Risk</p>
                <div style={{ fontSize: "1.875rem", fontWeight: 700, fontFamily: "ui-monospace,monospace",
                  color: "#fff", letterSpacing: "-0.02em", marginBottom: 16 }}>{w.risk.toFixed(1)}%</div>
                <div style={{ fontSize: "0.6875rem", fontFamily: "ui-monospace,monospace",
                  borderTop: "1px solid rgba(24,26,34,1)", paddingTop: 12,
                  display: "flex", flexDirection: "column", gap: 6, color: "#94a3b8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Pred. Yield: <strong style={{ color: "#e2e8f0" }}>{w.yield.toFixed(1)}%</strong></span>
                    <span style={{ color: "#64748b" }}>Exp: 98.5%</span>
                  </div>
                  <div>Primary Risk: <span style={{ color: "#fbbf24", fontWeight: 500 }}>Model Output</span></div>
                </div>
              </div>
              <button onClick={() => handleView(i)} style={{
                marginTop: 20, width: "100%", padding: "8px 12px",
                fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.1em",
                color: isLoading ? "rgba(255,255,255,0.5)" : "#cbd5e1",
                background: isLoading ? "rgba(20,23,32,0.5)" : "rgba(20,23,32,1)",
                border: "1px solid rgba(71,85,105,0.6)", borderRadius: 4,
                cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.background = "#f59e0b"; e.currentTarget.style.color = "#000"; } }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(20,23,32,1)"; e.currentTarget.style.color = "#cbd5e1"; }}
              >
                {isLoading ? "LOADING..." : "View Prediction"}
              </button>
            </motion.article>
          );
        })}
      </div>

      {/* ── Batch metadata footer ── */}
      <div style={{ paddingTop: 16, borderTop: "1px solid rgba(20,23,32,1)",
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
        gap: 16, fontSize: "0.75rem", fontFamily: "ui-monospace,monospace", color: "#64748b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>BATCH SIZE: <span style={{ color: "#cbd5e1" }}>{summary.totalWafers != null ? String(summary.totalWafers) : "--"}</span></span>
          <span style={{ color: "#374151" }}>|</span>
          <span>PASS: <span style={{ color: "#4ade80" }}>{summary.passCount != null ? String(summary.passCount) : "--"}</span></span>
          <span style={{ color: "#374151" }}>|</span>
          <span>FAIL: <span style={{ color: "#f87171" }}>{summary.failCount != null ? String(summary.failCount) : "--"}</span></span>
          {summary.execTime && (
            <>
              <span style={{ color: "#374151" }}>|</span>
              <span>EXEC: <span style={{ color: "#cbd5e1" }}>{summary.execTime}</span></span>
            </>
          )}
          {activeAnalysisId && savedAnalysis && (
            <>
              <span style={{ color: "#374151" }}>|</span>
              <span>DATASET: <span style={{ color: "#fbbf24" }}>{savedAnalysis.dataset_name}</span></span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%",
            background: hasData ? "#10b981" : "rgba(245,158,11,0.8)", display: "inline-block" }} />
          <span style={{ color: "#94a3b8" }}>{hasData ? (activeAnalysisId ? "Saved analysis loaded" : "Batch data loaded") : "Awaiting batch upload"}</span>
        </div>
      </div>
    </div>
  );
}

