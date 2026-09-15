# S1 Wafer Yield Root Cause & Defect Pattern Analyser
## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | ThinkTankX |
| **Track** | AI |
| **Team Lead** | Yashvi Tanna — [24cs100@charusat.edu.in](mailto:24cs100@charusat.edu.in) |
| **Members** | Mansi Jogani, Khushi Undhad, Priyanshu Macwan |

## 🎯 Problem Statement

At 3nm and 5nm chip nodes, even a small decline in wafer yield can create major financial losses. Semiconductor process and quality engineers must analyse large volumes of wafer, lot, process, sensor, and defect information to identify likely causes of poor yield and determine which upcoming batches may be at risk.

Root causes are distributed across many signals, making manual investigation slow and difficult to prioritise. Engineers need to analyse wafer and lot data, identify recurring patterns, rank likely process drivers, recommend corrective actions, and flag upcoming batches whose process parameters historically correlate with low yield.

## 💡 Solution

YieldSentinel AI is a working prototype that combines an XGBoost model, median-imputation preprocessing, SHAP-based explanations, a FastAPI backend, and a Next.js dashboard. It predicts wafer pass/fail risk, analyses uploaded batch CSV data, and highlights important model contributors for engineering review.

The dashboard supports batch-risk, wafer, process, root-cause, defect-pattern, and corrective-action investigation views. SHAP results are used to explain model contributions and prioritise investigation; they are not presented as definitive physical root-cause proof.

## ✨ Key Features

- **Wafer-level prediction:** Classifies wafer pass/fail risk using XGBoost.
- **Batch risk analysis:** Screens uploaded CSV data and summarizes risk across multiple wafers.
- **Explainable predictions:** Uses SHAP to show the strongest feature contributions behind a prediction.
- **Operational dashboards:** Provides batch-risk, wafer, process, root-cause, and defect-pattern analysis views.
- **Engineering investigation:** Provides corrective-action views and an optional OpenRouter conversational assistant when configured.

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python, TypeScript |
| **Frameworks** | FastAPI, Next.js, React, Tailwind CSS |
| **IBM Technologies** | None |
| **Databases** | None required for the core workflow |
| **Other** | XGBoost, SHAP, pandas, NumPy, scikit-learn, joblib, Framer Motion, GitHub Actions |

## 📁 Repository Structure

```text
bob-ai-hackathon-ThinkTankX/
├── README.md
├── CONTRIBUTING.md
├── submission.yaml
├── setup.ps1
├── start.ps1
├── docs/
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   ├── setup-guide.md
│   └── template-guide.md
├── demo/
│   ├── demo-video-link.txt
│   ├── live-demo-url.txt
│   └── screenshots/
├── presentation/
│   └── README.md
└── src/
	├── README.md
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

## ⚡ How to Run

Use Python 3.11+, Node.js 18+, npm, and Windows PowerShell.

From the repository root, run the setup script once:

```powershell
.\setup.ps1
```

Start both services:

```powershell
.\start.ps1
```

The application runs at:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

For a manual setup, install the backend and frontend dependencies as follows:

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

```powershell
cd ..\frontend
npm install
```

Then start the services in separate terminals:

```powershell
cd src/backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```powershell
cd src/frontend
npm run dev
```

The repository includes a trained model at `src/backend/yieldsentinel_best_model.pkl`. Retraining is optional:

```powershell
cd src/backend
.\.venv\Scripts\python.exe train_model.py --data uci-secom.csv
```

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/](presentation/) |

The application is designed for a local walkthrough using the setup commands above. The linked files are the repository’s submission artifact locations; no external demo URL is invented here.

## ⚠️ Known Limitations

- The project uses a sample SECOM-style semiconductor dataset and a local trained model artifact rather than a production fab data pipeline.
- The dashboard is a prototype for local validation, not production-scale manufacturing infrastructure.
- SHAP explains model feature contributions for investigation but does not prove a physical root cause.
- The optional conversational assistant depends on OpenRouter configuration and is not required for the core workflow.

## 🏅 What We're Most Proud Of

We are most proud of combining wafer-risk prediction with SHAP-based explainability and an operational dashboard for batch and wafer investigation. The project turns model output into a practical review workflow by showing which signals contribute most to risk and giving engineering teams focused views for process, root-cause, defect-pattern, and corrective-action analysis.
