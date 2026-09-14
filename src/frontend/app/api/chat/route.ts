import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "You are YieldSentinel Assistant, a helpful AI assistant inside the YieldSentinel AI semiconductor yield analysis platform. " +
  "Answer user questions clearly and accurately. You can explain semiconductor manufacturing, wafer yield, defects, sensors, " +
  "machine learning concepts, and how to understand the application's results. Keep answers concise and easy to understand. " +
  "Do not invent prediction results or claim to have access to data unless it is explicitly provided in the conversation. " +
  "If a user asks about a specific prediction or dataset that is not available to you, explain that you need the relevant result/data. " +
  "For general questions, answer normally.";

// Keep only the most recent N message pairs to avoid large payloads
const MAX_HISTORY_MESSAGES = 10;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[chat] OPENROUTER_API_KEY is not set");
    return NextResponse.json(
      { error: "AI assistant is temporarily unavailable." },
      { status: 503 }
    );
  }

  let body: { message?: string; history?: { role: string; content: string }[] };
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
  // Trim history to last MAX_HISTORY_MESSAGES and sanitise roles/content
  const recentHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const rawModel = (process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free").trim();
  const model = rawModel.replace(/^OPENROUTER_MODEL\s*=/i, "").trim();
  // Accept any model string with a "/" (covers provider/model and provider/model:variant)
  const safeModel = /\/.+/.test(model) ? model : "nvidia/nemotron-3-super-120b-a12b:free";

  // Verified working free-tier fallback models (tested live)
  const FALLBACK_MODELS = ["liquid/lfm-2.5-2.6b:free", "nex-agi/nex-n2.5-mini:free"];

  const buildMessages = () => [
    { role: "system", content: SYSTEM_PROMPT },
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
        max_tokens: 512,
        temperature: 0.6,
      }),
    });
  };

  try {
    let response = await callOpenRouter(safeModel);

    // If the primary model fails (404 model-not-found, 503, 500), retry through verified fallbacks
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
        console.error(`[chat] OpenRouter error message: "${msg}"`);
        if (response.status === 401 || msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("invalid api key")) {
          userError = "AI assistant is temporarily unavailable. (API key issue)";
        } else if (response.status === 429 || msg.toLowerCase().includes("rate limit")) {
          userError = "Too many requests — please wait a moment and try again.";
        } else if (response.status === 402 || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("billing")) {
          userError = "AI assistant is temporarily unavailable. (Account credit issue)";
        }
      } catch { /* not JSON */ }
      return NextResponse.json({ error: userError }, { status: 502 });
    }

    const data = await response.json();
    console.log("[chat] OpenRouter response:", JSON.stringify(data).slice(0, 300));
    const reply: string = data?.choices?.[0]?.message?.content ?? "";
    if (!reply) {
      console.error("[chat] Empty reply from OpenRouter. Full response:", JSON.stringify(data));
      return NextResponse.json(
        { error: "Sorry, I couldn't generate a response. Please try rephrasing your question." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat] Fetch error:", err);
    return NextResponse.json(
      { error: "Unable to reach AI service. Please check your connection and try again." },
      { status: 502 }
    );
  }
}
