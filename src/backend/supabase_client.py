"""
supabase_client.py — Supabase integration for YieldSentinel backend
--------------------------------------------------------------------
Saves prediction results to two tables:

  predictions      — single-wafer results (from POST /predict)
  batch_runs       — batch CSV summary + per-wafer rows (from POST /predict-csv)

Environment variables required (set in .env or system env):
  SUPABASE_URL              Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY Service-role key (never exposed to the browser)

If either variable is missing the module degrades gracefully — predictions
still work, but nothing is stored in Supabase.
"""

from __future__ import annotations

import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("yieldsentinel.supabase")

# ─── Lazy client ──────────────────────────────────────────────────────────────

_client = None


def _get_client():
    """Return a cached Supabase client, or None if credentials are absent."""
    global _client
    if _client is not None:
        return _client

    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        logger.warning(
            "Supabase credentials not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). "
            "Prediction storage disabled."
        )
        return None

    try:
        from supabase import create_client  # type: ignore
        _client = create_client(url, key)
        logger.info("Supabase client initialised — predictions will be persisted.")
    except Exception as exc:
        logger.error(f"Failed to create Supabase client: {exc}")
        return None

    return _client


# ─── Public helpers ────────────────────────────────────────────────────────────

def save_prediction(result: dict[str, Any]) -> None:
    """
    Fire-and-forget: persist a single-wafer prediction result.
    Called after POST /predict returns.

    Expected keys in `result`:
        wafer_id, prediction, pass_probability, fail_probability,
        anomaly_score, threshold_used, latency_ms
    """
    client = _get_client()
    if client is None:
        return

    row = {
        "wafer_id":        result.get("wafer_id"),
        "prediction":      result.get("prediction"),
        "pass_probability": result.get("pass_probability"),
        "fail_probability": result.get("fail_probability"),
        "anomaly_score":   result.get("anomaly_score"),
        "threshold_used":  result.get("threshold_used"),
        "latency_ms":      result.get("latency_ms"),
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }

    try:
        client.table("predictions").insert(row).execute()
    except Exception as exc:
        logger.error(f"Failed to save prediction to Supabase: {exc}")


def save_batch_run(summary: dict[str, Any], wafers: list[dict[str, Any]]) -> None:
    """
    Persist a batch CSV run: one row in `batch_runs` and one row per wafer
    in `batch_wafers`.

    Expected keys in `summary`:
        total_wafers, pass_count, fail_count, pass_rate, fail_rate,
        estimated_execution_time_ms

    Each wafer dict:
        wafer_id, prediction, pass_probability, fail_probability, anomaly_score
    """
    client = _get_client()
    if client is None:
        return

    try:
        now = datetime.now(timezone.utc).isoformat()

        # Insert batch summary, get back the generated id
        resp = (
            client.table("batch_runs")
            .insert({
                "total_wafers":               summary.get("total_wafers"),
                "pass_count":                 summary.get("pass_count"),
                "fail_count":                 summary.get("fail_count"),
                "pass_rate":                  summary.get("pass_rate"),
                "fail_rate":                  summary.get("fail_rate"),
                "estimated_execution_time_ms": summary.get("estimated_execution_time_ms"),
                "created_at":                 now,
            })
            .execute()
        )

        batch_id: str | None = None
        if resp.data:
            batch_id = resp.data[0].get("id")

        # Insert per-wafer rows
        wafer_rows = [
            {
                "batch_run_id":    batch_id,
                "wafer_id":        w.get("wafer_id"),
                "prediction":      w.get("prediction"),
                "pass_probability": w.get("pass_probability"),
                "fail_probability": w.get("fail_probability"),
                "anomaly_score":   w.get("anomaly_score"),
                "created_at":      now,
            }
            for w in wafers
        ]
        if wafer_rows:
            client.table("batch_wafers").insert(wafer_rows).execute()

    except Exception as exc:
        logger.error(f"Failed to save batch run to Supabase: {exc}")
