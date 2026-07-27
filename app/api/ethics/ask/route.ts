import { NextRequest, NextResponse } from "next/server";
import { OPENROUTER_KEY } from "@/lib/ai-provider";

interface EthicsResponse {
  answer: string;
  category: string;
  riskLevel: "low" | "medium" | "high";
  references: string[];
}

// Comprehensive House Ethics Rules context
const ETHICS_RULES_CONTEXT = `
You are an expert on House of Representatives ethics rules. You provide specific, actionable guidance based on official House ethics rules.

## GIFT RULES (House Rule 25, Clause 5)

### General Rule
Members, officers, and employees may NOT accept gifts except as specifically permitted.

### Key Gift Limits
- **$50 rule**: May accept gifts worth less than $50 from any single source on a single occasion, EXCEPT from lobbyists
- **$100 annual limit**: Cannot accept more than $100 total in gifts from any single source in a calendar year
- **ZERO tolerance for lobbyist gifts**: Cannot accept ANY gifts from registered lobbyists or agents of foreign principals, regardless of value

### Permitted Exceptions (no dollar limit)
1. **Personal hospitality**: Food, lodging at someone's home (not a lobbyist's)
2. **Relatives and friends**: Gifts based on personal relationship, not official position
3. **Widely attended events**: Free attendance if pre-approved and value does not exceed $480
4. **Informational materials**: Books, reports, periodicals
5. **Items of little value**: Plaques, certificates, trophies
6. **Food and refreshments**: In another's home (not lobbyist); at widely attended events

### Prohibited Actions
- Cannot solicit gifts for yourself or others
- Cannot accept gifts offered in exchange for official action
- Cannot accept cash or cash equivalents

## TRAVEL RULES

### Officially-Connected Travel (paid by private sources)
- **Pre-approval required**: Must get Committee approval BEFORE travel for trips over 1 day
- **Domestic trips**: Maximum 4 days (3 nights)
- **International trips**: Maximum 7 days (6 nights)
- **Flight class**: Coach class for flights under 7 hours
- **Disclosure**: Must file public disclosure within 15 days of return

### Prohibited Travel Sponsors
- Cannot accept travel paid by registered lobbyists or lobbying firms
- Cannot accept travel from entities that employ or retain lobbyists if lobbyists participate in organizing

### What's Covered
- Transportation, lodging, meals during the event
- One night before and one night after the event

## CAMPAIGN ACTIVITY RULES

### Prohibited Uses of Official Resources
- Cannot use official time, staff, office space, equipment, or supplies for campaign purposes
- Cannot send campaign communications on official letterhead
- Cannot use official email or phones for campaign work
- Cannot have staff do campaign work during official hours

### Permitted Activities
- Staff may volunteer for campaigns on their OWN time
- May discuss campaign matters in personal conversations
- May have campaign and official events on same trip (pay appropriately)

## FINANCIAL DISCLOSURE

### Who Must File
- Members of Congress
- Officers of the House
- Employees earning above certain threshold
- Candidates for Congress

### What's Disclosed
- Income sources and amounts
- Assets and liabilities
- Transactions
- Gifts and travel reimbursements above thresholds
- Positions held

## OUTSIDE EMPLOYMENT

### Restrictions for Staff
- Cannot receive compensation for fiduciary relationships
- Cannot be compensated for practicing a profession involving fiduciary relationship (law, real estate, insurance, etc.)
- Cannot receive compensation for affiliating with firms providing professional services involving fiduciary relationship

### Teaching Exception
- Teaching is generally permitted with Committee approval
- Compensation cannot exceed $29,895 annually for senior staff

## KEY CONTACTS
- House Committee on Ethics: (202) 225-7103
- Website: ethics.house.gov
- Email: ethicscommittee@mail.house.gov
`;

const SYSTEM_PROMPT = `${ETHICS_RULES_CONTEXT}

## YOUR RESPONSE GUIDELINES

1. **Be Specific**: Give concrete yes/no answers when possible, citing specific rules and dollar amounts
2. **Cite Rules**: Reference specific House Rules, clauses, and manual sections
3. **Explain Why**: Briefly explain the reasoning behind the rule
4. **Provide Alternatives**: If something is prohibited, suggest compliant alternatives
5. **Flag Risks**: Clearly identify if the scenario is high risk

## RESPONSE FORMAT

Structure your response with clear sections using markdown:
- Start with a **direct answer** (Yes/No/It depends)
- **Key Rules** that apply
- **Specific Requirements** if applicable
- **Alternatives** if the action is prohibited
- Keep it concise but complete

DO NOT give generic "consult the committee" answers for questions that have clear rules. Only suggest consultation for truly complex or fact-specific scenarios.`;

function determineCategory(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("gift") || q.includes("accept") || q.includes("dinner") || q.includes("ticket")) {
    return "Gifts";
  }
  if (q.includes("travel") || q.includes("trip") || q.includes("flight") || q.includes("hotel")) {
    return "Travel";
  }
  if (q.includes("campaign") || q.includes("election") || q.includes("political") || q.includes("volunteer")) {
    return "Campaign Activity";
  }
  if (q.includes("disclosure") || q.includes("report") || q.includes("file") || q.includes("asset")) {
    return "Financial Disclosure";
  }
  if (q.includes("employ") || q.includes("job") || q.includes("work") || q.includes("outside") || q.includes("teach")) {
    return "Outside Employment";
  }
  if (q.includes("frank") || q.includes("mail") || q.includes("communication")) {
    return "Franking";
  }
  return "General Ethics";
}

function determineRiskLevel(question: string, answer: string): "low" | "medium" | "high" {
  const combined = (question + " " + answer).toLowerCase();

  // High risk indicators
  if (
    combined.includes("lobbyist") ||
    combined.includes("prohibited") ||
    combined.includes("cannot accept") ||
    combined.includes("violation") ||
    combined.includes("no, you") ||
    combined.includes("not permitted") ||
    combined.includes("campaign") && combined.includes("official")
  ) {
    return "high";
  }

  // Low risk indicators
  if (
    combined.includes("yes, you may") ||
    combined.includes("permitted") ||
    combined.includes("allowed") ||
    combined.includes("exception applies") ||
    combined.includes("under $50")
  ) {
    return "low";
  }

  return "medium";
}

function extractReferences(answer: string): string[] {
  const refs: string[] = [];

  if (answer.includes("Rule 25") || answer.includes("Gift Rule")) {
    refs.push("House Rule 25 (Gifts)");
  }
  if (answer.includes("Rule 23")) {
    refs.push("House Rule 23 (Code of Conduct)");
  }
  if (answer.includes("Rule 24")) {
    refs.push("House Rule 24 (Limitations on Outside Employment)");
  }
  if (answer.includes("Ethics Manual")) {
    refs.push("House Ethics Manual");
  }
  if (answer.includes("travel") || answer.includes("Travel")) {
    refs.push("Travel Regulations (House Rule 25, Clause 5)");
  }
  if (answer.includes("disclosure") || answer.includes("EIGA")) {
    refs.push("Ethics in Government Act");
  }
  if (answer.includes("campaign") || answer.includes("official resources")) {
    refs.push("31 U.S.C. 1301(a) (Misappropriation)");
  }

  // Always include manual and committee reference
  if (refs.length === 0) {
    refs.push("House Ethics Manual");
  }
  refs.push("Committee on Ethics Advisory Opinions");
  refs.push("ethics.house.gov");

  return [...new Set(refs)]; // Remove duplicates
}

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
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
      headers["X-Title"] = "Actalyze Ethics Copilot";
    }

    console.log(`🏛️ Ethics question: "${question}"`);

    const response = await fetch(baseURL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? "anthropic/claude-3.5-sonnet" : "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        temperature: 0.3, // Lower temperature for more factual responses
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`AI API error: ${response.status}`);
      return NextResponse.json(
        { error: "Failed to get AI response" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Unable to generate response.";

    const category = determineCategory(question);
    const riskLevel = determineRiskLevel(question, answer);
    const references = extractReferences(answer);

    const result: EthicsResponse = {
      answer,
      category,
      riskLevel,
      references,
    };

    console.log(`✅ Ethics response generated (${category}, ${riskLevel} risk)`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ethics API error:", error);
    return NextResponse.json(
      { error: "Failed to process ethics question" },
      { status: 500 }
    );
  }
}
