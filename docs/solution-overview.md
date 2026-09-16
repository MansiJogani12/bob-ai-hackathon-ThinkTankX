# Solution Overview

## What We Built

YieldSentinel AI is a wafer-yield analysis tool for semiconductor process and quality engineers. It helps teams identify wafers and batches that may fail, understand which sensor signals contribute most to that risk, and organize the next investigation in one dashboard.

A user can submit sensor values for one wafer or upload a CSV containing multiple wafers. The system returns PASS or FAIL predictions, probability scores, batch-level risk summaries, and feature explanations. The dashboard also includes views for process trends, root causes, defect patterns, and corrective actions. The core workflow runs locally with the included model and sample dataset; Supabase and the conversational assistant are optional integrations.

## How It Works

1. The engineer opens the Next.js dashboard and enters single-wafer sensor values or uploads a batch CSV.
2. The frontend sends the request to the FastAPI backend through the `/predict` or `/predict-csv` endpoint.
3. The backend aligns the incoming data with the feature schema saved in `yieldsentinel_best_model.pkl`.
4. Missing sensor values are filled using the median imputer stored with the trained model.
5. The XGBoost classifier calculates PASS and FAIL probabilities, and the configured threshold determines the final prediction.
6. SHAP ranks the strongest sensor or process-signal contributors for single-wafer predictions so engineers can focus their investigation.
7. The backend returns prediction and analytics data for the dashboard, including batch risk, root-cause, defect-pattern, and corrective-action views.
8. When configured, Supabase stores analysis results and OpenRouter provides optional conversational assistance based on the current analysis.

## Architecture Diagram

> See [`architecture.md`](architecture.md) for the detailed diagram.

```
[Engineer]
     |
     v
[Next.js Dashboard]
     |
     | REST requests and CSV upload
     v
[FastAPI Backend] --> [Feature Alignment + Median Imputation]
     |                                  |
     |                                  v
     |                         [XGBoost Model Package]
     |                                  |
     |                                  v
     |                         [PASS/FAIL + Risk Scores]
     |                                  |
     |                                  v
     |                         [SHAP Explanations]
     |
     +--> [Dashboard Analytics]
     +--> [Optional Supabase Persistence]
     +--> [Optional OpenRouter Assistant]
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Use a packaged model artifact | The backend can run the included model without retraining during every local demo or deployment. |
| Align incoming data to the stored feature schema | Single-wafer payloads and CSV uploads can contain missing or differently ordered columns without changing the model contract. |
| Median-impute missing sensor values | The same preprocessing configuration used during training is applied during inference. |
| Use SHAP for explanations | Engineers can see which signals contributed most to a prediction instead of receiving only a binary result. |
| Keep optional integrations non-blocking | Core wafer and batch analysis remains usable without Supabase or an OpenRouter API key. |

## IBM Technologies Used

No IBM platform technology is directly integrated into the current implementation. The project was created for the IBM Bob AI Hackathon, but its implemented runtime stack uses FastAPI, Next.js, XGBoost, SHAP, Supabase, and optional OpenRouter rather than watsonx.ai or another IBM Cloud service.
