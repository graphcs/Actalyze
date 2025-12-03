import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";

/**
 * GET /api/district/geocode?lat=38.9072&lng=-77.0369
 * GET /api/district/geocode?address=123 Main St, Washington DC
 * Returns congressional district using Census Bureau API (official 118th Congress boundaries)
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

    if (lat && lng) {
      const roundedLat = Math.round(parseFloat(lat) * 1000) / 1000; // ~100m precision
      const roundedLng = Math.round(parseFloat(lng) * 1000) / 1000;
      cacheKey = generateCacheKey('geocode-v2', { lat: roundedLat, lng: roundedLng });
    } else {
      cacheKey = generateCacheKey('geocode-v2', { address: address!.toLowerCase().trim() });
    }

    // Check cache first
    const cached = serverCache.get<{ district: string; state: string }>(cacheKey, true);
    if (cached) {
      console.log(`✅ Cache HIT for geocode: ${cached.district}`);
      return NextResponse.json(cached);
    }

    let latitude: number;
    let longitude: number;

    if (lat && lng) {
      latitude = parseFloat(lat);
      longitude = parseFloat(lng);
      console.log(`🗺️  Looking up district for coordinates: ${latitude}, ${longitude}`);
    } else {
      // Geocode address first using Census Bureau
      console.log(`🗺️  Geocoding address: ${address}`);
      const coords = await geocodeAddress(address!);
      if (!coords) {
        return NextResponse.json({ district: null, state: null, error: "Could not geocode address" });
      }
      latitude = coords.lat;
      longitude = coords.lng;
      console.log(`📍 Geocoded to: ${latitude}, ${longitude}`);
    }

    // Use Census Bureau TIGERweb for congressional districts
    const result = await lookupDistrictCensus(latitude, longitude);

    if (result.district) {
      // Cache for 24 hours
      serverCache.set(cacheKey, result, 86400);
      console.log(`✅ Found and cached district: ${result.district}`);
    } else {
      console.log(`⚠️ Could not determine district for ${latitude}, ${longitude}`);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error geocoding:', error);
    return NextResponse.json({
      district: null,
      state: null,
      error: "Geocoding error"
    });
  }
}

/**
 * Look up congressional district using Census Bureau TIGERweb REST API
 * Uses the 118th Congressional Districts layer
 */
async function lookupDistrictCensus(lat: number, lng: number): Promise<{ district: string | null; state: string | null }> {
  try {
    // Census TIGERweb REST Services - 118th Congressional Districts
    // Layer 0 = 118th Congressional Districts
    const url = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0/query?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&` +
      `outFields=STATE,CD118&returnGeometry=false&f=json`;

    console.log(`🔍 Querying Census TIGERweb for district...`);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Census API error: ${response.status}`);
      return { district: null, state: null };
    }

    const data = await response.json();
    console.log('📊 Census API response:', JSON.stringify(data, null, 2));

    const feature = data.features?.[0];
    if (!feature?.attributes) {
      console.log('No congressional district found in Census response');
      return { district: null, state: null };
    }

    const stateFips = feature.attributes.STATE;
    const districtNum = feature.attributes.CD118;

    if (!stateFips || districtNum === undefined) {
      return { district: null, state: null };
    }

    // Convert FIPS to state abbreviation
    const stateAbbr = FIPS_TO_STATE[stateFips];
    if (!stateAbbr) {
      console.log(`Unknown FIPS code: ${stateFips}`);
      return { district: null, state: null };
    }

    // Format district (00 = at-large, use AL)
    const districtFormatted = districtNum === '00' || districtNum === '98' || districtNum === 0
      ? 'AL'
      : String(districtNum).padStart(2, '0');

    const district = `${stateAbbr}${districtFormatted}`;

    return { district, state: stateAbbr };

  } catch (error) {
    console.error('Error calling Census API:', error);
    return { district: null, state: null };
  }
}

/**
 * Geocode an address to coordinates using Census Bureau
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const match = data.result?.addressMatches?.[0];

    if (!match?.coordinates) {
      return null;
    }

    return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
    };

  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

// FIPS state codes to state abbreviations
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI"
};
