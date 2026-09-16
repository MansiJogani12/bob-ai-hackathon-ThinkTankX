# Demo

This folder contains the ThinkTankX demonstration artifacts for **S1 Wafer Yield Root Cause & Defect Pattern Analyser**.

## Demo Video

The project walkthrough is available at:

https://youtu.be/pylJjxL4T7k

The video demonstrates the YieldSentinel AI dashboard, wafer and batch-risk workflow, and generated analysis output.

## Live Demo

The deployed frontend is available at:

https://bob-ai-hackathon-think-tank-x.vercel.app/

The backend can also be run locally using [`docs/setup-guide.md`](../docs/setup-guide.md).

## Screenshots

The `screenshots/` directory contains application evidence:

- `01-landing-page.png.jpg`
- `02-main-feature.jpg`
- `03-compare-analysis.jpeg`
- `04-batch-predication.jpeg`

The screenshots cover the landing page, main dashboard, comparison analysis, and batch prediction workflow.

## Recommended Demo Flow

1. Start the backend and frontend using `setup.ps1` and `start.ps1`.
2. Open the dashboard at `http://localhost:3000`.
3. Upload a wafer batch CSV or enter single-wafer sensor values.
4. Review PASS/FAIL probabilities and SHAP feature contributors.
5. Open batch-risk, root-cause, defect-pattern, and corrective-action views.

## Notes

- The core demo uses the included model artifact and SECOM-style dataset.
- Supabase persistence and the OpenRouter assistant are optional.
- SHAP results identify important model contributors for investigation; they do not prove a physical root cause.
