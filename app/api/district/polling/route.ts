import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";

/**
 * GET /api/district/polling?district=VA05
 * Returns recent polling data for a congressional district using Sonar
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
    const districtLabel = `${stateCode}-${districtNum}`;

    // Check cache settings
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDuration = parseInt(request.headers.get('x-cache-duration') || '3600', 10);
    const dbCacheKey = generateDistrictCacheKey('polling', districtCode);

    // Check DB cache first (if cache reading is enabled)
    if (useCache) {
      const dbCached = await getFromDbCache<{ trend: string | null; description: string; sources?: { name: string; url: string }[] }>(dbCacheKey, true);
      if (dbCached) {
        console.log(`📦 DB cache hit for polling ${districtCode}`);
        return NextResponse.json(dbCached);
      }
    }

    // Check memory cache as fallback
    const cacheKey = generateCacheKey('district-polling', { district: districtCode });
    const cached = serverCache.get<{ trend: string | null; description: string; sources?: { name: string; url: string }[] }>(cacheKey, useCache);

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
            content: `What are the latest 2026 or 2028 election polls for Congressional District ${districtLabel}? If available, provide the most recent polling average or trend (e.g., "D+5", "R+3", "Tied", "Toss-up", "Likely D", "Likely R"). Return ONLY a JSON object with:
- "trend" (the margin like "D+5" or political leaning like "Likely R")
- "description" (one sentence about recent polls or political leaning)
- "sources" (array of objects with "name" and "url" for each polling source cited)

If no recent polls, use general district political leaning. Example: {"trend": "D+5", "description": "Recent polls show Democrats leading by 5 points", "sources": [{"name": "FiveThirtyEight", "url": "https://fivethirtyeight.com"}, {"name": "Cook Political Report", "url": "https://cookpolitical.com"}]}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
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
      description: pollingData.description || "Recent polling data unavailable",
      sources: pollingData.sources || []
    };

    // Save to memory cache
    serverCache.set(cacheKey, result);

    // Save to DB cache (always write, even if cache reading is disabled)
    await setInDbCache(dbCacheKey, 'polling', districtCode, result, cacheDuration);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching district polling data:', error);
    return NextResponse.json({
      trend: null,
      description: "Polling information unavailable"
    });
  }
}
