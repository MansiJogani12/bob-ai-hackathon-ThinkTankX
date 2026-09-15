# S1 Wafer Yield Root Cause & Defect Pattern Analyser

## Team

| Item | Details |
|---|---|
| Team Name | ThinkTankX |
| Team Lead | Yashvi Tanna — [24cs100@charusat.edu.in](mailto:24cs100@charusat.edu.in) |
| Members | Mansi Jogani; Khushi Undhad; Priyanshu Macwan |

## Problem Statement

At 3nm and 5nm nodes, even a small decline in wafer yield can create large financial losses. The challenge is not only detecting a failing wafer after it has already been produced; it is identifying which lots and process trends are likely to fail early enough to reduce scrap, rework, and lost production.

Across semiconductor manufacturing, root causes are spread across thousands of equipment signals, process parameters, and defect observations. Engineers often investigate these signals manually, which slows diagnosis and makes it difficult to prioritise corrective actions. The need is to analyse wafer and lot data, identify recurring defect patterns, rank likely process drivers, and flag upcoming batches that are at risk before the next run.

## Solution

YieldSentinel AI is a working prototype designed to address this challenge. The project combines a trained XGBoost classifier, median-imputation preprocessing, and SHAP-based explanations with a dashboard for batch review and wafer investigation. The backend accepts wafer sensor data and batch CSV uploads, produces pass/fail probabilities, and highlights the strongest contributors behind high-risk predictions.

The repository contains the implemented FastAPI backend, Next.js dashboard, model-training workflow, and packaged model artifact used for local inference and operational review. SHAP is used to support investigation and engineering interpretation, not to claim definitive physical root-cause proof.

## Key Features

- Wafer-level pass/fail prediction using a trained XGBoost model
- Batch CSV screening for pass/fail summaries across multiple wafers
- SHAP-based top contributors to explain why a wafer is predicted as risky
- Dashboard views for batch risk, wafer detail, process trend review, and root-cause analysis
- Defect-pattern and corrective-action views for engineering investigation
- Optional conversational assistant in the frontend when OpenRouter is configured

## Tech Stack

| Category | Technologies used in this project |
|---|---|
| Languages | Python, TypeScript |
| Backend | FastAPI, pandas, NumPy, joblib, XGBoost, SHAP |
| Frontend | Next.js, React, Tailwind CSS, Framer Motion |
| Model training | XGBoost classifier with median imputation and threshold tuning |
| Optional AI support | OpenRouter API integration in the frontend |

## Repository Structure

```text
bob-ai-hackathon-ThinkTankX/
├── README.md
├── CONTRIBUTING.md
├── submission.yaml
├── setup.ps1
├── start.ps1
├── docs/
│   ├── architecture.md
│   ├── problem-statement.md
│   ├── setup-guide.md
│   ├── solution-overview.md
│   └── template-guide.md
├── demo/
│   ├── demo-video-link.txt
│   ├── live-demo-url.txt
│   └── screenshots/
├── presentation/
│   └── README.md
├── src/
│   ├── README.md
│   ├── YieldSentinel_Improved_Model.ipynb
│   ├── backend/
│   │   ├── main.py
│   │   ├── train_model.py
│   │   ├── requirements.txt
│   │   ├── uci-secom.csv
│   │   ├── yieldsentinel_best_model.pkl
│   │   └── README.md
│   └── frontend/
│       ├── README.md
│       ├── app/
│       ├── public/
│       ├── src/
│       ├── package.json
│       ├── next.config.mjs
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       └── tsconfig.json
└── .gitignore
```

## How to Run

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm

### Quick start on Windows

From the repository root, run:

```powershell
.\setup.ps1
.\start.ps1
```

This sets up the backend and frontend dependencies and launches:

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

### Manual start

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

In a second terminal:

```powershell
cd src/frontend
npm install
npm run dev
```

### Model retraining

The repository already includes the trained model artifact at `src/backend/yieldsentinel_best_model.pkl`. If you want to regenerate it from the included SECOM-style dataset, run:

```powershell
cd src/backend
.\.venv\Scripts\python.exe train_model.py --data uci-secom.csv
```

## Demo

This project is designed to run locally from this repository. The demo materials included in the repo are meant for presentation support, and the expected walkthrough is a local run using the setup instructions above.

The repository includes:

- demo video note: [demo/demo-video-link.txt](demo/demo-video-link.txt)
- live demo note: [demo/live-demo-url.txt](demo/live-demo-url.txt)
- screenshots guidance: [demo/screenshots/README.md](demo/screenshots/README.md)
- presentation notes: [presentation/README.md](presentation/README.md)

## Known Limitations

- The project currently relies on a local model artifact and a sample SECOM-style dataset rather than a full production manufacturing pipeline.
- The dashboard and analytics are designed for a prototype and local validation workflow rather than a production-scale deployment.
- SHAP values highlight the strongest model contributors; they are useful for investigation, but they are not definitive physical root-cause proof.
- The optional conversational assistant depends on external configuration and is not required for the core prediction workflow.

## What We're Most Proud Of

We are most proud of combining prediction with explainability. The system does not stop at a pass/fail label; it highlights which signals are driving the decision, surfaces likely risk patterns, and presents those findings in a dashboard designed to support engineering review. That makes the project more actionable for process and quality teams working on yield risk and root-cause investigation.

---

ThinkTankX | S1 Wafer Yield Root Cause & Defect Pattern Analyser | YieldSentinel AI