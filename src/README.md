# Source Code

Place all of the YieldSentinel AI source code and runtime assets in this folder.

## Structure Guidelines

YieldSentinel AI is both a web application and a data/AI project. The repository uses the following structure:

### Web Application

```text
src/
  backend/        <- FastAPI API server and model-serving code
  frontend/       <- Next.js and React dashboard UI
  shared/         <- No separate shared package; frontend services live in frontend/src/
```

### Data / AI Project

```text
src/
  backend/                              <- Inference API and training script
  YieldSentinel_Improved_Model.ipynb    <- Model exploration and development notebook
  backend/uci-secom.csv                 <- Sample SECOM-style training dataset
  backend/yieldsentinel_best_model.pkl  <- Serialized model package for inference
```

The project does not use a separate CLI layout. The backend API and frontend dashboard are the application entry points.

### CLI / Script-based Tool

```text
src/
  scripts/        <- No separate CLI package; setup.ps1 and start.ps1 remain at repository root
  lib/            <- No standalone CLI library; backend and frontend modules own the application logic
```

The repository does include `backend/train_model.py` for optional model retraining, but it is a training script rather than a user-facing CLI.

## Important Files to Include

- `backend/requirements.txt` - Python dependency manifest for FastAPI, XGBoost, SHAP, pandas, and related libraries
- `frontend/package.json` - Node.js dependency and script manifest for the Next.js dashboard
- `.env.example` - Optional environment-variable template; never commit real `.env` files
- `backend/supabase_migrations.sql` - Optional Supabase table definitions for persisted analyses
- `backend/main.py` - FastAPI health, prediction, batch analysis, and analytics endpoints
- `backend/train_model.py` - Model training and serialized artifact export workflow
- `YieldSentinel_Improved_Model.ipynb` - Notebook used for model development and evaluation
- `backend/yieldsentinel_best_model.pkl` - Included trained model package used by the API

## What Not to Include in src/

- `.env` files containing real secrets
- `node_modules/` or Python virtual environments such as `.venv/`
- Build artifacts such as `.next/`, `dist/`, `build/`, or `__pycache__/`
- Temporary logs, credentials, or local deployment files

The repository `.gitignore` excludes these paths. The included dataset and model artifact are retained because they are required for the local demonstration and inference workflow.

## Current Source Layout

```text
src/
├── .env.example
├── README.md
├── comment_check.txt
├── fix_mojibake.py
├── fix_mojibake_v2.py
├── YieldSentinel_Improved_Model.ipynb
├── backend/
│   ├── README.md
│   ├── main.py
│   ├── train_model.py
│   ├── requirements.txt
│   ├── uci-secom.csv
│   ├── yieldsentinel_best_model.pkl
│   ├── supabase_client.py
│   └── supabase_migrations.sql
└── frontend/
    ├── README.md
    ├── app/
    ├── public/
    ├── src/
    ├── package.json
    ├── package-lock.json
    ├── next.config.mjs
    ├── postcss.config.mjs
    ├── tailwind.config.ts
    └── tsconfig.json
```

For installation and execution, see [`docs/setup-guide.md`](../docs/setup-guide.md).
