"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../src/lib/supabase";
import { getAnalyses, type Analysis } from "../../../src/lib/analysisDb";

/* ── Design tokens ── */
const C = {
  card: "rgba(10,13,18,0.9)",
  border: "rgba(30,38,52,1)",
  amber: "#f59e0b",
  amberDim: "#fbbf24",
  text: "#f4f4f5",
  secondary: "#94a3b8",
  muted: "#64748b",
  green: "#10b981",
  green2: "#4ade80",
  red: "#ef4444",
  red2: "#f87171",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  font: "Inter, system-ui, -apple-system, sans-serif",
} as const;

/* ── Helpers ── */
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return iso; }
}

function getRootCauses(a: Analysis): string[] {
  const causes = a.root_causes?.["causes"];
  if (!Array.isArray(causes)) return [];
  return (causes as { label?: string }[]).map(c => c.label ?? "Unknown").filter(Boolean);
}

function getRootCausesWithProb(a: Analysis): { label: string; probability: number }[] {
  const causes = a.root_causes?.["causes"];
  if (!Array.isArray(causes)) return [];
  return (causes as { label?: string; probability?: number }[]).map(c => ({
    label: c.label ?? "Unknown",
    probability: c.probability ?? 0,
  }));
}

/* ── SVG Line Chart ── */
interface LineChartProps {
  data: { label: string; value: number }[];
  color: string;
  width?: number;
  height?: number;
  showLabels?: boolean;
  valueFormatter?: (v: number) => string;
}

function LineChart({ data, color, width = 400, height = 100, showLabels = true, valueFormatter = (v) => v.toFixed(1) }: LineChartProps) {
  if (data.length < 2) {
    return (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center",
        color: C.muted, fontSize: "0.6875rem", fontFamily: C.mono }}>
        Insufficient data
      </div>
    );
  }
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padV = 10;
  const padH = 8;
  const w = width - padH * 2;
  const h = height - padV * 2;

  const pts = data.map((d, i) => {
    const x = padH + (i / (data.length - 1)) * w;
    const y = padV + h - ((d.value - min) / range) * h;
    return { x, y, d };
  });

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${(padV + h).toFixed(1)} L${pts[0].x.toFixed(1)},${(padV + h).toFixed(1)} Z`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`grad_${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad_${color.replace("#", "")})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} />
          {showLabels && (
            <>
              <text x={p.x} y={p.y - 8} textAnchor="middle" fill={color} fontSize={9} fontFamily={C.mono}>
                {valueFormatter(p.d.value)}
              </text>
              <text x={p.x} y={height - 2} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily={C.mono}>
                {p.d.label}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── Bar Chart ── */
function BarChart({ data, color, width = 400, height = 120 }: {
  data: { label: string; value: number }[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data.length) return <div style={{ color: C.muted, fontSize: "0.6875rem", fontFamily: C.mono }}>No data</div>;
  const max = Math.max(...data.map(d => d.value));
  const barW = Math.max(16, Math.floor((width - 20) / data.length) - 4);
  const padTop = 20;
  const padBot = 28;
  const chartH = height - padTop - padBot;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {data.map((d, i) => {
        const barH = max > 0 ? (d.value / max) * chartH : 0;
        const x = 10 + i * (barW + 4);
        const y = padTop + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              fill={color} opacity={0.8} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={color} fontSize={9} fontFamily={C.mono}>
              {d.value}
            </text>
            <text x={x + barW / 2} y={height - 4} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily={C.mono}
              style={{ overflow: "hidden" }}>
              {d.label.length > 6 ? d.label.slice(0, 6) + "…" : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Root Cause Trend Status ── */
type TrendStatus = "IMPROVING" | "STABLE" | "WORSENING";

function rcTrendStatus(probs: number[]): TrendStatus {
  if (probs.length < 2) return "STABLE";
  const delta = probs[probs.length - 1] - probs[0];
  if (delta < -0.05) return "IMPROVING";
  if (delta > 0.05) return "WORSENING";
  return "STABLE";
}

function trendStatusColor(s: TrendStatus) {
  if (s === "IMPROVING") return C.green;
  if (s === "WORSENING") return C.red;
  return C.amber;
}

/* ── Sparkline inline ── */
function Sparkline({ values, color, width = 80, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <span style={{ color: C.muted, fontSize: "0.5rem" }}>—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/* ── Issue classification (same logic as compare page) ── */
function classifyIssues(sorted: Analysis[]) {
  if (sorted.length < 2) return { improved: [] as string[], persistent: [] as string[], newIssues: [] as string[], regression: [] as string[], resolved: [] as string[] };
  const latest = sorted[sorted.length - 1];
  const latestRC = new Set(getRootCauses(latest));
  const allRCSets = sorted.map(a => new Set(getRootCauses(a)));
  const allRC = new Set<string>();
  for (const s of allRCSets) s.forEach(rc => allRC.add(rc));

  const persistent: string[] = [], resolved: string[] = [], newIssues: string[] = [], improved: string[] = [], regression: string[] = [];
  for (const rc of Array.from(allRC)) {
    const occ = allRCSets.map(s => s.has(rc));
    const allPresent = occ.every(Boolean);
    const inLatest = latestRC.has(rc);
    const firstIdx = occ.indexOf(true);
    if (allPresent) {
      const probs = sorted.map(a => getRootCausesWithProb(a).find(x => x.label === rc)?.probability ?? 0);
      probs[probs.length - 1] > probs[0] ? regression.push(rc) : persistent.push(rc);
    } else if (!inLatest) {
      resolved.push(rc);
    } else if (firstIdx === sorted.length - 1) {
      newIssues.push(rc);
    } else if (inLatest) {
      const latestP = getRootCausesWithProb(latest).find(x => x.label === rc)?.probability ?? 0;
      const earlyP = sorted.slice(0, -1).filter((_, i) => occ[i])
        .map(a => getRootCausesWithProb(a).find(x => x.label === rc)?.probability ?? 0);
      const avgE = earlyP.length ? earlyP.reduce((s, v) => s + v, 0) / earlyP.length : 0;
      if (latestP < avgE) improved.push(rc);
    }
  }
  return { improved, persistent, newIssues, regression, resolved };
}

/* ── Process status ── */
type ProcessStatus = "IMPROVING" | "STABLE" | "DEGRADING" | "REQUIRES INVESTIGATION";

function getProcessStatus(sorted: Analysis[]): ProcessStatus {
  if (sorted.length < 2) return "STABLE";
  const yields = sorted.map(a => a.yield_percentage ?? 0);
  const latest = yields[yields.length - 1];
  const prev = yields[yields.length - 2];
  const delta = latest - prev;
  const avgAll = yields.reduce((s, v) => s + v, 0) / yields.length;
  if (latest < 50) return "REQUIRES INVESTIGATION";
  if (delta > 3) return "IMPROVING";
  if (delta < -3) return "DEGRADING";
  if (Math.abs(latest - avgAll) < 2) return "STABLE";
  return "STABLE";
}

function processStatusStyle(status: ProcessStatus): { color: string; bg: string; border: string; pulse?: boolean } {
  if (status === "IMPROVING") return { color: C.green, bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.4)" };
  if (status === "STABLE") return { color: C.amber, bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.4)" };
  if (status === "DEGRADING") return { color: C.red, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.4)" };
  return { color: C.red, bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.5)", pulse: true };
}

/* ── Main Page ── */
export default function IntelligencePage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { setError("Not authenticated."); setLoading(false); return; }
      const data = await getAnalyses(session.user.id);
      setAnalyses(data);
    } catch {
      setError("Failed to load analyses.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...analyses].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const hasEnough = sorted.length >= 2;

  /* KPIs */
  const latestYield = latest?.yield_percentage;
  const prevYield = prev?.yield_percentage;
  const yieldChange = latestYield != null && prevYield != null ? latestYield - prevYield : null;
  const currentFailRate = latest?.fail_rate;
  const totalWafers = analyses.reduce((s, a) => s + (a.total_records ?? 0), 0);
  const highRiskIssues = latest ? getRootCauses(latest).length : 0;

  const issues = hasEnough ? classifyIssues(sorted) : null;
  const persistentCount = issues?.persistent.length ?? 0;
  const processStatus = hasEnough ? getProcessStatus(sorted) : "STABLE";
  const statusStyle = processStatusStyle(processStatus);
  const historicalBest = sorted.length ? Math.max(...sorted.map(a => a.yield_percentage ?? 0)) : null;
  const historicalWorst = sorted.length ? Math.min(...sorted.map(a => a.yield_percentage ?? 0)) : null;

  /* Chart data */
  const yieldTimeSeries = sorted.map(a => ({ label: fmtDate(a.created_at), value: a.yield_percentage ?? 0 }));
  const failRateTimeSeries = sorted.map(a => ({ label: fmtDate(a.created_at), value: a.fail_rate ?? 0 }));

  /* Root cause frequency bar chart */
  const rcFreq: Record<string, number> = {};
  for (const a of sorted) {
    for (const rc of getRootCauses(a)) {
      rcFreq[rc] = (rcFreq[rc] ?? 0) + 1;
    }
  }
  const rcBarData = Object.entries(rcFreq).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  /* Root cause trends */
  const allRC = new Set<string>();
  for (const a of sorted) getRootCauses(a).forEach(rc => allRC.add(rc));
  const rcTrends: { label: string; probs: number[]; firstDate: string; latestSeverity: number; count: number; status: TrendStatus }[] = [];
  for (const rc of Array.from(allRC)) {
    const appearances = sorted.filter(a => getRootCauses(a).includes(rc));
    if (appearances.length < 2) continue;
    const probs = sorted.map(a => getRootCausesWithProb(a).find(x => x.label === rc)?.probability ?? 0);
    const nonZeroProbs = probs.filter(p => p > 0);
    rcTrends.push({
      label: rc,
      probs,
      firstDate: fmtDate(appearances[0].created_at),
      latestSeverity: nonZeroProbs[nonZeroProbs.length - 1] ?? 0,
      count: appearances.length,
      status: rcTrendStatus(nonZeroProbs),
    });
  }
  rcTrends.sort((a, b) => b.count - a.count);

  const kpis = [
    { label: "Latest Yield %", value: latestYield != null ? `${latestYield.toFixed(2)}%` : "N/A",
      color: latestYield != null && latestYield >= 90 ? C.green : latestYield != null && latestYield >= 70 ? C.amber : C.red },
    { label: "Previous Yield %", value: prevYield != null ? `${prevYield.toFixed(2)}%` : "N/A", color: C.secondary },
    { label: "Yield Change", value: yieldChange != null ? `${yieldChange > 0 ? "▲" : "▼"} ${Math.abs(yieldChange).toFixed(2)}%` : "N/A",
      color: yieldChange == null ? C.muted : yieldChange > 0 ? C.green : C.red },
    { label: "Current Fail Rate", value: currentFailRate != null ? `${currentFailRate.toFixed(2)}%` : "N/A",
      color: currentFailRate != null && currentFailRate > 15 ? C.red : currentFailRate != null && currentFailRate > 5 ? C.amber : C.green },
    { label: "Total Analyses", value: String(analyses.length), color: C.text },
    { label: "Total Wafers", value: totalWafers > 0 ? String(totalWafers) : "N/A", color: C.secondary },
    { label: "Active High-Risk Issues", value: String(highRiskIssues), color: highRiskIssues > 3 ? C.red : C.amber },
    { label: "Persistent Root Causes", value: String(persistentCount), color: persistentCount > 2 ? C.red2 : C.amber },
  ];

  return (
    <div style={{ fontFamily: C.font, color: C.text }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes statusPulse { 0%,100%{opacity:1;box-shadow:0 0 12px rgba(239,68,68,0.5)} 50%{opacity:0.85;box-shadow:0 0 22px rgba(239,68,68,0.8)} }
      ` }} />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.15em",
          textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
          POWER BI-STYLE COMMAND CENTER
        </div>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#fff", marginBottom: 6 }}>
          Yield Intelligence
        </h1>
        <p style={{ fontSize: "0.875rem", color: C.secondary }}>
          Cross-analysis intelligence — trends, risks, root cause evolution, and process status.
        </p>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(127,29,29,0.4)",
          border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5",
          fontFamily: C.mono, fontSize: "0.65rem", letterSpacing: "0.04em", marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: C.muted, fontFamily: C.mono, fontSize: "0.875rem" }}>
          Loading intelligence data...
        </div>
      )}

      {!loading && !hasEnough && analyses.length < 2 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: "1rem", color: C.text, fontWeight: 600, marginBottom: 8 }}>
            Insufficient data — upload more analyses
          </div>
          <div style={{ fontSize: "0.875rem", color: C.muted }}>
            {analyses.length === 0
              ? "No analyses found. Upload a CSV batch to begin."
              : "At least 2 analyses are required for trend intelligence. Upload another CSV batch."}
          </div>
        </div>
      )}

      {!loading && (analyses.length >= 1) && (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {kpis.slice(0, 4).map(k => (
              <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: "0.5rem", fontFamily: C.mono, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: C.mono, color: k.color, letterSpacing: "-0.02em" }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            {kpis.slice(4).map(k => (
              <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: "0.5rem", fontFamily: C.mono, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: C.mono, color: k.color, letterSpacing: "-0.02em" }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* ── Process Status Banner ── */}
          <div style={{
            background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, borderRadius: 12,
            padding: "16px 24px", marginBottom: 24,
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
            animation: statusStyle.pulse ? "statusPulse 2s ease-in-out infinite" : undefined,
          }}>
            <div>
              <div style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
                PROCESS STATUS
              </div>
              <div style={{ fontSize: "1.375rem", fontWeight: 800, fontFamily: C.mono, color: statusStyle.color, letterSpacing: "0.05em" }}>
                {processStatus}
              </div>
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              {[
                { label: "LATEST", value: latestYield != null ? `${latestYield.toFixed(1)}%` : "N/A", color: statusStyle.color },
                { label: "PREVIOUS", value: prevYield != null ? `${prevYield.toFixed(1)}%` : "N/A", color: C.secondary },
                { label: "HIST. BEST", value: historicalBest != null ? `${historicalBest.toFixed(1)}%` : "N/A", color: C.green },
                { label: "HIST. WORST", value: historicalWorst != null ? `${historicalWorst.toFixed(1)}%` : "N/A", color: C.red },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.5rem", fontFamily: C.mono, color: C.muted, letterSpacing: "0.1em", marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, fontFamily: C.mono, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Charts row ── */}
          {hasEnough && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
              {/* Yield line chart */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.muted, letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                  YIELD % OVER TIME
                </div>
                <LineChart data={yieldTimeSeries} color={C.green} width={260} height={110}
                  valueFormatter={v => `${v.toFixed(1)}%`} />
              </div>
              {/* Fail rate line chart */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.muted, letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                  FAIL RATE % OVER TIME
                </div>
                <LineChart data={failRateTimeSeries} color={C.red} width={260} height={110}
                  valueFormatter={v => `${v.toFixed(1)}%`} />
              </div>
              {/* Root cause frequency bar */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.muted, letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                  ROOT CAUSE FREQUENCY (TOP 8)
                </div>
                {rcBarData.length > 0
                  ? <BarChart data={rcBarData} color={C.amber} width={260} height={120} />
                  : <div style={{ color: C.muted, fontSize: "0.6875rem", fontFamily: C.mono }}>No root cause data</div>
                }
              </div>
            </div>
          )}

          {/* ── Intelligence Panel ── */}
          {issues && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {/* Current top risks */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 14 }}>
                  CURRENT TOP RISKS
                </div>
                {latest ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {getRootCausesWithProb(latest).slice(0, 5).map((rc, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: "0.5rem", fontFamily: C.mono, color: C.muted, minWidth: 16 }}>#{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.text }}>{rc.label}</span>
                            <span style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.amber }}>{(rc.probability * 100).toFixed(0)}%</span>
                          </div>
                          <div style={{ height: 3, background: "rgba(30,38,52,1)", borderRadius: 999 }}>
                            <div style={{ height: "100%", width: `${rc.probability * 100}%`,
                              background: i < 2 ? `linear-gradient(90deg, ${C.red}, ${C.red2})` : `linear-gradient(90deg, ${C.amber}, ${C.amberDim})`,
                              borderRadius: 999 }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {getRootCauses(latest).length === 0 && (
                      <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono }}>Data unavailable</div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono }}>Data unavailable</div>
                )}
              </div>

              {/* Issue status panel */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 14 }}>
                  ISSUE STATUS SUMMARY
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Resolved", items: issues.resolved, color: C.green, icon: "✓" },
                    { label: "Improving", items: issues.improved, color: "#34d399", icon: "▲" },
                    { label: "Persistent", items: issues.persistent, color: C.amber, icon: "—" },
                    { label: "New Risks", items: issues.newIssues, color: "#818cf8", icon: "●" },
                    { label: "Regressions", items: issues.regression, color: C.red, icon: "▼" },
                  ].map(cat => (
                    <div key={cat.label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: cat.color, minWidth: 14 }}>{cat.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: cat.color, fontWeight: 600 }}>{cat.label}</span>
                          <span style={{ fontSize: "0.5625rem", fontFamily: C.mono, color: C.muted }}>{cat.items.length}</span>
                        </div>
                        {cat.items.length > 0 && (
                          <div style={{ fontSize: "0.5625rem", color: C.muted, fontFamily: C.mono, marginTop: 2,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {cat.items.slice(0, 3).join(", ")}{cat.items.length > 3 ? "..." : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Root Cause Trend Tracking ── */}
          {rcTrends.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 16 }}>
                ROOT CAUSE TREND TRACKING
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 100px 80px 80px 40px 100px", gap: 0 }}>
                {/* Header */}
                {["ROOT CAUSE", "SPARKLINE", "FIRST DETECTED", "LATEST SEV.", "COUNT", "STATUS"].map(h => (
                  <div key={h} style={{ padding: "6px 10px", fontSize: "0.5rem", fontFamily: C.mono, color: C.muted,
                    textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: `1px solid ${C.border}` }}>
                    {h}
                  </div>
                ))}
                {/* Rows */}
                {rcTrends.map((rc, i) => {
                  const sColor = trendStatusColor(rc.status);
                  return (
                    <React.Fragment key={i}>
                      <div style={{ padding: "8px 10px", borderBottom: `1px solid rgba(30,38,52,0.5)`,
                        fontSize: "0.6875rem", fontFamily: C.mono, color: C.text,
                        display: "flex", alignItems: "center" }}>
                        {rc.label}
                      </div>
                      <div style={{ padding: "8px 10px", borderBottom: `1px solid rgba(30,38,52,0.5)`,
                        display: "flex", alignItems: "center" }}>
                        <Sparkline values={rc.probs} color={sColor} width={80} height={20} />
                      </div>
                      <div style={{ padding: "8px 10px", borderBottom: `1px solid rgba(30,38,52,0.5)`,
                        fontSize: "0.5625rem", fontFamily: C.mono, color: C.muted, display: "flex", alignItems: "center" }}>
                        {rc.firstDate}
                      </div>
                      <div style={{ padding: "8px 10px", borderBottom: `1px solid rgba(30,38,52,0.5)`,
                        fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, display: "flex", alignItems: "center" }}>
                        {(rc.latestSeverity * 100).toFixed(0)}%
                      </div>
                      <div style={{ padding: "8px 10px", borderBottom: `1px solid rgba(30,38,52,0.5)`,
                        fontSize: "0.6875rem", fontFamily: C.mono, color: C.text, display: "flex", alignItems: "center" }}>
                        {rc.count}
                      </div>
                      <div style={{ padding: "8px 10px", borderBottom: `1px solid rgba(30,38,52,0.5)`,
                        display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "0.5625rem", fontFamily: C.mono, padding: "2px 6px", borderRadius: 4,
                          background: `${sColor}18`, color: sColor, border: `1px solid ${sColor}40`,
                          letterSpacing: "0.06em", fontWeight: 700 }}>
                          {rc.status}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* No trend data message */}
          {rcTrends.length === 0 && hasEnough && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8 }}>
                ROOT CAUSE TREND TRACKING
              </div>
              <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono }}>
                No recurring root causes detected across analyses yet. Root cause trend data will appear when the same issue occurs in 2+ analyses.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// React needed for Fragment in JSX
import React from "react";
