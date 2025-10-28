import { NextRequest, NextResponse } from "next/server";

export interface PartyPerspective {
  democrats: {
    summary: string;
    talkingPoints: string[];
    citations?: string[];
  };
  republicans: {
    summary: string;
    talkingPoints: string[];
    citations?: string[];
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

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API key not configured' },
        { status: 500 }
      );
    }

    const useOpenRouter = !!process.env.OPENROUTER_API_KEY;

    console.log(`🤖 Generating party perspectives for: "${topic}"`);

    // Generate both perspectives in parallel
    const [democratResponse, republicanResponse] = await Promise.all([
      generatePerspective(topic, "Democrats", apiKey, useOpenRouter),
      generatePerspective(topic, "Republicans", apiKey, useOpenRouter),
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
  apiKey: string,
  useOpenRouter: boolean
): Promise<{ summary: string; talkingPoints: string[]; citations?: string[] }> {
  try {
    const baseURL = useOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
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
        model: useOpenRouter ? 'perplexity/sonar' : 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a political analyst summarizing party positions. Provide concise, factual, neutral summaries. Respond ONLY with valid JSON format with "summary" (2-3 sentences) and "talkingPoints" (array of 3-4 bullet points). Do not include any markdown formatting or code blocks.',
          },
          {
            role: 'user',
            content: `What are ${party} saying about "${topic}"? Provide:
1. A brief summary (2-3 sentences) of their public position
2. 3-4 key talking points they're emphasizing

Return ONLY this JSON format with no markdown: {"summary": "...", "talkingPoints": ["...", "...", "..."]}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
        ...(useOpenRouter ? {} : { response_format: { type: "json_object" } }),
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
    let message = data.choices?.[0]?.message?.content;

    if (!message) {
      return {
        summary: `No perspective available for ${party}.`,
        talkingPoints: [],
      };
    }

    // Strip markdown code blocks if present (Perplexity wraps JSON in ```json blocks)
    message = message.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(message);

    // Extract citations from Perplexity response (OpenRouter provides them)
    const citations = useOpenRouter && data.citations ? data.citations : undefined;

    return {
      summary: parsed.summary || `No perspective available for ${party}.`,
      talkingPoints: parsed.talkingPoints || [],
      citations,
    };
  } catch (error) {
    console.error(`Error generating ${party} perspective:`, error);
    return {
      summary: `Unable to determine ${party} position at this time.`,
      talkingPoints: [],
    };
  }
}
