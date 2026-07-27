#!/usr/bin/env node
/**
 * Pre-warm the caches the demo touches.
 *
 * Several endpoints are slow on a cold cache (SerpAPI + LLM classification can take
 * 30-60s for a district). On a cold hit the UI briefly shows "unavailable" empty
 * states, which reads as a broken product. Everything here writes to the same DB
 * cache the app reads, so a warmed deployment answers instantly.
 *
 * Usage:
 *   node scripts/warm-demo-cache.mjs [baseUrl]
 * Defaults to http://localhost:3000. Pass https://www.actalyze.com to warm production.
 */

const BASE = process.argv[2] || process.env.WARM_BASE_URL || 'http://localhost:3000';

const DISTRICTS = ['CA12', 'PA07', 'TX38', 'NY01', 'MI07'];
const STATES = ['CA', 'TX', 'PA', 'GA', 'MI'];

/** Endpoints with no per-entity parameter. */
const GLOBAL = ['/api/trending', '/api/congress'];

async function hit(path, timeoutMs = 180_000) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'actalyze-cache-warmer' },
    });
    const ms = Date.now() - started;
    let detail = '';
    try {
      const body = await res.json();
      if (Array.isArray(body)) detail = `${body.length} items`;
      else if (body?.sample_size !== undefined) detail = `sample=${body.sample_size}`;
      else if (body?.headlines) detail = `${body.headlines.length} headlines`;
      else if (body?.tweets) detail = `${body.tweets.length} tweets`;
      else if (body?.trend !== undefined) detail = body.trend ? `trend=${body.trend}` : 'no poll';
    } catch {
      detail = 'non-JSON';
    }
    console.log(`  ${res.ok ? '✅' : '⚠️ '} ${String(ms).padStart(6)}ms  ${path}  ${detail}`);
    return res.ok;
  } catch (err) {
    console.log(`  ❌ ${String(Date.now() - started).padStart(6)}ms  ${path}  ${err.message}`);
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

console.log(`Warming ${BASE}\n`);

console.log('Global:');
await pool(GLOBAL.map((p) => () => hit(p)));

console.log('\nStates:');
await pool(
  STATES.flatMap((s) => [
    () => hit(`/api/state/news?state=${s}`),
    () => hit(`/api/state/polling?state=${s}`),
    () => hit(`/api/map/state-news?state=${s}`),
    () => hit(`/api/topic/perspectives?topic=${encodeURIComponent(`${s} politics`)}`),
  ])
);

console.log('\nDistricts (ai-intel is the slow one):');
await pool(
  DISTRICTS.flatMap((d) => [
    () => hit(`/api/district/news?district=${d}`),
    () => hit(`/api/district/summary?district=${d}`),
    () => hit(`/api/district/polling?district=${d}`),
    () => hit(`/api/district/ai-intel?district=${d}`, 240_000),
  ]),
  2
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

console.log('\nDone.');
