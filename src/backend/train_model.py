"""
train_model.py â€” YieldSentinel AI
-----------------------------------
Reproduces the exact data-cleaning, imputation, and XGBoost training
pipeline from YieldSentinel_Improved_Model.ipynb, then serialises the
result to yieldsentinel_best_model.pkl.

Usage:
    python train_model.py --data uci-secom.csv

The pkl file contains:
    {
        "model":         XGBClassifier,
        "imputer":       SimpleImputer(strategy="median"),
        "feature_names": list[str],   # 562 column names after cleaning
        "target_column": "Pass/Fail",
        "threshold":     float,       # best Fail-F1 threshold (â‰ˆ0.23)
        "model_name":    "XGBoost",
        "scale_pos_weight": float,
    }
"""

import argparse
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

RANDOM_STATE = 42
TARGET_COLUMN = "Pass/Fail"
MODEL_OUT = "yieldsentinel_best_model.pkl"


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# helpers
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def convert_target(value):
    """Map SECOM labels to binary 0/1.

    Pass / -1  â†’ 0
    Fail /  1  â†’ 1
    """
    text = str(value).strip().lower()
    if text in ("pass", "0", "-1", "good", "normal"):
        return 0
    if text in ("fail", "1", "bad", "defect", "defective"):
        return 1
    try:
        num = float(value)
        if num == -1:
            return 0
        if num == 1:
            return 1
        if num == 0:
            return 0
    except Exception:
        pass
    return np.nan


def best_threshold(proba, y_true, lo=0.05, hi=0.50, step=0.01):
    """Sweep thresholds and return the one with the highest Fail F1-score."""
    best_t, best_f1 = 0.5, -1.0
    t = lo
    while t <= hi + 1e-9:
        preds = (proba >= t).astype(int)
        score = f1_score(y_true, preds, zero_division=0)
        if score > best_f1:
            best_f1, best_t = score, round(t, 4)
        t = round(t + step, 4)
    return best_t


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# main pipeline
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def run(data_path: str, out_path: str = MODEL_OUT) -> None:
    print(f"[1/7] Loading dataset: {data_path}")
    df = pd.read_csv(data_path)
    print(f"      Raw shape: {df.shape}")

    # â”€â”€ detect target column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    target = TARGET_COLUMN
    if target not in df.columns:
        candidates = [
            c for c in df.columns
            if str(c).strip().lower() in ("pass/fail", "pass_fail", "target", "label", "class", "y")
        ]
        if candidates:
            target = candidates[0]
            print(f"      Auto-detected target column: {target}")
        else:
            raise ValueError("Target column not found. Set TARGET_COLUMN manually.")

    print(f"[2/7] Converting target labels â€¦")
    df[target] = df[target].apply(convert_target)
    df = df.dropna(subset=[target]).copy()
    df[target] = df[target].astype(int)
    print(f"      Class distribution: {df[target].value_counts().to_dict()}")

    # â”€â”€ feature matrix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[3/7] Preparing features â€¦")
    X = df.drop(columns=[target]).copy()
    y = df[target].copy()

    # convert all to numeric, coerce errors to NaN
    X = X.apply(pd.to_numeric, errors="coerce")
    # replace Â±inf with NaN
    X = X.replace([np.inf, -np.inf], np.nan)

    # drop columns with â‰¥50 % missing values (notebook: < 0.50 kept)
    missing_ratio = X.isna().mean()
    cols_to_keep = missing_ratio[missing_ratio < 0.50].index
    dropped_missing = len(missing_ratio) - len(cols_to_keep)
    X = X[cols_to_keep]

    # drop constant columns
    constant_cols = [c for c in X.columns if X[c].nunique(dropna=False) <= 1]
    X = X.drop(columns=constant_cols)

    print(f"      Features after cleaning: {X.shape[1]}  "
          f"(dropped {dropped_missing} high-missing, {len(constant_cols)} constant)")

    # â”€â”€ stratified split â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[4/7] Stratified train/test split (80/20) â€¦")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_STATE, stratify=y
    )
    print(f"      Train: {len(X_train)} | Test: {len(X_test)}")

    # â”€â”€ median imputation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[5/7] Median imputation â€¦")
    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp  = imputer.transform(X_test)
    feature_names = X_train.columns.tolist()

    # â”€â”€ class-imbalance weight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    neg  = int((y_train == 0).sum())
    pos  = int((y_train == 1).sum())
    if pos == 0:
        raise ValueError("No Fail samples found in training data.")
    spw = neg / pos
    print(f"      Pass={neg}  Fail={pos}  scale_pos_weight={spw:.3f}")

    # â”€â”€ XGBoost training â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[6/7] Training XGBoost â€¦")
    model = XGBClassifier(
        n_estimators=500,
        max_depth=3,
        learning_rate=0.02,
        min_child_weight=2,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.2,
        reg_lambda=2.0,
        scale_pos_weight=spw,
        objective="binary:logistic",
        eval_metric="aucpr",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_train_imp, y_train)

    proba = model.predict_proba(X_test_imp)[:, 1]
    thresh = best_threshold(proba, y_test)
    preds = (proba >= thresh).astype(int)

    print(f"      Best threshold (max Fail F1): {thresh}")
    print(f"      Fail Precision : {precision_score(y_test, preds, zero_division=0):.4f}")
    print(f"      Fail Recall    : {recall_score(y_test, preds, zero_division=0):.4f}")
    print(f"      Fail F1-score  : {f1_score(y_test, preds, zero_division=0):.4f}")

    # â”€â”€ save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print(f"[7/7] Saving model package â†’ {out_path}")
    pkg = {
        "model":            model,
        "imputer":          imputer,
        "feature_names":    feature_names,
        "target_column":    target,
        "threshold":        thresh,
        "model_name":       "XGBoost",
        "scale_pos_weight": spw,
    }
    joblib.dump(pkg, out_path)
    print("      Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YieldSentinel model")
    parser.add_argument("--data", required=True, help="Path to SECOM CSV")
    parser.add_argument("--out",  default=MODEL_OUT, help="Output .pkl path")
    args = parser.parse_args()
    run(args.data, args.out)
