import { NextRequest, NextResponse } from "next/server";
import { OPENROUTER_KEY } from "@/lib/ai-provider";
import {
  generateTaxonomyContext,
  findNode,
  isValidLabelId,
  FLATTENED_CATEGORIES,
  TAXONOMY_VERSION,
  CASECOMPASS_METADATA,
} from "@/lib/casecompass";

interface ClassificationResult {
  // Primary classification
  tier1: { label_id: string; name: string; abbreviation?: string } | null;
  tier2: { label_id: string; name: string } | null;
  tier3: { label_id: string; name: string } | null;
  tier4: { label_id: string; name: string; description?: string } | null;

  // Full path display
  categoryPath: string;
  categoryIds: string[];

  // AI analysis
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  relatedAgency: string;
  estimatedTimeline: string;

  // CaseCompass metadata
  caseCompassVersion: string;
  taxonomySource: string;
}

// Generate taxonomy context once at startup
const TAXONOMY_CONTEXT = generateTaxonomyContext();

const SYSTEM_PROMPT = `You are an expert congressional casework classifier using the official House Digital Service CaseCompass taxonomy v${TAXONOMY_VERSION}.

Your job is to analyze constituent casework requests and classify them using ONLY the exact label_ids from the official taxonomy.

${TAXONOMY_CONTEXT}

## CRITICAL CLASSIFICATION RULES

1. **ONLY use label_ids that appear in the taxonomy above** - Do NOT make up or guess IDs
2. **If a label_id doesn't exist, use null** - Better to leave a tier empty than use an invalid ID
3. **Classify to the most specific tier possible** - Use Tier 4 if a match exists
4. **Start with Tier 1 (agency) and work down** - Each tier must be a child of the previous
5. **Validate the hierarchy** - tier2 must be under tier1, tier3 under tier2, etc.

## RESPONSE FORMAT

Return ONLY valid JSON with these exact fields. Use ONLY label_ids from the taxonomy above:
{
  "tier1_id": "exact_label_id_from_taxonomy or null",
  "tier2_id": "exact_label_id_from_taxonomy or null",
  "tier3_id": "exact_label_id_from_taxonomy or null",
  "tier4_id": "exact_label_id_from_taxonomy or null",
  "confidence": 0-100,
  "reasoning": "Brief explanation referencing the specific taxonomy categories chosen",
  "suggestedActions": ["Action 1", "Action 2", "Action 3"],
  "estimatedTimeline": "X-Y weeks for agency response"
}

REMEMBER: Only use label_ids exactly as they appear in the taxonomy. If you're unsure, use a broader category or null.`;

export async function POST(request: NextRequest) {
  try {
    const { subject, description, constituentName } = await request.json();

    if (!subject && !description) {
      return NextResponse.json(
        { error: "Subject or description required" },
        { status: 400 }
      );
    }

    const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const useOpenRouter = !!OPENROUTER_KEY;
    const baseURL = useOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (useOpenRouter) {
      headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
      headers["X-Title"] = "Actalyze Casework Classifier";
    }

    const userMessage = `Classify this constituent casework request using the CaseCompass taxonomy:

Subject: ${subject || "Not provided"}
Description: ${description || "Not provided"}
${constituentName ? `Constituent: ${constituentName}` : ""}

IMPORTANT: Only use label_ids that exist in the taxonomy. Respond with JSON only.`;

    console.log(`📋 Classifying casework: "${subject}"`);

    const response = await fetch(baseURL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? "anthropic/claude-3.5-sonnet" : "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1, // Lower temperature for more consistent classification
        max_tokens: 1000,
        ...(useOpenRouter ? {} : { response_format: { type: "json_object" } }),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return NextResponse.json(
        { error: "Classification failed" },
        { status: 500 }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";

    // Clean markdown if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { error: "Invalid classification response" },
        { status: 500 }
      );
    }

    // Validate and find nodes - only use valid label_ids
    const tier1_id = parsed.tier1_id && isValidLabelId(parsed.tier1_id) ? parsed.tier1_id : null;
    const tier2_id = parsed.tier2_id && isValidLabelId(parsed.tier2_id) ? parsed.tier2_id : null;
    const tier3_id = parsed.tier3_id && isValidLabelId(parsed.tier3_id) ? parsed.tier3_id : null;
    const tier4_id = parsed.tier4_id && isValidLabelId(parsed.tier4_id) ? parsed.tier4_id : null;

    // Log if AI returned invalid IDs
    if (parsed.tier1_id && !tier1_id) console.warn(`⚠️ Invalid tier1_id: ${parsed.tier1_id}`);
    if (parsed.tier2_id && !tier2_id) console.warn(`⚠️ Invalid tier2_id: ${parsed.tier2_id}`);
    if (parsed.tier3_id && !tier3_id) console.warn(`⚠️ Invalid tier3_id: ${parsed.tier3_id}`);
    if (parsed.tier4_id && !tier4_id) console.warn(`⚠️ Invalid tier4_id: ${parsed.tier4_id}`);

    const tier1 = tier1_id ? findNode(tier1_id) : null;
    const tier2 = tier2_id ? findNode(tier2_id) : null;
    const tier3 = tier3_id ? findNode(tier3_id) : null;
    const tier4 = tier4_id ? findNode(tier4_id) : null;

    // Build category path
    const pathParts: string[] = [];
    const pathIds: string[] = [];

    if (tier1) {
      pathParts.push(tier1.abbreviation || tier1.name);
      pathIds.push(tier1.label_id);
    }
    if (tier2) {
      pathParts.push(tier2.name);
      pathIds.push(tier2.label_id);
    }
    if (tier3) {
      pathParts.push(tier3.name);
      pathIds.push(tier3.label_id);
    }
    if (tier4) {
      pathParts.push(tier4.name);
      pathIds.push(tier4.label_id);
    }

    // Determine related agency for display
    const relatedAgency = tier1?.name || "Federal Agency";

    const result: ClassificationResult = {
      tier1: tier1 ? { label_id: tier1.label_id, name: tier1.name, abbreviation: tier1.abbreviation } : null,
      tier2: tier2 ? { label_id: tier2.label_id, name: tier2.name } : null,
      tier3: tier3 ? { label_id: tier3.label_id, name: tier3.name } : null,
      tier4: tier4 ? { label_id: tier4.label_id, name: tier4.name, description: tier4.description } : null,
      categoryPath: pathParts.join(" > "),
      categoryIds: pathIds,
      confidence: parsed.confidence || 75,
      reasoning: parsed.reasoning || "Classification based on subject matter analysis.",
      suggestedActions: parsed.suggestedActions || [
        "Obtain signed privacy release form",
        "Submit congressional inquiry to agency",
        "Set follow-up reminder",
      ],
      relatedAgency,
      estimatedTimeline: parsed.estimatedTimeline || "2-4 weeks for agency response",
      caseCompassVersion: TAXONOMY_VERSION,
      taxonomySource: CASECOMPASS_METADATA.publisher,
    };

    console.log(`✅ Classified: ${result.categoryPath} (${result.confidence}% confidence)`);
    console.log(`   Label IDs: ${pathIds.join(" > ")}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Casework classification error:", error);
    return NextResponse.json(
      { error: "Classification failed" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve available categories
 */
export async function GET() {
  return NextResponse.json({
    categories: FLATTENED_CATEGORIES,
    version: TAXONOMY_VERSION,
    source: CASECOMPASS_METADATA.publisher,
    url: "https://github.com/usgpo/innovation/blob/master/resources/CaseCompass/CaseCompassTaxonomy.json",
  });
}
