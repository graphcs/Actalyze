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

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
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
 * GET /api/state/news?state=VA
 * Returns local news headlines for a state
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
    const cached = serverCache.get<{ headlines: Headline[] }>(cacheKey, useCache);

    if (cached) {
      return NextResponse.json(cached);
    }

    console.log(`📰 Fetching local news for ${stateName}`);

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      console.warn('⚠️ SERPAPI_KEY not set, returning placeholder headlines');
      return NextResponse.json({
        headlines: [
          {
            title: `Local news for ${stateName}`,
            url: "#",
            source: "Local News",
          },
        ]
      });
    }

    // Construct search query for local news
    const searchQuery = `${stateName} politics news`;

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
            title: `News for ${stateName}`,
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
        date: article.date,
        thumbnail: article.thumbnail,
      }));

    console.log(`✅ Got ${headlines.length} headlines for ${stateName}`);

    const result = {
      headlines: headlines.length > 0 ? headlines : [
        {
          title: `Local updates for ${stateName}`,
          url: "#",
          source: "State News",
        },
      ],
    };

    // Save to cache
    serverCache.set(cacheKey, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching state news:', error);
    return NextResponse.json({
      headlines: [
        {
          title: "Local state news",
          url: "#",
          source: "Local News",
        },
      ],
    });
  }
}
