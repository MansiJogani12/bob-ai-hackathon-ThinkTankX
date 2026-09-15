# Setup Guide

This document describes the actual local setup path for YieldSentinel AI as implemented in this repository.

## Prerequisites

Before running the project locally, install:

- Python 3.11+
- Node.js 18+
- npm
- Windows PowerShell (recommended for the included setup scripts)

## Environment Variables

The core application does not require any special environment variables to run. The optional AI assistant does. If you want to enable the frontend chat route, create `src/frontend/.env.local` and add:

| Variable | Description | Required |
|---|---|---|
| `OPENROUTER_API_KEY` | API key for the optional OpenRouter-based assistant | No |
| `OPENROUTER_MODEL` | Model identifier used by the chat route | No |

If these values are not present, the dashboard and backend analytics remain usable without the chat feature.

## Installation

### Option 1: One-command Windows setup

From the repository root, run:

```powershell
.\setup.ps1
```

This script:

- creates the backend virtual environment in `src/backend/.venv`
- installs the Python dependencies from `src/backend/requirements.txt`
- runs `npm install` in the frontend

### Option 2: Manual setup

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

```powershell
cd ..\frontend
npm install
```

## Running the Application

### Start both services together

From the repository root:

```powershell
.\start.ps1
```

This launches:

- backend API at http://localhost:8000
- frontend dashboard at http://localhost:3000

### Manual backend start

```powershell
cd src/backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

### Manual frontend start

```powershell
cd src/frontend
npm run dev
```

## Verification

After startup, verify the application in the browser and via the backend health endpoint:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health check: http://localhost:8000/ or http://localhost:8000/health

The application is functional when the dashboard loads and the backend responds successfully. For batch analysis, upload a CSV with the expected wafer-feature columns and review the returned prediction summary.

## Retraining the Model

The repository includes a trained model artifact at `src/backend/yieldsentinel_best_model.pkl`. Retraining is optional and only needed if you want to rebuild the model from the source data.

```powershell
cd src/backend
.\.venv\Scripts\python.exe train_model.py --data uci-secom.csv
```

## Troubleshooting

| Issue | Suggested fix |
|---|---|
| `ModuleNotFoundError` | Run the setup script again or reinstall backend dependencies in `src/backend/.venv` |
| `WinError 32` or file lock issue during install | Close any active Python or backend process and rerun the setup |
| Frontend cannot connect to the backend | Confirm the backend is running on port 8000 and that the frontend is using the default backend URL |
| Chat assistant is unavailable | Ensure `src/frontend/.env.local` contains the correct `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` values |
| No analytics after CSV upload | Make sure the uploaded CSV contains the expected feature columns and that the backend model has loaded successfully |

## Practical Notes

- This project is a local prototype and is intended for demo and validation use.
- The model artifact and sample dataset are included in the repository for local execution.
- The optional AI and persistence features are not required for the primary wafer-risk workflow.
