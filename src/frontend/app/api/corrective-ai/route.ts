import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/corrective-ai
 *
 * Accepts structured evidence from the current analysis and returns
 * natural-language investigation/corrective-action suggestions.
 *
 * The AI is ONLY used to turn already-structured evidence into prose.
 * It is explicitly told NOT to invent equipment, root causes, sensor meanings,
 * numerical impact, or expected yield improvement.
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "liquid/lfm-2.5-2.6b:free",
  "nex-agi/nex-n2.5-mini:free",
];

export interface CorrectiveAIRequest {
  /** Dataset name */
  datasetName: string;
  /** Short analysis ID (first 8 chars) */
  analysisId: string;
  /** Total wafers / records */
  totalRecords: number | null;
  /** Yield percentage 0–100 */
  yieldPct: number | null;
  /** Fail rate percentage 0–100 */
  failRate: number | null;
  /** Top parameters from root-cause analysis, ranked by evidence score */
  topParameters: {
    label: string;
    evidenceScore: number;
    correlation: number;
    deviation: string;
    rank: number;
    affectedRecords: number | null;
    failureRate: number | null;
  }[];
  /** Previous analysis for comparison (optional) */
  previousAnalysis?: {
    datasetName: string;
    yieldPct: number | null;
    failRate: number | null;
    topParameters: string[];
  } | null;
}

function buildSystemPrompt(): string {
  return `You are a semiconductor manufacturing quality engineer AI assistant embedded in the YieldSentinel yield analysis platform.

CRITICAL RULES — NEVER VIOLATE THESE:
1. You must ONLY use the structured data provided in the user message.
2. Do NOT invent or assume equipment names, equipment IDs, lot IDs, or sensor physical meaning.
3. Do NOT invent expected yield improvement percentages or numerical impact.
4. Do NOT claim you know the root cause — only say these are parameters associated with predicted failures.
5. Do NOT convert feature importance, correlation, or evidence score into AI confidence or failure probability.
6. Do NOT use phrases like "AI Confidence: X%" or "Probability of failure X%".
7. Only say "Equipment: Unavailable" — never invent an equipment name.
8. Only say "Expected Impact: Not estimated" — never invent an impact number.
9. You can suggest investigation steps, monitoring steps, and validation steps based solely on the parameter names and their statistical evidence.
10. Keep each action recommendation concise (2-4 sentences max).
11. If a previous analysis is provided, compare only based on the actual evidence scores — say "risk reduced", "persisted", "new risk", or "regressed" without inventing percentages.

OUTPUT FORMAT (JSON only, no markdown fences, no prose outside the JSON):
{
  "actions": [
    {
      "recommendedAction": "string — concise action title",
      "investigationSteps": ["step1", "step2"],
      "monitoringSteps": ["step1"],
      "validationSteps": ["step1"],
      "comparisonNote": "string or null — only if previous analysis data was provided and the parameter appeared in it"
    }
  ],
  "overallNote": "string — 1-2 sentence summary based only on data provided, no inventions"
}`;
}

function buildUserMessage(payload: CorrectiveAIRequest): string {
  const lines: string[] = [
    `=== ANALYSIS DATA (use this only — do not invent) ===`,
    `Dataset: ${payload.datasetName}`,
    `Analysis ID: ${payload.analysisId}`,
    `Total Records: ${payload.totalRecords ?? "unavailable"}`,
    `Yield: ${payload.yieldPct != null ? payload.yieldPct.toFixed(1) + "%" : "unavailable"}`,
    `Fail Rate: ${payload.failRate != null ? payload.failRate.toFixed(1) + "%" : "unavailable"}`,
    ``,
    `Top Parameters (ranked by evidence score — association with predicted failures):`,
  ];

  for (const p of payload.topParameters) {
    lines.push(
      `  Rank #${p.rank}: ${p.label}`,
      `    Evidence Score: ${Math.round(p.evidenceScore)}/100`,
      `    Pearson |r| with failure: ${p.correlation.toFixed(4)}`,
      `    Deviation from population: ${p.deviation}`,
      `    Affected Records: ${p.affectedRecords != null ? p.affectedRecords : "unknown"}`,
      `    Failure Rate in affected: ${p.failureRate != null ? p.failureRate.toFixed(1) + "%" : "unknown"}`,
    );
  }

  if (payload.previousAnalysis) {
    lines.push(
      ``,
      `=== PREVIOUS ANALYSIS (for comparison only — do not invent improvements) ===`,
      `Previous Dataset: ${payload.previousAnalysis.datasetName}`,
      `Previous Yield: ${payload.previousAnalysis.yieldPct != null ? payload.previousAnalysis.yieldPct.toFixed(1) + "%" : "unavailable"}`,
      `Previous Fail Rate: ${payload.previousAnalysis.failRate != null ? payload.previousAnalysis.failRate.toFixed(1) + "%" : "unavailable"}`,
      `Previous Top Parameters: ${payload.previousAnalysis.topParameters.join(", ") || "none"}`,
    );
  }

  lines.push(``, `=== END DATA ===`);
  lines.push(``, `Generate corrective action recommendations for each top parameter. Follow the system rules strictly.`);

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service unavailable." }, { status: 503 });
  }

  let payload: CorrectiveAIRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!payload.topParameters || payload.topParameters.length === 0) {
    return NextResponse.json({ error: "No parameters provided." }, { status: 400 });
  }

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserMessage(payload) },
  ];

  const rawModel = (process.env.OPENROUTER_MODEL ?? FALLBACK_MODELS[0]).trim();
  const safeModel = /\/.+/.test(rawModel) ? rawModel : FALLBACK_MODELS[0];
  const modelsToTry = [safeModel, ...FALLBACK_MODELS.filter(m => m !== safeModel)];

  for (const model of modelsToTry) {
    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://yieldsentinel.ai",
          "X-Title": "YieldSentinel Corrective Actions",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1200,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      if (!content) continue;

      // Strip potential markdown fences
      const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      try {
        const parsed = JSON.parse(clean);
        return NextResponse.json(parsed);
      } catch {
        // Return raw text as a fallback note
        return NextResponse.json({ actions: [], overallNote: clean });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "AI service unavailable after retries." }, { status: 502 });
}
