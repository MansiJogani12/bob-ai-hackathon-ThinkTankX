# ThinkTankX — Bob AI Innovation Hackathon Submission Guide

This guide documents the completed submission for **ThinkTankX** and explains how evaluators can find, run, and review **S1 Wafer Yield Root Cause & Defect Pattern Analyser**.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project and Team](#2-project-and-team)
3. [Repository Structure](#3-repository-structure)
4. [File-by-File Walkthrough](#4-file-by-file-walkthrough)
   - [submission.yaml](#41-submissionyaml)
   - [README.md](#42-readmemd)
   - [docs/](#43-docs)
   - [src/](#44-src)
   - [demo/](#45-demo)
   - [presentation/](#46-presentation)
5. [Getting Started](#5-getting-started)
6. [Automated Validation](#6-automated-validation)
7. [Submission Checklist](#7-submission-checklist)
8. [How This Entry Is Evaluated](#8-how-this-entry-is-evaluated)
9. [Common Mistakes](#9-common-mistakes)
10. [FAQ](#10-faq)

---

## 1. Overview

ThinkTankX is submitting **YieldSentinel AI**, a semiconductor wafer-yield intelligence prototype. The system combines XGBoost prediction, median-imputation preprocessing, SHAP explanations, a FastAPI backend, and a Next.js dashboard.

The project helps process and quality engineers identify risky wafers and batches, understand the strongest contributing signals, and organize follow-up investigation through dashboard views for batch risk, wafer analysis, root causes, defect patterns, and corrective actions.

The core workflow uses the included model artifact and sample SECOM-style dataset. Supabase persistence and the OpenRouter conversational assistant are optional integrations and are not required for the main prediction workflow.

---

## 2. Project and Team

| Field | Details |
|---|---|
| **Team name** | ThinkTankX |
| **Track** | AI |
| **Team lead** | Yashvi Tanna — 24cs100@charusat.edu.in |
| **Team members** | Mansi Jogani, Khushi Undhad, Priyanshu Macwan |
| **Project title** | S1 Wafer Yield Root Cause & Defect Pattern Analyser |
| **Repository** | https://github.com/MansiJogani12/bob-ai-hackathon-ThinkTankX |
| **Demo video** | https://youtu.be/pylJjxL4T7k |
| **Live demo** | https://bob-ai-hackathon-think-tank-x.vercel.app/ |

### Team Contacts

| Member | Email |
|---|---|
| Yashvi Tanna | 24cs100@charusat.edu.in |
| Mansi Jogani | 24it033@charusat.edu.in |
| Khushi Undhad | 24cs101@charusat.edu.in |
| Priyanshu Macwan | 24cs049@charusat.edu.in |

---

## 3. Repository Structure

```
bob-ai-hackathon-ThinkTankX/
│
├── submission.yaml          <- Structured metadata for evaluators
├── README.md                <- Human-readable project overview
├── CONTRIBUTING.md          <- Contribution and submission guidance
├── setup.ps1                <- Windows dependency setup script
├── start.ps1                <- Windows script for starting both services
│
├── src/                     <- Application source code and model assets
│   ├── .env.example         <- Optional environment variable template
│   ├── README.md            <- Source layout and usage notes
│   ├── YieldSentinel_Improved_Model.ipynb
│   ├── backend/
│   │   ├── main.py          <- FastAPI inference and analytics API
│   │   ├── train_model.py   <- Model training and export workflow
│   │   ├── requirements.txt
│   │   ├── uci-secom.csv    <- Sample training dataset
│   │   ├── yieldsentinel_best_model.pkl
│   │   ├── supabase_client.py
│   │   └── supabase_migrations.sql
│   └── frontend/
│       ├── app/             <- Next.js pages, dashboard, and API routes
│       ├── public/          <- Frontend assets
│       ├── src/             <- Shared frontend services and state
│       └── package.json
│
├── docs/                    <- Written project documentation
│   ├── problem-statement.md
│   ├── solution-overview.md
│   ├── architecture.md
│   ├── setup-guide.md
│   └── template-guide.md
│
├── demo/                    <- Demo artifacts
│   ├── demo-video-link.txt
│   ├── live-demo-url.txt
│   └── screenshots/
│
├── presentation/            <- YieldSentinel AI presentation PDF
└── .github/workflows/       <- GitHub Actions validation workflow
```

---

## 4. File-by-File Walkthrough

### 4.1 `submission.yaml`

This is the structured metadata file read by the evaluation workflow. The completed values are:

```yaml
team:
  name: "ThinkTankX"
  track: "AI"
  lead:
    name: "Yashvi Tanna"
    email: "24cs100@charusat.edu.in"
  members:
    - name: "Mansi Jogani"
      email: "24it033@charusat.edu.in"
    - name: "Khushi Undhad"
      email: "24cs101@charusat.edu.in"
    - name: "Priyanshu Macwan"
      email: "24cs049@charusat.edu.in"

submission:
  title: "S1 Wafer Yield Root Cause & Defect Pattern Analyser"
```

The file also contains the problem statement, solution summary, five key features, technology stack, limitations, and artifact paths. Do not rename it because the GitHub Actions workflow reads it by name.

### 4.2 `README.md`

The root README is the human-readable entry point. It contains:

- team and project details
- the semiconductor yield problem
- the YieldSentinel AI solution
- implemented features and technology stack
- Windows setup and run commands
- demo and deployment artifact links
- known limitations and the project strengths
- submission validation instructions

### 4.3 `docs/`

The documentation files describe the project from complementary viewpoints:

| File | Purpose |
|---|---|
| `problem-statement.md` | Explains the yield-loss problem, affected engineering teams, business impact, and why manual analysis is difficult. |
| `solution-overview.md` | Describes the user experience, prediction workflow, architecture summary, and design decisions in plain language. |
| `architecture.md` | Contains the Mermaid system diagram, component table, end-to-end data flow, security notes, and scalability notes. |
| `setup-guide.md` | Gives exact prerequisites, environment variables, PowerShell commands, verification steps, and troubleshooting guidance. |
| `template-guide.md` | Records the completed ThinkTankX submission details and repository review guide. |

### 4.4 `src/`

All application source code is inside `src/`.

- `src/backend/main.py` exposes FastAPI health, model-info, single-wafer, batch CSV, dashboard, root-cause, and defect-pattern endpoints.
- `src/backend/train_model.py` trains and exports the model package.
- `src/backend/yieldsentinel_best_model.pkl` stores the trained model, feature schema, imputer, threshold, and metadata.
- `src/frontend/app/` contains the Next.js dashboard pages and optional API routes.
- `src/frontend/src/services/api.ts` defines frontend calls to the backend.
- `src/.env.example` documents optional IBM, Supabase, model, and frontend configuration values.

Do not commit real `.env` files, `node_modules/`, `.venv/`, `__pycache__/`, or build artifacts.

### 4.5 `demo/`

The demo artifacts are:

| Artifact | Current value |
|---|---|
| Demo video | https://youtu.be/pylJjxL4T7k |
| Live demo | https://bob-ai-hackathon-think-tank-x.vercel.app/ |
| Screenshots | `demo/screenshots/` |

The video should demonstrate the application starting, a real wafer or batch analysis journey, and actual prediction output. The live deployment is hosted on Vercel, while the complete backend workflow can also be run locally using `setup.ps1` and `start.ps1`.

### 4.6 `presentation/`

The presentation directory contains `YieldSentinel AI (Presentation).pdf`. It presents the problem, solution, dashboard workflow, architecture, and project impact.

---

## 5. Getting Started

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- npm
- Windows PowerShell 5.1 or PowerShell 7+

Docker, PostgreSQL, an IBM Cloud account, and watsonx.ai access are not required for the core local workflow.

### Installation

From the repository root:

```powershell
.\setup.ps1
```

The script creates `src/backend/.venv`, installs Python dependencies, and installs frontend dependencies.

### Run the application

```powershell
.\start.ps1
```

The services start at:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health check: http://localhost:8000/health

For complete environment variables, manual setup, verification, and troubleshooting, see [`setup-guide.md`](setup-guide.md).

---

## 6. Automated Validation

The workflow at `.github/workflows/validate.yml` runs on pushes and pull requests. It checks:

- required repository files
- YAML parsing for `submission.yaml`
- required team and submission fields
- valid track value: `AI`, `DevOps`, `Sustainability`, or `Open`
- at least one key feature
- source code inside `src/`
- the demo video link is not the template placeholder
- README placeholders have been replaced

To check the result, open the repository's **Actions** tab and select **Validate Submission**. A green run means the structural checks passed.

Do not modify `.github/workflows/validate.yml` unless the hackathon organizers explicitly request it.

---

## 7. Submission Checklist

### Content

- [x] `submission.yaml` contains the ThinkTankX team and project metadata.
- [x] `README.md` contains project-specific content with no template placeholders.
- [x] `docs/problem-statement.md` explains the semiconductor yield problem.
- [x] `docs/solution-overview.md` explains the implemented solution.
- [x] `docs/architecture.md` contains a diagram and technical explanation.
- [x] `docs/setup-guide.md` contains exact setup and run instructions.
- [x] `src/` contains the backend, frontend, dataset, notebook, and model artifact.
- [x] `demo/demo-video-link.txt` contains the YouTube demo URL.
- [x] `demo/live-demo-url.txt` contains the Vercel deployment URL.
- [x] `presentation/YieldSentinel AI (Presentation).pdf` is present.

### Technical

- [ ] Confirm no real credentials are committed before each push.
- [ ] Keep `node_modules/`, `.venv/`, `__pycache__/`, and build artifacts out of Git.
- [ ] Confirm the latest **Validate Submission** workflow is green.
- [ ] Keep the repository public so evaluators can access it.

---

## 8. How This Entry Is Evaluated

ThinkTankX should be reviewed against the following areas:

| Criterion | Evidence in this repository |
|---|---|
| Technical implementation | FastAPI inference endpoints, Next.js dashboard, model artifact, batch analysis, SHAP explanations, and training code. |
| Innovation and differentiation | Combines risk prediction with explainability and operational investigation views instead of returning only PASS or FAIL. |
| Problem depth | Problem documentation focuses on wafer yield loss, process signals, batch risk, and engineering investigation. |
| Working functionality | Local scripts, included model artifact, sample dataset, demo video, and Vercel frontend provide reproducible evidence. |
| IBM technology integration | No IBM platform service is directly integrated in the current implementation; this is stated explicitly in the submission metadata and documentation. |
| Documentation and reproducibility | README, setup guide, architecture, solution overview, source README, and this project-specific guide explain how to run and review the system. |

The project does not claim watsonx.ai or IBM Bob runtime integration because those technologies are not present in the implemented code. The optional OpenRouter assistant is documented separately from the core workflow.

---

## 9. Common Mistakes

| Mistake | How ThinkTankX avoids it |
|---|---|
| Leaving generic template placeholders | Project-specific documentation and metadata replace the template examples. |
| Committing credentials | Optional credentials belong in ignored `.env` files and are not required for the core workflow. |
| Using an incorrect demo link | The current demo URL is `https://youtu.be/pylJjxL4T7k`. |
| Forgetting the deployed URL | The current live demo is `https://bob-ai-hackathon-think-tank-x.vercel.app/`. |
| Running only the frontend | The dashboard requires the FastAPI backend for live predictions and analytics. |
| Missing the model artifact | Confirm `src/backend/yieldsentinel_best_model.pkl` exists before starting inference. |
| Uploading an incompatible CSV | Use columns matching the trained sensor feature schema; missing values are imputed automatically. |
| Changing the validation workflow | Keep `.github/workflows/validate.yml` unchanged unless instructed by organizers. |

---

## 10. FAQ

**Q: Who is the team lead?**
Yashvi Tanna (`24cs100@charusat.edu.in`).

**Q: What track is the project submitted under?**
The AI track.

**Q: What is the project called?**
S1 Wafer Yield Root Cause & Defect Pattern Analyser, implemented as YieldSentinel AI.

**Q: Does the project require watsonx.ai or IBM Cloud?**
No. The core implementation uses FastAPI, Next.js, XGBoost, SHAP, and the included model artifact. No IBM platform service is directly integrated.

**Q: Can the project run without Supabase or OpenRouter?**
Yes. Those integrations are optional. The primary wafer and batch prediction workflow works without them.

**Q: Where should a reviewer start?**
Start with [README.md](../README.md), then follow [setup-guide.md](setup-guide.md) to run the application and [architecture.md](architecture.md) to understand the system.

**Q: Has anything been pushed after the current documentation edits?**
These documentation edits are local until the repository owner explicitly requests a commit and push.

---

*For hackathon-specific questions, contact the organizers directly.*
