# 🚀 Wafer Yield Root Cause & Defect Pattern Analyser

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | ThinkTankX |
| **Track** | AI |
| **Team Lead** | Yashvi Tanna - 24cs100@charusat.edu.in |
| **Members** | Mansi Jogani, Khushi Undhad, Priyanshu Macwan |

---

## 🎯 Problem Statement 

Semiconductor fabs lose significant yield and revenue when wafer defects are detected too late. Manufacturing teams work with high-volume sensor data and wafer maps, but the signal-to-noise ratio is high and the process of identifying root causes is slow, manual, and inconsistent.

This creates operational pressure for quality engineers, process analysts, and production leaders who need faster visibility into which wafers, tool conditions, or process parameters are likely to cause failures before they escalate.

---

## 💡 Solution

YieldSentinel AI is an AI-powered wafer intelligence platform that combines predictive modeling, explainability, and a modern dashboard to help fabs detect risky wafers early and understand why they fail. It predicts pass/fail outcomes from sensor data, identifies the key contributing features using SHAP-based interpretability, and surfaces suspicious defect patterns and likely root causes for actionable investigation.

The solution turns complex manufacturing telemetry into a decision-ready view for engineers and managers.

---

## ✨ Key Features

- **Wafer-level failure prediction:** ML-based pass/fail inference using semiconductor sensor inputs.
- **Batch analytics:** CSV upload workflow for screening multiple wafers and summarizing production risk.
- **Root-cause intelligence:** Top contributing process features highlighted to support investigations.
- **Defect pattern visualization:** Clustering of defect signatures and risk-prone wafer regions.
- **AI assistant interface:** Conversational support for interpreting yield trends and operational questions.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python, TypeScript |
| **Frameworks** | FastAPI, Next.js, React |
| **IBM Technologies** | IBM Bob AI Hackathon, IBM-aligned manufacturing intelligence workflow |
| **Databases** | Local model artifacts; no persistent production DB in the prototype |
| **Other** | XGBoost, SHAP, OpenRouter AI, Framer Motion |

---

## 📁 Repository Structure

```text
bob-ai-hackathon-ThinkTankX/
├── README.md                    # Project overview and run instructions
├── CONTRIBUTING.md              # Contribution guidelines
├── submission.yaml              # Hackathon submission metadata
├── setup.ps1                    # One-time Windows setup
├── start.ps1                    # Start backend and frontend together
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── src/
│   ├── README.md                # Source-code overview
│   ├── .env.example              # Environment variable template
│   ├── YieldSentinel_Improved_Model.ipynb
│   ├── backend/
│   │   ├── main.py               # FastAPI application
│   │   ├── train_model.py        # Optional model training script
│   │   ├── requirements.txt      # Python dependencies
│   │   ├── uci-secom.csv         # Training/demo dataset
│   │   ├── yieldsentinel_best_model.pkl
│   │   └── README.md
│   └── frontend/
│       ├── app/                  # Pages, layouts, API routes, and UI
│       ├── public/               # Static assets
│       ├── src/                  # Frontend shared code
│       ├── package.json          # Node.js dependencies and scripts
│       ├── package-lock.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       └── tsconfig.json
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
└── .gitignore
```

Generated or local-only folders such as `src/backend/.venv/`,
`src/frontend/node_modules/`, `src/frontend/.next/`, Python caches, and
`src/frontend/.env.local` are intentionally excluded from the repository tree.

---

## ⚡ How to Run

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- npm

### Windows quick start

Run this once from the repository root:

```powershell
.\setup.ps1
```

Then start both services with one command:

```powershell
.\start.ps1
```

This opens the backend at `http://localhost:8000` and the frontend at `http://localhost:3000` in separate PowerShell windows.

### Manual start

Install dependencies once:

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

cd ..\frontend
npm install
```

For normal runs, start the backend and frontend in separate terminals:

```powershell
cd src/backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```powershell
cd src/frontend
npm run dev
```

The trained model is already included at `src/backend/yieldsentinel_best_model.pkl`. Run `python train_model.py --data uci-secom.csv` only when you want to retrain it.

### AI assistant configuration

The optional frontend chatbot reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from `src/frontend/.env.local`. The dashboard and backend work without the chatbot key.

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | https://bob-ai-hackathon-think-tank-x.vercel.app/ |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/](presentation/) |

---

## ⚠️ Known Limitations

- The current prototype relies on a local model artifact and demo dataset rather than a production manufacturing data pipeline.
- No persistent database, user auth, or enterprise-grade deployment stack is included in this version.
- The experience is designed for demo and proof-of-concept validation rather than full-scale production rollout.

---

## 🏅 What We're Most Proud Of

The strongest part of this project is the way it combines predictive intelligence with operational clarity. Instead of only showing a pass/fail label, the system explains the biggest contributors, visualizes defect patterns, and helps engineers make faster, more informed decisions in wafer quality investigations.

---
