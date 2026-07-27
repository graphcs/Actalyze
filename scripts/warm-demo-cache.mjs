#!/usr/bin/env node
/**
 * Pre-warm the caches the demo touches.
 *
 * Several endpoints are slow on a cold cache (SerpAPI + LLM classification can take
 * 30-60s for a district). On a cold hit the UI briefly shows "unavailable" empty
 * states, which reads as a broken product. Everything here writes to the same DB
 * cache the app reads, so a warmed deployment answers instantly.
 *
 * ⚠️ QUOTA COST — DO NOT RUN THIS IN A LOOP. A district that is genuinely cold costs
 * roughly 11 SerpAPI searches (~9 for AI-intel tweet recovery, ~2 for grounded
 * polling), so a full cold pass over the district list is ~250-300 searches out of a
 * 5000/month plan; states and trending add more. Warm ONCE, then run the E2E suite
 * against the warm cache (a warmed district costs zero searches). Districts already
 * in the cache are near-free, so re-running after a partial failure is cheap — but a
 * casual `for i in 1..5` will burn the month. Check the balance first:
 *   curl -s "https://serpapi.com/account?api_key=$SERPAPI_KEY"
 *
 * TTL: the cache routes let the CALLER pick how long an entry lives, via the
 * `x-cache-duration-seconds` request header (the app's own fetchWithCache sends at
 * most 24h). The warmer deliberately requests a LONGER TTL than that 24h default —
 * see CACHE_TTL_SECONDS below — so a demo warmed on Monday is still warm on Friday
 * instead of expiring mid-presentation and dropping the presenter onto the 40s cold
 * path. Not every route honours the header; see the note on CACHE_TTL_SECONDS.
 *
 * Usage:
 *   node scripts/warm-demo-cache.mjs [baseUrl]
 * Defaults to http://localhost:3000. Pass https://www.actalyze.com to warm production.
 *
 * Optional env:
 *   WARM_BASE_URL=...        same as the positional baseUrl argument
 *   WARM_DISTRICTS=NY01,OK05 override the district list (comma separated)
 *   WARM_STATES=NY,OK        override the state list (comma separated)
 *   WARM_CONCURRENCY=2       district fan-out width (default 2)
 */

// ---------------------------------------------------------------------------
// EDIT ME — demo coverage lists.
//
// These MUST stay in sync with tests/e2e/districts.spec.ts (DISTRICTS), which
// asserts that none of these pages show an empty state. Adding a district to
// the spec without adding it here means the spec's first run pays the full
// 30-60s cold-cache cost for that district and will probably time out.
// ---------------------------------------------------------------------------

/** Congressional districts covered by the government demo. */
const DISTRICTS = [
  // New York (explicitly requested)
  'NY01', 'NY12', 'NY03',
  // Oklahoma (explicitly requested)
  'OK01', 'OK05',
  // New Jersey (explicitly requested)
  'NJ07', 'NJ09',
  // West / Southwest
  'CA12', 'CA22', 'AZ06', 'WA08', 'CO08',
  // Texas / South
  'TX38', 'TX09', 'FL27', 'GA07', 'NC09', 'VA05',
  // Midwest / Rust belt
  'OH09', 'MI07', 'IL14', 'MN02', 'WI03', 'PA07',
];

/** States covered by the /state/<code> pages and the national map. */
const STATES = [
  'CA', 'TX', 'PA', 'GA', 'NY', 'NJ', 'OK', 'OH', 'FL',
  'AZ', 'MI', 'NC', 'VA', 'WA', 'CO', 'MN', 'WI', 'IL',
];

/**
 * TTL requested for every warmed entry, in seconds. 7 days.
 *
 * The app's own client (src/lib/fetchWithCache.ts) asks for 24h at most, and the
 * routes default to 86400 when the header is absent — so without this the whole
 * warm run expires a day later. Overridable with WARM_TTL_SECONDS.
 *
 * Verified to honour `x-cache-duration-seconds` (memory + Supabase district_cache):
 *   /api/district/news, /api/district/summary, /api/district/polling,
 *   /api/district/ai-intel (floored at 6h via Math.max), /api/topic/perspectives,
 *   /api/state/news, /api/trending, /api/tweets/search
 * Honours it for the in-memory cache only (no DB write — lost on server restart):
 *   /api/state/polling
 * Ignores it entirely, keeping its own default:
 *   /api/district/tweets (untimed serverCache.set), /api/map/state-news (same),
 *   /api/congress (module-level 1h), /api/topic/headlines (no caching at all)
 *
 * Caveat: a cache HIT does not extend the stored expiry. Routes re-seed the in-memory
 * cache with this TTL on a DB hit, but the Supabase row keeps the expires_at it was
 * written with. So the 7-day DB TTL only lands on entries this run actually
 * generated. Re-warming an already-warm demo therefore does NOT push its expiry out;
 * to genuinely extend it the entries must be regenerated, which costs quota.
 */
const CACHE_TTL_SECONDS = Number(process.env.WARM_TTL_SECONDS || 604_800);

// ---------------------------------------------------------------------------

/** Endpoints with no per-entity parameter. */
const GLOBAL = ['/api/trending', '/api/congress'];

const BASE = process.argv[2] || process.env.WARM_BASE_URL || 'http://localhost:3000';

const districts = process.env.WARM_DISTRICTS
  ? process.env.WARM_DISTRICTS.split(',').map((d) => d.trim().toUpperCase()).filter(Boolean)
  : DISTRICTS;
const states = process.env.WARM_STATES
  ? process.env.WARM_STATES.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
  : STATES;
const DISTRICT_CONCURRENCY = Number(process.env.WARM_CONCURRENCY || 2);

/**
 * WARM_FORCE=1 sends `x-use-cache: false`, which makes each route regenerate
 * instead of serving its cached copy.
 *
 * This is the only way to push an existing entry's expiry out. A cache HIT
 * re-seeds the in-memory copy with the requested TTL but leaves the Supabase
 * row's original expires_at alone, so a plain re-warm of an already-warm demo
 * does nothing for its lifetime. Forcing regeneration is what actually applies
 * CACHE_TTL_SECONDS to the stored rows.
 *
 * It costs real quota - every district goes down the cold path - so use it
 * deliberately: once, after a deploy, to bake in a long TTL before a demo.
 * Not for routine re-warming.
 */
const FORCE = process.env.WARM_FORCE === '1';

/** Rolling tally so the run ends with a verdict rather than a wall of lines. */
const stats = { ok: 0, warn: 0, fail: 0, slowest: [], problems: [] };

async function hit(path, timeoutMs = 180_000) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'actalyze-cache-warmer',
        // Ask for a longer-lived entry than the app's 24h default (see CACHE_TTL_SECONDS).
        'x-cache-duration-seconds': String(CACHE_TTL_SECONDS),
        // Only when explicitly forced - see FORCE above.
        ...(FORCE ? { 'x-use-cache': 'false' } : {}),
      },
    });
    const ms = Date.now() - started;
    let detail = '';
    try {
      const body = await res.json();
      if (Array.isArray(body)) detail = `${body.length} items`;
      else if (body?.error) detail = `error: ${body.error}`;
      else if (body?.sample_size !== undefined) detail = `sample=${body.sample_size}`;
      else if (body?.headlines) detail = `${body.headlines.length} headlines`;
      else if (body?.tweets) detail = `${body.tweets.length} tweets`;
      else if (body?.democrats) detail = 'perspectives ok';
      else if (body?.summary) detail = `summary ${body.summary.length} chars`;
      else if (body?.trend !== undefined) detail = body.trend ? `trend=${body.trend}` : 'no poll';
    } catch {
      detail = 'non-JSON';
    }
    console.log(`  ${res.ok ? '✅' : '⚠️ '} ${String(ms).padStart(6)}ms  ${path}  ${detail}`);
    stats.slowest.push({ path, ms });
    if (res.ok) stats.ok++;
    else {
      stats.warn++;
      stats.problems.push(`HTTP ${res.status}  ${path}  ${detail}`);
    }
    return res.ok;
  } catch (err) {
    const ms = Date.now() - started;
    console.log(`  ❌ ${String(ms).padStart(6)}ms  ${path}  ${err.message}`);
    stats.slowest.push({ path, ms });
    stats.fail++;
    stats.problems.push(`FAILED   ${path}  ${err.message}`);
    return false;
  }
}

/** Run tasks with limited concurrency so we do not stampede the upstreams. */
async function pool(tasks, size = 3) {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) {
      const task = queue.shift();
      await task();
    }
  });
  await Promise.all(workers);
}

const runStarted = Date.now();
console.log(`Warming ${BASE}`);
console.log(
  `  ${districts.length} districts, ${states.length} states, concurrency ${DISTRICT_CONCURRENCY}, ` +
    `requested TTL ${(CACHE_TTL_SECONDS / 86400).toFixed(1)}d` +
    (FORCE ? '\n  ⚠️  WARM_FORCE=1 — regenerating everything, this spends SerpAPI quota' : '') +
    '\n'
);

console.log('Global:');
await pool(GLOBAL.map((p) => () => hit(p)));

console.log('\nStates:');
await pool(
  states.flatMap((s) => [
    () => hit(`/api/state/news?state=${s}`),
    () => hit(`/api/state/polling?state=${s}`),
    () => hit(`/api/map/state-news?state=${s}`),
    () => hit(`/api/topic/perspectives?topic=${encodeURIComponent(`${s} politics`)}`),
  ])
);

// Every endpoint app/district/[code]/page.tsx fetches. `perspectives` and
// `tweets` are included because the page renders "Loading perspective..." until
// perspectives resolves — an empty state the E2E spec fails on.
console.log('\nDistricts (ai-intel is the slow one):');
await pool(
  districts.flatMap((d) => [
    () => hit(`/api/district/news?district=${d}`),
    () => hit(`/api/district/summary?district=${d}`),
    () => hit(`/api/district/polling?district=${d}`),
    () => hit(`/api/district/tweets?district=${d}`),
    () => hit(`/api/topic/perspectives?topic=${encodeURIComponent(`${d} district`)}`),
    () => hit(`/api/district/ai-intel?district=${d}`, 240_000),
  ]),
  DISTRICT_CONCURRENCY
);

console.log('\nTrending topic detail:');
try {
  const topics = await (await fetch(`${BASE}/api/trending`)).json();
  const ids = (Array.isArray(topics) ? topics : []).slice(0, 5);
  await pool(
    ids.flatMap((t) => [
      () => hit(`/api/topic/headlines?topic=${encodeURIComponent(t.title)}`),
      () => hit(`/api/tweets/search?query=${encodeURIComponent(t.title)}&limit=4`),
      () => hit(`/api/topic/perspectives?topic=${encodeURIComponent(t.title)}`),
    ])
  );
} catch (err) {
  console.log(`  ❌ could not enumerate trending topics: ${err.message}`);
}

const totalMs = Date.now() - runStarted;
const slowest = stats.slowest.sort((a, b) => b.ms - a.ms).slice(0, 8);

console.log('\n─── Summary ───────────────────────────────────────────');
console.log(`  ok: ${stats.ok}   non-2xx: ${stats.warn}   failed: ${stats.fail}`);
console.log(`  wall clock: ${(totalMs / 1000).toFixed(1)}s`);
if (slowest.length) {
  console.log('  slowest:');
  for (const s of slowest) console.log(`    ${String(s.ms).padStart(6)}ms  ${s.path}`);
}
if (stats.problems.length) {
  console.log('  problems:');
  for (const p of stats.problems) console.log(`    ${p}`);
}
console.log('\nDone.');
