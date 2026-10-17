import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AGENT_NAMES = [
  "Transportation Planning",
  "Financial Analysis",
  "Environmental Assessment",
  "Utilities & Dependencies",
  "Risk Analysis",
];

/**
 * Server-side Gemini integration.
 * The API key lives ONLY here on the server (process.env.GEMINI_API_KEY).
 * If no key is configured, returns 503 so the client can switch to the
 * clearly-labeled deterministic demo analysis instead.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return NextResponse.json(
      { configured: false, error: "GEMINI_API_KEY is not configured on the server. Use demo analysis mode." },
      { status: 503 },
    );
  }

  let payload: {
    projectName?: string; infraType?: string; region?: string;
    budgetCrore?: number; requirements?: string; objectives?: string[];
    sustainabilityPriorities?: string[];
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ configured: true, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload.requirements || typeof payload.requirements !== "string") {
    return NextResponse.json({ configured: true, error: "requirements is required" }, { status: 400 });
  }

  const prompt = `You are an infrastructure planning analyst. Produce a structured planning analysis as STRICT JSON (no markdown, no code fences) matching exactly this TypeScript shape:
{
  "executiveSummary": string (3-4 sentences),
  "agents": [ for each of these five agents, exactly in this order: ${AGENT_NAMES.join(", ")}: { "agent": string (the exact agent name), "summary": string, "findings": string[] (3 items), "metrics": [{"label": string, "value": string}] (3 items) } ],
  "recommendations": [{"title": string, "rationale": string that explicitly explains WHY}] (3 items),
  "costs": [{"label": string, "valueCrore": number, "note": string}] (4-6 items),
  "deliveryConsiderations": string[] (4 items),
  "environmentalConstraints": string[] (4 items),
  "dependencies": [{"item": string, "criticality": "Low"|"Moderate"|"High"|"Critical", "note": string}] (4 items),
  "risks": [{"risk": string, "severity": "Low"|"Moderate"|"High"|"Critical", "mitigation": string}] (4 items),
  "confidence": {"score": number 0-100, "explanation": string},
  "assumptions": string[] (4 items),
  "evidence": [{"label": string, "kind": "Illustrative"|"Internal analysis"}] (3 items)
}

Project: ${payload.projectName ?? "Unspecified"} (${payload.infraType ?? "infrastructure"}) in ${payload.region ?? "unspecified region"}.
Capital envelope: ₹${payload.budgetCrore ?? "unknown"} crore.
Objectives: ${(payload.objectives ?? []).join("; ") || "not specified"}.
Sustainability priorities: ${(payload.sustainabilityPriorities ?? []).join("; ") || "not specified"}.
Requirements brief: ${payload.requirements}

Costs must be denominated in ₹ crore and roughly consistent with the envelope. Answer with JSON only.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      },
    );
    clearTimeout(timer);

    if (res.status === 429) {
      return NextResponse.json(
        { configured: true, error: "Gemini rate limit reached. Wait a moment and retry, or use demo analysis mode." },
        { status: 429 },
      );
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json(
        { configured: true, error: `Gemini request failed (${res.status}). ${txt.slice(0, 160)}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!text) {
      return NextResponse.json({ configured: true, error: "Gemini returned an empty response." }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim());
    } catch {
      return NextResponse.json({ configured: true, error: "Gemini response was not valid JSON." }, { status: 502 });
    }

    const validation = validateAnalysisShape(parsed);
    if (validation) {
      return NextResponse.json(
        { configured: true, error: `Gemini response failed structure validation: ${validation}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ analysis: parsed });
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { configured: true, error: isAbort ? "Gemini request timed out after 30s." : `Gemini request error: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 502 },
    );
  }
}

/** Structural validation of the model output. Returns null if valid, else a reason. */
function validateAnalysisShape(a: unknown): string | null {
  if (typeof a !== "object" || a === null) return "not an object";
  const o = a as Record<string, unknown>;
  if (typeof o.executiveSummary !== "string" || o.executiveSummary.length < 40) return "executiveSummary invalid";
  if (!Array.isArray(o.agents) || o.agents.length !== 5) return "agents must contain 5 entries";
  for (const name of AGENT_NAMES) {
    if (!(o.agents as { agent?: string }[]).some((ag) => ag.agent === name)) return `missing agent: ${name}`;
  }
  if (!Array.isArray(o.recommendations) || o.recommendations.length < 2) return "recommendations invalid";
  if (!Array.isArray(o.costs) || !o.costs.every((c) => typeof (c as { valueCrore?: unknown }).valueCrore === "number"))
    return "costs invalid";
  if (!Array.isArray(o.risks) || !Array.isArray(o.assumptions)) return "risks/assumptions invalid";
  if (typeof (o.confidence as { score?: unknown })?.score !== "number") return "confidence.score invalid";
  return null;
}
