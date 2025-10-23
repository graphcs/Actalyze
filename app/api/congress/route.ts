import { NextRequest, NextResponse } from "next/server";

// Cache Congress data for 1 hour
let cachedCongressData: CongressBill[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface CongressBill {
  id: string;
  title: string;
  sponsor: string;
  committee: string;
  status: string;
  state?: string;
  introducedDate?: string;
  summary?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("id");

    // Check cache
    const now = Date.now();
    if (cachedCongressData && (now - cacheTimestamp) < CACHE_DURATION && !billId) {
      return NextResponse.json(cachedCongressData);
    }

    // Congress.gov API requires an API key
    // For MVP, we'll use mock data and structure for future integration
    // To get real data: https://api.congress.gov/v3/

    const apiKey = process.env.CONGRESS_API_KEY;

    if (!apiKey) {
      console.log("No Congress API key found, returning mock data");
      return NextResponse.json(getMockCongressData());
    }

    // If we have an API key, fetch real data
    // Example: https://api.congress.gov/v3/bill/118?api_key=YOUR_KEY
    const baseUrl = "https://api.congress.gov/v3";

    if (billId) {
      // Fetch specific bill
      const response = await fetch(
        `${baseUrl}/bill/${billId}?api_key=${apiKey}`,
        { next: { revalidate: 3600 } } // Cache for 1 hour
      );

      if (!response.ok) {
        throw new Error("Failed to fetch bill data");
      }

      const data = await response.json();
      return NextResponse.json(transformBillData(data));
    }

    // Fetch recent bills
    const response = await fetch(
      `${baseUrl}/bill?api_key=${apiKey}&limit=20&sort=updateDate desc`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Congress data");
    }

    const data = await response.json();
    const result = data.bills?.map(transformBillData) || getMockCongressData();

    // Cache the results
    cachedCongressData = result;
    cacheTimestamp = now;

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error fetching Congress data:", error);
    return NextResponse.json(getMockCongressData());
  }
}

function transformBillData(bill: Record<string, unknown>): CongressBill {
  const sponsors = bill.sponsors as Array<{ fullName?: string; state?: string }> | undefined;
  const committees = bill.committees as Array<{ name?: string }> | undefined;
  const latestAction = bill.latestAction as { text?: string } | undefined;
  const summary = bill.summary as { text?: string } | undefined;

  return {
    id: (bill.number as string) || "Unknown",
    title: (bill.title as string) || "Unknown Bill",
    sponsor: sponsors?.[0]?.fullName || "Unknown Sponsor",
    committee: committees?.[0]?.name || "Unknown Committee",
    status: latestAction?.text || "Introduced",
    state: sponsors?.[0]?.state || undefined,
    introducedDate: (bill.introducedDate as string) || undefined,
    summary: summary?.text || undefined,
  };
}

function getMockCongressData(): CongressBill[] {
  return [
    {
      id: "HR-1234",
      title: "Infrastructure Investment and Jobs Act",
      sponsor: "Sen. Doe (D-CA)",
      committee: "Energy & Commerce",
      status: "Floor Consideration",
      state: "CA",
      introducedDate: "2024-01-15",
      summary: "A bill to invest in infrastructure and create jobs across transportation, broadband, and energy sectors.",
    },
    {
      id: "S-5678",
      title: "Affordable Care Act Enhancement",
      sponsor: "Rep. Smith (R-TX)",
      committee: "Ways and Means",
      status: "Committee Review",
      state: "TX",
      introducedDate: "2024-02-10",
      summary: "Legislation to strengthen and expand healthcare coverage under the Affordable Care Act.",
    },
    {
      id: "HR-2468",
      title: "Agricultural Innovation Act",
      sponsor: "Sen. Johnson (R-IA)",
      committee: "Agriculture, Nutrition, and Forestry",
      status: "Passed Senate",
      state: "IA",
      introducedDate: "2024-01-05",
      summary: "Support for American farmers through research grants and rural development programs.",
    },
    {
      id: "S-1357",
      title: "National Defense Authorization",
      sponsor: "Rep. Williams (D-VA)",
      committee: "Armed Services",
      status: "Conference Committee",
      state: "VA",
      introducedDate: "2023-12-20",
      summary: "Annual defense policy bill setting funding levels and policy for the Department of Defense.",
    },
    {
      id: "HR-3690",
      title: "Climate Action and Resilience",
      sponsor: "Sen. Garcia (D-WA)",
      committee: "Environment and Public Works",
      status: "Introduced",
      state: "WA",
      introducedDate: "2024-03-01",
      summary: "Comprehensive climate legislation addressing emissions reduction and clean energy investment.",
    },
    {
      id: "S-8024",
      title: "Education Equity and Funding",
      sponsor: "Rep. Martinez (D-NY)",
      committee: "Education and Labor",
      status: "Markup",
      state: "NY",
      introducedDate: "2024-02-20",
      summary: "Increase federal funding for K-12 education with focus on underserved communities.",
    },
  ];
}
