import { NextRequest, NextResponse } from "next/server";
import { fetchTopTweets, Tweet } from "@/src/trending/series";

/**
 * GET /api/topic/tweets?topic=...
 * Returns top tweets about a topic
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

    console.log(`🐦 Fetching tweets for topic: "${topic}"`);

    const tweets = await fetchTopTweets(topic);

    if (!tweets || tweets.length === 0) {
      console.log(`⚠️ No tweets found for: "${topic}"`);
      return NextResponse.json({ tweets: [] });
    }

    console.log(`✅ Found ${tweets.length} tweets`);
    return NextResponse.json({ tweets });

  } catch (error) {
    console.error('❌ Error fetching tweets:', error);
    return NextResponse.json({ tweets: [] });
  }
}
