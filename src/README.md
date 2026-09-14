# Source Code

This folder contains the YieldSentinel AI application: a FastAPI service for
wafer-risk analysis, a Next.js dashboard, and the model-development notebook.

## Project Structure

```text
src/
├── README.md
├── .env.example                 # Environment variable template
├── YieldSentinel_Improved_Model.ipynb
│                                  # Model experiments and evaluation
├── backend/
│   ├── main.py                  # FastAPI API and model inference
│   ├── train_model.py           # Optional model training pipeline
│   ├── requirements.txt         # Python dependencies
│   ├── uci-secom.csv            # Training/demo dataset
│   ├── yieldsentinel_best_model.pkl
│   │                              # Trained model artifact
│   └── README.md
└── frontend/
    ├── app/                     # Next.js routes and page components
    │   ├── api/chat/             # Optional OpenRouter chat endpoint
    │   ├── dashboard/            # Dashboard and analytics pages
    │   ├── components/           # Reusable UI components
    │   ├── context.tsx
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── public/frames/            # Static dashboard assets
    ├── src/                      # Shared frontend services and state
    ├── package.json              # Node.js dependencies and scripts
    ├── package-lock.json
    ├── next.config.mjs
    ├── postcss.config.mjs
    ├── tailwind.config.ts
    └── tsconfig.json
```

## Backend

The FastAPI service runs on port `8000` and provides health, prediction,
batch prediction, dashboard analytics, root-cause, and defect-pattern
endpoints. The included model artifact is used by default, so retraining is
not required for normal development.

## Frontend

The Next.js dashboard runs on port `3000`. It includes wafer and batch
workflows, defect and process views, corrective-action and root-cause screens,
and an optional OpenRouter-powered assistant.

## Model Notebook

`YieldSentinel_Improved_Model.ipynb` contains the experimental training flow:
data preparation, missing-value handling, class-imbalance management,
XGBoost/LightGBM comparison, threshold tuning, evaluation, feature importance,
and optional model export.

## Development

From the repository root, run the one-time setup and then start both services:

```powershell
.\setup.ps1
.\start.ps1
```

For prerequisites, environment variables, and manual commands, see the root
[README](../README.md) and [setup guide](../docs/setup-guide.md).

Do not commit real secrets from `.env` or `.env.local`, virtual environments,
`node_modules`, `.next`, Python caches, or other build artifacts.
