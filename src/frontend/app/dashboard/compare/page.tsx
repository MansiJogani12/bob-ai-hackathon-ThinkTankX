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
  red: "#ef4444",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  font: "Inter, system-ui, -apple-system, sans-serif",
} as const;

/* ── Helpers ── */
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}

interface EvidenceParameter {
  label: string;
  evidenceScore: number | null;
  deviation: string | null;
  rank: number | null;
}

function getFeatureName(a: Analysis, rawLabel: string): string {
  const featureNames = a.metadata?.["feature_names"];
  if (Array.isArray(featureNames)) {
    const rawFeature = rawLabel.replace(/^Sensor\s+/i, "").trim();
    const index = Number(rawFeature);
    const namedFeature = Number.isInteger(index) ? featureNames[index] : undefined;
    if (typeof namedFeature === "string" && namedFeature.trim()) return namedFeature;
  }
  return rawLabel.replace(/^Sensor\s+/i, "Feature ");
}

function getEvidenceParameters(a: Analysis): EvidenceParameter[] {
  const causes = a.root_causes?.["causes"];
  if (!Array.isArray(causes)) return [];
  return (causes as { label?: string; probability?: number; deviation?: string; rank?: number }[]).map(c => ({
    label: getFeatureName(a, c.label ?? "Unknown"),
    evidenceScore: typeof c.probability === "number" ? c.probability : null,
    deviation: c.deviation ?? null,
    rank: c.rank ?? null,
  }));
}

function isSignificant(parameter: EvidenceParameter): boolean {
  return parameter.deviation === "HIGH" || parameter.deviation === "MEDIUM" || (parameter.evidenceScore ?? 0) >= 33;
}

/* ── Issue classification ── */
interface IssueClassification {
  improved: string[];     // rc with decreasing occurrence/prob
  persistent: string[];   // rc appearing in all selected analyses
  newIssues: string[];    // rc only in most recent
  regression: string[];   // rc that improved then worsened
  resolved: string[];     // rc no longer in latest
}

function classifyIssues(selected: Analysis[]): IssueClassification {
  if (selected.length < 2) return { improved: [], persistent: [], newIssues: [], regression: [], resolved: [] };

  const sorted = [...selected].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const parametersByAnalysis = sorted.map(a => getEvidenceParameters(a));

  const allFeatures = new Set<string>();
  for (const parameters of parametersByAnalysis) {
    parameters.filter(isSignificant).forEach(parameter => allFeatures.add(parameter.label));
  }

  const persistent: string[] = [];
  const resolved: string[] = [];
  const newIssues: string[] = [];
  const improved: string[] = [];
  const regression: string[] = [];

  for (const feature of Array.from(allFeatures)) {
    const states = parametersByAnalysis.map(parameters => {
      const parameter = parameters.find(candidate => candidate.label === feature);
      return { significant: parameter ? isSignificant(parameter) : false, score: parameter?.evidenceScore ?? null };
    });
    const latestState = states[states.length - 1];
    const priorStates = states.slice(0, -1);
    const wasSignificant = priorStates.some(state => state.significant);
    const wasAlwaysSignificant = priorStates.length > 0 && priorStates.every(state => state.significant);
    const priorScores = priorStates.map(state => state.score).filter((score): score is number => score != null);
    const latestScore = latestState.score;

    if (wasSignificant && !latestState.significant) {
      resolved.push(feature);
    } else if (!wasSignificant && latestState.significant) {
      newIssues.push(feature);
    } else if (wasAlwaysSignificant && latestState.significant) {
      const priorAverage = priorScores.length ? priorScores.reduce((sum, score) => sum + score, 0) / priorScores.length : null;
      if (latestScore != null && priorAverage != null && latestScore < priorAverage) improved.push(feature);
      else if (latestScore != null && priorAverage != null && latestScore > priorAverage) regression.push(feature);
      else persistent.push(feature);
    } else if (latestState.significant) {
      persistent.push(feature);
    }
  }

  return { improved, persistent, newIssues, regression, resolved };
}

/* ── SVG Sparkline ── */
function Sparkline({ values, color = C.amber, width = 200, height = 40 }: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  if (values.length < 2) return <span style={{ color: C.muted, fontSize: "0.625rem", fontFamily: C.mono }}>Insufficient data</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Export helpers ── */
function exportComparisonJSON(selected: Analysis[]) {
  const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparison_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTrendCSV(selected: Analysis[]) {
  const sorted = [...selected].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const header = "Dataset,Date,Yield%,Fail Rate%,Pass,Fail,Total";
  const rows = sorted.map(a =>
    `${a.dataset_name},${fmtDate(a.created_at)},${a.yield_percentage?.toFixed(2) ?? ""},${a.fail_rate?.toFixed(2) ?? ""},${a.pass_count ?? ""},${a.fail_count ?? ""},${a.total_records ?? ""}`
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trend_comparison_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── IssueSection ── */
function IssueSection({ title, items, color, bgColor }: { title: string; items: string[]; color: string; bgColor: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "0.6rem", fontFamily: C.mono, color, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item, i) => (
          <span key={i} style={{
            fontSize: "0.6rem", fontFamily: C.mono, padding: "2px 8px", borderRadius: 4,
            background: bgColor, color, border: `1px solid ${color}40`, letterSpacing: "0.04em",
          }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ComparePage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareResult, setCompareResult] = useState<Analysis[] | null>(null);

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

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function runCompare() {
    const sel = analyses.filter(a => selected.has(a.id));
    setCompareResult(sel.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  }

  const issues = compareResult ? classifyIssues(compareResult) : null;
  const isTwoWay = compareResult?.length === 2;

  return (
    <div style={{ fontFamily: C.font, color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.15em",
          textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
          MULTI-ANALYSIS COMPARISON
        </div>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.025em", color: "#fff", marginBottom: 6 }}>
          Compare Analyses
        </h1>
        <p style={{ fontSize: "0.875rem", color: C.secondary }}>
          Select 2 or more analyses to compare yield trends, risk-parameter shifts, and issue classification.
        </p>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "rgba(127,29,29,0.4)",
          border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5",
          fontFamily: C.mono, fontSize: "0.65rem", letterSpacing: "0.04em", marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        {/* ── Left panel: selection ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em",
            fontWeight: 700, marginBottom: 14 }}>SELECT ANALYSES</div>

          {loading && <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono }}>Loading...</div>}

          {!loading && analyses.length === 0 && (
            <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono }}>
              No analyses found. Upload a CSV batch first.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto" }}>
            {analyses.map(a => {
              const isChecked = selected.has(a.id);
              return (
                <div key={a.id} onClick={() => toggleSelect(a.id)} style={{
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                  background: isChecked ? "rgba(245,158,11,0.1)" : "rgba(7,9,13,0.6)",
                  border: `1px solid ${isChecked ? "rgba(245,158,11,0.4)" : C.border}`,
                  transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${isChecked ? C.amber : C.muted}`,
                      background: isChecked ? C.amber : "transparent", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isChecked && <span style={{ color: "#000", fontSize: "0.6rem", fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: C.text, fontFamily: C.mono,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.dataset_name}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: "0.5625rem", color: C.muted, fontFamily: C.mono }}>{fmtDate(a.created_at)}</span>
                        {a.yield_percentage != null && (
                          <span style={{ fontSize: "0.5625rem", fontFamily: C.mono,
                            color: a.yield_percentage >= 90 ? C.green : a.yield_percentage >= 70 ? C.amber : C.red }}>
                            {a.yield_percentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={runCompare}
            disabled={selected.size < 2}
            style={{
              width: "100%", marginTop: 16, padding: "10px", borderRadius: 8,
              background: selected.size >= 2 ? C.amber : "rgba(30,38,52,0.8)",
              color: selected.size >= 2 ? "#000" : C.muted,
              fontFamily: C.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", border: "none", cursor: selected.size >= 2 ? "pointer" : "not-allowed",
              textTransform: "uppercase", transition: "all 0.15s",
            }}
          >
            COMPARE SELECTED ({selected.size})
          </button>
        </div>

        {/* ── Right panel: results ── */}
        <div>
          {!compareResult && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>⚖️</div>
              <div style={{ fontSize: "1rem", color: C.text, fontWeight: 600, marginBottom: 8 }}>Select analyses to compare</div>
              <div style={{ fontSize: "0.875rem", color: C.muted }}>Choose 2+ analyses from the left panel and click Compare.</div>
            </div>
          )}

          {compareResult && compareResult.length >= 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Export buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => exportComparisonJSON(compareResult)} style={{
                  padding: "6px 14px", borderRadius: 6, background: "transparent",
                  border: `1px solid rgba(245,158,11,0.4)`, color: C.amber,
                  fontFamily: C.mono, fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
                  cursor: "pointer", textTransform: "uppercase",
                }}>EXPORT JSON</button>
                <button onClick={() => exportTrendCSV(compareResult)} style={{
                  padding: "6px 14px", borderRadius: 6, background: "transparent",
                  border: `1px solid rgba(245,158,11,0.4)`, color: C.amber,
                  fontFamily: C.mono, fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em",
                  cursor: "pointer", textTransform: "uppercase",
                }}>EXPORT TREND CSV</button>
              </div>

              {/* 2-way: side-by-side table */}
              {isTwoWay && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em",
                    fontWeight: 700, marginBottom: 16 }}>SIDE-BY-SIDE COMPARISON</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: "0.75rem" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", color: C.muted, fontWeight: 600, fontSize: "0.625rem",
                            textTransform: "uppercase", letterSpacing: "0.1em" }}>METRIC</th>
                          {compareResult.map(a => (
                            <th key={a.id} style={{ padding: "8px 12px", textAlign: "right", color: C.amberDim, fontWeight: 600, fontSize: "0.625rem",
                              textTransform: "uppercase", letterSpacing: "0.08em", maxWidth: 160,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {a.dataset_name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Date", fn: (a: Analysis) => fmtDate(a.created_at), coloring: () => C.text },
                          { label: "Yield %", fn: (a: Analysis) => a.yield_percentage != null ? `${a.yield_percentage.toFixed(2)}%` : "Data unavailable",
                            coloring: (a: Analysis) => (a.yield_percentage ?? 0) >= 90 ? C.green : (a.yield_percentage ?? 0) >= 70 ? C.amber : C.red },
                          { label: "Fail Rate", fn: (a: Analysis) => a.fail_rate != null ? `${a.fail_rate.toFixed(2)}%` : "Data unavailable",
                            coloring: (a: Analysis) => (a.fail_rate ?? 0) > 15 ? C.red : (a.fail_rate ?? 0) > 5 ? C.amber : C.green },
                          { label: "Total Wafers", fn: (a: Analysis) => a.total_records != null ? String(a.total_records) : "Data unavailable", coloring: () => C.text },
                          { label: "Pass Count", fn: (a: Analysis) => a.pass_count != null ? String(a.pass_count) : "Data unavailable", coloring: () => C.green },
                          { label: "Fail Count", fn: (a: Analysis) => a.fail_count != null ? String(a.fail_count) : "Data unavailable", coloring: () => C.red },
                          { label: "Top Risk Parameter", fn: (a: Analysis) => getEvidenceParameters(a)[0]?.label ?? "Data unavailable", coloring: () => C.amberDim },
                          { label: "2nd Risk Parameter", fn: (a: Analysis) => getEvidenceParameters(a)[1]?.label ?? "Data unavailable", coloring: () => C.amber },
                          { label: "3rd Risk Parameter", fn: (a: Analysis) => getEvidenceParameters(a)[2]?.label ?? "Data unavailable", coloring: () => C.secondary },
                          { label: "4th Risk Parameter", fn: (a: Analysis) => getEvidenceParameters(a)[3]?.label ?? "Data unavailable", coloring: () => C.secondary },
                          { label: "5th Risk Parameter", fn: (a: Analysis) => getEvidenceParameters(a)[4]?.label ?? "Data unavailable", coloring: () => C.secondary },
                        ].map(row => (
                          <tr key={row.label} style={{ borderBottom: `1px solid rgba(30,38,52,0.5)` }}>
                            <td style={{ padding: "8px 12px", color: C.muted, fontWeight: 500, fontSize: "0.6875rem" }}>{row.label}</td>
                            {compareResult.map(a => (
                              <td key={a.id} style={{ padding: "8px 12px", textAlign: "right", color: row.coloring(a), fontWeight: 600 }}>
                                {row.fn(a)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Multi-way: trend lines */}
              {!isTwoWay && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em",
                    fontWeight: 700, marginBottom: 16 }}>TREND ANALYSIS ({compareResult.length} ANALYSES)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Yield % Over Time</div>
                      <Sparkline values={compareResult.map(a => a.yield_percentage ?? 0)} color={C.green} width={240} height={50} />
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {compareResult.map((a, i) => (
                          <span key={i} style={{ fontSize: "0.5rem", fontFamily: C.mono, color: C.muted }}>
                            {i + 1}. {a.yield_percentage?.toFixed(1) ?? "N/A"}%
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Fail Rate % Over Time</div>
                      <Sparkline values={compareResult.map(a => a.fail_rate ?? 0)} color={C.red} width={240} height={50} />
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {compareResult.map((a, i) => (
                          <span key={i} style={{ fontSize: "0.5rem", fontFamily: C.mono, color: C.muted }}>
                            {i + 1}. {a.fail_rate?.toFixed(1) ?? "N/A"}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Risk parameter frequency table */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Risk Parameter Frequency</div>
                    {(() => {
                      const freq: Record<string, number> = {};
                      for (const a of compareResult) {
                        for (const parameter of getEvidenceParameters(a).filter(isSignificant)) {
                          freq[parameter.label] = (freq[parameter.label] ?? 0) + 1;
                        }
                      }
                      const sorted = Object.entries(freq).sort((x, y) => y[1] - x[1]).slice(0, 8);
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {sorted.map(([label, count]) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.text, minWidth: 200 }}>{label}</span>
                              <div style={{ flex: 1, height: 4, background: "rgba(30,38,52,1)", borderRadius: 999 }}>
                                <div style={{ height: "100%", width: `${(count / compareResult.length) * 100}%`,
                                  background: `linear-gradient(90deg, ${C.amber}, ${C.amberDim})`, borderRadius: 999 }} />
                              </div>
                              <span style={{ fontSize: "0.625rem", fontFamily: C.mono, color: C.amber, minWidth: 24, textAlign: "right" }}>{count}x</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Issue classification */}
              {issues && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: "0.6875rem", fontFamily: C.mono, color: C.amber, letterSpacing: "0.1em",
                    fontWeight: 700, marginBottom: 16 }}>ISSUE CLASSIFICATION</div>
                  <IssueSection title="✓ RESOLVED — No longer present in latest" items={issues.resolved} color={C.green} bgColor="rgba(16,185,129,0.1)" />
                  <IssueSection title="▲ IMPROVED — Decreasing occurrence/severity" items={issues.improved} color="#34d399" bgColor="rgba(52,211,153,0.08)" />
                  <IssueSection title="— PERSISTENT — Appears in all selected analyses" items={issues.persistent} color={C.amber} bgColor="rgba(245,158,11,0.1)" />
                  <IssueSection title="● NEW — Only in most recent analysis" items={issues.newIssues} color="#818cf8" bgColor="rgba(129,140,248,0.1)" />
                  <IssueSection title="▼ REGRESSION — Improved then worsened" items={issues.regression} color={C.red} bgColor="rgba(239,68,68,0.1)" />
                  {Object.values(issues).every(arr => arr.length === 0) && (
                    <div style={{ color: C.muted, fontSize: "0.75rem", fontFamily: C.mono }}>
                      {compareResult.every(a => !a.root_causes) ? "Risk parameter data unavailable for selected analyses." : "No classification patterns detected."}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
