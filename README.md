# S1 Wafer Yield Root Cause & Defect Pattern Analyser

## Team
ThinkTankX

## Problem Statement
At 3nm/5nm chip nodes, a 1% yield drop can cost tens of millions of dollars per month. In advanced semiconductor manufacturing, the signals that explain poor wafer outcomes are spread across thousands of equipment sensors, process parameters, and defect images. The challenge is not simply detecting a failing wafer after the fact; it is identifying the likely root cause early enough to prevent scrap, rework, and lost production.

Process engineers and quality teams spend significant time manually scanning large volumes of wafer data and defect patterns to determine whether a failure is driven by equipment drift, process variation, or a recurring spatial defect pattern. In a fast-moving fab, every day of delay adds cost and throughput pressure. The business problem is therefore both predictive and diagnostic: teams need to flag at-risk batches before they run and then explain why a wafer failed when the issue appears.

## Solution
YieldSentinel AI is a working prototype designed to address that exact gap. It combines a trained XGBoost classifier, median-imputation preprocessing, and SHAP-based feature explanations with a modern dashboard for batch review and wafer investigation. The backend accepts wafer sensor data and batch CSV uploads, returns pass/fail probabilities, and highlights the strongest contributing features for each high-risk wafer. The frontend surfaces these results through operational views for wafer-level analysis, batch risk screening, root cause review, and defect pattern exploration.

This repository is not a generic template or mockup; it contains the implemented FastAPI backend, Next.js dashboard, and the model training pipeline used to generate the packaged model artifact.

## Key Features
- Single-wafer failure prediction using a trained XGBoost model.
- Batch CSV screening for pass/fail summaries across multiple wafers.
- SHAP-based top contributing features to explain why a wafer is predicted as risky.
- Dashboard views for command-center metrics, risk summaries, process trends, and wafer-level analysis.
- Root-cause and defect-pattern analytics endpoints with structured output for operational review.
- Optional conversational assistant in the frontend that uses OpenRouter if an API key is configured.

## How the system works
1. The Python backend loads a serialized model package from src/backend/yieldsentinel_best_model.pkl on startup.
2. Training logic in src/backend/train_model.py cleans the SECOM-style manufacturing data, imputes missing values with medians, trains an XGBoost classifier, tunes the failure threshold using the best fail-F1 score, and saves the model package.
3. The FastAPI service exposes inference endpoints for one wafer at a time and for batch uploads. For each request, it aligns inputs to the trained feature set, computes pass/fail probabilities, and returns the top contributing features using SHAP.
4. The Next.js frontend calls these endpoints to populate the dashboard, batch-risk pages, root-cause views, and wafer detail screens.
5. If configured, the optional chat route in src/frontend/app/api/chat/route.ts forwards questions to OpenRouter for conversational analysis based on current backend data.

## Tech Stack
| Category | Technologies used in this project |
|---|---|
| Languages | Python, TypeScript |
| Backend | FastAPI, pandas, NumPy, scikit-learn, XGBoost, SHAP, joblib |
| Frontend | Next.js, React, Tailwind CSS, Framer Motion |
| Model training | XGBoost classifier with median imputation and threshold tuning |
| Optional AI assistant | OpenRouter API integration in the frontend |

## Project Structure
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
│       ├── app/
│       │   ├── api/chat/route.ts
│       │   ├── components/
│       │   ├── dashboard/
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── public/
│       ├── src/
│       ├── package.json
│       ├── next.config.mjs
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       └── tsconfig.json
└── src/backend/.venv/  (created locally during setup)
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

### Retraining the model
The repository includes a trained model artifact already packaged in src/backend/yieldsentinel_best_model.pkl. If you want to retrain it from the SECOM dataset:

```powershell
cd src/backend
python train_model.py --data uci-secom.csv
```

## Demo
This repository includes the demo artifacts used for presentation and validation:
- Demo video note: [demo/demo-video-link.txt](demo/demo-video-link.txt)
- Live demo URL note: [demo/live-demo-url.txt](demo/live-demo-url.txt)
- Screenshots directory: [demo/screenshots/](demo/screenshots/)
- Presentation notes: [presentation/README.md](presentation/README.md)

## Known Limitations
- The project currently relies on a local model artifact and a sample SECOM-style dataset rather than a production manufacturing data pipeline.
- There is no persistent database, user authentication, or enterprise deployment stack included in this prototype.
- The dashboard and analytics are designed for demo and proof-of-concept validation rather than full-scale production rollout.
- The frontend chat assistant is optional and only functions when OpenRouter configuration is present.

## What We're Most Proud Of
We are most proud of the combination of prediction and explanation. The system does not stop at a pass/fail label; it traces the strongest contributing signal using SHAP, identifies likely root-cause drivers, and presents the results in an operational dashboard that makes wafer risk understandable to engineers. This turns a complex, high-volume manufacturing problem into a clearer decision-making workflow for process and quality teams.

---

This project is developed for the IBM Bob AI Hackathon and was implemented as a practical wafer-yield intelligence prototype rooted in the actual code present in this repository.
