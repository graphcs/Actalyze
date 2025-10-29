import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

// Map of state codes to full names
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
 * GET /api/map/state-news?state=VA
 * Returns top political issues for a state using OpenRouter/Sonar
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
    const cacheKey = generateCacheKey('state-news', { state: stateCode });
    const cached = serverCache.get<{ issues: string[] }>(cacheKey, useCache);

    if (cached) {
      return NextResponse.json(cached);
    }

    console.log(`📰 Fetching top issues for ${stateName} (${stateCode})`);

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ API key not set, returning placeholder');
      return NextResponse.json({
        issues: [
          "State legislative session updates",
          "Local election news",
          "Policy developments"
        ]
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
            content: `What are the top 3-4 political issues or news stories in ${stateName} right now? Focus on state politics, legislation, elections, and major policy debates. Return ONLY a JSON array of strings, each being a concise issue/headline (max 10 words each). Example: ["Healthcare reform debate", "Governor's budget proposal", "Education funding bill"]`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`State news API error: ${response.status}`);
      return NextResponse.json({
        issues: [
          "Recent legislative updates",
          "State policy developments",
          "Political news"
        ]
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({
        issues: [
          "State government updates",
          "Policy news",
          "Legislative developments"
        ]
      });
    }

    // Parse JSON response
    const issues = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    if (!Array.isArray(issues)) {
      throw new Error('Invalid response format');
    }

    console.log(`✅ Got ${issues.length} issues for ${stateName}`);

    const result = {
      issues: issues.slice(0, 4)
    };

    // Save to cache
    serverCache.set(cacheKey, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching state news:', error);
    return NextResponse.json({
      issues: [
        "State political updates",
        "Legislative news",
        "Policy developments"
      ]
    });
  }
}
