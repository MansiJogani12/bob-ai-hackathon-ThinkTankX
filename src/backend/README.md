# Backend Overview

This folder contains the FastAPI backend used by the YieldSentinel AI application. It is responsible for model loading, inference, batch analysis, and analytics endpoints used by the dashboard.

## Key Responsibilities

- load the trained XGBoost model package and metadata at startup
- transform incoming wafer inputs to the expected feature schema
- impute missing values using the stored preprocessing object
- return pass/fail probabilities and top SHAP feature contributors
- handle CSV upload analysis for multiple wafers
- provide dashboard metrics, root-cause summaries, and defect-pattern outputs
- optionally persist prediction data to Supabase when credentials are configured

## Main Files

```text
src/backend/
├── main.py
├── train_model.py
├── requirements.txt
├── uci-secom.csv
├── yieldsentinel_best_model.pkl
├── supabase_client.py
├── supabase_migrations.sql
├── README.md
└── .venv/   (created locally during setup)
```

## API Endpoints

The backend exposes the following endpoints in the current implementation:

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Basic health response |
| GET | `/health` | Health check used by the frontend |
| GET | `/model-info` | Returns the model metadata and feature list |
| POST | `/predict` | Runs single-wafer inference and SHAP ranking |
| POST | `/predict-csv` | Runs batch analysis for uploaded CSV data |
| GET | `/analysis-summary` | Returns a compact summary of the latest batch |
| GET | `/dashboard` | Returns command-center style analytics |
| GET | `/root-causes` | Returns ranked root-cause indicators |
| GET | `/defect-patterns` | Returns defect-pattern summaries |

## Model Workflow

The backend expects a serialized model package with:

- feature names
- model object
- threshold value
- imputer for missing values
- metadata such as model name and target column

This is loaded from `yieldsentinel_best_model.pkl` and used by the inference endpoints.

## Local Run

From the repository root:

```powershell
.\setup.ps1
.\start.ps1
```

Or run the backend manually:

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

## Retraining

If the model needs to be regenerated from the included dataset:

```powershell
cd src/backend
.\.venv\Scripts\python.exe train_model.py --data uci-secom.csv
```

## Notes

- The backend is designed to function as a local-run prototype.
- The optional Supabase persistence layer only writes when credentials are available.
- The analytics endpoints depend on the most recent CSV upload during the active server session.
