# Setup Guide

> **This file is read by the automated evaluation pipeline. Be precise and complete.**

## Prerequisites

Before you begin, ensure you have the following installed:

- [ ] Python 3.11+
- [ ] Node.js 18+
- [ ] npm
- [ ] Windows PowerShell 5.1 or PowerShell 7+

Docker, PostgreSQL, an IBM Cloud account, and watsonx.ai access are not required for the core local workflow.

## Environment Variables

The core prediction workflow runs without environment variables. Optional integrations can be configured with environment files:

```powershell
Copy-Item src\.env.example src\backend\.env
```

For the frontend, create `src/frontend/.env.local` when using Supabase, OpenRouter, or a non-default backend URL.

| Variable | Description | Required |
|---|---|---|
| `MODEL_PATH` | Backend path to the serialized model package; defaults to `yieldsentinel_best_model.pkl` | No |
| `NEXT_PUBLIC_YIELDSENTINEL_BACKEND_URL` | Backend URL used by the frontend; defaults to `http://127.0.0.1:8000` | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for frontend authentication and saved analyses | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser-safe anonymous key | No |
| `SUPABASE_URL` | Supabase project URL used by the backend persistence client | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key used only by the backend; never expose it to the browser | No |
| `OPENROUTER_API_KEY` | API key for the optional chat and corrective-action assistant | No |
| `OPENROUTER_MODEL` | Optional OpenRouter model identifier | No |

## Installation

```powershell
# 1. Clone the repository
git clone https://github.com/MansiJogani12/bob-ai-hackathon-ThinkTankX.git
cd bob-ai-hackathon-ThinkTankX

# 2. Install backend dependencies and create the virtual environment
.\setup.ps1
```

The setup script creates `src/backend/.venv`, installs `src/backend/requirements.txt`, and runs `npm install` in `src/frontend`.

For manual installation:

```powershell
# 2. Install backend dependencies
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 3. Install frontend dependencies
cd ..\frontend
npm install
```

No database migration is required for the core workflow. Supabase persistence is optional; if enabled, apply `src/backend/supabase_migrations.sql` in the Supabase SQL editor.

## Running the Application

```powershell
# Start both services from the repository root
.\start.ps1
```

The script starts the backend and frontend in separate PowerShell windows. To start services manually:

```powershell
# Start the backend
cd src/backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```powershell
# Start the frontend in a separate terminal
cd src/frontend
npm run dev
```

The application will be available at: `http://localhost:3000`

The backend API and health endpoints are available at `http://localhost:8000` and `http://localhost:8000/health`.

## Running Tests

There is no dedicated automated test suite in this repository. Use the following checks to validate the main project surfaces:

```powershell
# Validate the submission metadata
python -c "import yaml; from pathlib import Path; d=yaml.safe_load(Path('submission.yaml').read_text(encoding='utf-8')); assert d['team']['track'] in {'AI','DevOps','Sustainability','Open'}; assert d['submission']['key_features']; print('submission.yaml is valid')"

# Build the frontend
cd src/frontend
npm run build
```

## Quick Demo (Optional)

After installation, start the application and open the dashboard:

```powershell
# From the repository root
.\start.ps1
Start-Process http://localhost:3000
```

For a quick model demonstration, use the dashboard's wafer analysis page or upload a CSV batch from the batch analysis page. The included model artifact is `src/backend/yieldsentinel_best_model.pkl`, and the sample dataset is `src/backend/uci-secom.csv`.

To retrain the model from the included dataset:

```powershell
cd src/backend
.\.venv\Scripts\python.exe train_model.py --data uci-secom.csv
```

## Troubleshooting

| Issue | Solution |
|---|---|
| `ModuleNotFoundError` | Run `.\setup.ps1` again, or install `src/backend/requirements.txt` using `src/backend/.venv\Scripts\python.exe`. |
| `npm` or `node` is not recognized | Install Node.js 18+ and reopen PowerShell so the updated PATH is available. |
| Backend does not start or returns model errors | Run setup first and confirm `src/backend/yieldsentinel_best_model.pkl` exists. If using a custom model, check `MODEL_PATH`. |
| Frontend cannot connect to the backend | Confirm the backend is running on port 8000 and check `NEXT_PUBLIC_YIELDSENTINEL_BACKEND_URL` in `src/frontend/.env.local`. |
| Supabase authentication or saved analyses are unavailable | Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `src/frontend/.env.local`. Supabase is optional for core predictions. |
| Chat assistant is unavailable | Configure `OPENROUTER_API_KEY` and, optionally, `OPENROUTER_MODEL` in `src/frontend/.env.local`. |
| No results after CSV upload | Confirm the CSV contains the expected sensor feature columns and that the backend model loaded successfully. |
| Port 3000 or 8000 is already in use | Stop the existing process or start the frontend/backend on an available port and update the frontend backend URL if needed. |
