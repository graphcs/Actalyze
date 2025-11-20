import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

interface RedditPost {
    id: string;
    title: string;
    permalink: string;
    author: string;
    subreddit: string;
    score: number;
    num_comments: number;
    created_utc: number;
    url: string;
}

interface RedditResponse {
    data: {
        children: {
            data: RedditPost;
        }[];
    };
}

/**
 * GET /api/reddit/search?query=...&limit=4
 * Searches Reddit for recent posts and returns data for embedding
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('query');
        const limit = parseInt(searchParams.get('limit') || '4');

        if (!query) {
            return NextResponse.json(
                { error: 'Missing query parameter' },
                { status: 400 }
            );
        }

        // Check cache
        const useCacheHeader = request.headers.get('x-use-cache');
        const useCache = useCacheHeader !== 'false';
        const cacheKey = generateCacheKey('reddit-search', { query, limit });
        const cached = serverCache.get<{ posts: RedditPost[] }>(cacheKey, useCache);

        if (cached) {
            return NextResponse.json(cached);
        }

        console.log(`🤖 Searching Reddit for: "${query}"`);

        // Search Reddit
        // sort=relevance, t=week (posts from the last week)
        const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=week&limit=${limit * 2}`; // Fetch more to filter if needed

        const response = await fetch(redditUrl, {
            headers: {
                'User-Agent': 'Actalyze/1.0.0 (by /u/actalyze_bot)', // Required by Reddit API
            },
        });

        if (!response.ok) {
            console.error(`❌ Reddit API error: ${response.status} ${response.statusText}`);
            return NextResponse.json({ posts: [] });
        }

        const data: RedditResponse = await response.json();

        if (!data.data || !data.data.children || data.data.children.length === 0) {
            console.log(`⚠️  No Reddit posts found for: "${query}"`);
            return NextResponse.json({ posts: [] });
        }

        // Format posts
        const posts: RedditPost[] = data.data.children
            .map((child) => child.data)
            .filter((post) => !post.url.includes('v.redd.it')) // Filter out video posts if they cause embed issues (optional)
            .slice(0, limit);

        const result = { posts };

        // Cache result (1 hour)
        serverCache.set(cacheKey, result, 60 * 60);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error searching Reddit:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
