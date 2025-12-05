import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

function formatDate(dateString?: string): string | undefined {
  if (!dateString) return undefined;

  // If it's already relative (e.g. "2 hours ago"), keep it
  if (dateString.includes('ago')) return dateString;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    // Format: "Nov 14, 2025"
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateString;
  }
}

function isWithinLastWeek(dateString?: string): boolean {
  if (!dateString) return true; // Include articles without dates

  // Relative dates like "2 hours ago", "3 days ago" are always recent
  if (dateString.includes('ago')) return true;

  try {
    const articleDate = new Date(dateString);
    if (isNaN(articleDate.getTime())) return true; // Include if we can't parse

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return articleDate >= oneWeekAgo;
  } catch {
    return true; // Include on parse error
  }
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
    let searchQuery = `${stateCode} congressional district ${parseInt(districtNum)} news politics`;

    // Try to get a better search query using AI if available
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      try {
        const districtLabel = `${stateCode}-${districtNum}`;
        const prompt = `Generate a Google News search query to find the most relevant recent political news for US Congressional District ${districtLabel}.
Include the current representative's name and major cities/counties in the query string using OR operators.
Return ONLY the raw query string. Do not use quotes around the whole string.
Example output: "Tom Suozzi" OR "NY-03" OR "Nassau County politics"`;

        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_URL!,
            'X-Title': 'Actalyze',
          },
          body: JSON.stringify({
            model: 'perplexity/sonar-pro',
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.1,
            max_tokens: 100,
          }),
          signal: AbortSignal.timeout(5000), // Short timeout
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const generatedQuery = aiData.choices?.[0]?.message?.content?.trim();
          if (generatedQuery) {
            // Clean up query (remove quotes if wrapped in them, though prompt says not to)
            searchQuery = generatedQuery.replace(/^"|"$/g, '');
            console.log(`🤖 AI generated search query: ${searchQuery}`);
          }
        }
      } catch (e) {
        console.warn('Failed to generate AI search query, falling back to default', e);
      }
    }

    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_news');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', '15'); // Fetch more to account for filtering
    url.searchParams.set('tbs', 'qdr:w'); // Limit to past week (qdr:w = query date range: week)
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
      .filter((article: { date?: string }) => isWithinLastWeek(article.date))
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
        date: formatDate(article.date),
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
