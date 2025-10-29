import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

/**
 * GET /api/district/news?district=VA05
 * Returns local news headlines for a congressional district
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
        { error: 'Invalid district code format. Use format like VA05 or NY01' },
        { status: 400 }
      );
    }

    const [, stateCode, districtNum] = match;

    // Check cache
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheKey = generateCacheKey('district-news', { district: districtCode });
    const cached = serverCache.get<{ headlines: Headline[] }>(cacheKey, useCache);

    if (cached) {
      return NextResponse.json(cached);
    }

    console.log(`📰 Fetching local news for district ${stateCode}-${districtNum}`);

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      console.warn('⚠️ SERPAPI_KEY not set, returning placeholder headlines');
      return NextResponse.json({
        headlines: [
          {
            title: `Local news for ${districtCode}`,
            url: "#",
            source: "Local News",
          },
          {
            title: "District updates and community news",
            url: "#",
            source: "Community",
          },
        ]
      });
    }

    // Construct search query for local news
    const searchQuery = `${stateCode} congressional district ${parseInt(districtNum)} news politics`;

    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_news');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', '10');
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`SERPAPI error: ${response.status}`);
      return NextResponse.json({
        headlines: [
          {
            title: `News for ${districtCode} district`,
            url: "#",
            source: "Local News",
          },
        ]
      });
    }

    const data = await response.json();
    const newsResults = data.news_results || [];

    const headlines: Headline[] = newsResults
      .slice(0, 5)
      .map((article: {
        title?: string;
        link?: string;
        source?: { name?: string };
        date?: string;
        thumbnail?: string;
      }) => ({
        title: article.title || "Untitled",
        url: article.link || "#",
        source: article.source?.name || "Unknown",
        date: article.date,
        thumbnail: article.thumbnail,
      }));

    console.log(`✅ Got ${headlines.length} headlines for ${districtCode}`);

    const result = {
      headlines: headlines.length > 0 ? headlines : [
        {
          title: `Local updates for ${districtCode}`,
          url: "#",
          source: "District News",
        },
      ],
    };

    // Save to cache
    serverCache.set(cacheKey, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching district news:', error);
    return NextResponse.json({
      headlines: [
        {
          title: "Local district news",
          url: "#",
          source: "Local News",
        },
      ],
    });
  }
}
