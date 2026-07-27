import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { OPENROUTER_KEY } from "@/lib/ai-provider";

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

    const apiKey = OPENROUTER_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ API key not set, returning placeholder');
      return NextResponse.json({
        issues: [] as string[]
      });
    }

    const useOpenRouter = !!OPENROUTER_KEY;
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

    // Ground the answer in real current coverage. Asking the model what is
    // happening "right now" only works when it can search the web; on plain
    // OpenAI it answers from training data, which is how a 2026 page ended up
    // listing a "2024 gubernatorial election" as a live issue. Pull the real
    // headlines this app already retrieves and let the model only summarise
    // those.
    let headlineContext = '';
    try {
      // Resolve against this request's own origin rather than NEXT_PUBLIC_URL,
      // which can be stale or point at a different deployment.
      const newsUrl = new URL(`/api/state/news?state=${stateCode}`, request.nextUrl.origin);
      const newsRes = await fetch(newsUrl, { signal: AbortSignal.timeout(20000) });
      if (newsRes.ok) {
        const news = await newsRes.json();
        const titles = (news?.headlines ?? [])
          .map((h: { title?: string }) => h?.title)
          .filter(Boolean)
          .slice(0, 8);
        if (titles.length) {
          headlineContext = titles.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n');
        }
      }
    } catch {
      // Fall through - handled below.
    }

    // With no real coverage to work from, say nothing rather than inventing
    // plausible-sounding issues.
    if (!headlineContext) {
      console.warn(`⚠️ No headlines available for ${stateName}; returning empty issues`);
      return NextResponse.json({ issues: [] });
    }

    const response = await fetch(baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? 'perplexity/sonar-pro' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Here are current news headlines from ${stateName}:

${headlineContext}

Summarise the 3-4 political issues these headlines are about. Use ONLY what the headlines above support - do not add issues from your own knowledge, and do not mention any election year unless a headline does. Return ONLY a JSON array of strings, each a concise issue (max 10 words). Example: ["Healthcare reform debate", "Governor's budget proposal"]`,
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.error(`State news API error: ${response.status}`);
      return NextResponse.json({
        issues: [] as string[]
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({
        issues: [] as string[]
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
      issues: [] as string[]
    });
  }
}
