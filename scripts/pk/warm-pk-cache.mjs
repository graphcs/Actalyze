#!/usr/bin/env node
/**
 * Warm the Pakistan demo surfaces.
 *
 * The AI-intel route is the slow one — SerpAPI retrieval plus per-post classification
 * runs tens of seconds cold and about 100ms warm. Everything else is comfortably fast
 * either way, but is warmed too so the first click of a demo is never the slow one.
 *
 * Both languages are warmed: topic labels and insights are translated per language
 * and cached under a language-scoped key, so warming only Urdu leaves an English
 * visitor on the cold path.
 *
 *   node scripts/pk/warm-pk-cache.mjs [baseUrl]
 *
 * QUOTA: a cold constituency costs roughly 5 SerpAPI searches. Warm once before a
 * demo; do not loop.
 */

const BASE = process.argv[2] || process.env.WARM_BASE_URL || 'http://localhost:3000';

/** Seats a demo is most likely to visit: leadership, the major cities, and one vacancy. */
const SEATS = [
  'na-123', // Shehbaz Sharif, Lahore-VII — the Prime Minister's seat
  'na-130', // Nawaz Sharif, Lahore-XIV
  'na-194', // Bilawal Bhutto Zardari, Larkana-I
  'na-120', // Speaker Ayaz Sadiq, Lahore-IV
  'na-247', // Karachi Central-I — three-way MQM-P / PTI / PPP split
  'na-265', // Maulana Fazl-ur-Rehman, Pishin
  'na-31',  // Peshawar-IV — PTI-backed independent
  'na-10',  // Gohar Ali Khan, Buner — PTI chairman sitting as an independent
  'na-1',   // vacant — the app must say so rather than invent a member
];

const PROVINCES = ['pb', 'sd', 'kp', 'ba', 'ict'];
const LANGS = ['ur', 'en'];

async function hit(path, timeoutMs = 240_000) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'actalyze-pk-warmer' },
    });
    let detail = '';
    try {
      const body = await res.json();
      if (Array.isArray(body)) detail = `${body.length} items`;
      else if (body?.sample_size !== undefined) detail = `n=${body.sample_size}`;
      else if (body?.headlines) detail = `${body.headlines.length} headlines`;
      else if (body?.issues) detail = `${body.issues.length} issues`;
    } catch { /* html */ }
    console.log(`  ${res.ok ? '✅' : '⚠️ '} ${String(Date.now() - t0).padStart(6)}ms  ${path}  ${detail}`);
    return res.ok;
  } catch (e) {
    console.log(`  ❌ ${String(Date.now() - t0).padStart(6)}ms  ${path}  ${e.message}`);
    return false;
  }
}

async function pool(tasks, size = 2) {
  const q = [...tasks];
  await Promise.all(
    Array.from({ length: Math.min(size, q.length) }, async () => {
      while (q.length) await q.shift()();
    })
  );
}

console.log(`Warming ${BASE}/pk\n`);

console.log('National:');
await pool([
  () => hit('/api/pk/trending'),
  ...PROVINCES.map((p) => () => hit(`/api/pk/province-news?province=${p}`)),
]);

console.log('\nConstituencies (ai-intel is the slow one):');
await pool(
  SEATS.flatMap((s) => [
    () => hit(`/api/pk/news?code=${s}`),
    ...LANGS.map((l) => () => hit(`/api/pk/summary?code=${s}&lang=${l}`)),
    ...LANGS.map((l) => () => hit(`/api/pk/ai-intel?code=${s}&lang=${l}`)),
  ]),
  2
);

console.log('\nPages:');
await pool([
  ...['', '/trending', '/instruments', '/casework', '/chat', '/documents', '/questions',
      '/committees', '/repugnancy', '/comms/notice', '/comms/radar', '/comms/claims']
    .map((p) => () => hit(`/pk${p}`, 60_000)),
  ...PROVINCES.map((p) => () => hit(`/pk/province/${p}`, 60_000)),
  ...SEATS.map((s) => () => hit(`/pk/constituency/${s}`, 60_000)),
], 4);

/**
 * The provincial routes.
 *
 * These cost no SerpAPI quota at all — the geometry is a static asset and the rosters
 * are bundled — so they are warmed generously. What is being warmed is the Next.js
 * route cache and the CDN copy of the district GeoJSON, which is the one thing on the
 * board that crosses the network at demo time.
 */
console.log('\nProvincial (no SerpAPI cost):');
const DEMO_DISTRICTS = [
  ['pb', 'lahore'], ['pb', 'rawalpindi'], ['pb', 'multan'], ['pb', 'faisalabad'],
  ['sd', 'central-karachi'], ['sd', 'hyderabad'],
  ['kp', 'peshawar'], ['ba', 'quetta'],
];
await pool([
  ...['punjab', 'sindh', 'kp', 'balochistan', 'ict', 'manifest'].map(
    (g) => () => hit(`/pk/geo/${g}.json`, 30_000)
  ),
  ...PROVINCES.filter((p) => p !== 'ict').map((p) => () => hit(`/pk/province/${p}/assembly`, 60_000)),
  ...DEMO_DISTRICTS.map(([p, d]) => () => hit(`/pk/province/${p}/district/${d}`, 60_000)),
  // A deep-linked district is the shape a demo actually opens.
  () => hit('/pk/province/pb?district=Lahore', 60_000),
], 4);

/**
 * The radar. Four SerpAPI searches per province, cached twelve hours, so this is the
 * one block here that costs quota — warm it deliberately before a demo rather than
 * letting the first click of the presentation pay for it.
 */
console.log('\nIssue radar (4 SerpAPI searches per province):');
await pool(
  ['PB', 'SD', 'KP', 'BA'].map((p) => () => hit(`/api/pk/comms/radar?province=${p}`, 120_000)),
  2
);

console.log('\nDone.');
