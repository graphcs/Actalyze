/**
 * What the province is talking about this week, who owns it, and what is being done.
 *
 * Three joins, none of them a model:
 *
 *   1. Retrieved coverage is **counted** against the issue patterns. No LLM is asked
 *      "what are the issues" — see `lib/pk/issues.ts` for why.
 *   2. Each issue is routed to its department, carrying the jurisdiction caveat where the
 *      subject is not the province's alone.
 *   3. Each issue is matched to the development schemes that address it, with delivery
 *      shown as `31 of 48`.
 *
 * The third join is the one that turns a monitoring dashboard into something an officer
 * can act on: it puts the answer next to the question.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getFromDbCache, setInDbCache, generateDistrictCacheKey } from '@/lib/db-cache';
import { rankIssues, PK_ISSUES } from '@/lib/pk/issues';
import { schemesForIssue, type Scheme } from '@/lib/pk/schemes';
import { COUNTRY_SEARCH_LOCALE } from '@/lib/country';

export const maxDuration = 60;

/**
 * Four angles per province, because SerpAPI's news engine returns ten results per
 * request whatever `num` says — a single query gave a radar built from ten headlines,
 * which is not enough to rank anything from.
 *
 * The fourth query is the one that matters most and is the least obvious: generic
 * province news skews heavily to politics and appointments, while a radar exists to
 * surface what people are *unhappy* about. Asking directly for shortages, protests and
 * complaints is what makes the ranking about the province's problems rather than its
 * press cycle.
 */
const PROVINCES: Record<string, { en: string; queries: string[] }> = {
  PB: {
    en: 'Punjab',
    queries: [
      'Punjab Pakistan',
      'Punjab government Lahore',
      'Punjab Chief Minister',
      'Punjab shortage OR protest OR complaint OR outage',
    ],
  },
  SD: {
    en: 'Sindh',
    queries: [
      'Sindh Pakistan',
      'Sindh government Karachi',
      'Sindh Chief Minister',
      'Sindh shortage OR protest OR complaint OR outage',
    ],
  },
  KP: {
    en: 'Khyber Pakhtunkhwa',
    queries: [
      'Khyber Pakhtunkhwa Pakistan',
      'Khyber Pakhtunkhwa government Peshawar',
      'Khyber Pakhtunkhwa Chief Minister',
      'Khyber Pakhtunkhwa shortage OR protest OR complaint',
    ],
  },
  BA: {
    en: 'Balochistan',
    queries: [
      'Balochistan Pakistan',
      'Balochistan government Quetta',
      'Balochistan Chief Minister',
      'Balochistan shortage OR protest OR complaint',
    ],
  },
};

/**
 * India exclusion.
 *
 * Shared place names (Punjab, Hyderabad), shared party abbreviations and
 * tribune.com.pk versus tribuneindia.com make cross-border contamination the top accuracy
 * risk in any Pakistani news retrieval, and it has bitten this project before — a Kenyan
 * Public Accounts Committee once turned up in a Pakistani committee brief. The rule from
 * that fix applies here too: an outlet is a reason to keep, never on its own a reason to
 * drop.
 */
const INDIA = /\b(modi|bjp|lok sabha|rajya sabha|congress party|yojana|ayushman|crore|amritsar|chandigarh|new delhi|indian punjab|tribuneindia|ndtv|times of india|hindustan)\b/i;
const PAKISTAN = /\b(pakistan|pakistani|punjab assembly|sindh|balochistan|khyber|islamabad|lahore|karachi|peshawar|quetta|multan|rupee|pml|ppp|pti|imran|shehbaz|maryam)\b/i;

function isPakistani(title: string, source: string): boolean {
  if (PAKISTAN.test(title) || /\.pk\b|dawn|geo\.tv|arynews|bolnews|thenews|brecorder|nation\.com/i.test(source)) {
    return true;
  }
  return !INDIA.test(title);
}

interface Item {
  title: string;
  url: string;
  source: string;
  date?: string;
}

async function fetchOne(query: string): Promise<Item[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  const locale = COUNTRY_SEARCH_LOCALE.PK;

  const params = new URLSearchParams({
    engine: 'google',
    tbm: 'nws',
    q: query,
    num: '40',
    gl: locale.gl,
    hl: 'en',
    location: locale.location,
    // `engine=google_news` silently ignores `tbs`, which is how 55 of 100 results once
    // came back older than six months. `tbm=nws` honours it.
    tbs: 'qdr:w',
    api_key: key,
  });

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      news_results?: Array<{ title?: string; link?: string; source?: string; date?: string }>;
    };
    return (json.news_results ?? [])
      .map((r) => ({
        title: r.title ?? '',
        url: r.link ?? '',
        source: typeof r.source === 'string' ? r.source : '',
        date: r.date,
      }))
      .filter((i) => i.title && i.url)
      .filter((i) => isPakistani(i.title, i.source));
  } catch {
    return [];
  }
}

/** All angles at once, deduplicated by URL. A story surfacing on two queries is one
 *  story, and counting it twice would inflate whichever issue it belongs to. */
async function fetchCoverage(queries: string[]): Promise<Item[]> {
  const batches = await Promise.all(queries.map((q) => fetchOne(q).catch(() => [])));
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const item of batches.flat()) {
    const key = item.url.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const limited = checkRateLimit(request, 'pk-radar', { limit: 30, windowMs: 60_000 });
    if (limited) return limited;

    const provinceParam = (request.nextUrl.searchParams.get('province') || 'PB').toUpperCase();
    const province = PROVINCES[provinceParam];
    if (!province) {
      return NextResponse.json({ error: 'unknown province' }, { status: 400 });
    }
    const district = request.nextUrl.searchParams.get('district') || undefined;

    const cacheKey = generateDistrictCacheKey(
      'comms-radar',
      provinceParam,
      district ? { district } : undefined,
      'PK'
    );
    const cached = await getFromDbCache(cacheKey);
    if (cached && request.headers.get('x-use-cache') !== 'false') {
      return NextResponse.json({ ...(cached as object), cached: true });
    }

    const items = await fetchCoverage(province.queries);
    const ranked = rankIssues(items, PK_ISSUES).map((issue) => ({
      ...issue,
      // The answer, next to the question.
      schemes: schemesForIssue(issue.id, district).map((s: Scheme) => ({
        id: s.id,
        adpNumber: s.adpNumber,
        titleEn: s.titleEn,
        titleUr: s.titleUr,
        department: s.department,
        departmentUr: s.departmentUr,
        allocationPkr: s.allocationPkr,
        unit: s.unit,
        unitUr: s.unitUr,
        target: s.target,
        delivered: s.delivered,
        districts: s.districts,
        status: s.status,
      })),
    }));

    const payload = {
      province: provinceParam,
      provinceName: province.en,
      district: district ?? null,
      /** How many items the ranking was computed from. A thin week must read as thin. */
      itemsRetrieved: items.length,
      window: 'past 7 days',
      issues: ranked,
      generatedAt: new Date().toISOString(),
    };

    // Half a day: the radar is a weekly picture, and every refresh spends SerpAPI quota.
    await setInDbCache(cacheKey, 'comms-radar', provinceParam, payload, 12 * 60 * 60 * 1000);
    return NextResponse.json({ ...payload, cached: false });
  } catch (error) {
    console.error('Radar error:', error);
    return NextResponse.json({ error: 'Failed to build the radar' }, { status: 500 });
  }
}
