# Frontend Overview

This folder contains the Next.js dashboard for the YieldSentinel AI project. It is the user-facing layer for risk review, batch analytics, and wafer investigation.

## What the Frontend Includes

The application currently includes pages and views for:

- command-center dashboard overview
- batch upload and CSV-based analysis
- wafer risk screening and upcoming-batch review
- single-wafer prediction flow
- defect intelligence and process correlation views
- root-cause review and corrective-action tracking
- optional conversational analysis through the chat route

## Main Structure

```text
src/frontend/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts
│   │   └── corrective-ai/
│   │       └── route.ts
│   ├── components/
│   ├── dashboard/
│   │   ├── batch/
│   │   ├── batchrisk/
│   │   ├── compare/
│   │   ├── corrective/
│   │   ├── defects/
│   │   ├── history/
│   │   ├── intelligence/
│   │   ├── process/
│   │   ├── rootcause/
│   │   ├── wafer/
│   │   └── layout.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── providers.tsx
│   └── context.tsx
├── public/
├── src/
│   ├── lib/
│   ├── services/
│   └── store.tsx
├── package.json
├── package-lock.json
├── next.config.mjs
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## App Behavior

The frontend consumes the FastAPI backend at `http://127.0.0.1:8000` by default. It calls endpoints such as:

- `/health`
- `/model-info`
- `/predict`
- `/predict-csv`
- `/dashboard`
- `/root-causes`
- `/defect-patterns`

The dashboard then presents the returned data in multiple operational views.

## Optional AI Assistant

The frontend includes an optional chat route in `src/frontend/app/api/chat/route.ts`. It reads configuration from environment variables when present and can send requests to OpenRouter for conversational analysis. The main analytics workflow correctly works without this key.

## Local Run

From the repository root:

```powershell
.\setup.ps1
.\start.ps1
```

Or manually:

```powershell
cd src/frontend
npm install
npm run dev
```

The app is expected to run on:

```text
http://localhost:3000
```

## Notes

- The frontend is part of a local demo/prototype flow and is not a production deployment setup.
- The design and page structure reflect the implemented dashboard flows in this repository.
- The codebase intentionally keeps stylistic and framework files to a minimum and focuses on the operational dashboard behavior.
