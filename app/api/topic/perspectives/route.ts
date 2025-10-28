import { NextRequest, NextResponse } from "next/server";

export interface PartyPerspective {
  democrats: {
    summary: string;
    talkingPoints: string[];
  };
  republicans: {
    summary: string;
    talkingPoints: string[];
  };
}

/**
 * GET /api/topic/perspectives?topic=...
 * Returns AI-generated summaries of Democrat and Republican perspectives
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    console.log(`🤖 Generating party perspectives for: "${topic}"`);

    // Generate both perspectives in parallel
    const [democratResponse, republicanResponse] = await Promise.all([
      generatePerspective(topic, "Democrats", apiKey),
      generatePerspective(topic, "Republicans", apiKey),
    ]);

    return NextResponse.json({
      democrats: democratResponse,
      republicans: republicanResponse,
    } as PartyPerspective);

  } catch (error) {
    console.error('❌ Error generating perspectives:', error);
    return NextResponse.json(
      {
        democrats: "Unable to generate perspective at this time.",
        republicans: "Unable to generate perspective at this time.",
      },
      { status: 500 }
    );
  }
}

async function generatePerspective(
  topic: string,
  party: string,
  apiKey: string
): Promise<{ summary: string; talkingPoints: string[] }> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
        'X-Title': 'Actalyze',
      },
      body: JSON.stringify({
        model: 'perplexity/llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a political analyst summarizing party positions. Provide concise, factual, neutral summaries. Respond in JSON format with "summary" (2-3 sentences) and "talkingPoints" (array of 3-4 bullet points).',
          },
          {
            role: 'user',
            content: `What are ${party} saying about "${topic}"? Provide:
1. A brief summary (2-3 sentences) of their public position
2. 3-4 key talking points they're emphasizing

Return as JSON: {"summary": "...", "talkingPoints": ["...", "...", "..."]}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status}`);
      return {
        summary: `Unable to determine ${party} position at this time.`,
        talkingPoints: [],
      };
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      return {
        summary: `No perspective available for ${party}.`,
        talkingPoints: [],
      };
    }

    const parsed = JSON.parse(message);
    return {
      summary: parsed.summary || `No perspective available for ${party}.`,
      talkingPoints: parsed.talkingPoints || [],
    };
  } catch (error) {
    console.error(`Error generating ${party} perspective:`, error);
    return {
      summary: `Unable to determine ${party} position at this time.`,
      talkingPoints: [],
    };
  }
}
