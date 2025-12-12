import { NextRequest, NextResponse } from "next/server";
import {
  generateTaxonomyContext,
  findNode,
  getCategoryPath,
  FLATTENED_CATEGORIES,
  type FlattenedCategory,
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

const TAXONOMY_CONTEXT = generateTaxonomyContext();

const SYSTEM_PROMPT = `You are an expert congressional casework classifier using the official House Digital Service CaseCompass taxonomy.
Your job is to analyze constituent casework requests and classify them according to the standardized taxonomy.

${TAXONOMY_CONTEXT}

## CLASSIFICATION RULES

1. **Always classify to the most specific tier possible** - If a case clearly matches a Tier 4 category, use it
2. **Use the label_id codes exactly** - These are the official CaseCompass identifiers
3. **Consider agency first** - Start with the Tier 1 agency, then narrow down
4. **When uncertain, choose the broader category** - Better to be accurate at Tier 3 than wrong at Tier 4

## COMMON CASEWORK PATTERNS

- Visa delays, green cards, citizenship → DHS > USCIS
- Passport issues → DOS > Passport Services
- VA disability, benefits → VA > VBA
- Social Security, Medicare → SSA
- Tax refunds, identity theft → IRS
- Student loans, PSLF → ED > FSA
- Small business loans, EIDL → SBA
- Housing discrimination → HUD > FHEO
- Military records, discharge → DOD > Military Personnel

## RESPONSE FORMAT

Return ONLY valid JSON with these exact fields:
{
  "tier1_id": "AGENCY_ID or null",
  "tier2_id": "SUB_AGENCY_ID or null",
  "tier3_id": "CATEGORY_ID or null",
  "tier4_id": "SPECIFIC_ID or null",
  "confidence": 0-100,
  "reasoning": "Brief explanation of classification",
  "suggestedActions": ["Action 1", "Action 2", "Action 3"],
  "estimatedTimeline": "X-Y weeks for agency response"
}`;

export async function POST(request: NextRequest) {
  try {
    const { subject, description, constituentName } = await request.json();

    if (!subject && !description) {
      return NextResponse.json(
        { error: "Subject or description required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
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

    const userMessage = `Classify this constituent casework request:

Subject: ${subject || "Not provided"}
Description: ${description || "Not provided"}
${constituentName ? `Constituent: ${constituentName}` : ""}

Respond with JSON classification using CaseCompass taxonomy.`;

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
        temperature: 0.2,
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

    // Build the classification result
    const tier1 = parsed.tier1_id ? findNode(parsed.tier1_id) : null;
    const tier2 = parsed.tier2_id ? findNode(parsed.tier2_id) : null;
    const tier3 = parsed.tier3_id ? findNode(parsed.tier3_id) : null;
    const tier4 = parsed.tier4_id ? findNode(parsed.tier4_id) : null;

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
      caseCompassVersion: "1.0.2",
      taxonomySource: "House Digital Service",
    };

    console.log(`✅ Classified: ${result.categoryPath} (${result.confidence}% confidence)`);

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
    version: "1.0.2",
    source: "House Digital Service CaseCompass Taxonomy",
    url: "https://github.com/usgpo/innovation/blob/master/resources/CaseCompass/CaseCompassTaxonomy.json",
  });
}
