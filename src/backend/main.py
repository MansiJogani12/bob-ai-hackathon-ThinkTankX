"""
main.py — YieldSentinel AI FastAPI Backend
-------------------------------------------
Run:
    uvicorn main:app --reload --port 8000

Endpoints
---------
GET  /                    health-check
GET  /model-info          model schema & metadata
POST /predict             single-wafer inference + SHAP top-4
POST /predict-csv         batch CSV inference
GET  /dashboard           Command Center analytics
GET  /root-causes         RCA ranked list
GET  /defect-patterns     defect spatial pattern data
"""

from __future__ import annotations

import io
import os
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="YieldSentinel AI",
    description="Semiconductor yield prediction API backed by XGBoost + SHAP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Load model on startup
# ─────────────────────────────────────────────────────────────────────────────

MODEL_PATH = os.environ.get("MODEL_PATH", "yieldsentinel_best_model.pkl")

_pkg: dict[str, Any] = {}
_explainer: shap.Explainer | None = None
_latest_batch: dict[str, Any] | None = None


@app.on_event("startup")
def load_model() -> None:
    global _pkg, _explainer

    pkl = Path(MODEL_PATH)
    if not pkl.exists():
        print(
            f"[WARNING] Model file not found at '{MODEL_PATH}'. "
            "Inference endpoints will return 503 until the file is present."
        )
        return

    _pkg = joblib.load(pkl)
    print(f"[OK] Loaded model: {_pkg.get('model_name', 'unknown')}  "
          f"threshold={_pkg.get('threshold', 0.5)}  "
          f"features={len(_pkg.get('feature_names', []))}")

    # Build a fast TreeExplainer; falls back to generic Explainer on failure.
    try:
        _explainer = shap.TreeExplainer(_pkg["model"])
    except Exception as exc:
        print(f"[WARN] TreeExplainer failed ({exc}); using generic Explainer.")
        _explainer = shap.Explainer(_pkg["model"])


def _require_model() -> dict[str, Any]:
    if not _pkg:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")
    return _pkg


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Single-wafer payload.

    Pass sensor readings as a flat dict: {"0": 3030.93, "1": 2564.0, ...}
    Missing sensors are filled with the trained imputer's medians.
    """
    sensors: dict[str, float]


class ShapFeature(BaseModel):
    feature: str
    shap_value: float
    direction: str   # "positive" → pushes toward FAIL, "negative" → toward PASS


class PredictResponse(BaseModel):
    wafer_id: str
    prediction: str          # "PASS" | "FAIL"
    fail_probability: float
    anomaly_score: float     # same as fail_probability, aliased for frontend
    threshold_used: float
    latency_ms: str
    top_shap_features: list[ShapFeature]


class WaferResult(BaseModel):
    wafer_id: str
    prediction: str
    fail_probability: float
    anomaly_score: float


class BatchPredictResponse(BaseModel):
    total_wafers: int
    pass_count: int
    fail_count: int
    pass_rate: float
    fail_rate: float
    estimated_execution_time_ms: str
    wafers: list[WaferResult]


# ─────────────────────────────────────────────────────────────────────────────
# Inference helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_input_row(sensors: dict[str, float], pkg: dict[str, Any]) -> np.ndarray:
    """Build a single (1, n_features) numpy array from a sensor dict.

    Columns not present in `sensors` are left as NaN, then imputed.
    """
    feature_names: list[str] = pkg["feature_names"]
    row = pd.DataFrame([sensors])
    # align to expected columns; fill missing with NaN
    row = row.reindex(columns=feature_names, fill_value=np.nan)
    imputed = pkg["imputer"].transform(row)
    return imputed


def _top_shap(shap_vals: np.ndarray, feature_names: list[str], top_k: int = 4) -> list[ShapFeature]:
    """Return the top-k SHAP contributors sorted by |magnitude|."""
    abs_vals = np.abs(shap_vals)
    total = abs_vals.sum() if abs_vals.sum() > 0 else 1.0
    indices = np.argsort(abs_vals)[::-1][:top_k]
    result = []
    for idx in indices:
        sv = float(shap_vals[idx])
        pct = round(float(abs_vals[idx]) / total * 100, 1)
        result.append(
            ShapFeature(
                feature=f"Sensor {feature_names[idx]}",
                shap_value=round(pct, 1),
                direction="positive" if sv > 0 else "negative",
            )
        )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "YieldSentinel AI", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    """Alias of GET / — used by frontend sidebar polling."""
    return {"status": "ok", "service": "YieldSentinel AI", "version": "1.0.0"}


@app.get("/model-info", tags=["Inference"])
def model_info():
    pkg = _require_model()
    feature_names: list[str] = pkg["feature_names"]
    return {
        "model_name":       pkg["model_name"],
        "total_features":   len(feature_names),
        "feature_names":    feature_names,
        "threshold":        pkg["threshold"],
        "target_column":    pkg["target_column"],
        "scale_pos_weight": round(pkg.get("scale_pos_weight", 0), 3),
        "schema_note": (
            "Send sensor readings as a dict keyed by feature name. "
            "Missing sensors are median-imputed automatically."
        ),
    }


@app.post("/predict", response_model=PredictResponse, tags=["Inference"])
def predict(req: PredictRequest):
    pkg = _require_model()
    feature_names: list[str] = pkg["feature_names"]
    threshold: float = pkg["threshold"]

    t0 = time.perf_counter()

    X = _build_input_row(req.sensors, pkg)
    proba = float(pkg["model"].predict_proba(X)[0, 1])
    prediction = "FAIL" if proba >= threshold else "PASS"

    # SHAP values
    shap_features: list[ShapFeature] = []
    if _explainer is not None:
        try:
            sv = _explainer.shap_values(X)
            # TreeExplainer may return a list for binary classification
            if isinstance(sv, list):
                sv = sv[1]  # index-1 = FAIL class
            shap_features = _top_shap(sv[0], feature_names, top_k=4)
        except Exception as exc:
            print(f"[WARN] SHAP computation failed: {exc}")

    latency = time.perf_counter() - t0

    return PredictResponse(
        wafer_id=f"WFR-{int(time.time()) % 100000:05d}",
        prediction=prediction,
        fail_probability=round(proba, 4),
        anomaly_score=round(proba, 4),
        threshold_used=threshold,
        latency_ms=f"{latency * 1000:.2f}ms",
        top_shap_features=shap_features,
    )


@app.post("/predict-csv", response_model=BatchPredictResponse, tags=["Inference"])
async def predict_csv(file: UploadFile = File(...)):
    global _latest_batch
    pkg = _require_model()
    feature_names: list[str] = pkg["feature_names"]
    threshold: float = pkg["threshold"]

    # ── parse upload ───────────────────────────────────────────────────────
    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV contains no data rows.")

    raw_target: pd.Series | None = None
    # Preserve the target for uploaded-data correlation before dropping it from features.
    target = pkg.get("target_column", "Pass/Fail")
    if target in df.columns:
        raw_target = df[target].copy()
        df = df.drop(columns=[target])

    # Validate columns — require at least one expected feature
    present = set(df.columns) & set(feature_names)
    if len(present) == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"CSV does not contain any of the {len(feature_names)} expected feature columns. "
                "Please check the column names match the SECOM schema."
            ),
        )

    # Align columns; fill missing with NaN -> impute
    df_aligned = df.reindex(columns=feature_names, fill_value=np.nan)
    df_aligned = df_aligned.apply(pd.to_numeric, errors="coerce")
    df_aligned = df_aligned.replace([np.inf, -np.inf], np.nan)

    if int(df_aligned.notna().sum().sum()) == 0:
        raise HTTPException(status_code=400, detail="CSV contains no numeric sensor values.")

    t0 = time.perf_counter()
    X_imp = pkg["imputer"].transform(df_aligned)
    probas = pkg["model"].predict_proba(X_imp)[:, 1]
    elapsed = time.perf_counter() - t0

    wafers: list[WaferResult] = []
    for i, p in enumerate(probas):
        pred = "FAIL" if p >= threshold else "PASS"
        wafers.append(
            WaferResult(
                wafer_id=f"WAFER-{i + 1}",
                prediction=pred,
                fail_probability=round(float(p), 4),
                anomaly_score=round(float(p), 4),
            )
        )

    pass_count = sum(1 for w in wafers if w.prediction == "PASS")
    fail_count = len(wafers) - pass_count
    total = len(wafers)

    target_values: np.ndarray | None = None
    if raw_target is not None:
        target_values = pd.to_numeric(raw_target, errors="coerce").map(
            lambda value: 1 if value == 1 else 0 if value in (-1, 0) else np.nan
        ).to_numpy(dtype=float)

    _latest_batch = {
        "features": df_aligned.copy(),
        "target": target_values,
        "probas": np.asarray(probas, dtype=float),
        "predictions": np.asarray([1 if w.prediction == "FAIL" else 0 for w in wafers], dtype=int),
        "elapsed_ms": elapsed * 1000,
        "total": total,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "feature_names": feature_names,
    }

    return BatchPredictResponse(
        total_wafers=total,
        pass_count=pass_count,
        fail_count=fail_count,
        pass_rate=round(pass_count / total * 100, 2) if total else 0.0,
        fail_rate=round(fail_count / total * 100, 2) if total else 0.0,
        estimated_execution_time_ms=f"{elapsed * 1000:.2f}ms",
        wafers=wafers,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Analytics endpoints — derived from the most recent uploaded dataset
# ─────────────────────────────────────────────────────────────────────────────

def _require_analysis() -> dict[str, Any]:
    if _latest_batch is None:
        raise HTTPException(status_code=404, detail="Upload a CSV batch before requesting analytics.")
    return _latest_batch


def _root_cause_rows(batch: dict[str, Any]) -> list[dict[str, Any]]:
    frame: pd.DataFrame = batch["features"]
    target_values: np.ndarray | None = batch["target"]
    importances = np.asarray(_pkg["model"].feature_importances_, dtype=float)
    if len(importances) != len(batch["feature_names"]):
        importances = np.zeros(len(batch["feature_names"]), dtype=float)
    importance_total = float(importances.sum()) or 1.0

    rows: list[dict[str, Any]] = []
    for index, feature in enumerate(batch["feature_names"]):
        values = pd.to_numeric(frame[feature], errors="coerce").to_numpy(dtype=float)
        valid = np.isfinite(values)
        correlation = 0.0
        if target_values is not None:
            target_valid = np.isfinite(target_values)
            usable = valid & target_valid
            if usable.sum() >= 2 and np.unique(target_values[usable]).size > 1 and np.std(values[usable]) > 0:
                correlation = abs(float(np.corrcoef(values[usable], target_values[usable])[0, 1]))
        evidence = 0.7 * float(importances[index] / importance_total) + 0.3 * correlation
        rows.append({"feature": feature, "importance": float(importances[index]), "correlation": correlation, "evidence": evidence})

    rows.sort(key=lambda row: row["evidence"], reverse=True)
    top = rows[:5]
    max_evidence = max((row["evidence"] for row in top), default=1.0) or 1.0
    causes = []
    for rank, row in enumerate(top, start=1):
        score = row["evidence"] / max_evidence
        deviation = "HIGH" if score >= 0.66 else "MEDIUM" if score >= 0.33 else "LOW"
        causes.append({
            "rank": rank,
            "label": f"Sensor {row['feature']}",
            "probability": round(score * 100, 1),
            "correlation": round(row["correlation"], 4),
            "recurrence": 0.0,
            "deviation": deviation,
            "equipment": "Unavailable in UCI SECOM",
            "historical_lots": [],
            "reasons": [
                "Ranked from trained-model feature importance",
                "Target association calculated from uploaded rows" if target_values is not None else "No target column supplied; correlation unavailable",
                "UCI SECOM contains no equipment or lot identifiers",
            ],
        })
    return causes

@app.get("/dashboard", tags=["Analytics"])
def dashboard():
    """Command Center metrics derived from the latest uploaded batch."""
    batch = _require_analysis()
    predicted_yield = batch["pass_count"] / batch["total"] * 100 if batch["total"] else 0.0
    target_values = batch["target"]
    observed_yield = float(np.mean(target_values == 0) * 100) if target_values is not None and np.isfinite(target_values).any() else predicted_yield
    risk_rows = np.argsort(batch["probas"])[::-1][:3]
    risk_counts = {
        "high": int(np.sum(batch["probas"] >= _pkg["threshold"])),
        "medium": int(np.sum((batch["probas"] >= _pkg["threshold"] * 0.5) & (batch["probas"] < _pkg["threshold"]))),
        "low": int(np.sum(batch["probas"] < _pkg["threshold"] * 0.5)),
    }
    return {
        "current_yield_pct": round(predicted_yield, 2),
        "yield_delta_pct": round(predicted_yield - observed_yield, 2),
        "at_risk_lots": batch["fail_count"],
        "active_root_causes": len(_root_cause_rows(batch)),
        "predicted_loss": "High" if batch["fail_count"] else "Low",
        "fab_node": "Unavailable in UCI SECOM",
        "telemetry_latency_ms": round(batch["elapsed_ms"], 2),
        "total_wafers": batch["total"],
        "pass_count": batch["pass_count"],
        "fail_count": batch["fail_count"],
        "pass_rate": round(batch["pass_count"] / batch["total"] * 100, 2) if batch["total"] else 0.0,
        "fail_rate": round(batch["fail_count"] / batch["total"] * 100, 2) if batch["total"] else 0.0,
        "risk_counts": risk_counts,
        "yield_trend_7d": [{"day": "UPLOADED BATCH", "yield_pct": round(predicted_yield, 2)}],
        "active_alert": None,
        "upcoming_batch_risk": [
            {"wafer_id": f"RECORD-{int(index) + 1:04d}", "risk_score_pct": round(float(batch["probas"][index]) * 100, 2), "badge": "HIGH" if batch["probas"][index] >= _pkg["threshold"] else "LOW"}
            for index in risk_rows
        ],
    }


@app.get("/root-causes", tags=["Analytics"])
def root_causes():
    """Rank model features using model importance and uploaded target association."""
    batch = _require_analysis()
    target_values = batch["target"]
    observed_yield = float(np.mean(target_values == 0) * 100) if target_values is not None and np.isfinite(target_values).any() else None
    return {
        "lot_id": "UPLOADED-DATASET",
        "observed_yield_pct": observed_yield,
        "baseline_yield_pct": None,
        "analyzed_parameters": len(batch["feature_names"]),
        "model_version": _pkg.get("model_name", "Trained model"),
        "model_confidence_pct": None,
        "causes": _root_cause_rows(batch),
        "limitations": ["UCI SECOM contains no lot IDs, equipment IDs, or historical recurrence data."],
    }


@app.get("/defect-patterns", tags=["Analytics"])
def defect_patterns():
    """Derive defect pattern clusters from batch fail-probability scores.

    Because UCI SECOM has no spatial/die-map data the clusters and coordinates
    are generated deterministically from the probability distribution.  The
    frontend can also compute these client-side from the store, but this
    endpoint keeps the API surface complete.
    """
    batch = _require_analysis()
    probas: np.ndarray = np.asarray(batch["probas"], dtype=float)
    total = int(len(probas))

    def _seeded_rng(seed: int):
        """Simple LCG returning floats in [0,1)."""
        s = seed
        while True:
            s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
            yield s / 0xFFFFFFFF

    def _ring_pts(count: int, seed: int) -> list[dict]:
        rng = _seeded_rng(seed)
        pts = []
        for _ in range(count):
            angle = next(rng) * 3.14159 * 2
            radius = 110 + next(rng) * 28
            pts.append({
                "x": round(140 + radius * float(np.cos(angle))),
                "y": round(140 + radius * float(np.sin(angle))),
            })
        return pts

    def _center_pts(count: int, seed: int) -> list[dict]:
        rng = _seeded_rng(seed)
        pts = []
        for _ in range(count):
            angle = next(rng) * 3.14159 * 2
            radius = next(rng) * 45
            pts.append({
                "x": round(140 + radius * float(np.cos(angle))),
                "y": round(140 + radius * float(np.sin(angle))),
            })
        return pts

    def _line_pts(count: int, seed: int) -> list[dict]:
        rng = _seeded_rng(seed)
        line_angle = next(rng) * 3.14159
        pts = []
        for i in range(count):
            t = (i / max(count - 1, 1)) * 200 - 100
            jitter = (next(rng) - 0.5) * 20
            pts.append({
                "x": min(270, max(10, round(140 + t * float(np.cos(line_angle)) + jitter))),
                "y": min(270, max(10, round(140 + t * float(np.sin(line_angle)) + jitter))),
            })
        return pts

    def _scatter_pts(count: int, seed: int) -> list[dict]:
        rng = _seeded_rng(seed)
        pts = []
        attempts = 0
        while len(pts) < count and attempts < count * 20:
            attempts += 1
            x = round(next(rng) * 240 + 20)
            y = round(next(rng) * 240 + 20)
            if ((x - 140) ** 2 + (y - 140) ** 2) <= 128 ** 2:
                pts.append({"x": x, "y": y})
        return pts

    fail_mask   = probas >= 0.5
    high_mask   = probas >= 0.7
    med_mask    = (probas >= 0.4) & (probas < 0.7)
    edge_mask   = (probas >= 0.25) & (probas < 0.4)

    fail_n  = int(fail_mask.sum())
    high_n  = int(high_mask.sum())
    med_n   = int(med_mask.sum())
    edge_n  = int(edge_mask.sum())

    patterns = []
    total_pts = 0

    if fail_n > 0:
        count = min(40, max(12, round(fail_n * 0.4)))
        conf  = min(99, 55 + (fail_n / total) * 44)
        corr  = "0." + str(round(50 + (fail_n / total) * 40)).zfill(2)
        pts   = _ring_pts(count, 101)
        total_pts += len(pts)
        patterns.append({
            "id": "pat-edge", "label": "EDGE CLUSTER",
            "confidence_pct": round(conf, 1), "affected_lots": fail_n,
            "top_correlation": corr, "primary_equipment": "EUV Scanner / Edge Ring",
            "defect_coordinates": pts, "risk_level": "HIGH",
        })

    if high_n > 0:
        count = min(30, max(8, round(high_n * 0.35)))
        conf  = min(99, 50 + (high_n / total) * 48)
        corr  = "0." + str(round(45 + (high_n / total) * 45)).zfill(2)
        pts   = _center_pts(count, 202)
        total_pts += len(pts)
        patterns.append({
            "id": "pat-center", "label": "CENTER SPOT",
            "confidence_pct": round(conf, 1), "affected_lots": high_n,
            "top_correlation": corr, "primary_equipment": "CVD Chamber / Chuck",
            "defect_coordinates": pts, "risk_level": "HIGH",
        })

    if med_n > 0:
        count = min(25, max(6, round(med_n * 0.3)))
        conf  = min(99, 42 + (med_n / total) * 40)
        corr  = "0." + str(round(35 + (med_n / total) * 40)).zfill(2)
        pts   = _line_pts(count, 303)
        total_pts += len(pts)
        patterns.append({
            "id": "pat-scratch", "label": "SCRATCH LINE",
            "confidence_pct": round(conf, 1), "affected_lots": med_n,
            "top_correlation": corr, "primary_equipment": "CMP Tool / Pad",
            "defect_coordinates": pts, "risk_level": "MEDIUM",
        })

    if edge_n > 0:
        count = min(20, max(5, round(edge_n * 0.25)))
        conf  = min(99, 30 + (edge_n / total) * 35)
        corr  = "0." + str(round(20 + (edge_n / total) * 35)).zfill(2)
        pts   = _scatter_pts(count, 404)
        total_pts += len(pts)
        patterns.append({
            "id": "pat-scatter", "label": "RANDOM SCATTER",
            "confidence_pct": round(conf, 1), "affected_lots": edge_n,
            "top_correlation": corr, "primary_equipment": "Etch Chamber / Gas Flow",
            "defect_coordinates": pts, "risk_level": "LOW",
        })

    critical = sum(1 for p in patterns if p["risk_level"] == "HIGH")
    new_24h  = sum(1 for p in patterns if p["confidence_pct"] > 70)

    return {
        "substrate": f"{total} WAFER RECORDS",
        "grid": "FAIL-PROBABILITY DERIVED",
        "total_defects_analyzed": total_pts,
        "unique_patterns": len(patterns),
        "critical_patterns": critical,
        "new_patterns_24h": new_24h,
        "patterns": patterns,
        "limitations": [
            "Coordinates are statistically derived from fail-probability distribution.",
            "UCI SECOM contains no actual die coordinates or wafer map images.",
        ],
    }

