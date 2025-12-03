import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

/**
 * GET /api/district/geocode?lat=38.9072&lng=-77.0369
 * GET /api/district/geocode?address=123 Main St, Washington DC
 * Returns congressional district using Gemini Flash via OpenRouter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat && !lng && !address) {
      return NextResponse.json(
        { error: 'Missing lat/lng or address parameters' },
        { status: 400 }
      );
    }

    // Build cache key - round coordinates for cache efficiency
    let cacheKey: string;
    let locationDesc: string;

    if (lat && lng) {
      const roundedLat = Math.round(parseFloat(lat) * 100) / 100;
      const roundedLng = Math.round(parseFloat(lng) * 100) / 100;
      cacheKey = generateCacheKey('geocode', { lat: roundedLat, lng: roundedLng });
      locationDesc = `coordinates ${lat}, ${lng}`;
    } else {
      cacheKey = generateCacheKey('geocode', { address: address!.toLowerCase().trim() });
      locationDesc = `address "${address}"`;
    }

    // Check cache first
    const cached = serverCache.get<{ district: string; state: string }>(cacheKey, true);
    if (cached) {
      console.log(`✅ Cache HIT for geocode: ${cached.district}`);
      return NextResponse.json(cached);
    }

    console.log(`🗺️  Looking up district for ${locationDesc}`);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        district: null,
        state: null,
        error: "API key not configured"
      });
    }

    // Use Gemini Flash - fast and cheap
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
        'X-Title': 'Actalyze',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: `What US congressional district contains ${locationDesc}? Reply with ONLY a JSON object, no other text: {"district":"XX00","state":"XX"} where XX is 2-letter state code and 00 is 2-digit district number. For at-large states use 01. Example: {"district":"NJ07","state":"NJ"}`
          }
        ],
        temperature: 0,
        max_tokens: 50,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`Gemini API error: ${response.status}`);
      return NextResponse.json({ district: null, state: null, error: "API error" });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ district: null, state: null, error: "No response" });
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const result = JSON.parse(jsonStr);

    if (!result.district || !result.state) {
      console.log(`⚠️ Invalid response: ${content}`);
      return NextResponse.json({ district: null, state: null });
    }

    // Normalize district format (ensure 2-digit district number)
    const stateCode = result.state.toUpperCase();
    const districtNum = result.district.replace(/[^0-9]/g, '').padStart(2, '0');
    const district = `${stateCode}${districtNum}`;

    const finalResult = { district, state: stateCode };

    // Cache for 24 hours
    serverCache.set(cacheKey, finalResult, 86400);
    console.log(`✅ Found and cached district: ${district}`);

    return NextResponse.json(finalResult);

  } catch (error) {
    console.error('Error geocoding:', error);
    return NextResponse.json({
      district: null,
      state: null,
      error: "Geocoding error"
    });
  }
}
