import { NextRequest, NextResponse } from 'next/server';
import { serverCache, generateCacheKey } from '@/src/lib/cache';
import { getFromDbCache, setInDbCache, generateDistrictCacheKey } from '@/lib/db-cache';
import { COUNTRY_SEARCH_LOCALE } from '@/lib/country';
import { PK_PROVINCES, type PkProvinceCode } from '@/lib/pk/parties';

/**
 * Provincial coverage and the issues running through it.
 *
 * Two decisions worth stating.
 *
 * **`gl=pk` is doing most of the disambiguation.** The obvious fear with Punjab is
 * Indian Punjab; Day-0 measurement put the worst-case query at 8/8 Pakistani results.
 * The subject filter below is defence in depth, and it filters on Indian *subject
 * matter* rather than Indian outlets, because a Pakistani story on an Indian outlet is
 * a legitimate result and an Indian story on a Pakistani outlet is not.
 *
 * **"Issues in the news" is counted, not inferred.** An LLM asked "what are the issues
 * in Balochistan" will produce a fluent list whether or not any of it is in the
 * retrieved coverage, and there is no way for a reader to check it. So issues are
 * matched against a fixed vocabulary of Pakistani policy terms and reported with the
 * count of headlines that mention them, and every issue carries the headlines that
 * produced it. An issue nobody wrote about this week does not appear.
 */

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

interface Issue {
  id: string;
  label: string;
  labelUr: string;
  count: number;
  headlines: Headline[];
}

interface ProvinceNewsResponse {
  province: PkProvinceCode;
  headlines: Headline[];
  issues: Issue[];
  fetchedAt: string;
}

const SERPAPI = 'https://serpapi.com/search';
const { gl, hl } = COUNTRY_SEARCH_LOCALE.PK;

/**
 * Per-province query.
 *
 * Built from the provincial assembly, the chief minister and the two or three cities
 * whose names are unambiguous, rather than the province name alone: "Sindh" alone
 * returns national coverage that merely mentions Sindh, while "Karachi" returns
 * coverage that is about it.
 *
 * ICT is the exception and has to be handled as one — Islamabad Capital Territory is
 * not a province, has no provincial assembly and no chief minister, so a query built
 * from that template would return nothing.
 */
const QUERY: Record<PkProvinceCode, string> = {
  PB: '"Punjab Assembly" OR "Chief Minister Punjab" OR "Punjab government" OR Lahore OR Faisalabad OR Multan OR Rawalpindi',
  SD: '"Sindh Assembly" OR "Chief Minister Sindh" OR "Sindh government" OR Karachi OR Hyderabad OR Sukkur',
  KP: '"Khyber Pakhtunkhwa Assembly" OR "Chief Minister Khyber Pakhtunkhwa" OR "KP government" OR Peshawar OR Mardan OR Swat',
  BA: '"Balochistan Assembly" OR "Chief Minister Balochistan" OR "Balochistan government" OR Quetta OR Gwadar OR Turbat',
  ICT: '"Islamabad Capital Territory" OR "Islamabad administration" OR "National Assembly" Islamabad OR "Islamabad High Court" OR "Capital Development Authority"',
};

const INDIA_SUBJECT =
  /\b(modi|bjp|lok sabha|rajya sabha|ayushman|yojana|crore|amritsar|chandigarh|ludhiana|jalandhar|new delhi)\b/i;

/**
 * Issue vocabulary.
 *
 * Written for Pakistani coverage, not translated from a US taxonomy: load-shedding,
 * the IMF programme, wheat support price, the Benazir Income Support Programme and
 * enforced disappearances are the things Pakistani political reporting is actually
 * about, and none of them appear in a US issue list.
 */
const ISSUES: Array<{ id: string; label: string; labelUr: string; patterns: RegExp }> = [
  {
    id: 'energy',
    label: 'Electricity and load-shedding',
    labelUr: 'بجلی اور لوڈ شیڈنگ',
    patterns: /\b(electricity|load[- ]?shedding|power (?:outage|tariff|sector)|k-?electric|wapda|iesco|lesco|grid|circular debt)\b/i,
  },
  {
    id: 'gas',
    label: 'Gas and fuel',
    labelUr: 'گیس اور ایندھن',
    patterns: /\b(sui gas|gas (?:load|tariff|supply|shortage)|lng|petrol(?:eum)? price|diesel)\b/i,
  },
  {
    id: 'economy',
    label: 'Economy and the IMF programme',
    labelUr: 'معیشت اور آئی ایم ایف پروگرام',
    patterns: /\b(imf|inflation|rupee|budget|tax(?:ation)?|fbr|economic|debt|world bank|adb|revenue)\b/i,
  },
  {
    id: 'security',
    label: 'Security and militancy',
    labelUr: 'سلامتی اور شدت پسندی',
    patterns: /\b(terror(?:ism|ist)?|militant|ttp|blast|attack|security forces|operation|check ?post|suicide bomb)\b/i,
  },
  {
    id: 'water',
    label: 'Water and irrigation',
    labelUr: 'پانی اور آبپاشی',
    patterns: /\b(water (?:crisis|shortage|supply|scarcity)|irsa|canal|irrigation|indus|dam|drought)\b/i,
  },
  {
    id: 'floods',
    label: 'Floods and climate',
    labelUr: 'سیلاب اور موسمیاتی تبدیلی',
    patterns: /\b(flood(?:ing|s)?|monsoon|rain(?:fall|s)|ndma|pdma|climate|heatwave|glacier)\b/i,
  },
  {
    id: 'health',
    label: 'Health',
    labelUr: 'صحت',
    patterns: /\b(health|hospital|polio|dengue|vaccin|doctors?|clinic|drug regulatory|sehat card)\b/i,
  },
  {
    id: 'education',
    label: 'Education',
    labelUr: 'تعلیم',
    patterns: /\b(education|school(?:s|ing)?|universit|student|teacher|hec|matric|curriculum)\b/i,
  },
  {
    id: 'agriculture',
    label: 'Agriculture and wheat',
    labelUr: 'زراعت اور گندم',
    patterns: /\b(wheat|farmer|agricultur|crop|fertilis|fertiliz|sugarcane|cotton|support price)\b/i,
  },
  {
    id: 'welfare',
    label: 'Social protection',
    labelUr: 'سماجی تحفظ',
    patterns: /\b(bisp|benazir income support|kafaalat|ehsaas|ration|subsid(?:y|ies)|pension|welfare)\b/i,
  },
  {
    id: 'governance',
    label: 'Local government and devolution',
    labelUr: 'مقامی حکومت اور اختیارات کی منتقلی',
    patterns: /\b(local government|nfc award|devolution|18th amendment|municipal|union council|mayor|commissioner)\b/i,
  },
  {
    id: 'courts',
    label: 'Courts and accountability',
    labelUr: 'عدالتیں اور احتساب',
    patterns: /\b(supreme court|high court|nab|accountability|verdict|petition|bail|judge|contempt|fia)\b/i,
  },
  {
    id: 'elections',
    label: 'Elections and the ECP',
    labelUr: 'انتخابات اور الیکشن کمیشن',
    patterns: /\b(election|ecp|by-?poll|by-?election|constituenc|delimitation|returning officer|senate poll)\b/i,
  },
  {
    id: 'rights',
    label: 'Rights and missing persons',
    labelUr: 'حقوق اور لاپتہ افراد',
    patterns: /\b(missing persons?|enforced disappearance|human rights|protest|sit-?in|dharna|press freedom)\b/i,
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure and CPEC',
    labelUr: 'انفراسٹرکچر اور سی پیک',
    patterns: /\b(cpec|motorway|highway|metro|railway|gwadar port|infrastructure|road project|orange line)\b/i,
  },
];

/**
 * Public-affairs relevance.
 *
 * The city names in each query are what make the retrieval local — "Sindh" alone
 * returns national coverage that merely mentions Sindh — but they also pull in
 * everything else that happens in a city of eleven million. A first run of the Punjab
 * query returned a PCB under-17 skills camp in Faisalabad and a feature on Multan's
 * mango-gifting tradition alongside the monsoon death toll.
 *
 * A headline is kept if it is about government, or about one of the policy issues this
 * route already knows how to count. Nothing else is a province rollup's business.
 */
const GOVERNANCE =
  /\b(assembly|government|govt|minister|ministry|cabinet|governor|chief secretary|commissioner|policy|bill|ordinance|act\b|legislation|court|judge|police|budget|opposition|coalition|party|pti|pml|ppp|mqm|jui|anp|bnp|election|senate|\bmpa\b|\bmna\b|protest|strike|corruption|inquiry|probe|summoned|notification|resolution|tribunal|authority|department)\b/i;

function isPublicAffairs(title: string): boolean {
  if (GOVERNANCE.test(title)) return true;
  return ISSUES.some((issue) => issue.patterns.test(title));
}

function serpKey(): string | null {
  return process.env.SERPAPI_KEY?.trim().replace(/^["']|["']$/g, '') || null;
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes('ago')) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/**
 * Recency has to be enforced here, not by the API.
 *
 * `engine=google_news` accepts SerpAPI's `tbs=qdr:*` parameter and then ignores it — a
 * 2018 article came back ranked alongside 2026 coverage in testing. Sending the
 * parameter anyway would be worse than useless: it reads as though recency were
 * handled. So no `tbs` is sent and the cut is made in code, on the date each result
 * actually carries.
 *
 * Undated results are kept. Google omits the date on a meaningful share of Pakistani
 * results, and dropping them would remove genuine coverage to no benefit — the failure
 * being guarded against is a seven-year-old article, and those are dated.
 */
const MAX_AGE_DAYS = 45;

function isRecent(value: string | undefined, maxDays = MAX_AGE_DAYS): boolean {
  if (!value) return true;

  const relative = value.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i);
  if (relative) {
    const n = parseInt(relative[1], 10);
    const days: Record<string, number> = {
      minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365,
    };
    return n * (days[relative[2].toLowerCase()] ?? 1) <= maxDays;
  }
  if (/ago$/i.test(value.trim())) return true;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return true;
  return (Date.now() - parsed.getTime()) / 86_400_000 <= maxDays;
}

async function fetchProvinceHeadlines(code: PkProvinceCode, apiKey: string): Promise<Headline[]> {
  const url = new URL(SERPAPI);
  url.searchParams.set('engine', 'google_news');
  url.searchParams.set('q', QUERY[code]);
  url.searchParams.set('gl', gl);
  url.searchParams.set('hl', hl);
  url.searchParams.set('num', '100');
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.error(`[pk/province-news] ${code}: HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const results: Array<{
    title?: string;
    link?: string;
    date?: string;
    thumbnail?: string;
    source?: { name?: string };
    stories?: Array<Record<string, unknown>>;
  }> = data.news_results || [];

  const flat = results.flatMap((r) =>
    Array.isArray(r.stories) && r.stories.length > 0 ? (r.stories as typeof results) : [r]
  );

  const seen = new Set<string>();
  const kept: Headline[] = [];
  const offTopic: Headline[] = [];
  let stale = 0;

  for (const r of flat) {
    if (!r.title || !r.link) continue;
    if (INDIA_SUBJECT.test(r.title)) continue;
    if (seen.has(r.title)) continue;
    if (!isRecent(r.date)) {
      stale++;
      continue;
    }
    seen.add(r.title);
    const headline: Headline = {
      title: r.title,
      url: r.link,
      source: r.source?.name || 'Unknown',
      date: formatDate(r.date),
      thumbnail: r.thumbnail,
    };
    (isPublicAffairs(r.title) ? kept : offTopic).push(headline);
  }

  // Balochistan and ICT are covered far more thinly than Punjab, and a filter tuned for
  // Punjab's volume can empty them. Below the floor the wider set is used and the page
  // shows real coverage rather than an empty state — being slightly off-topic beats
  // being blank.
  const MIN_HEADLINES = 6;
  const headlines = kept.length >= MIN_HEADLINES ? kept : [...kept, ...offTopic];

  console.log(
    `[pk/province-news] ${code}: ${headlines.length} headlines ` +
      `(${kept.length} public-affairs, ${offTopic.length} other, ${stale} stale)`
  );
  return headlines;
}

/** Count, don't infer. Every issue carries the headlines that produced it. */
function extractIssues(headlines: Headline[]): Issue[] {
  return ISSUES.map(({ id, label, labelUr, patterns }) => {
    const matched = headlines.filter((h) => patterns.test(h.title));
    return { id, label, labelUr, count: matched.length, headlines: matched.slice(0, 3) };
  })
    .filter((issue) => issue.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('province')?.toUpperCase();
    if (!raw || !(raw in PK_PROVINCES)) {
      return NextResponse.json(
        { error: 'province must be one of PB, SD, KP, BA, ICT' },
        { status: 400 }
      );
    }
    const code = raw as PkProvinceCode;

    const useCache = request.headers.get('x-use-cache') !== 'false';
    const ttl = parseInt(request.headers.get('x-cache-duration-seconds') || '21600', 10);

    // Namespaced: two-letter subnational codes collide outright across countries —
    // Sindh `SD` is South Dakota in the US cache. See lib/country.ts.
    const memoryKey = generateCacheKey('pk-province-news', { province: code });
    const dbKey = generateDistrictCacheKey('news', `pk-province-${code}`);

    const dbCached = await getFromDbCache<ProvinceNewsResponse>(dbKey, useCache);
    if (dbCached) {
      serverCache.set(memoryKey, dbCached, ttl);
      return NextResponse.json(dbCached);
    }

    const memoryCached = serverCache.get<ProvinceNewsResponse>(memoryKey, useCache);
    if (memoryCached) return NextResponse.json(memoryCached);

    const apiKey = serpKey();
    if (!apiKey) {
      console.warn('[pk/province-news] SERPAPI_KEY not set — returning empty');
      return NextResponse.json({ province: code, headlines: [], issues: [], fetchedAt: new Date().toISOString() });
    }

    const headlines = await fetchProvinceHeadlines(code, apiKey);

    // No invented headlines and no placeholder rows. The page renders an empty state.
    const result: ProvinceNewsResponse = {
      province: code,
      headlines: headlines.slice(0, 24),
      issues: extractIssues(headlines),
      fetchedAt: new Date().toISOString(),
    };

    if (headlines.length > 0) {
      serverCache.set(memoryKey, result, ttl);
      await setInDbCache(dbKey, 'news', `pk-province-${code}`, result, ttl);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[pk/province-news] failed:', error);
    return NextResponse.json({ headlines: [], issues: [] }, { status: 200 });
  }
}
