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
        // Append keywords to ensure political/news context and exclude common non-political topics
        const enhancedQuery = `${query} (politics OR news OR government OR legislation) -subreddit:sports -subreddit:nfl -subreddit:nba -subreddit:cfb -subreddit:collegebasketball -subreddit:gaming -subreddit:leagueoflegends`;
        const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(enhancedQuery)}&sort=relevance&t=week&limit=${limit * 3}`; // Fetch more to filter if needed

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
        let posts: RedditPost[] = data.data.children
            .map((child) => child.data)
            .filter((post) => !post.url.includes('v.redd.it')); // Filter out video posts if they cause embed issues (optional)

        // AI Filtering to remove unrelated content (sports, gaming, etc.)
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (posts.length > 0 && apiKey) {
            try {
                // Analyze top candidates (up to 10) to save tokens/time
                const candidates = posts.slice(0, 10);
                const postsForAnalysis = candidates.map(p => ({
                    id: p.id,
                    title: p.title,
                    subreddit: p.subreddit
                }));

                const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
                        'X-Title': 'Actalyze',
                    },
                    body: JSON.stringify({
                        model: 'openai/gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a content filter. Return JSON with a "relevantIds" array containing IDs of posts that are strictly related to politics, news, government, or social issues. Exclude sports scores, game threads, video games, and entertainment.'
                            },
                            {
                                role: 'user',
                                content: `Query: "${query}"\n\nPosts:\n${JSON.stringify(postsForAnalysis)}`
                            }
                        ],
                        response_format: { type: "json_object" }
                    }),
                    signal: AbortSignal.timeout(4000) // Short timeout
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    const content = aiData.choices?.[0]?.message?.content;
                    if (content) {
                        const parsed = JSON.parse(content);
                        if (Array.isArray(parsed.relevantIds)) {
                            const relevantIds = new Set(parsed.relevantIds);
                            const filteredCandidates = candidates.filter(p => relevantIds.has(p.id));

                            if (filteredCandidates.length > 0) {
                                console.log(`🤖 AI filtered ${candidates.length - filteredCandidates.length} unrelated posts`);
                                posts = filteredCandidates;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('AI filtering failed, falling back to raw results:', error);
            }
        }

        // Final slice
        posts = posts.slice(0, limit);

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
