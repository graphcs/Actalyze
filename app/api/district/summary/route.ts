import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

/**
 * GET /api/district/summary?district=VA05
 * Returns a Sonar-generated summary of top issues in a congressional district
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

    // Parse district code (e.g., "VA05" -> state: "VA", district: "05")
    const match = districtCode.match(/^([A-Z]{2})(\d{2})$/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid district code format' },
        { status: 400 }
      );
    }

    const [, stateCode, districtNum] = match;
    const districtLabel = `${stateCode}-${parseInt(districtNum)}`;

    console.log(`🔍 Fetching hyperlocal summary for district ${districtLabel}`);

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ API key not set, returning placeholder');
      return NextResponse.json({
        summary: `District ${districtLabel} local political news and developments.`
      });
    }

    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const baseURL = useOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (useOpenRouter) {
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Actalyze';
    }

    const response = await fetch(baseURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: useOpenRouter ? 'perplexity/sonar-pro' : 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Summarize the top political news and issues in congressional district ${districtLabel} this week. Focus on: local political developments, community concerns, legislative actions affecting the district, and any newsworthy events. Write 2-3 concise sentences. Be specific and factual.`,
          },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`Sonar API error: ${response.status}`);
      return NextResponse.json({
        summary: `Congressional district ${districtLabel} news and local political developments.`
      });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return NextResponse.json({
        summary: `District ${districtLabel} local news and political updates.`
      });
    }

    console.log(`✅ Generated summary for ${districtLabel}`);

    return NextResponse.json({
      summary
    });

  } catch (error) {
    console.error('Error generating district summary:', error);
    return NextResponse.json({
      summary: "Local district news and political updates."
    });
  }
}
