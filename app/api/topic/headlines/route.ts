import { NextRequest, NextResponse } from "next/server";

export interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

/**
 * GET /api/topic/headlines?topic=...
 * Returns top news headlines from Google News via SERPAPI
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const topic = searchParams.get('topic');

    if (!topic) {
      return NextResponse.json(
        { error: 'Missing topic parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SERPAPI key not configured' },
        { status: 500 }
      );
    }

    console.log(`📰 Fetching headlines for: "${topic}"`);

    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_news');
    url.searchParams.set('q', topic);
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');
    url.searchParams.set('num', '5');
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`SERPAPI error: ${response.status}`);
      return NextResponse.json({ headlines: [] });
    }

    const data = await response.json();
    const newsResults = data.news_results || [];

    if (newsResults.length === 0) {
      return NextResponse.json({ headlines: [] });
    }

    // Map to Headline interface
    const headlines: Headline[] = newsResults
      .slice(0, 5)
      .map((article: {
        title?: string;
        link?: string;
        source?: { name?: string };
        date?: string;
        thumbnail?: string;
        image?: string;
      }) => ({
        title: article.title || 'Untitled',
        url: article.link || '#',
        source: article.source?.name || 'Unknown',
        date: article.date,
        thumbnail: article.thumbnail || article.image,
      }))
      .filter((h: Headline) => h.title !== 'Untitled');

    console.log(`✅ Found ${headlines.length} headlines`);
    return NextResponse.json({ headlines });

  } catch (error) {
    console.error('❌ Error fetching headlines:', error);
    return NextResponse.json({ headlines: [] });
  }
}
