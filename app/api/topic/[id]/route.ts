import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

interface MentionsData {
  week: string;
  count: number;
}

interface TopicDetailData {
  mentions: MentionsData[];
  totalMentions: number;
  recentTweets: Array<{
    id: string;
    text: string;
    created_at: string;
    metrics: {
      likes: number;
      retweets: number;
    };
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params;

    // Map topic IDs to search queries
    const topicQueries: { [key: string]: string } = {
      "ijia": "infrastructure bill",
      "aca": "affordable care act OR obamacare",
      "farmbill": "farm bill",
      "defense": "defense appropriations",
      "climate": "climate legislation OR climate bill",
      "education": "education funding",
    };

    const searchQuery = topicQueries[topicId] || topicId.replace(/-/g, " ");

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.log("❌ No Twitter API credentials, returning mock data");
      return NextResponse.json(getMockTopicData());
    }

    console.log(`✓ Fetching topic data for: ${searchQuery}`);

    // Initialize Twitter client
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    const appOnlyClient = await client.appLogin();
    const readOnlyClient = appOnlyClient.readOnly;

    // Fetch recent tweets (last 7 days)
    const result = await readOnlyClient.v2.search(`${searchQuery} -is:retweet lang:en`, {
      max_results: 100, // Get more for better weekly aggregation
      'tweet.fields': ['created_at', 'public_metrics'],
      start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (!result.data.data || result.data.data.length === 0) {
      console.log("⚠️ No tweets found, returning mock data");
      return NextResponse.json(getMockTopicData());
    }

    const tweets = result.data.data;
    console.log(`✓ Found ${tweets.length} tweets`);

    // Aggregate by week
    const weeklyMentions: { [key: string]: number } = {};
    const now = new Date();

    // Initialize last 7 weeks
    for (let i = 6; i >= 0; i--) {
      const weekLabel = `W${7 - i}`;
      weeklyMentions[weekLabel] = 0;
    }

    // Count tweets per week
    tweets.forEach((tweet) => {
      if (tweet.created_at) {
        const tweetDate = new Date(tweet.created_at);
        const daysAgo = Math.floor((now.getTime() - tweetDate.getTime()) / (24 * 60 * 60 * 1000));
        const weeksAgo = Math.floor(daysAgo / 7);

        if (weeksAgo < 7) {
          const weekLabel = `W${7 - weeksAgo}`;
          weeklyMentions[weekLabel] = (weeklyMentions[weekLabel] || 0) + 1;
        }
      }
    });

    const mentionsData = Object.entries(weeklyMentions).map(([week, count]) => ({
      week,
      count,
    }));

    // Format recent tweets
    const recentTweets = tweets.slice(0, 10).map((tweet) => ({
      id: tweet.id,
      text: tweet.text || "",
      created_at: tweet.created_at || "",
      metrics: {
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
      },
    }));

    const responseData: TopicDetailData = {
      mentions: mentionsData,
      totalMentions: tweets.length,
      recentTweets,
    };

    console.log("✓ Topic data prepared successfully");
    return NextResponse.json(responseData);

  } catch (error) {
    console.error("❌ Error fetching topic data:", error);
    return NextResponse.json(getMockTopicData());
  }
}

function getMockTopicData(): TopicDetailData {
  return {
    mentions: [
      { week: "W1", count: 12 },
      { week: "W2", count: 18 },
      { week: "W3", count: 20 },
      { week: "W4", count: 23 },
      { week: "W5", count: 30 },
      { week: "W6", count: 28 },
      { week: "W7", count: 35 },
    ],
    totalMentions: 166,
    recentTweets: [],
  };
}
