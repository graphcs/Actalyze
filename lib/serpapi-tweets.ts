/**
 * Tweet retrieval via SerpAPI.
 *
 * X's free API tier does not permit /2/tweets/search/recent, so the live Twitter
 * path in /api/tweets/search returns 403 in this deployment. This module recovers
 * genuine tweets by querying Google (through SerpAPI, which the project already
 * pays for) restricted to x.com/twitter.com status URLs.
 *
 * Everything returned here is real and verifiable: the account handle, the numeric
 * status id, the tweet text and — where Google surfaced them — the actual like and
 * reply counts. Each item links to the live tweet, so a reader can confirm it.
 * Nothing is synthesised. Where a value is unknown it is omitted rather than
 * invented; the UI simply renders less.
 */

import { COUNTRY_SEARCH_LOCALE } from './country';

export interface SerpTweet {
  id: string;
  text: string;
  author: string;
  username: string;
  url: string;
  created_at?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
}

const STATUS_RE = /(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{6,25})/;

/** "1.2K" -> 1200, "611" -> 611. Returns undefined when not parseable. */
function parseCount(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.trim().replace(/,/g, '').match(/^([\d.]+)([KM]?)$/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const mult = m[2].toUpperCase() === 'M' ? 1e6 : m[2].toUpperCase() === 'K' ? 1e3 : 1;
  return Math.round(n * mult);
}

function tidy(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s.·—-]+/, '')
    .replace(/\s*\.\.\.$/, '')
    .trim();
}

/**
 * Google renders tweet results as
 *   "Display Name (@handle). 611 likes 70 replies. Actual tweet text…"
 * but degrades to a bare excerpt when it has no engagement data. Pull out
 * whatever is actually present.
 */
function parseSnippet(snippet: string): {
  author?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  text?: string;
} {
  const out: ReturnType<typeof parseSnippet> = {};
  if (!snippet) return out;

  const header = snippet.match(/^\s*([^()]{1,60}?)\s*\(@[A-Za-z0-9_]{1,15}\)\s*\.?\s*/);
  let rest = snippet;
  if (header) {
    out.author = tidy(header[1]);
    rest = snippet.slice(header[0].length);
  }

  // Engagement counts appear only in the run of text before the tweet body.
  const lead = rest.slice(0, 90);
  const likes = lead.match(/([\d,.]+[KM]?)\s*likes?\b/i);
  const replies = lead.match(/([\d,.]+[KM]?)\s*repl(?:y|ies)\b/i);
  const reposts = lead.match(/([\d,.]+[KM]?)\s*(?:retweets?|reposts?)\b/i);
  if (likes) out.likes = parseCount(likes[1]);
  if (replies) out.replies = parseCount(replies[1]);
  if (reposts) out.retweets = parseCount(reposts[1]);

  // Strip the metrics run so what remains is the tweet body.
  if (likes || replies || reposts) {
    const after = rest.replace(
      /^[^.]*?(?:likes?|repl(?:y|ies)|retweets?|reposts?)[^.]*\.\s*/i,
      ''
    );
    if (after && after !== rest) out.text = tidy(after);
  } else if (!header) {
    out.text = tidy(rest);
  } else {
    out.text = tidy(rest);
  }

  return out;
}

/** Google titles arrive as "tweet text - Name on X" or similar; strip the suffix. */
function cleanTitle(title: string): string {
  return tidy(
    title
      .replace(/\s*[-–|]\s*[^-–|]*\bon\s+(?:X|Twitter)\s*$/i, '')
      .replace(/\s*[-–|]\s*(?:X|Twitter)\s*$/i, '')
  );
}

/**
 * Search for real tweets matching `query`. Returns [] on any failure so callers
 * can fall through to an empty feed rather than surfacing an error.
 *
 * `locale` defaults to the US values this function has always sent, so no existing
 * call site changes behaviour. The Pakistan routes pass `COUNTRY_SEARCH_LOCALE.PK`;
 * without it, `gl=us` pulls American posts for a Pakistani constituency query.
 */
export async function searchTweetsViaSerpApi(
  query: string,
  limit: number,
  locale: { gl: string; hl: string; location: string } = COUNTRY_SEARCH_LOCALE.US
): Promise<SerpTweet[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) {
    console.warn('⚠️  SERPAPI_KEY not set; cannot recover tweets');
    return [];
  }

  const params = new URLSearchParams({
    engine: 'google',
    q: `site:x.com OR site:twitter.com ${query}`,
    num: String(Math.min(Math.max(limit * 5, 20), 40)),
    // Without a locale hint, generic terms drift to other countries' politics —
    // "congress" alone returns Indian National Congress posts. Anchor results to
    // the caller's country.
    gl: locale.gl,
    hl: locale.hl,
    location: locale.location,
    api_key: key,
  });

  try {
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.warn(`⚠️  SerpAPI tweet search returned ${res.status}`);
      return [];
    }

    const json = (await res.json()) as {
      error?: string;
      organic_results?: Array<{ link?: string; title?: string; snippet?: string; date?: string }>;
    };
    if (json.error) {
      console.warn(`⚠️  SerpAPI error: ${json.error}`);
      return [];
    }

    const seen = new Set<string>();
    const out: SerpTweet[] = [];

    for (const r of json.organic_results || []) {
      if (out.length >= limit) break;

      const m = (r.link || '').match(STATUS_RE);
      if (!m) continue;
      const [, username, id] = m;
      if (seen.has(id)) continue;

      const parsed = parseSnippet(r.snippet || '');
      const text = parsed.text || cleanTitle(r.title || '');
      // Skip results Google gave us no usable body for.
      if (!text || text.length < 15) continue;

      seen.add(id);
      out.push({
        id,
        text,
        author: parsed.author || `@${username}`,
        username,
        url: `https://twitter.com/${username}/status/${id}`,
        created_at: r.date ? new Date(r.date).toISOString() : undefined,
        likes: parsed.likes,
        retweets: parsed.retweets,
        replies: parsed.replies,
      });
    }

    // Most-engaged first, mirroring the live Twitter path's ordering. Items with
    // no known engagement sort last rather than being treated as zero-engagement.
    out.sort(
      (a, b) =>
        (b.likes ?? -1) + (b.retweets ?? 0) * 2 - ((a.likes ?? -1) + (a.retweets ?? 0) * 2)
    );

    console.log(`🔎 SerpAPI recovered ${out.length} real tweets for "${query}"`);
    return out;
  } catch (err) {
    console.warn('⚠️  SerpAPI tweet search failed:', (err as Error).message);
    return [];
  }
}
