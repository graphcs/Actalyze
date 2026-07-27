/**
 * Word Analytics API Route
 * Provides detailed analytics for a specific word
 */

import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import type { WordAnalytics } from "@/types/wordcloud";
import {
  cleanText,
  tokenizeAndFilter,
  lemmatize,
  analyzeSentiment,
} from "@/src/lib/text-processor";

interface TweetData {
  id: string;
  text: string;
  created_at: string;
  author_id?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

interface UserData {
  id: string;
  name: string;
  username: string;
}

/**
 * WordAnalytics plus a machine-readable availability flag so the client can
 * tell "the social API could not be reached" apart from "we looked and this
 * word genuinely has no matching posts". Both render a calm empty state.
 */
type WordAnalyticsResponse = WordAnalytics & {
  available: boolean;
  unavailableReason?: string;
};

/**
 * A complete, well-formed, zero-valued analytics payload.
 * Every field the UI reads is present, so the page never sees `undefined`.
 */
function emptyAnalytics(
  word: string,
  topic: string,
  timeRange: string,
  location: string,
  available: boolean,
  unavailableReason?: string
): WordAnalyticsResponse {
  return {
    word,
    totalOccurrences: 0,
    sentiment: {
      average: 0,
      distribution: { positive: 0, neutral: 0, negative: 0 },
    },
    topTweets: [],
    relatedWords: [],
    timeSeriesData: [],
    context: { topic, timeRange, location },
    available,
    ...(unavailableReason ? { unavailableReason } : {}),
  };
}

/**
 * Rejects if `promise` has not settled within `ms`, so an unresponsive
 * upstream can never hold this route (and the page) open indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export async function GET(request: NextRequest) {
  try {
    const urlParams = request.nextUrl.searchParams;
    const word = urlParams.get("word");
    const topic = urlParams.get("topic");
    const timeRange = urlParams.get("timeRange") || "7d";
    const location = urlParams.get("location") || "national";
    const maxTweets = parseInt(urlParams.get("maxTweets") || "100");

    console.log(`[Word Analytics] Request received - word: "${word}", topic: "${topic}"`);

    if (!word || !topic) {
      console.error("[Word Analytics] Missing required parameters");
      return NextResponse.json(
        { error: "Word and topic are required" },
        { status: 400 }
      );
    }

    // Get Twitter API credentials
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.warn("[Word Analytics] Social API credentials not configured");
      return NextResponse.json(
        emptyAnalytics(
          word,
          topic,
          timeRange,
          location,
          false,
          "credentials_not_configured"
        )
      );
    }

    // Initialize Twitter client
    console.log("[Word Analytics] Initializing Twitter client...");
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    let appOnlyClient;
    try {
      appOnlyClient = await withTimeout(client.appLogin(), 10000, "appLogin");
    } catch (authError) {
      console.warn("[Word Analytics] Social API authentication unavailable:", authError);
      return NextResponse.json(
        emptyAnalytics(word, topic, timeRange, location, false, "upstream_unavailable")
      );
    }

    // Build search query - search for the word within the topic context
    const query = `${topic} ${word} -is:retweet lang:en`;

    console.log(`[Word Analytics] Fetching tweets for word: "${word}" in topic: "${topic}"`);

    // Fetch tweets
    const searchParams: Record<string, unknown> = {
      max_results: Math.min(maxTweets, 100),
      'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
      expansions: ['author_id'],
    };

    console.log(`[Word Analytics] Search query: "${query}"`);
    console.log(`[Word Analytics] Search params:`, JSON.stringify(searchParams));

    let tweets;
    try {
      tweets = await withTimeout(
        appOnlyClient.v2.search(query, searchParams),
        15000,
        "tweet search"
      );
      console.log(`[Word Analytics] Received ${tweets.data?.data?.length || 0} tweets`);
    } catch (twitterError) {
      // The social API is unavailable on this plan (403), rate limited, or slow.
      // This is not a server fault - answer 200 with an empty, well-formed
      // payload so the client can render a calm empty state.
      console.warn("[Word Analytics] Social API unavailable:", twitterError);
      return NextResponse.json(
        emptyAnalytics(word, topic, timeRange, location, false, "upstream_unavailable")
      );
    }

    const tweetData = (tweets.data?.data as TweetData[]) || [];
    const users = (tweets.data?.includes?.users as UserData[]) || [];

    console.log(`[Word Analytics] Processed ${tweetData.length} tweets, ${users.length} users`);

    if (tweetData.length === 0) {
      console.log("[Word Analytics] No tweets found, returning empty analytics");
      // Reached upstream successfully, it just had nothing for this word.
      return NextResponse.json(
        emptyAnalytics(word, topic, timeRange, location, true)
      );
    }

    // Process tweets
    console.log(`[Word Analytics] Starting to process ${tweetData.length} tweets...`);
    let totalOccurrences = 0;
    let totalSentiment = 0;
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const relatedWordsMap = new Map<string, number>();
    const timeSeriesMap = new Map<string, number>();
    const processedTweets: Array<{
      id: string;
      text: string;
      author: string;
      username: string;
      url: string;
      created_at: string;
      engagement: number;
      sentiment: number;
    }> = [];

    // Process each tweet
    for (const tweet of tweetData) {
      try {
        if (!tweet || !tweet.text) {
          console.warn(`[Word Analytics] Skipping tweet with no text: ${tweet?.id}`);
          continue;
        }

        const text = tweet.text;
        const cleanedText = cleanText(text);
        const tokens = tokenizeAndFilter(cleanedText);
        const lemmatizedTokens = tokens.map((t) => lemmatize(t));

        // Count occurrences of the target word
        const wordOccurrences = lemmatizedTokens.filter(
          (t) => t.toLowerCase() === word.toLowerCase()
        ).length;
        totalOccurrences += wordOccurrences;

        // Analyze sentiment
        const sentiment = analyzeSentiment(text);
        totalSentiment += sentiment;

        if (sentiment > 0.1) sentimentCounts.positive++;
        else if (sentiment < -0.1) sentimentCounts.negative++;
        else sentimentCounts.neutral++;

        // Track related words (co-occurring words)
        lemmatizedTokens.forEach((token) => {
          if (token.toLowerCase() !== word.toLowerCase()) {
            relatedWordsMap.set(
              token,
              (relatedWordsMap.get(token) || 0) + wordOccurrences
            );
          }
        });

        // Track time series (group by hour)
        if (tweet.created_at) {
          const hourKey = new Date(tweet.created_at).toISOString().slice(0, 13);
          timeSeriesMap.set(
            hourKey,
            (timeSeriesMap.get(hourKey) || 0) + wordOccurrences
          );
        }

        // Get author info
        const author = users.find((u) => u.id === tweet.author_id);
        const engagement =
          (tweet.public_metrics?.like_count || 0) +
          (tweet.public_metrics?.retweet_count || 0) * 2 +
          (tweet.public_metrics?.reply_count || 0);

        processedTweets.push({
          id: tweet.id,
          text: tweet.text || "",
          author: author?.name || "Unknown",
          username: author?.username || "unknown",
          url: `https://twitter.com/${author?.username || "i"}/status/${tweet.id}`,
          created_at: tweet.created_at || new Date().toISOString(),
          engagement,
          sentiment,
        });
      } catch (tweetError) {
        console.error(`[Word Analytics] Error processing tweet ${tweet?.id || 'unknown'}:`, tweetError);
        // Continue processing other tweets
      }
    }

    console.log(`[Word Analytics] Finished processing. Total occurrences: ${totalOccurrences}`);

    // Sort tweets by engagement
    const topTweets = processedTweets
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);

    // Get top related words
    const relatedWords = Array.from(relatedWordsMap.entries())
      .map(([word, count]) => ({ word, coOccurrence: count }))
      .sort((a, b) => b.coOccurrence - a.coOccurrence)
      .slice(0, 20);

    // Format time series data
    const timeSeriesData = Array.from(timeSeriesMap.entries())
      .map(([timestamp, count]) => ({ timestamp: timestamp + ":00:00Z", count }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Calculate analytics
    const analytics: WordAnalyticsResponse = {
      available: true,
      word,
      totalOccurrences,
      sentiment: {
        average: tweetData.length > 0 ? totalSentiment / tweetData.length : 0,
        distribution: {
          positive: sentimentCounts.positive,
          neutral: sentimentCounts.neutral,
          negative: sentimentCounts.negative,
        },
      },
      topTweets,
      relatedWords,
      timeSeriesData,
      context: {
        topic,
        timeRange,
        location,
      },
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("[Word Analytics API Error]:", error);

    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Never surface a raw 500 to the UI. Answer 200 with an empty, well-formed
    // payload flagged `available: false`; the page renders an empty state.
    const urlParams = request.nextUrl.searchParams;
    return NextResponse.json(
      emptyAnalytics(
        urlParams.get("word") || "",
        urlParams.get("topic") || "",
        urlParams.get("timeRange") || "7d",
        urlParams.get("location") || "national",
        false,
        "upstream_unavailable"
      )
    );
  }
}
