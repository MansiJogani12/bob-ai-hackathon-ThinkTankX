# Setup Guide

This guide describes the actual local setup for YieldSentinel AI.

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm

## Environment Variables

The AI assistant is optional. To enable it, configure `src/frontend/.env.local`:

| Variable | Description | Required |
|---|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key for the chatbot | No |
| `OPENROUTER_MODEL` | OpenRouter model identifier | No |

## Installation

### Windows one-command setup

From the repository root, run the setup script once:

```powershell
.\setup.ps1
```

The script creates `src/backend/.venv`, installs Python dependencies, and runs `npm install` in the frontend.

### Manual installation

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\frontend
npm install
```

## Running the Application

Start both services from the repository root:

```powershell
.\start.ps1
```

The application is available at `http://localhost:3000`. The API runs at `http://localhost:8000`.

The trained model is included in `src/backend/yieldsentinel_best_model.pkl`; retraining is optional:

```powershell
cd src/backend
.\.venv\Scripts\python.exe train_model.py --data uci-secom.csv
```

## Running Tests

No automated test suite is currently included. Check the API with `http://localhost:8000/` after startup.

## Troubleshooting

| Issue | Solution |
|---|---|
| `ModuleNotFoundError` | Run `.\setup.ps1` again, then restart with `.\start.ps1`. |
| `WinError 32` during pip install | Close any running backend or Python process and run `.\setup.ps1` again. |
| Chatbot unavailable | Check `OPENROUTER_API_KEY` in `src/frontend/.env.local`; the dashboard itself does not require it. |
