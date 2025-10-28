import { NextRequest, NextResponse } from "next/server";
import { fetchTrendsSeries, fetchTopTweets, fetchRelatedQueries, Tweet } from "@/src/trending/series";

export interface SeriesResponse {
  source: 'trends' | 'tweets' | 'queries';
  points?: Array<{ t: string; v: number }>;
  tweets?: Tweet[];
  queries?: string[];
}

/**
 * GET /api/trending/series?topic=...
 * Returns time-series data, tweets, or related queries for a trending topic
 *
 * Fallback order:
 * 1. Google Trends timeseries (sparkline chart)
 * 2. Top tweets about topic (5 recent tweets)
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

    // Try Google Trends first (accept any number of points)
    const trendsData = await fetchTrendsSeries(topic);
    if (trendsData && trendsData.length > 0) {
      console.log(`✅ Using Trends series (${trendsData.length} points)`);
      return NextResponse.json({
        source: 'trends',
        points: trendsData,
      } as SeriesResponse);
    }

    // Fallback to Twitter tweets
    const tweets = await fetchTopTweets(topic);
    if (tweets && tweets.length > 0) {
      console.log(`✅ Using Twitter tweets (${tweets.length} tweets)`);
      return NextResponse.json({
        source: 'tweets',
        tweets,
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
