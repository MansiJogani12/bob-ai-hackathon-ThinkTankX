/**
 * analysisDb.ts
 * ─────────────
 * Supabase CRUD helpers for: analyses, corrective_actions, comparisons.
 * All queries filter by user_id (RLS also enforces this server-side).
 * Errors are caught and returned as null / empty arrays — never thrown.
 */

import { supabase } from "./supabase";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface Analysis {
  id: string;
  user_id: string;
  dataset_name: string;
  created_at: string;
  total_records: number | null;
  pass_count: number | null;
  fail_count: number | null;
  yield_percentage: number | null;
  fail_rate: number | null;
  prediction_summary: Record<string, unknown> | null;
  root_causes: Record<string, unknown> | null;
  defect_patterns: Record<string, unknown> | null;
  analysis_summary: Record<string, unknown> | null;
  recommendations: Record<string, unknown> | null;
  model_info: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

export interface CorrectiveAction {
  id: string;
  user_id: string;
  analysis_id: string | null;
  recommendation_key: string | null;
  action_taken: string | null;
  date_taken: string | null;
  status: string;
  expected_improvement: string | null;
  notes: string | null;
  evidence_trigger: string | null;
  parameter: string | null;
  affected_records: number | null;
  failure_rate: number | null;
  risk_contribution: number | null;
  evidence_strength: number | null;
  equipment: string | null;
  validation_result: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Comparison {
  id: string;
  user_id: string;
  analysis_ids: string[];
  comparison_result: Record<string, unknown> | null;
  created_at: string;
}

export interface SaveAnalysisInput {
  userId: string;
  datasetName: string;
  batchResult: Record<string, unknown>;
  rootCauses: Record<string, unknown> | null;
  defectPatterns: Record<string, unknown> | null;
  analysisSummary: Record<string, unknown> | null;
  modelInfo: Record<string, unknown> | null;
  recommendations?: Record<string, unknown> | null;
}

/* ── Analyses ──────────────────────────────────────────────────────────── */

export async function saveAnalysis(input: SaveAnalysisInput): Promise<{ data: Analysis | null; error: string | null }> {
  try {
    const totalRecords = (input.batchResult["total_wafers"] as number) ?? null;
    const passCount    = (input.batchResult["pass_count"]   as number) ?? null;
    const failCount    = (input.batchResult["fail_count"]   as number) ?? null;
    // pass_rate and fail_rate from the backend are already 0–100 percentages
    const passRate     = (input.batchResult["pass_rate"]    as number) ?? null;
    const failRate     = (input.batchResult["fail_rate"]    as number) ?? null;

    const { data, error } = await supabase
      .from("analyses")
      .insert({
        user_id:            input.userId,
        dataset_name:       input.datasetName,
        total_records:      totalRecords,
        pass_count:         passCount,
        fail_count:         failCount,
        yield_percentage:   passRate,   // already a percentage (e.g. 87.5)
        fail_rate:          failRate,   // already a percentage
        prediction_summary: input.batchResult,
        root_causes:        input.rootCauses,
        defect_patterns:    input.defectPatterns,
        analysis_summary:   input.analysisSummary,
        model_info:         input.modelInfo,
        recommendations:    input.recommendations ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[analysisDb] saveAnalysis error:", error.message);
      return { data: null, error: error.message };
    }
    return { data: data as Analysis, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[analysisDb] saveAnalysis unexpected error:", msg);
    return { data: null, error: msg };
  }
}

export async function getAnalyses(userId: string): Promise<Analysis[]> {
  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[analysisDb] getAnalyses error:", error.message);
      return [];
    }
    return (data ?? []) as Analysis[];
  } catch (err) {
    console.error("[analysisDb] getAnalyses unexpected error:", err);
    return [];
  }
}

export async function getAnalysis(userId: string, id: string): Promise<Analysis | null> {
  try {
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (error) {
      console.error("[analysisDb] getAnalysis error:", error.message);
      return null;
    }
    return data as Analysis;
  } catch (err) {
    console.error("[analysisDb] getAnalysis unexpected error:", err);
    return null;
  }
}

/* ── Corrective Actions ─────────────────────────────────────────────────── */

export interface NewCorrectiveAction {
  action_taken: string;
  date_taken: string;
  status: string;
  expected_improvement: string;
  notes: string;
  recommendation_key?: string;
  evidence_trigger?: string;
  parameter?: string;
  affected_records?: number | null;
  failure_rate?: number | null;
  risk_contribution?: number | null;
  evidence_strength?: number | null;
  equipment?: string;
  validation_result?: string;
  due_date?: string;
}

export async function saveCorrectiveAction(
  userId: string,
  analysisId: string,
  action: NewCorrectiveAction
): Promise<CorrectiveAction | null> {
  try {
    const { data, error } = await supabase
      .from("corrective_actions")
      .insert({
        user_id: userId,
        analysis_id: analysisId,
        action_taken: action.action_taken,
        date_taken: action.date_taken || null,
        status: action.status,
        expected_improvement: action.expected_improvement,
        notes: action.notes,
        recommendation_key: action.recommendation_key ?? null,
        evidence_trigger: action.evidence_trigger ?? null,
        parameter: action.parameter ?? null,
        affected_records: action.affected_records ?? null,
        failure_rate: action.failure_rate ?? null,
        risk_contribution: action.risk_contribution ?? null,
        evidence_strength: action.evidence_strength ?? null,
        equipment: action.equipment ?? null,
        validation_result: action.validation_result ?? null,
        due_date: action.due_date || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[analysisDb] saveCorrectiveAction error:", error.message);
      return null;
    }
    return data as CorrectiveAction;
  } catch (err) {
    console.error("[analysisDb] saveCorrectiveAction unexpected error:", err);
    return null;
  }
}

export interface CorrectiveActionPatch {
  status?: string;
  notes?: string;
  validation_result?: string;
  date_taken?: string | null;
}

export async function updateCorrectiveAction(
  userId: string,
  id: string,
  patch: CorrectiveActionPatch
): Promise<CorrectiveAction | null> {
  try {
    const update: Record<string, unknown> = { ...patch };
    if (patch.status === "COMPLETED") update.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== "COMPLETED") update.completed_at = null;

    const { data, error } = await supabase
      .from("corrective_actions")
      .update(update)
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[analysisDb] updateCorrectiveAction error:", error.message);
      return null;
    }
    return data as CorrectiveAction;
  } catch (err) {
    console.error("[analysisDb] updateCorrectiveAction unexpected error:", err);
    return null;
  }
}

export async function getCorrectiveActions(
  userId: string,
  analysisId?: string
): Promise<CorrectiveAction[]> {
  try {
    let query = supabase
      .from("corrective_actions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (analysisId) {
      query = query.eq("analysis_id", analysisId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[analysisDb] getCorrectiveActions error:", error.message);
      return [];
    }
    return (data ?? []) as CorrectiveAction[];
  } catch (err) {
    console.error("[analysisDb] getCorrectiveActions unexpected error:", err);
    return [];
  }
}

export async function deleteAnalysis(userId: string, id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("analyses")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);
    if (error) {
      console.error("[analysisDb] deleteAnalysis error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[analysisDb] deleteAnalysis unexpected error:", err);
    return false;
  }
}

/* ── Comparisons ────────────────────────────────────────────────────────── */

export async function saveComparison(
  userId: string,
  analysisIds: string[],
  result: Record<string, unknown>
): Promise<Comparison | null> {
  try {
    const { data, error } = await supabase
      .from("comparisons")
      .insert({
        user_id: userId,
        analysis_ids: analysisIds,
        comparison_result: result,
      })
      .select()
      .single();

    if (error) {
      console.error("[analysisDb] saveComparison error:", error.message);
      return null;
    }
    return data as Comparison;
  } catch (err) {
    console.error("[analysisDb] saveComparison unexpected error:", err);
    return null;
  }
}
