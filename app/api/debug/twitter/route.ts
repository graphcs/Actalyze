import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    envVarsPresent: {
      TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
      TWITTER_API_SECRET: !!process.env.TWITTER_API_SECRET,
    },
    apiKeyLength: process.env.TWITTER_API_KEY?.length || 0,
    apiSecretLength: process.env.TWITTER_API_SECRET?.length || 0,
  };

  try {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;

    if (!apiKey || !apiSecret) {
      debug.error = "Environment variables not found";
      debug.solution = "Add TWITTER_API_KEY and TWITTER_API_SECRET to Vercel environment variables";
      return NextResponse.json(debug);
    }

    debug.status = "Attempting Twitter authentication...";

    // Try to authenticate
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    });

    debug.authInitialized = true;

    // Try app login
    const appOnlyClient = await client.appLogin();
    debug.appLoginSuccess = true;

    // Try a simple search
    const result = await appOnlyClient.v2.search("test -is:retweet lang:en", {
      max_results: 5,
    });

    debug.searchSuccess = true;
    debug.tweetsFound = result.data.data?.length || 0;
    debug.message = "✅ Twitter API is working correctly!";

    if (result.data.data && result.data.data.length > 0) {
      debug.sampleTweet = {
        id: result.data.data[0].id,
        text: result.data.data[0].text?.substring(0, 100) + "...",
      };
    }

    return NextResponse.json(debug);
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; data?: unknown; constructor: { name: string } };
    debug.error = err.message || "Unknown error";
    debug.errorCode = err.code;
    debug.errorType = err.constructor.name;

    if (err.data) {
      debug.errorData = err.data;
    }

    debug.solution = "Check if your Twitter API credentials are correct and have the necessary permissions";

    return NextResponse.json(debug, { status: 500 });
  }
}
