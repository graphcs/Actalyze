import { chatCompletions } from "@/lib/ai-provider";
import type { PkIntelResponse } from "./party-intel";

/**
 * Render an already-computed intel payload into Urdu.
 *
 * Classification itself stays in English deliberately. Topic labels are used as
 * aggregation keys — posts are grouped by the string the model returns — so letting
 * each post name the same issue in freely-worded Urdu would fragment "load shedding"
 * across several buckets and undercount all of them. Classify in a stable language,
 * then translate the aggregate once.
 *
 * That also costs one LLM call instead of one per post.
 *
 * Failure is non-fatal: on any error the English payload is returned unchanged, so a
 * translation outage degrades to a mixed-language page rather than an empty one.
 */
export async function localizeIntelToUrdu(intel: PkIntelResponse): Promise<PkIntelResponse> {
  const topics = intel.topics.map((t) => t.name);
  const insights = intel.insights.map((i) => i.text);
  if (topics.length === 0 && insights.length === 0) return intel;

  const ai = chatCompletions();
  if (!ai) return intel;

  const prompt = `Translate these Pakistani political intelligence labels from English into Urdu.

Rules:
- Use the Urdu that Pakistani news media actually uses for these terms, not literal
  translation. "load shedding" is لوڈ شیڈنگ, not a calque.
- Keep party names, constituency codes and acronyms (PML-N, PTI, NA-123, IMF, BISP)
  in Latin script — that is how they appear in Urdu print.
- Topic labels stay short, as labels, not sentences.
- Return the same number of items, in the same order.

Return ONLY JSON: {"topics": [...], "insights": [...]}

topics: ${JSON.stringify(topics)}
insights: ${JSON.stringify(insights)}`;

  try {
    const res = await fetch(ai.url, {
      method: "POST",
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return intel;

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));

    const urTopics: unknown = parsed.topics;
    const urInsights: unknown = parsed.insights;

    // Only substitute when the model returned the same shape; a short or ragged
    // array would silently mislabel the wrong topics.
    const topicsOk = Array.isArray(urTopics) && urTopics.length === topics.length;
    const insightsOk = Array.isArray(urInsights) && urInsights.length === insights.length;

    return {
      ...intel,
      topics: topicsOk
        ? intel.topics.map((t, i) => ({ ...t, name: String(urTopics[i]) || t.name }))
        : intel.topics,
      insights: insightsOk
        ? intel.insights.map((n, i) => ({ ...n, text: String(urInsights[i]) || n.text }))
        : intel.insights,
    };
  } catch {
    return intel;
  }
}
