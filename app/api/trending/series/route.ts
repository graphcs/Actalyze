import { NextRequest, NextResponse } from "next/server";
import { fetchTrendsSeries, fetchNewsVelocity, fetchRelatedQueries } from "@/src/trending/series";

export interface SeriesResponse {
  source: 'trends' | 'news' | 'queries';
  points?: Array<{ t: string; v: number }>;
  queries?: string[];
}

/**
 * GET /api/trending/series?topic=...
 * Returns time-series data or related queries for a trending topic
 *
 * Fallback order:
 * 1. Google Trends timeseries (last 7 days)
 * 2. Google News velocity (hourly buckets, last 36 hours)
 * 3. Related queries (list of 5 related searches)
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

    console.log(`📊 Fetching series data for topic: "${topic}"`);

    // Try Google Trends first
    const trendsData = await fetchTrendsSeries(topic);
    if (trendsData && trendsData.length >= 5) {
      console.log(`✅ Using Trends series (${trendsData.length} points)`);
      return NextResponse.json({
        source: 'trends',
        points: trendsData,
      } as SeriesResponse);
    }

    // Fallback to News velocity
    const newsData = await fetchNewsVelocity(topic);
    if (newsData && newsData.length >= 3) {
      console.log(`✅ Using News velocity (${newsData.length} points)`);
      return NextResponse.json({
        source: 'news',
        points: newsData,
      } as SeriesResponse);
    }

    // Final fallback: Related queries
    const queries = await fetchRelatedQueries(topic);
    if (queries && queries.length > 0) {
      console.log(`✅ Using Related queries (${queries.length} items)`);
      return NextResponse.json({
        source: 'queries',
        queries,
      } as SeriesResponse);
    }

    // Total failure: return empty queries
    console.log(`⚠️ No data found for topic: "${topic}"`);
    return NextResponse.json({
      source: 'queries',
      queries: [],
    } as SeriesResponse);

  } catch (error) {
    console.error('❌ Error in series API:', error);
    // Never throw - return empty response
    return NextResponse.json({
      source: 'queries',
      queries: [],
    } as SeriesResponse);
  }
}
