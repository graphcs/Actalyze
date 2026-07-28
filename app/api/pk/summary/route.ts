import { NextRequest, NextResponse } from "next/server";
import { serverCache, generateCacheKey } from "@/src/lib/cache";
import { chatCompletions } from "@/lib/ai-provider";
import {
  getFromDbCache,
  setInDbCache,
  generateDistrictCacheKey,
} from "@/lib/db-cache";
import { normalizePkCode } from "@/lib/pk/constituency-code";
import { getConstituency } from "@/lib/pk/constituencies";
import { PK_PROVINCES, party } from "@/lib/pk/parties";
import type { PkHeadline } from "../news/route";

/**
 * A short constituency briefing.
 *
 * The US route this is modelled on hands the model a district label and asks for
 * "recent political news", with nothing to read. On this deployment
 * `chatCompletions()` resolves to plain OpenAI, which has no web access, so that
 * prompt is an invitation to recall training data. For a US district that produces
 * vague-but-survivable copy. For a Pakistani constituency it would produce confident
 * fiction — a member who lost in 2024, a party that no longer exists under that name
 * — in front of an audience that knows the correct answer.
 *
 * So this route is **grounded**: it retrieves headlines first (via /api/pk/news with
 * `snippets=1`, which uses the one engine that actually returns snippets for
 * Pakistan) and constrains the model to what those headlines say. With no headlines
 * there is no briefing — the page renders `constituency.summaryEmpty` rather than
 * inviting the model to fill the space.
 *
 * GET /api/pk/summary?code=NA-123[&lang=ur]
 */

/** Roster facts the model may state, because they come from na.gov.pk, not recall. */
function rosterFacts(code: string): string | null {
  const c = getConstituency(code);
  if (!c) return null;
  if (c.vacant) {
    return [
      `Constituency: ${c.code}`,
      `Status: VACANT — no member currently returned for this seat.`,
    ].join("\n");
  }
  const province = c.province ? PK_PROVINCES[c.province].nameEn : "unknown";
  return [
    `Constituency: ${c.code}${c.name ? ` (${c.name})` : ""}`,
    `Member of the National Assembly: ${c.memberName}`,
    `Party: ${party(c.party).commonName}`,
    `Province: ${province}`,
    `District(s): ${c.districts.join(", ") || "unknown"}`,
  ].join("\n");
}

async function fetchHeadlines(
  code: string,
  request: NextRequest
): Promise<PkHeadline[]> {
  try {
    // The request's OWN origin, not NEXT_PUBLIC_URL. That variable points at the
    // deployed site (and in local dev, at a different server entirely), so using it
    // here silently retrieves headlines from whatever is running there — or 404s
    // against a deployment that predates these routes, which is what it did.
    const base = request.nextUrl.origin || process.env.NEXT_PUBLIC_URL;
    const url = new URL("/api/pk/news", base);
    url.searchParams.set("code", code);
    // The briefing has to read the coverage, not just list it. google_news returns
    // zero snippets for Pakistan (measured 0/100); this asks for the tbm=nws engine.
    url.searchParams.set("snippets", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "x-use-cache": request.headers.get("x-use-cache") ?? "true",
        "x-cache-duration-seconds":
          request.headers.get("x-cache-duration-seconds") ?? "86400",
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { headlines?: PkHeadline[] };
    return data.headlines ?? [];
  } catch (error) {
    console.warn("⚠️ Could not retrieve headlines to ground the briefing:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const code = normalizePkCode(params.get("code"));
    const lang = params.get("lang") === "ur" ? "ur" : "en";

    if (!code) {
      return NextResponse.json(
        { error: "Invalid or missing constituency code. Expected e.g. NA-123." },
        { status: 400 }
      );
    }

    const facts = rosterFacts(code);
    if (!facts) {
      return NextResponse.json(
        { error: `No National Assembly constituency ${code}` },
        { status: 404 }
      );
    }

    const useCache = request.headers.get("x-use-cache") !== "false";
    const cacheDurationSeconds = parseInt(
      request.headers.get("x-cache-duration-seconds") || "86400",
      10
    );

    const memoryCacheKey = generateCacheKey("pk-summary", { code, lang });
    const dbCacheKey = generateDistrictCacheKey("summary", code, { lang }, "PK");

    const dbCached = await getFromDbCache<{ summary: string }>(dbCacheKey, useCache);
    if (dbCached) {
      serverCache.set(memoryCacheKey, dbCached, cacheDurationSeconds);
      return NextResponse.json(dbCached);
    }
    const memoryCached = serverCache.get<{ summary: string }>(memoryCacheKey, useCache);
    if (memoryCached) return NextResponse.json(memoryCached);

    const provider = chatCompletions();
    if (!provider) {
      console.error("❌ No LLM provider configured");
      return NextResponse.json({ summary: "", grounded: false, sources: [] });
    }

    const headlines = await fetchHeadlines(code, request);

    // No retrieved coverage means no grounded briefing. Returning an empty summary
    // is the honest outcome; the UI has a message for it.
    if (headlines.length === 0) {
      const empty = { summary: "", grounded: false, sources: [], lang };
      serverCache.set(memoryCacheKey, empty, 15 * 60);
      return NextResponse.json(empty);
    }

    const evidence = headlines
      .map((h, i) => {
        const parts = [`[${i + 1}] ${h.title}`, `    source: ${h.source}`];
        if (h.date) parts.push(`    date: ${h.date}`);
        if (h.snippet) parts.push(`    excerpt: ${h.snippet}`);
        return parts.join("\n");
      })
      .join("\n\n");

    const languageRule =
      lang === "ur"
        ? "Write the briefing in URDU. Use standard written Urdu. Keep constituency codes (NA-123), party abbreviations (PML-N, PPP, PTI, MQM-P) and numerals in Latin script exactly as given — Pakistani press does the same."
        : "Write the briefing in English.";

    const prompt = `You are briefing a member of the National Assembly of Pakistan and their staff on their constituency.

VERIFIED CONSTITUENCY RECORD (from the National Assembly Secretariat, na.gov.pk):
${facts}

RETRIEVED NEWS COVERAGE (the ONLY reporting you may draw on):
${evidence}

Write a briefing of 2 to 4 sentences.

HARD RULES — these matter more than fluency:
- Use ONLY the constituency record above and the retrieved coverage. You have no other reliable information about this seat.
- Do NOT state any fact about this constituency, its member, its election results, its development schemes or its local politics that is not in the material above. If you are tempted to add context from memory, leave it out.
- If the coverage is national or provincial rather than about this specific seat, say so plainly — e.g. "Coverage this month is provincial rather than constituency-level" — and summarise what it does cover. Do not pretend it is local.
- Do not invent vote shares, dates, scheme names, or the names of officials.
- No preamble, no headings, no bullet points, no citation markers. Plain prose only.
- ${languageRule}`;

    const response = await fetch(provider.url, {
      method: "POST",
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: prompt }],
        // Low temperature: this is a briefing, not copywriting, and a warmer model
        // is measurably more willing to embellish beyond the supplied evidence.
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      console.error(`LLM error generating PK briefing: ${response.status}`);
      return NextResponse.json({ summary: "", grounded: false, sources: [], lang });
    }

    const data = await response.json();
    const summary: string = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!summary) {
      return NextResponse.json({ summary: "", grounded: false, sources: [], lang });
    }

    const result = {
      summary,
      grounded: true,
      lang,
      sources: headlines.slice(0, 5).map((h) => ({
        title: h.title,
        url: h.url,
        source: h.source,
      })),
      headline_count: headlines.length,
    };

    serverCache.set(memoryCacheKey, result, cacheDurationSeconds);
    await setInDbCache(dbCacheKey, "summary", code, result, cacheDurationSeconds);

    console.log(
      `✅ [${code}] grounded briefing (${lang}) from ${headlines.length} headlines`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating PK constituency briefing:", error);
    return NextResponse.json({ summary: "", grounded: false, sources: [] });
  }
}
