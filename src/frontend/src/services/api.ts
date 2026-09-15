const BASE = "http://127.0.0.1:8000";

/* ── Types ────────────────────────────────────────── */

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface ModelInfoResponse {
  model_name: string;
  total_features: number;
  feature_names: string[];
  threshold: number;
  target_column: string;
  scale_pos_weight: number;
  schema_note: string;
}

export interface ShapFeature {
  feature: string;
  shap_value: number;
  direction: string; // "positive" | "negative"
}

export interface PredictResponse {
  wafer_id: string;
  prediction: string; // "PASS" | "FAIL"
  pass_probability: number;
  fail_probability: number;
  anomaly_score: number;
  threshold_used: number;
  latency_ms: string;
  top_shap_features: ShapFeature[];
}

export interface WaferResult {
  wafer_id: string;
  prediction: string;
  pass_probability: number;
  fail_probability: number;
  anomaly_score: number;
}

export interface BatchPredictResponse {
  total_wafers: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
  fail_rate: number;
  estimated_execution_time_ms: string;
  wafers: WaferResult[] | undefined;
}

export interface DashboardResponse {
  current_yield_pct: number;
  yield_delta_pct: number;
  at_risk_lots: number;
  active_root_causes: number;
  predicted_loss: string;
  fab_node: string;
  telemetry_latency_ms: number;
  total_wafers?: number;
  pass_count?: number;
  fail_count?: number;
  pass_rate?: number;
  fail_rate?: number;
  risk_counts?: { high: number; medium: number; low: number };
  yield_trend_7d: { day: string; yield_pct: number }[];
  active_alert: {
    lot_id: string;
    severity: string;
    yield_impact: string;
    primary_correlation: string;
  } | null;
  upcoming_batch_risk: { wafer_id: string; risk_score_pct: number; badge: string }[];
}

export interface RootCausesResponse {
  lot_id: string;
  observed_yield_pct: number | null;
  baseline_yield_pct: number | null;
  analyzed_parameters: number;
  model_version: string;
  model_confidence_pct: number | null;
  causes: {
    rank: number;
    label: string;
    probability: number;
    correlation: number;
    recurrence: number;
    deviation: string;
    equipment: string;
    historical_lots: string[];
    reasons: string[];
  }[];
  limitations?: string[];
}

export interface DefectPattern {
  id: string;
  label: string;
  confidence_pct: number;
  affected_lots: number;
  top_correlation: string;
  primary_equipment: string;
  defect_coordinates: { x: number; y: number }[];
}

export interface DefectPatternsResponse {
  substrate: string;
  grid: string;
  total_defects_analyzed: number;
  unique_patterns: number;
  critical_patterns: number;
  new_patterns_24h: number;
  patterns: DefectPattern[];
  limitations?: string[];
}

/* ── API Functions ────────────────────────────────── */

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
  return res.json();
}

export async function getModelInfo(): Promise<ModelInfoResponse> {
  const res = await fetch(`${BASE}/model-info`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Model info failed: HTTP ${res.status}`);
  return res.json();
}

export async function predictSingleWafer(
  sensors: Record<string, number>
): Promise<PredictResponse> {
  const res = await fetch(`${BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sensors }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Predict failed: HTTP ${res.status}: ${detail}`);
  }
  return res.json();
}

export async function predictBatch(file: File): Promise<BatchPredictResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/predict-csv`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Batch predict failed: HTTP ${res.status}: ${detail}`);
  }
  return res.json();
}

export async function getDashboard(): Promise<DashboardResponse> {
  const res = await fetch(`${BASE}/dashboard`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Dashboard failed: HTTP ${res.status}`);
  return res.json();
}

export async function getRootCauses(): Promise<RootCausesResponse> {
  const res = await fetch(`${BASE}/root-causes`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Root causes failed: HTTP ${res.status}`);
  return res.json();
}

export async function getDefectPatterns(): Promise<DefectPatternsResponse> {
  const res = await fetch(`${BASE}/defect-patterns`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Defect patterns failed: HTTP ${res.status}`);
  return res.json();
}
