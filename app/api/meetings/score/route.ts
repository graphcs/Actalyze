import { NextRequest, NextResponse } from "next/server";
import { chatCompletions } from "@/lib/ai-provider";

/**
 * POST /api/meetings/score
 *
 * Scores a constituent meeting request for staff triage. This exists because the
 * meetings page previously assigned `Math.random()` as the "AI score" for any
 * request submitted in the UI — a number with no analysis behind it, shown next
 * to AI reasoning text. This route does the analysis for real.
 *
 * Returns { score, recommendation, reasoning }. On any failure it returns
 * `analyzed: false` with no score, so the caller can show "pending analysis"
 * rather than a fabricated figure.
 */

interface ScoreRequest {
  constituentName?: string;
  organization?: string;
  topic?: string;
  description?: string;
  location?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScoreRequest;
    const { topic, description, organization, location } = body;

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const ai = chatCompletions();
    if (!ai) {
      return NextResponse.json({ analyzed: false, reason: "No LLM provider configured" });
    }

    const prompt = `You are a congressional scheduler triaging constituent meeting requests for a Member of Congress.

Request:
- Topic: ${topic}
- Description: ${description || "(none provided)"}
- Organization: ${organization || "(individual constituent)"}
- Requested location: ${location || "(unspecified)"}

Score this request 0-100 for how strongly it warrants the Member's personal time, weighing:
- relevance to the Member's constituents and district
- how many people the outcome affects
- whether staff could handle it just as well
- urgency and any time sensitivity

Respond with ONLY a JSON object, no markdown fence:
{"score": <0-100 integer>, "recommendation": "meet" | "delegate" | "decline", "reasoning": "<two sentences max, specific to this request>"}`;

    const res = await fetch(ai.url, {
      method: "POST",
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      console.error(`❌ Meeting scoring failed: ${res.status}`);
      return NextResponse.json({ analyzed: false, reason: `Provider returned ${res.status}` });
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";

    // Models occasionally wrap JSON in a markdown fence despite instructions.
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: { score?: number; recommendation?: string; reasoning?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("❌ Meeting scoring returned unparseable JSON");
      return NextResponse.json({ analyzed: false, reason: "Unparseable response" });
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
    if (!Number.isFinite(score)) {
      return NextResponse.json({ analyzed: false, reason: "No score returned" });
    }

    const recommendation =
      parsed.recommendation === "meet" ||
      parsed.recommendation === "delegate" ||
      parsed.recommendation === "decline"
        ? parsed.recommendation
        : score >= 70
          ? "meet"
          : score >= 40
            ? "delegate"
            : "decline";

    return NextResponse.json({
      analyzed: true,
      score,
      recommendation,
      reasoning: parsed.reasoning?.trim() || "No reasoning returned.",
    });
  } catch (error) {
    console.error("❌ Meeting scoring error:", error);
    return NextResponse.json({ analyzed: false, reason: "Scoring failed" });
  }
}
