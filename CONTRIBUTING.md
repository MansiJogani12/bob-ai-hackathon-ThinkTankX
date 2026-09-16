# How to Submit Your Hackathon Entry

This guide documents how **ThinkTankX** prepared and submits the **S1 Wafer Yield Root Cause & Defect Pattern Analyser** repository. The judges depend on this structure to review the entry, and deviations may affect the score.

---

## Step 1 — Fork This Template

The ThinkTankX submission repository was created from the Bob AI Innovation Hackathon submission template.

1. Start from the [Bob AI Hackathon submission template](https://github.com/drijesh-ppatel/bob-ai-hackathon-submission-template).
2. Create a public repository for the team. The completed repository is [`bob-ai-hackathon-ThinkTankX`](https://github.com/MansiJogani12/bob-ai-hackathon-ThinkTankX).
3. Set visibility to **Public** so judges can access the source code, documentation, demo artifacts, and presentation.
4. Keep the required top-level files and directories in place.

### Project and Team Details

| Field | Value |
|---|---|
| Team | ThinkTankX |
| Track | AI |
| Project | S1 Wafer Yield Root Cause & Defect Pattern Analyser |
| Team lead | Yashvi Tanna — 24cs100@charusat.edu.in |
| Members | Mansi Jogani, Khushi Undhad, Priyanshu Macwan |

---

## Step 2 — Clone Your Fork Locally

```powershell
git clone https://github.com/MansiJogani12/bob-ai-hackathon-ThinkTankX.git
cd bob-ai-hackathon-ThinkTankX
```

The repository is also available as a live frontend deployment at:

```text
https://bob-ai-hackathon-think-tank-x.vercel.app/
```

---

## Step 3 — Fill in the Required Files

The ThinkTankX entry contains the following completed files and artifacts.

### 3a. `submission.yaml` <- **Start here**

This is the structured metadata file read by the evaluation workflow.

- Open [`submission.yaml`](submission.yaml).
- Confirm the team name is `ThinkTankX` and the track is `AI`.
- Confirm the lead is Yashvi Tanna (`24cs100@charusat.edu.in`).
- Confirm the project title is `S1 Wafer Yield Root Cause & Defect Pattern Analyser`.
- Confirm the problem statement, solution summary, and five key features are filled in.
- Do not rename the file because the validation workflow reads it by name.

### 3b. `README.md`

The root [README.md](README.md) contains the completed human-readable overview:

- team, track, lead, and members
- semiconductor wafer-yield problem statement
- YieldSentinel AI solution summary
- implemented prediction, batch, SHAP, dashboard, and investigation features
- Python, TypeScript, FastAPI, Next.js, XGBoost, and SHAP technology stack
- PowerShell setup and run commands
- demo, live deployment, screenshots, and presentation links
- known limitations and project strengths

### 3c. `docs/`

All four required documentation files are completed:

| File | What it contains |
|---|---|
| [`docs/problem-statement.md`](docs/problem-statement.md) | The semiconductor yield-loss problem, affected engineers, business impact, and limitations of manual review. |
| [`docs/solution-overview.md`](docs/solution-overview.md) | How YieldSentinel AI predicts wafer risk, explains model output, and supports engineering investigation. |
| [`docs/architecture.md`](docs/architecture.md) | Mermaid architecture diagram, component table, data flow, security considerations, and scalability notes. |
| [`docs/setup-guide.md`](docs/setup-guide.md) | Exact prerequisites, environment variables, PowerShell installation commands, run commands, verification, and troubleshooting. |

### 3d. `src/`

- All backend and frontend application code is inside [`src/`](src/).
- [`src/.env.example`](src/.env.example) documents optional model, backend URL, Supabase, and OpenRouter variables.
- [`src/README.md`](src/README.md) documents the web application and data/AI source layout.
- Never commit a real `.env` file. The repository `.gitignore` excludes environment files, virtual environments, dependencies, and build artifacts.

### 3e. `demo/`

| File | ThinkTankX entry |
|---|---|
| [`demo/demo-video-link.txt`](demo/demo-video-link.txt) | https://youtu.be/pylJjxL4T7k |
| [`demo/live-demo-url.txt`](demo/live-demo-url.txt) | https://bob-ai-hackathon-think-tank-x.vercel.app/ |
| [`demo/screenshots/`](demo/screenshots/) | Four application screenshots are included. |

Current screenshots:

- `01-landing-page.png.jpg`
- `02-main-feature.jpg`
- `03-compare-analysis.jpeg`
- `04-batch-predication.jpeg`

### 3f. `presentation/`

The completed slide deck is [`presentation/YieldSentinel AI (Presentation).pdf`](presentation/YieldSentinel%20AI%20(Presentation).pdf).

---

## Step 4 — Verify Your Submission Passes Validation

Every push to the repository triggers the **Validate Submission** GitHub Action automatically.

To check manually:

1. Go to the [ThinkTankX repository](https://github.com/MansiJogani12/bob-ai-hackathon-ThinkTankX).
2. Click the **Actions** tab.
3. Look for **✅ Validate Submission**.
4. A green checkmark means the structural submission checks passed.
5. A red X means something is missing or invalid; open the run log and fix the reported issue.

The workflow checks:

- required files exist
- `submission.yaml` is valid YAML
- required metadata fields are not empty
- the track is one of `AI`, `DevOps`, `Sustainability`, or `Open`
- at least one key feature is present
- `src/` contains source files
- the demo video is not the template placeholder
- README placeholders are replaced

You can also validate locally with Python:

```powershell
python -c "import yaml; from pathlib import Path; d=yaml.safe_load(Path('submission.yaml').read_text(encoding='utf-8')); assert d['team']['track'] in {'AI','DevOps','Sustainability','Open'}; assert d['submission']['key_features']; print('submission.yaml is valid')"
```

Do not modify `.github/workflows/validate.yml` unless the hackathon organizers explicitly request it.

---

## Step 5 — Submit Your Repository URL

Once validation passes:

1. Copy the repository URL: `https://github.com/MansiJogani12/bob-ai-hackathon-ThinkTankX`
2. Submit that URL through the official IBM Bob AI Innovation Hackathon entry form.
3. Follow the organizer-provided submission deadline and entry-form instructions.

The repository is public, and the live demo and demo video are available at the URLs recorded above.

---

## Checklist Before You Submit

- [x] `submission.yaml` - all required team and project fields filled
- [x] `README.md` - project-specific content with no template placeholders
- [x] `docs/setup-guide.md` - complete setup, run, verification, and troubleshooting instructions
- [x] `src/` - backend, frontend, model, dataset, notebook, and environment template present
- [x] `demo/demo-video-link.txt` - real YouTube video URL
- [x] `demo/screenshots/` - four application screenshots present
- [x] `presentation/YieldSentinel AI (Presentation).pdf` - slide deck present
- [x] GitHub Actions **✅ Validate Submission** workflow configured
- [x] Repository is **Public**
- [ ] Confirm the latest pushed commit has a green **Validate Submission** run
- [ ] Submit the repository URL through the official entry form

---
