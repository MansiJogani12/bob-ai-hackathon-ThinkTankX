# Source Code Overview

This folder contains the actual implementation for the wafer-yield intelligence project: the Python model and API backend, the Next.js frontend dashboard, and the notebook used to develop the model artifact.

## Project Structure

```text
src/
├── README.md
├── YieldSentinel_Improved_Model.ipynb
├── backend/
│   ├── README.md
│   ├── main.py
│   ├── requirements.txt
│   ├── train_model.py
│   ├── uci-secom.csv
│   ├── yieldsentinel_best_model.pkl
│   ├── supabase_client.py
│   └── supabase_migrations.sql
├── frontend/
│   ├── README.md
│   ├── app/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   ├── next.config.mjs
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   └── tsconfig.json
└── .gitignore
```

## Backend

The backend in `src/backend` is implemented with FastAPI. It loads the serialized model artifact, validates incoming inputs, performs preprocessing and inference, computes SHAP explanations, and exposes analytics endpoints for batch-level evaluation.

## Frontend

The frontend in `src/frontend` is implemented with Next.js and React. It presents the dashboard views for batch upload, command-center monitoring, wafer-level analysis, defect review, root-cause investigation, and corrective-action tracking.

## Model and Training Notebook

The project includes `src/YieldSentinel_Improved_Model.ipynb`, which contains the model-development workflow used to train and evaluate the classifier. The saved artifact is used at runtime by the backend without requiring a retraining step for standard local execution.

## Development Notes

The application is designed to run locally with the root setup and startup scripts:

```powershell
.\setup.ps1
.\start.ps1
```

For full setup and troubleshooting instructions, see the root [README.md](../README.md) and the detailed guide in [docs/setup-guide.md](../docs/setup-guide.md).
