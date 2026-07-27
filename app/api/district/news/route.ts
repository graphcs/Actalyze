import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { OPENROUTER_KEY } from "@/lib/ai-provider";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

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

// List of other state names to filter out when they appear prominently in headlines
const OTHER_STATE_KEYWORDS: Record<string, string[]> = {
  "AL": ["Alabama"], "AK": ["Alaska"], "AZ": ["Arizona"], "AR": ["Arkansas"],
  "CA": ["California"], "CO": ["Colorado"], "CT": ["Connecticut"], "DE": ["Delaware"],
  "FL": ["Florida"], "GA": ["Georgia"], "HI": ["Hawaii"], "ID": ["Idaho"],
  "IL": ["Illinois"], "IN": ["Indiana"], "IA": ["Iowa"], "KS": ["Kansas"],
  "KY": ["Kentucky"], "LA": ["Louisiana"], "ME": ["Maine"], "MD": ["Maryland"],
  "MA": ["Massachusetts"], "MI": ["Michigan"], "MN": ["Minnesota"], "MS": ["Mississippi"],
  "MO": ["Missouri"], "MT": ["Montana"], "NE": ["Nebraska"], "NV": ["Nevada"],
  "NH": ["New Hampshire"], "NJ": ["New Jersey"], "NM": ["New Mexico"], "NY": ["New York"],
  "NC": ["North Carolina"], "ND": ["North Dakota"], "OH": ["Ohio"], "OK": ["Oklahoma"],
  "OR": ["Oregon"], "PA": ["Pennsylvania"], "RI": ["Rhode Island"], "SC": ["South Carolina"],
  "SD": ["South Dakota"], "TN": ["Tennessee"], "TX": ["Texas"], "UT": ["Utah"],
  "VT": ["Vermont"], "VA": ["Virginia"], "WA": ["Washington State"], "WV": ["West Virginia"],
  "WI": ["Wisconsin"], "WY": ["Wyoming"], "DC": ["District of Columbia", "Washington D.C."]
};

/**
 * Check if an article title mentions a different state than the target
 */
function mentionsOtherState(title: string, targetStateCode: string): boolean {
  const titleLower = title.toLowerCase();

  for (const [stateCode, stateNames] of Object.entries(OTHER_STATE_KEYWORDS)) {
    if (stateCode === targetStateCode) continue; // Skip the target state

    for (const stateName of stateNames) {
      if (titleLower.includes(stateName.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Search SERPAPI for news articles matching a query
 */
async function searchSerpApi(query: string, apiKey: string, targetStateCode?: string): Promise<Headline[]> {
  try {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_news');
    url.searchParams.set('q', query);
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', '20'); // Fetch more to account for filtering
    url.searchParams.set('tbs', 'qdr:w'); // Past week
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`SERPAPI error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const newsResults = data.news_results || [];

    return newsResults
      .filter((article: { date?: string; title?: string }) => {
        // Filter by date
        if (!isWithinLastWeek(article.date)) return false;

        // Filter out articles that mention other states in the title
        if (targetStateCode && article.title && mentionsOtherState(article.title, targetStateCode)) {
          console.log(`🚫 Filtered out (wrong state): ${article.title}`);
          return false;
        }

        return true;
      })
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
  } catch (error) {
    console.error('SERPAPI search error:', error);
    return [];
  }
}

/**
 * Get major towns/cities in a congressional district using AI
 */
async function getDistrictTowns(districtLabel: string, openrouterKey: string): Promise<string[]> {
  try {
    const prompt = `List 3-5 major cities or towns in US Congressional District ${districtLabel}.
Return ONLY a comma-separated list of city/town names, nothing else.
Example output: Newark, Edison, New Brunswick, Perth Amboy`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'https://actalyze.com',
        'X-Title': 'Actalyze',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return [];

    // Parse comma-separated list
    const towns = content.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    console.log(`🏘️ Found towns for ${districtLabel}: ${towns.join(', ')}`);
    return towns;
  } catch (error) {
    console.error('Error getting district towns:', error);
    return [];
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
    const districtLabel = `${stateCode}-${districtNum}`;
    const stateName = STATE_NAMES[stateCode] || stateCode;

    // Check cache headers - default to 24 hours (86400 seconds)
    const useCacheHeader = request.headers.get('x-use-cache');
    const useCache = useCacheHeader !== 'false';
    const cacheDurationSeconds = parseInt(request.headers.get('x-cache-duration-seconds') || '86400', 10);

    // Generate cache keys
    const memoryCacheKey = generateCacheKey('district-news', { district: districtCode });
    const dbCacheKey = generateDistrictCacheKey('news', districtCode);

    // Try database cache first
    const dbCached = await getFromDbCache<{ headlines: Headline[] }>(dbCacheKey, useCache);
    if (dbCached) {
      console.log(`📦 Using DB cached news for ${districtCode}`);
      serverCache.set(memoryCacheKey, dbCached, cacheDurationSeconds);
      return NextResponse.json(dbCached);
    }

    // Fall back to memory cache
    const memoryCached = serverCache.get<{ headlines: Headline[] }>(memoryCacheKey, useCache);
    if (memoryCached) {
      console.log(`📦 Using memory cached news for ${districtCode}`);
      return NextResponse.json(memoryCached);
    }

    console.log(`📰 Fetching local news for district ${districtLabel}`);

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

    const openrouterKey = OPENROUTER_KEY;
    let headlines: Headline[] = [];

    // ========== TIER 1: AI-enhanced district-specific search ==========
    if (openrouterKey) {
      try {
        const prompt = `Generate a Google News search query to find the most relevant recent political news for US Congressional District ${districtLabel}.
Include the current representative's name and major cities/counties in the query string using OR operators.
Return ONLY the raw query string. Do not use quotes around the whole string.
Example output: "Tom Suozzi" OR "NY-03" OR "Nassau County politics"`;

        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'https://actalyze.com',
            'X-Title': 'Actalyze',
          },
          body: JSON.stringify({
            model: 'perplexity/sonar-pro',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 100,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const generatedQuery = aiData.choices?.[0]?.message?.content?.trim();
          if (generatedQuery) {
            const searchQuery = generatedQuery.replace(/^"|"$/g, '');
            console.log(`🤖 Tier 1: AI query for ${districtLabel}: ${searchQuery}`);
            headlines = await searchSerpApi(searchQuery, apiKey, stateCode);
          }
        }
      } catch (e) {
        console.warn('Tier 1 AI query failed:', e);
      }
    }

    // Fallback to default district query if AI didn't work
    if (headlines.length === 0) {
      const defaultQuery = `${stateCode} congressional district ${parseInt(districtNum)} news politics`;
      console.log(`📍 Tier 1 fallback: default query: ${defaultQuery}`);
      headlines = await searchSerpApi(defaultQuery, apiKey, stateCode);
    }

    if (headlines.length > 0) {
      console.log(`✅ Tier 1 success: Got ${headlines.length} headlines for ${districtCode}`);
    }

    // ========== TIER 2: Search by major towns/cities in district ==========
    if (headlines.length === 0 && openrouterKey) {
      console.log(`🏘️ Tier 2: Searching by towns for ${districtLabel}`);

      const towns = await getDistrictTowns(districtLabel, openrouterKey);
      if (towns.length > 0) {
        // Build query with town names
        const townQuery = towns.map(t => `"${t}"`).join(' OR ') + ` ${stateName} local news`;
        console.log(`🏘️ Tier 2 query: ${townQuery}`);
        headlines = await searchSerpApi(townQuery, apiKey, stateCode);

        if (headlines.length > 0) {
          console.log(`✅ Tier 2 success: Got ${headlines.length} headlines from town search`);
        }
      }
    }

    // ========== TIER 3: Fall back to state-level political news ==========
    if (headlines.length === 0) {
      console.log(`🗺️ Tier 3: Falling back to state news for ${stateName}`);
      const stateQuery = `"${stateName}" politics news local`;
      headlines = await searchSerpApi(stateQuery, apiKey, stateCode);

      if (headlines.length > 0) {
        console.log(`✅ Tier 3 success: Got ${headlines.length} headlines from state search`);
      }
    }

    // ========== Final fallback: placeholder ==========
    const result = {
      headlines: headlines.length > 0 ? headlines : [
        {
          title: `Local updates for ${districtCode}`,
          url: "#",
          source: "District News",
        },
      ],
    };

    if (headlines.length === 0) {
      console.warn(`⚠️ No news found for ${districtCode} after all tiers`);
    }

    // Save to both memory and database cache (always write, even if cache reading was disabled)
    serverCache.set(memoryCacheKey, result, cacheDurationSeconds);
    await setInDbCache(dbCacheKey, 'news', districtCode, result, cacheDurationSeconds);

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
