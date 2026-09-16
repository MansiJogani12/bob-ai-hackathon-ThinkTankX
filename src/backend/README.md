# Backend Source Code

This folder contains the FastAPI backend for **YieldSentinel AI**, the ThinkTankX wafer-yield analysis project.

## Structure Guidelines

```text
src/backend/
	main.py                    <- FastAPI application and inference endpoints
	train_model.py             <- Optional model training and export script
	requirements.txt           <- Python dependencies
	uci-secom.csv              <- Sample SECOM-style dataset
	yieldsentinel_best_model.pkl <- Trained model package used at runtime
	supabase_client.py         <- Optional Supabase persistence helpers
	supabase_migrations.sql    <- Optional Supabase table definitions
	Procfile                   <- Deployment process command
	vercel.json                <- Deployment configuration
```

## Important Files to Include

- `main.py` - loads the model, validates requests, performs inference, and serves analytics.
- `requirements.txt` - lists FastAPI, pandas, NumPy, scikit-learn, XGBoost, SHAP, joblib, and Supabase dependencies.
- `train_model.py` - retrains the classifier from `uci-secom.csv` when required.
- `yieldsentinel_best_model.pkl` - stores the model, feature schema, imputer, threshold, and metadata.
- `supabase_client.py` and `supabase_migrations.sql` - optional persistence integration.
- `Procfile` and `vercel.json` - deployment configuration for the backend service.

## API Endpoints

| Method | Path | Responsibility |
|---|---|---|
| GET | `/` | Service health response |
| GET | `/health` | Frontend health check |
| GET | `/model-info` | Model metadata and feature schema |
| POST | `/predict` | Single-wafer prediction with SHAP contributors |
| POST | `/predict-csv` | Batch CSV prediction and risk summary |
| GET | `/analysis-summary` | Latest uploaded batch summary |
| GET | `/dashboard` | Yield, risk, and operational dashboard metrics |
| GET | `/root-causes` | Ranked root-cause indicators from the latest batch |
| GET | `/defect-patterns` | Defect-pattern analysis data |

## Model Workflow

1. The API loads `yieldsentinel_best_model.pkl` at startup.
2. Incoming sensor data is aligned to the stored feature names.
3. Missing and invalid numeric values are handled with the stored median imputer.
4. XGBoost calculates PASS and FAIL probabilities using the stored threshold.
5. SHAP ranks the strongest contributors for single-wafer predictions.
6. Batch analytics are retained for the current server session and returned to the dashboard.

## Environment Variables

Optional backend variables are documented in [`src/.env.example`](../.env.example):

| Variable | Purpose | Required |
|---|---|---|
| `MODEL_PATH` | Relative or absolute model package path | No; defaults to `yieldsentinel_best_model.pkl` |
| `SUPABASE_URL` | Supabase project URL | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase persistence key | No |

The backend works without Supabase credentials. Never commit a real `.env` file or service key.

## Local Run

From the repository root:

```powershell
.\setup.ps1
.\start.ps1
```

To run only the backend:

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

The API is available at `http://localhost:8000`, with health status at `http://localhost:8000/health`.

## Retraining

```powershell
cd src/backend
.\.venv\Scripts\python.exe train_model.py --data uci-secom.csv
```

## What Not to Include in the Backend Folder

- `.env` files containing credentials
- `.venv/`, `__pycache__/`, `*.pyc`, and build artifacts
- temporary logs or local deployment output

These paths are excluded by the repository and backend `.gitignore` files.
