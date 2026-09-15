import { NextRequest, NextResponse } from "next/server";
import { getAnalyses } from "../../../src/lib/analysisDb";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = (process.env.NEXT_PUBLIC_YIELDSENTINEL_BACKEND_URL ?? process.env.YIELDSENTINEL_BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const MAX_HISTORY_MESSAGES = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Types mirroring backend responses
// ─────────────────────────────────────────────────────────────────────────────

interface AnalysisSummary {
  available: boolean;
  message?: string;
  total_wafers?: number;
  pass_count?: number;
  fail_count?: number;
  pass_percentage?: number;
  fail_percentage?: number;
  threshold?: number;
  model_name?: string;
  total_features?: number;
  top_fail_wafers?: {
    wafer_id: string;
    prediction: string;
    fail_probability: number;
    pass_probability: number;
  }[];
  fail_wafers?: {
    wafer_id: string;
    fail_probability: number;
    pass_probability: number;
  }[];
  fail_wafers_truncated?: boolean;
}

interface ModelInfo {
  model_name: string;
  total_features: number;
  threshold: number;
  target_column: string;
  scale_pos_weight: number;
}

interface RootCausesResponse {
  causes?: {
    label: string;
    probability: number;
    correlation: number;
    deviation: string;
  }[];
}

interface DefectPatternsResponse {
  patterns?: {
    label: string;
    risk_level: string;
    affected_lots: number;
    top_correlation: string;
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword detection — decides whether the question needs live data
// ─────────────────────────────────────────────────────────────────────────────

// Returns true if the user's question is about the current analysis / predictions
function needsAnalysisData(msg: string): boolean {
  const lower = msg.toLowerCase();
  const dataKeywords = [
    // counts / totals
    "fail", "pass", "wafer", "total", "count", "kitni", "kitne", "kiti",
    "how many", "how much", "kitna", "kaafi", "percent", "%", "rate",
    // model / threshold
    "model", "threshold", "accuracy", "recall", "precision",
    "which model", "kaunsa model", "kya model",
    // results / analysis
    "result", "predict", "analysis", "analys", "dashboard",
    "highest", "lowest", "sabse", "zyada", "kam",
    // specific wafer lookup
    "wafer-", "wafer ",
    // hindi / hinglish
    "hui", "hain", "hai", "ho gaye", "pass hui", "fail hui",
    "percentage", "kya hai", "batao", "bata", "show", "list",
    "probability", "chance",
    // advanced RCA / patterns
    "why", "root cause", "feature", "sensor", "pattern", "cluster",
    "equipment", "compare", "trend", "risk", "improve", "issue"
  ];
  return dataKeywords.some((kw) => lower.includes(kw));
}

// Extract a specific WAFER-N id from the message if present
function extractWaferId(msg: string): string | null {
  const match = msg.match(/WAFER[-\s]?(\d+)/i);
  if (match) return `WAFER-${match[1]}`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend data fetchers (server-side, no CORS issues)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAnalysisSummary(): Promise<AnalysisSummary | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/analysis-summary`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as AnalysisSummary;
  } catch {
    return null;
  }
}

async function fetchModelInfo(): Promise<ModelInfo | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/model-info`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ModelInfo;
  } catch {
    return null;
  }
}

async function fetchRootCauses(): Promise<RootCausesResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/root-causes`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RootCausesResponse;
  } catch {
    return null;
  }
}

async function fetchDefectPatterns(): Promise<DefectPatternsResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/defect-patterns`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DefectPatternsResponse;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the data context block injected as a system message
// ─────────────────────────────────────────────────────────────────────────────

function buildDataContext(
  summary: AnalysisSummary | null,
  modelInfo: ModelInfo | null,
  rootCauses: RootCausesResponse | null,
  defectPatterns: DefectPatternsResponse | null,
  requestedWaferId: string | null,
  savedAnalyses: any[] | null,
): string {
  const lines: string[] = [];

  lines.push("=== YIELDSENTINEL LIVE DATA (use this — do not invent numbers) ===");

  // Model info
  if (modelInfo) {
    lines.push(
      `Model: ${modelInfo.model_name}`,
      `Decision threshold: ${modelInfo.threshold}`,
      `Features: ${modelInfo.total_features}`,
      `Target column: ${modelInfo.target_column}`,
    );
  } else {
    lines.push("Model info: unavailable (backend may be offline).");
  }

  lines.push("");

  // Analysis summary
  if (!summary) {
    lines.push(
      "Batch analysis data: backend not reachable. Tell the user the backend may be offline.",
    );
  } else if (!summary.available) {
    lines.push(
      "Batch analysis data: NOT AVAILABLE YET.",
      "Tell the user: 'Abhi koi wafer analysis available nahi hai. Please pehle CSV upload karke batch prediction run karein.'",
    );
  } else {
    lines.push(
      `Total wafers analyzed: ${summary.total_wafers}`,
      `PASS count: ${summary.pass_count}  (${summary.pass_percentage}%)`,
      `FAIL count: ${summary.fail_count}  (${summary.fail_percentage}%)`,
      `Pass percentage: ${summary.pass_percentage}%`,
      `Fail percentage: ${summary.fail_percentage}%`,
      `Threshold used: ${summary.threshold}`,
    );

    // Root Causes
    if (rootCauses?.causes && rootCauses.causes.length > 0) {
      lines.push("", "Top Risk Features / Root Causes:");
      rootCauses.causes.slice(0, 5).forEach((c, idx) => {
        // Replacing "Sensor" with "Feature" if the backend returns "Sensor 103" but doesn't have evidence it's a sensor
        const safeLabel = c.label.replace(/Sensor/g, "Feature");
        lines.push(`  ${idx + 1}. ${safeLabel} (Evidence: ${c.probability}%, Correlation: ${c.correlation}) - Deviation: ${c.deviation}`);
      });
    }

    // Defect Patterns
    if (defectPatterns?.patterns && defectPatterns.patterns.length > 0) {
      lines.push("", "Detected Defect Patterns:");
      defectPatterns.patterns.forEach((p) => {
        lines.push(`  - ${p.label}: Risk Level ${p.risk_level}, Affected Wafers: ${p.affected_lots}, Correlation: ${p.top_correlation}`);
      });
    }

    // Top failing wafers
    if (summary.top_fail_wafers && summary.top_fail_wafers.length > 0) {
      lines.push("", "Top wafers by fail probability:");
      for (const w of summary.top_fail_wafers) {
        lines.push(
          `  ${w.wafer_id}: ${w.prediction}  fail_prob=${(w.fail_probability * 100).toFixed(2)}%  pass_prob=${(w.pass_probability * 100).toFixed(2)}%`,
        );
      }
    }

    // Specific wafer lookup
    if (requestedWaferId && summary.fail_wafers) {
      const found = summary.fail_wafers.find(
        (w) => w.wafer_id.toUpperCase() === requestedWaferId.toUpperCase(),
      );
      if (found) {
        const prediction = found.fail_probability >= (summary.threshold ?? 0.5) ? "FAIL" : "PASS";
        lines.push(
          "",
          `Requested wafer: ${requestedWaferId}`,
          `  Prediction: ${prediction}`,
          `  Fail probability: ${(found.fail_probability * 100).toFixed(2)}%`,
          `  Pass probability: ${(found.pass_probability * 100).toFixed(2)}%`,
          `  Threshold: ${summary.threshold}`,
        );
      } else {
        // Check if it's a PASS wafer (not in fail_wafers list)
        // Parse the wafer number and check total count
        const waferNumMatch = requestedWaferId.match(/WAFER-(\d+)/i);
        const waferNum = waferNumMatch ? parseInt(waferNumMatch[1], 10) : 0;
        if (waferNum >= 1 && waferNum <= (summary.total_wafers ?? 0)) {
          lines.push(
            "",
            `Requested wafer: ${requestedWaferId}`,
            `  Prediction: PASS (not in the FAIL list; fail probability is below threshold ${summary.threshold})`,
          );
        } else {
          lines.push(
            "",
            `Requested wafer: ${requestedWaferId} — NOT FOUND in current analysis (total analyzed: ${summary.total_wafers}).`,
          );
        }
      }
    }

    // Failed wafer list (up to 50 for prompt size)
    if (summary.fail_wafers && summary.fail_wafers.length > 0) {
      const shown = summary.fail_wafers.slice(0, 50);
      lines.push("", `Failed wafers (${summary.fail_count} total${summary.fail_wafers_truncated ? ", showing first 200" : ""}):`);
      for (const w of shown) {
        lines.push(
          `  ${w.wafer_id}: fail_prob=${(w.fail_probability * 100).toFixed(2)}%`,
        );
      }
      if (summary.fail_wafers.length > 50) {
        lines.push(`  ... and ${summary.fail_wafers.length - 50} more`);
      }
    }
  }

  lines.push("=== END LIVE DATA ===");

  if (savedAnalyses && savedAnalyses.length > 0) {
    lines.push("", "=== SAVED ANALYSIS HISTORY (for comparison) ===");
    lines.push(`Total saved analyses: ${savedAnalyses.length}`);
    
    const latest = savedAnalyses[0];
    lines.push("", "LATEST SAVED ANALYSIS:");
    lines.push(`  Dataset: ${latest.dataset_name}`);
    lines.push(`  Yield: ${latest.yield_percentage}%`);
    lines.push(`  Fail Rate: ${latest.fail_rate}%`);
    lines.push(`  Pass Count: ${latest.pass_count}`);
    lines.push(`  Fail Count: ${latest.fail_count}`);
    if (latest.root_causes?.causes) {
      lines.push(`  Top Risks: ${latest.root_causes.causes.slice(0,3).map((c:any) => c.label).join(", ")}`);
    }

    if (savedAnalyses.length > 1) {
      const prev = savedAnalyses[1];
      lines.push("", "PREVIOUS SAVED ANALYSIS:");
      lines.push(`  Dataset: ${prev.dataset_name}`);
      lines.push(`  Yield: ${prev.yield_percentage}%`);
      lines.push(`  Fail Rate: ${prev.fail_rate}%`);
      lines.push(`  Pass Count: ${prev.pass_count}`);
      lines.push(`  Fail Count: ${prev.fail_count}`);
      if (prev.root_causes?.causes) {
        lines.push(`  Top Risks: ${prev.root_causes.causes.slice(0,3).map((c:any) => c.label).join(", ")}`);
      }
    }
    lines.push("=== END SAVED HISTORY ===");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT =
  "You are YieldSentinel Assistant, a data-aware AI assistant embedded inside the YieldSentinel AI " +
  "semiconductor yield analysis platform.\n\n" +
  "CRITICAL RULES:\n" +
  "1. When the user asks about wafer counts, predictions, failure rates, probabilities, features, root causes, or defect patterns, " +
  "you MUST use the numbers and findings from the '=== YIELDSENTINEL LIVE DATA ===' block provided in the system context. " +
  "Do NOT invent, estimate, or guess any numerical values, patterns, or root causes.\n" +
  "2. If information is unavailable, clearly say 'This information is not available in the current dataset/analysis' instead of inventing it.\n" +
  "3. Answer using the currently selected dataset/analysis context, not hardcoded demo data.\n" +
  "4. Use terminology like 'Feature 103' instead of 'Sensor 103' unless actual sensor metadata exists in the data block. " +
  "Never claim a feature is a physical sensor, equipment, or definite root cause unless the dataset provides that evidence.\n" +
  "5. Never convert correlation/feature importance into a fake probability or confidence.\n" +
  "6. If the live data block says 'NOT AVAILABLE YET', tell the user to upload and analyze a CSV first. " +
  "Do NOT say you cannot access the data — it is available once a CSV is analyzed.\n" +
  "7. Answer in the same language the user uses (English, Hindi, Hinglish — all are fine).\n" +
  "8. Keep answers concise. For counts/rates, lead with the number in bold (**number**).\n" +
  "9. Never show a status of FAIL with a low fail probability or vice versa — always use the numbers as given.\n" +
  "10. For wafer-specific queries, use the exact probability values from the live data.\n" +
  "11. If the user asks to COMPARE analyses or requests history, use the '=== SAVED ANALYSIS HISTORY ===' block. " +
  "Compare the yield, fail rates, and top risks between the latest and previous saved analysis. Do not claim the previous run is unavailable if it is listed there.\n\n" +
  "You also understand semiconductor manufacturing, wafer yield, defects, sensors, and ML concepts.";

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[chat] OPENROUTER_API_KEY is not set");
    return NextResponse.json(
      { error: "AI assistant is temporarily unavailable." },
      { status: 503 },
    );
  }

  let body: { message?: string; history?: { role: string; content: string }[]; userId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userMessage = (body.message ?? "").trim().slice(0, 2000);
  if (!userMessage) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const recentHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  // ── Fetch live data if the question needs it ───────────────────────────────
  let dataContextBlock = "";
  if (needsAnalysisData(userMessage)) {
    const requestedWaferId = extractWaferId(userMessage);
    const [summary, modelInfo, rootCauses, defectPatterns, savedAnalyses] = await Promise.all([
      fetchAnalysisSummary(),
      fetchModelInfo(),
      fetchRootCauses(),
      fetchDefectPatterns(),
      body.userId ? getAnalyses(body.userId) : Promise.resolve(null)
    ]);
    dataContextBlock = buildDataContext(summary, modelInfo, rootCauses, defectPatterns, requestedWaferId, savedAnalyses);
  }

  // ── Build full system prompt ───────────────────────────────────────────────
  const systemContent = dataContextBlock
    ? `${BASE_SYSTEM_PROMPT}\n\n${dataContextBlock}`
    : BASE_SYSTEM_PROMPT;

  // ── Model selection ────────────────────────────────────────────────────────
  const rawModel = (process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free").trim();
  const model = rawModel.replace(/^OPENROUTER_MODEL\s*=/i, "").trim();
  const safeModel = /\/.+/.test(model) ? model : "nvidia/nemotron-3-super-120b-a12b:free";
  const FALLBACK_MODELS = ["liquid/lfm-2.5-2.6b:free", "nex-agi/nex-n2.5-mini:free"];

  const buildMessages = () => [
    { role: "system", content: systemContent },
    ...recentHistory,
    { role: "user", content: userMessage },
  ];

  const callOpenRouter = async (modelId: string) => {
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://yieldsentinel.ai",
        "X-Title": "YieldSentinel AI",
      },
      body: JSON.stringify({
        model: modelId,
        messages: buildMessages(),
        max_tokens: 600,
        temperature: 0.3,
      }),
    });
  };

  try {
    let response = await callOpenRouter(safeModel);

    if (!response.ok && response.status !== 401 && response.status !== 402 && response.status !== 429) {
      for (const fallbackModel of FALLBACK_MODELS) {
        console.warn(`[chat] Model returned ${response.status}, retrying with fallback: ${fallbackModel}`);
        response = await callOpenRouter(fallbackModel);
        if (response.ok) break;
      }
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[chat] OpenRouter HTTP ${response.status} — body:`, text);
      let userError = "Sorry, I couldn't process that request right now. Please try again.";
      try {
        const parsed = JSON.parse(text);
        const msg: string = parsed?.error?.message ?? "";
        if (
          response.status === 401 ||
          msg.toLowerCase().includes("auth") ||
          msg.toLowerCase().includes("invalid api key")
        ) {
          userError = "AI assistant is temporarily unavailable. (API key issue)";
        } else if (response.status === 429 || msg.toLowerCase().includes("rate limit")) {
          userError = "Too many requests — please wait a moment and try again.";
        } else if (
          response.status === 402 ||
          msg.toLowerCase().includes("credit") ||
          msg.toLowerCase().includes("billing")
        ) {
          userError = "AI assistant is temporarily unavailable. (Account credit issue)";
        }
      } catch {
        /* not JSON */
      }
      return NextResponse.json({ error: userError }, { status: 502 });
    }

    const data = await response.json();
    console.log("[chat] OpenRouter response:", JSON.stringify(data).slice(0, 300));
    const reply: string = data?.choices?.[0]?.message?.content ?? "";
    if (!reply) {
      console.error("[chat] Empty reply from OpenRouter. Full response:", JSON.stringify(data));
      return NextResponse.json(
        {
          error: "Sorry, I couldn't generate a response. Please try rephrasing your question.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat] Fetch error:", err);
    return NextResponse.json(
      { error: "Unable to reach AI service. Please check your connection and try again." },
      { status: 502 },
    );
  }
}
