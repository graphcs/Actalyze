import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { OPENROUTER_KEY } from "@/lib/ai-provider";

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
 * GET /api/district/reddit?district=VA10
 * Uses Claude Sonnet 4.5 to identify trending topics in a district,
 * then searches Reddit for discussions about those topics
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const districtCode = searchParams.get('district')?.toUpperCase();

        if (!districtCode) {
            return NextResponse.json(
                { error: 'Missing district parameter' },
                { status: 400 }
            );
        }

        // Parse district code (e.g., "VA10" -> state: "VA", district: "10")
        const match = districtCode.match(/^([A-Z]{2})(\d{2})$/);
        if (!match) {
            return NextResponse.json(
                { error: 'Invalid district code format' },
                { status: 400 }
            );
        }

        const [, stateCode, districtNum] = match;
        const districtLabel = `${stateCode}-${parseInt(districtNum)}`;

        // Check cache
        const useCacheHeader = request.headers.get('x-use-cache');
        const useCache = useCacheHeader !== 'false';
        const cacheKey = generateCacheKey('district-reddit', { district: districtCode });
        const cached = serverCache.get<{ posts: RedditPost[] }>(cacheKey, useCache);

        if (cached) {
            console.log(`📦 Using cached Reddit posts for ${districtLabel}`);
            return NextResponse.json(cached);
        }

        console.log(`🔍 Finding trending topics for district ${districtLabel} (Reddit)`);

        // Step 1: Call Claude Sonnet 4.5 via OpenRouter to get trending topics
        // We use the same logic as the Twitter endpoint to ensure consistency
        const openrouterKey = OPENROUTER_KEY;
        if (!openrouterKey) {
            console.error('❌ OPENROUTER_API_KEY not found');
            return NextResponse.json({ posts: [] });
        }

        const stateNames: Record<string, string> = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
            'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
            'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
            'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
            'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
            'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
            'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
            'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
        };

        const stateName = stateNames[stateCode] || stateCode;
        const districtName = `${stateName}'s ${parseInt(districtNum)} Congressional District (${districtLabel})`;

        const claudePrompt = `You are a political research assistant with access to current news and web search. Research and identify the top 4-5 trending political topics, controversies, or local issues currently happening in ${districtName} as of this week (November 2025).

Output ONLY a bulleted list of search terms in this exact format:
- [concise search term]
- [concise search term]
- [concise search term]
- [concise search term]
- [concise search term]

Each search term should be SHORT (1-4 words), use keywords that people would actually discuss on Reddit, and focus on district-specific issues, local politicians, controversies, or policy debates. Do NOT include generic phrases. Examples of good terms: "VA-10 election", "Suhas Subramanyam", "Loudoun schools".

ONLY output the bulleted list of search terms with NO additional commentary, explanations, or disclaimers.`;

        const claudeResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openrouterKey}`,
                'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
                'X-Title': 'Actalyze',
            },
            body: JSON.stringify({
                model: 'perplexity/sonar-pro',
                messages: [
                    {
                        role: 'user',
                        content: claudePrompt,
                    },
                ],
                temperature: 0.3,
                max_tokens: 500,
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!claudeResponse.ok) {
            console.error(`❌ Claude API error: ${claudeResponse.status}`);
            return NextResponse.json({ posts: [] });
        }

        const claudeData = await claudeResponse.json();
        const claudeText = claudeData.choices?.[0]?.message?.content?.trim();

        if (!claudeText) {
            console.error('❌ No response from Claude');
            return NextResponse.json({ posts: [] });
        }

        // Parse search terms from Claude's response
        const searchTerms: string[] = [];
        const lines = claudeText.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('-')) {
                const term = trimmed.substring(1).trim();
                if (term && term.length > 0) {
                    searchTerms.push(term);
                }
            }
        }

        console.log(`📋 Extracted ${searchTerms.length} search terms for Reddit:`, searchTerms);

        if (searchTerms.length === 0) {
            return NextResponse.json({ posts: [] });
        }

        // Step 2: Search Reddit for each topic
        const allPosts: RedditPost[] = [];
        const seenPostIds = new Set<string>();
        const domain = process.env.NEXT_PUBLIC_URL ? new URL(process.env.NEXT_PUBLIC_URL).hostname : 'actalyze.com';

        for (const searchTerm of searchTerms.slice(0, 4)) {
            console.log(`🤖 Searching Reddit for: "${searchTerm}"`);

            // Add political context to query
            const enhancedQuery = `${searchTerm} (politics OR news OR government OR legislation) -subreddit:sports -subreddit:nfl -subreddit:nba -subreddit:cfb -subreddit:collegebasketball -subreddit:gaming -subreddit:leagueoflegends`;
            const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(enhancedQuery)}&sort=relevance&t=week&limit=5`;

            try {
                const response = await fetch(redditUrl, {
                    headers: {
                        'User-Agent': `web:Actalyze:v1.0.0 (by /u/actalyze_bot on ${domain})`,
                    },
                });

                if (!response.ok) continue;

                const data: RedditResponse = await response.json();

                if (data.data && data.data.children) {
                    for (const child of data.data.children) {
                        const post = child.data;
                        if (!seenPostIds.has(post.id) && !post.url.includes('v.redd.it')) {
                            seenPostIds.add(post.id);
                            allPosts.push(post);
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Error searching Reddit for "${searchTerm}":`, error);
            }
        }

        // Step 3: Sort by score and take top results
        allPosts.sort((a, b) => b.score - a.score);
        const topPosts = allPosts.slice(0, 4);

        console.log(`✅ Returning ${topPosts.length} top Reddit posts for ${districtLabel}`);

        const response = { posts: topPosts };
        serverCache.set(cacheKey, response, 60 * 60); // Cache for 1 hour

        return NextResponse.json(response);

    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('❌ Error in district Reddit API:', err.message || error);
        return NextResponse.json({ posts: [] });
    }
}
