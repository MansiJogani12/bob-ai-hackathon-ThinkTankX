# Solution Overview

## What We Built

YieldSentinel AI is a wafer-yield intelligence prototype built around a trained XGBoost classifier and a dashboard for operational review. The project brings together three practical capabilities that matter in semiconductor manufacturing: risk prediction, root-cause explanation, and batch-level review.

The repository contains the implemented application, including:

- a FastAPI backend that loads a trained model package and accepts sensor inputs or batch CSV uploads
- a Next.js frontend dashboard for review of wafer risk, defect views, root-cause information, and corrective-action tracking
- a model-training workflow and serialized model artifact used for local inference and demo validation

This is a working proof-of-concept based on the actual code in the repository, not a generic dashboard shell.

## How It Works

1. The backend loads the trained model and preprocessing components from the serialized package in `src/backend/yieldsentinel_best_model.pkl`.
2. When a user submits a single wafer or a batch CSV, the backend aligns the input columns to the trained feature set, imputes missing values, and computes pass/fail probabilities.
3. The model returns prediction probabilities and the FastAPI service uses a threshold to assign PASS or FAIL for each wafer.
4. SHAP values are calculated to rank the most influential sensors or process signals pushing the outcome in a particular direction.
5. The dashboard summarizes the latest batch, shows at-risk wafers, and displays operational views for root causes, defect patterns, corrective actions, and process correlation.
6. Engineers can use the output to prioritize which wafers or batches require investigation and to understand the strongest contributing factors behind likely failures.

## Why This Solution Matters

The strongest differentiator in this project is that it does not stop at a binary classification. It combines prediction with explanation and operational context:

- the model estimates risk for each wafer or batch
- SHAP features show which inputs matter most
- the dashboard surfaces those outputs in a way that is understandable to engineers
- the workflow supports investigation, not just alerting

This is valuable in semiconductor operations because process teams need to do more than know that something failed; they need to know what to investigate next and which signals are most relevant.

## Architecture Summary

The project is intentionally simple and direct:

- the frontend collects user input and presents risk data
- the backend performs model inference and analytics
- the trained model package stores the learned logic and preprocessing objects
- optional OpenRouter and Supabase integrations are available only when configured, and they are not required for core operation

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Use a packaged model artifact with preprocessing objects | Keeps the backend runnable without retraining for normal local demo and validation workflows |
| Use SHAP for top feature explanations | Helps translate model output into process-relevant signals engineers can investigate |
| Keep analytics in the backend and dashboard views in the frontend | Separates prediction logic from presentation and makes the API reusable |
| Support CSV batch uploads | Allows quick screening of multiple wafers before deeper investigation |
| Keep optional AI and Supabase integrations non-blocking | The core product works without them; they do not create a hard dependency |

## IBM Hackathon Context

This project was built as a submission for the IBM Bob AI Hackathon using the semiconductor yield challenge as its context. The implementation in this repository is a functional proof of concept based on the actual backend, frontend, and model artifacts present in the codebase.

No additional IBM platform integrations were added beyond what is already present in the repository, and all claims in this documentation are limited to the implemented functionality.
