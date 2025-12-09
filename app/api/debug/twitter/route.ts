import { NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    envVarsPresent: {
      TWITTER_API_KEY: !!process.env.TWITTER_API_KEY,
      TWITTER_API_SECRET: !!process.env.TWITTER_API_SECRET,
      TWITTER_BEARER_TOKEN: !!process.env.TWITTER_BEARER_TOKEN,
    },
    apiKeyLength: process.env.TWITTER_API_KEY?.length || 0,
    apiSecretLength: process.env.TWITTER_API_SECRET?.length || 0,
    bearerTokenLength: process.env.TWITTER_BEARER_TOKEN?.length || 0,
  };

  try {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;

    // Prefer bearer token if available (fewer auth calls)
    let appOnlyClient: TwitterApi;

    if (bearerToken) {
      debug.authMethod = "bearer_token";
      appOnlyClient = new TwitterApi(bearerToken);
    } else if (apiKey && apiSecret) {
      debug.authMethod = "app_login";
      debug.status = "Attempting Twitter authentication...";

      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
      });

      debug.authInitialized = true;
      appOnlyClient = await client.appLogin();
      debug.appLoginSuccess = true;
    } else {
      debug.error = "No Twitter credentials found";
      debug.solution = "Add TWITTER_BEARER_TOKEN (preferred) or TWITTER_API_KEY + TWITTER_API_SECRET to Vercel";
      return NextResponse.json(debug);
    }

    // Try a simple search
    const result = await appOnlyClient.v2.search("politics -is:retweet lang:en", {
      max_results: 10,
    });

    debug.searchSuccess = true;
    debug.tweetsFound = result.data.data?.length || 0;

    // Check rate limit headers
    const rateLimit = result.rateLimit;
    if (rateLimit) {
      debug.rateLimit = {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: new Date(rateLimit.reset * 1000).toISOString(),
        resetInMinutes: Math.ceil((rateLimit.reset * 1000 - Date.now()) / 60000),
      };
    }

    debug.message = "✅ Twitter API is working correctly!";

    if (result.data.data && result.data.data.length > 0) {
      debug.sampleTweet = {
        id: result.data.data[0].id,
        text: result.data.data[0].text?.substring(0, 100) + "...",
      };
    }

    return NextResponse.json(debug);
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; data?: unknown; rateLimit?: { limit: number; remaining: number; reset: number }; constructor: { name: string } };
    debug.error = err.message || "Unknown error";
    debug.errorCode = err.code;
    debug.errorType = err.constructor.name;

    if (err.data) {
      debug.errorData = err.data;
    }

    // Check if it's a rate limit error
    const isRateLimitError = err.code === '429' || String(err.code) === '429';
    if (isRateLimitError) {
      debug.isRateLimited = true;
      debug.solution = "Rate limited. Wait 15 minutes or check your Twitter API tier limits. Basic tier: ~60 requests/15min, 10K tweets/month.";

      if (err.rateLimit) {
        debug.rateLimit = {
          limit: err.rateLimit.limit,
          remaining: err.rateLimit.remaining,
          reset: new Date(err.rateLimit.reset * 1000).toISOString(),
          resetInMinutes: Math.ceil((err.rateLimit.reset * 1000 - Date.now()) / 60000),
        };
      }
    } else {
      debug.solution = "Check if your Twitter API credentials are correct and have the necessary permissions";
    }

    const isRateLimit = err.code === '429' || String(err.code) === '429';
    return NextResponse.json(debug, { status: isRateLimit ? 429 : 500 });
  }
}
