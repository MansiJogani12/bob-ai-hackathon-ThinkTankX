# Frontend Source Code

This folder contains the Next.js and React dashboard for YieldSentinel AI. It is the user-facing layer for wafer-risk prediction, batch analysis, root-cause review, defect-pattern investigation, and corrective-action workflows.

## Structure Guidelines

The frontend follows the web-application structure inside `src/frontend/`:

```text
src/frontend/
  app/             <- Next.js App Router pages, layouts, dashboard views, and API routes
  public/          <- Static frontend assets and frame resources
  src/             <- Shared frontend libraries, services, and client state
  package.json     <- Dependency manifest and npm scripts
  next.config.mjs  <- Next.js configuration
```

### Application Routes

```text
app/
  api/
    chat/           <- Optional OpenRouter conversational analysis route
    corrective-ai/  <- Optional corrective-action assistant route
  dashboard/        <- Operational dashboard pages
    batch/          <- CSV batch analysis
    batchrisk/      <- Batch risk review
    compare/        <- Analysis comparison
    corrective/     <- Corrective-action workflow
    defects/        <- Defect-pattern investigation
    history/        <- Saved analysis history
    intelligence/   <- Yield intelligence view
    process/        <- Process analysis
    rootcause/      <- Root-cause review
    wafer/          <- Single-wafer analysis
  components/       <- Reusable dashboard and chatbot components
  fonts/            <- Frontend font assets
  layout.tsx        <- Root layout
  page.tsx          <- Landing page
  providers.tsx     <- Application providers
  context.tsx       <- Frontend context
```

### Shared Frontend Code

```text
src/
  lib/
    analysisDb.ts   <- Supabase analysis persistence helpers
    store.tsx       <- Shared client state
    supabase.ts     <- Supabase browser client
  services/
    api.ts          <- Typed calls to the FastAPI backend
```

## Important Files to Include

- `package.json` - Next.js, React, Supabase, Framer Motion, Tailwind, and TypeScript dependencies
- `package-lock.json` - Locked npm dependency versions
- `app/page.tsx` - Main entry page
- `app/dashboard/` - Implemented operational dashboard routes
- `src/services/api.ts` - Backend API client for health, model, prediction, batch, dashboard, root-cause, and defect endpoints
- `src/lib/analysisDb.ts` - Optional saved-analysis and corrective-action persistence helpers
- `next.config.mjs` - Next.js configuration
- `postcss.config.mjs` and `tailwind.config.ts` - CSS processing and Tailwind configuration
- `tsconfig.json` - TypeScript compiler configuration
- `public/` - Static files used by the dashboard

## Environment Variables

The core dashboard can use the default backend at `http://127.0.0.1:8000`. Optional integrations are configured in `src/frontend/.env.local`:

| Variable | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_YIELDSENTINEL_BACKEND_URL` | FastAPI backend URL | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for authentication and saved analyses | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser-safe anonymous key | No |
| `OPENROUTER_API_KEY` | Optional chat and corrective-action assistant key | No |
| `OPENROUTER_MODEL` | Optional OpenRouter model identifier | No |

Never commit `.env.local` or real credentials. Use `src/.env.example` as the project-level reference.

## What Not to Include in the Frontend Folder

- `node_modules/`
- `.next/`, `dist/`, or other build artifacts
- `.env.local` or any file containing real credentials
- Python virtual environments or backend-only files
- Temporary logs and local deployment output

These paths are excluded by the repository `.gitignore`.

## Backend API Integration

The frontend calls the FastAPI service using the following endpoints:

| Method | Endpoint | Frontend purpose |
|---|---|---|
| GET | `/health` | Sidebar and service health checks |
| GET | `/model-info` | Display model schema and threshold information |
| POST | `/predict` | Single-wafer prediction and SHAP contributors |
| POST | `/predict-csv` | Batch CSV risk analysis |
| GET | `/analysis-summary` | Latest batch summary for assistant context |
| GET | `/dashboard` | Command-center metrics |
| GET | `/root-causes` | Ranked root-cause indicators |
| GET | `/defect-patterns` | Defect-pattern summaries |

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

The frontend runs at:

```text
http://localhost:3000
```

The backend should be running at `http://localhost:8000` for live prediction and analytics data.

## Validation

Use the following commands for frontend validation:

```powershell
cd src/frontend
npm run build
```

The frontend is a local and deployed prototype. Its core dashboard workflow is designed to work without Supabase or OpenRouter when the backend is available.
