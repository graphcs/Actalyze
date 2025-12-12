import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";

/**
 * Check if the AI response is unhelpful (e.g., "I cannot provide an answer")
 */
function isUnhelpfulResponse(text: string): boolean {
  const unhelpfulPatterns = [
    /cannot (provide|give|offer|find)/i,
    /unable to (provide|give|find|locate)/i,
    /don't have (enough |sufficient |any )?(information|data|access)/i,
    /no (specific |relevant |recent )?(information|data|news)/i,
    /couldn't find/i,
    /not able to/i,
    /i (don't|do not) have/i,
    /i('m| am) (not able|unable)/i,
    /unfortunately.*(cannot|unable|don't have)/i,
  ];
  return unhelpfulPatterns.some(pattern => pattern.test(text));
}

/**
 * GET /api/district/summary?district=VA05
 * Returns a Sonar-generated summary of top issues in a congressional district
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const districtCode = searchParams.get('district')?.toUpperCase();

    if (!districtCode) {
      return NextResponse.json(
        { error: 'Missing district parameter' },
        { status: 400 }
      );
    }

    // Parse district code (e.g., "VA05" -> state: "VA", district: "05")
    const match = districtCode.match(/^([A-Z]{2})(\d{2})$/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid district code format' },
        { status: 400 }
      );
    }

    const [, stateCode, districtNum] = match;
    const districtLabel = `${stateCode}-${parseInt(districtNum)}`;

    console.log(`🔍 Fetching hyperlocal summary for district ${districtLabel}`);

    // Check cache settings - default to 24 hours (86400 seconds)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '86400', 10);
    const dbCacheKey = generateDistrictCacheKey('summary', districtCode);

    // Check DB cache first (if cache reading is enabled)
    if (useCache) {
      const dbCached = await getFromDbCache<{ summary: string }>(dbCacheKey, true);
      if (dbCached) {
        console.log(`📦 DB cache hit for summary ${districtCode}`);
        return NextResponse.json(dbCached);
      }
    }

    // Check memory cache as fallback
    const cacheKey = generateCacheKey('district-summary', { district: districtCode });
    const cached = serverCache.get<{ summary: string }>(cacheKey, useCache);

    if (cached) {
      return NextResponse.json(cached);
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ API key not set, returning placeholder');
      return NextResponse.json({
        summary: `District ${districtLabel} local political news and developments.`
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
            content: `Provide a brief summary of recent political news and issues relevant to congressional district ${districtLabel}. Include any of the following if available: local political developments, the current representative's activities, community concerns, or legislative actions. If specific recent news is limited, provide general context about the district's political landscape and key issues. Write 2-3 concise sentences. Be specific and factual.`,
          },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`Sonar API error: ${response.status}`);
      return NextResponse.json({
        summary: `Congressional district ${districtLabel} news and local political developments.`
      });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary || isUnhelpfulResponse(summary)) {
      console.log(`⚠️ Unhelpful or empty response for ${districtLabel}, using fallback`);
      return NextResponse.json({
        summary: `Political news and developments for ${districtLabel}. This district's representative and local political landscape may have recent updates in local news sources.`
      });
    }

    console.log(`✅ Generated summary for ${districtLabel}`);

    const result = { summary };

    // Save to memory cache
    serverCache.set(cacheKey, result, cacheDurationSeconds);

    // Save to DB cache (always write, even if cache reading is disabled)
    await setInDbCache(dbCacheKey, 'summary', districtCode, result, cacheDurationSeconds);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error generating district summary:', error);
    return NextResponse.json({
      summary: "Local district news and political updates."
    });
  }
}
