# YieldSentinel AI — Backend

FastAPI inference backend for the Yield Intelligence dashboard.

---

## Quick Start

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the API server

```bash
uvicorn main:app --reload --port 8000
```

The server starts immediately. Analytics endpoints (`/dashboard`, `/root-causes`,
`/defect-patterns`, `/health`) work **without a trained model**.

Inference endpoints (`/predict`, `/predict-csv`) require the model pkl — see step 3.

---

## 3. Train the model (required for inference only)

You need the [UCI SECOM dataset](https://archive.ics.uci.edu/ml/datasets/SECOM).
Download `uci-secom.csv` and place it in this directory, then run:

```bash
python train_model.py --data uci-secom.csv
```

This produces `yieldsentinel_best_model.pkl`. Restart the server after training.

---

## Endpoints

| Method | Path               | Model needed | Description                        |
|--------|--------------------|--------------|------------------------------------|
| GET    | `/health`          | No           | Health check — used by sidebar     |
| GET    | `/model-info`      | Yes          | Feature list + threshold           |
| POST   | `/predict`         | Yes          | Single wafer inference + SHAP      |
| POST   | `/predict-csv`     | Yes          | Batch CSV inference                |
| GET    | `/dashboard`       | No           | Command Center KPIs                |
| GET    | `/root-causes`     | No           | Root Cause Analysis ranked list    |
| GET    | `/defect-patterns` | No           | Defect spatial patterns            |

### Why was `/root-causes` returning 404?

A **404** means the running server process is an **old version** of `main.py` that
predates the analytics routes. Stop the old process and restart with the current file:

```bash
# Kill any existing uvicorn process first, then:
uvicorn main:app --reload --port 8000
```

You can verify all routes are registered by visiting:
<http://127.0.0.1:8000/docs>

---

## CORS

All origins are allowed by default (`allow_origins=["*"]`). Restrict this in
production by setting `allow_origins=["http://localhost:3000"]`.
