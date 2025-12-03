import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/district/geocode?address=123 Main St, Washington DC
 * GET /api/district/geocode?lat=38.9072&lng=-77.0369
 * Returns congressional district for an address or coordinates
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Support both address and coordinates
    let locationQuery: string;
    if (lat && lng) {
      locationQuery = `coordinates ${lat}, ${lng}`;
      console.log(`🗺️  Looking up district for coordinates: ${lat}, ${lng}`);
    } else if (address) {
      locationQuery = `address: "${address}"`;
      console.log(`🗺️  Looking up district for address: ${address}`);
    } else {
      return NextResponse.json(
        { error: 'Missing address or lat/lng parameters' },
        { status: 400 }
      );
    }

    // Use OpenRouter/Sonar to find the congressional district
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        district: null,
        error: "Geocoding service unavailable"
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
            content: `What is the U.S. Congressional District for this ${locationQuery}? Return ONLY a JSON object with "district" (in format like "VA05" or "NY01" with 2-digit district number) and "state" (2-letter code). If you cannot determine the district, return null for district. Example: {"district": "VA05", "state": "VA"}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({
        district: null,
        error: "Geocoding failed"
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({
        district: null,
        error: "Could not determine district"
      });
    }

    const result = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

    console.log(`✅ Found district: ${result.district || 'none'}`);

    return NextResponse.json({
      district: result.district || null,
      state: result.state || null
    });

  } catch (error) {
    console.error('Error geocoding address:', error);
    return NextResponse.json({
      district: null,
      error: "Geocoding error"
    });
  }
}
