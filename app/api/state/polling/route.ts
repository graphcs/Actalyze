import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

const STATE_NAMES: Record<string, string> = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
  "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
  "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
  "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
  "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
  "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
  "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
  "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
  "DC": "District of Columbia"
};

/**
 * GET /api/state/polling?state=VA
 * Returns recent polling data for a state using Sonar
 * Supports caching via x-use-cache header
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stateCode = searchParams.get('state')?.toUpperCase();

    if (!stateCode || !STATE_NAMES[stateCode]) {
      return NextResponse.json(
        { error: 'Invalid state code' },
        { status: 400 }
      );
    }

    const stateName = STATE_NAMES[stateCode];

    // Check cache
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheKey = generateCacheKey('state-polling', { state: stateCode });
    const cached = serverCache.get<{ trend: string | null; description: string }>(cacheKey, useCache);

    if (cached) {
      return NextResponse.json(cached);
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        trend: null,
        description: "Polling data unavailable"
      });
    }

    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const baseURL = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (useOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Actalyze';
    }

    const response = await fetch(baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? 'perplexity/sonar-pro' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `What are the latest 2026 or 2028 election polls for ${stateName}? If available, provide the most recent polling average or trend (e.g., "D+5", "R+3", "Tied", "Toss-up"). Return ONLY a JSON object with "trend" (the margin like "D+5" or "Toss-up") and "description" (one sentence about recent polls). If no recent polls, use general political leaning. Example: {"trend": "D+5", "description": "Recent polls show Democrats leading by 5 points"}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({
        trend: null,
        description: "Recent polling data unavailable"
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({
        trend: null,
        description: "Polling trends unavailable"
      });
    }

    const pollingData = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    const result = {
      trend: pollingData.trend || null,
      description: pollingData.description || "Recent polling data unavailable"
    };

    // Save to cache
    serverCache.set(cacheKey, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching polling data:', error);
    return NextResponse.json({
      trend: null,
      description: "Polling information unavailable"
    });
  }
}
