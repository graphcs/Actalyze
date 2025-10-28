import { NextRequest, NextResponse } from "next/server";

export interface PartyPerspective {
  democrats: string;
  republicans: string;
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
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
): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a political analyst summarizing party positions. Provide concise, factual, neutral summaries of what each party is saying about topics. Keep responses to 2-3 sentences maximum.',
          },
          {
            role: 'user',
            content: `What are ${party} saying about "${topic}"? Provide a brief, factual summary of their public position or commentary.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status}`);
      return `Unable to determine ${party} position at this time.`;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      return `No perspective available for ${party}.`;
    }

    return message.trim();
  } catch (error) {
    console.error(`Error generating ${party} perspective:`, error);
    return `Unable to determine ${party} position at this time.`;
  }
}
