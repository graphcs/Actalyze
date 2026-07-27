import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import {
  collectErrors,
  gotoWithAuthFallback,
  assertNoNextErrorOverlay,
  type PageErrors,
} from "./helpers";

/**
 * Government-demo district coverage.
 *
 * Every district a presenter might be asked to pull up live must render with real
 * data — not a loading spinner and not an "unavailable" placeholder. This spec is
 * the gate for that: for each district it asserts the page returns 200, does not
 * redirect, throws no uncaught errors, names the right district, and displays NONE
 * of the empty-state strings the UI falls back to when an upstream returns nothing.
 *
 * RUN IT WARM. `/district/<code>` is genuinely slow on a cold cache — the AI-intel
 * block measured 32-58s (median ~41s; NY12 54.4s, AZ06 57.8s, VA05 55.6s, CO08
 * 54.3s, NC09 50.5s, NY03 46.6s, OK01 43.6s, WI03 43.6s) — and a cold district also
 * costs ~11 SerpAPI searches out of a shared 5000/month quota. So:
 *
 *   node scripts/warm-demo-cache.mjs            # once; ~250-300 searches if fully cold
 *   npx playwright test tests/e2e/districts.spec.ts --workers=2
 *
 * Against a warm cache the suite costs zero SerpAPI searches. The district list here
 * MUST stay in sync with DISTRICTS in scripts/warm-demo-cache.mjs.
 *
 * The specs deliberately do NOT send the warmer's `x-cache-duration-seconds` header:
 * tests exercise the app's normal client defaults, not warmer-specific TTLs.
 */

/**
 * 24 districts chosen for geographic and political spread: safe-D urban, safe-R
 * rural, and genuine toss-ups across the Northeast, South, Midwest and West.
 * New York, Oklahoma and New Jersey are demo-mandatory.
 */
const DISTRICTS = [
  // New York — dense urban + suburban Long Island
  "NY01",
  "NY12",
  "NY03",
  // Oklahoma — safe-R plains
  "OK01",
  "OK05",
  // New Jersey — competitive suburbs
  "NJ07",
  "NJ09",
  // West / Southwest
  "CA12",
  "CA22",
  "AZ06",
  "WA08",
  "CO08",
  // Texas / South
  "TX38",
  "TX09",
  "FL27",
  "GA07",
  "NC09",
  "VA05",
  // Midwest / Rust belt
  "OH09",
  "MI07",
  "IL14",
  "MN02",
  "WI03",
  "PA07",
] as const;

/**
 * Strings the UI renders when an upstream returned nothing usable. Any of these on
 * screen is a demo-visible data gap, so their presence fails the test.
 *
 * Where each comes from:
 *   "Polling data unavailable"      app/api/district/polling + StateHeatMap
 *   "No posts analysed"             AIPollingGauge / ElectionOutlook, sample_size 0
 *   "Insufficient data"             lib/ai-intel election_outlook.key_factors fallback
 *   "No trending topics detected"   TrendingTopicsPanel, empty topics[]
 *   "No notable insights detected"  KeyInsightsFeed, empty insights[]
 *   "AI intelligence unavailable"   district page, ai-intel errored or 503'd
 *   "Loading perspective"           district page, /api/topic/perspectives gave no summary
 */
const EMPTY_STATE_STRINGS = [
  "Polling data unavailable",
  "No posts analysed",
  "Insufficient data",
  "No trending topics detected",
  "No notable insights detected",
  "AI intelligence unavailable",
  "Loading perspective",
];

/**
 * In-flight markers. These are NOT failures — they mean a fetch is still running.
 * The test waits for them to clear before judging the page, which is the whole
 * point: asserting early on a cold page produces false failures.
 *
 * "Generating summary..." clears when the page's Promise.all over
 * news/summary/polling/perspectives/tweets settles (`loading` -> false).
 * "Analyzing social media sentiment..." clears when ai-intel settles
 * (`aiIntelLoading` -> false).
 */
const BULK_LOADING_MARKER = "Generating summary...";
const INTEL_LOADING_MARKER = "Analyzing social media sentiment...";

/**
 * The `dynamic(..., { loading })` fallback for DistrictMap. It is replaced the
 * moment the map's JS chunk arrives — no network data involved. So if it is STILL
 * on screen alongside every other spinner, nothing the browser asked the dev server
 * for has come back, which is a transport stall, not slow data. See waitForBulkData.
 */
const MAP_CHUNK_MARKER = "Loading map...";

/**
 * Budgets. Worst case (45s nav + 30s + 40s bulk + 110s intel + paint/assertions)
 * stays under the 240s per-test timeout.
 */
const BULK_FIRST_TRY_MS = 30_000;
const BULK_REMAINING_MS = 40_000;
const INTEL_TIMEOUT_MS = 110_000;

/** Time after the last fetch settles for React to paint the resolved panels. */
const PAINT_MS = 1_500;

/** "NY01" -> "NY-01", the form the heading and badges display. */
function districtLabel(code: string): string {
  return code.replace(/^([A-Z]{2})(\d{2})$/, "$1-$2");
}

/**
 * Waits for the district page's five parallel fetches to settle.
 *
 * Two very different things can keep the spinner up, and conflating them produces
 * either false failures or false passes:
 *
 *  1. Slow data — a cold cache. Legitimate; just keep waiting.
 *  2. A stalled `next dev` server. Reproduced repeatedly here: a tab issues its
 *     requests and NOTHING comes back — not the APIs, not even the map's JS chunk —
 *     for 30-90s, then the identical load succeeds in ~3s. It hits random districts
 *     on each run (and occasionally at --workers=1), so it is the dev server, not
 *     the district's data.
 *
 * Case 2 is detected by MAP_CHUNK_MARKER still being present (a chunk that never
 * arrived cannot be blamed on an upstream API) and recovered with one reload. Case 1
 * just gets the rest of the budget. If the reload does not fix it, the failure is
 * real and is reported as such.
 */
async function waitForBulkData(
  page: Page,
  path: string,
  reset: () => void
): Promise<{ reloaded: boolean }> {
  const marker = page.getByText(BULK_LOADING_MARKER, { exact: false });
  const mapFallback = page.getByText(MAP_CHUNK_MARKER, { exact: false });
  const stillLoadingMsg =
    `${path} was still showing "${BULK_LOADING_MARKER}" — the district data fetches ` +
    `never settled (cold cache? run scripts/warm-demo-cache.mjs first)`;

  try {
    await expect(marker, stillLoadingMsg).toHaveCount(0, { timeout: BULK_FIRST_TRY_MS });
    return { reloaded: false };
  } catch {
    if ((await mapFallback.count()) === 0) {
      // Chunks arrived, so the app is alive and simply waiting on data. Keep going.
      await expect(marker, stillLoadingMsg).toHaveCount(0, { timeout: BULK_REMAINING_MS });
      return { reloaded: false };
    }

    // eslint-disable-next-line no-console
    console.log(
      `[STALL-RECOVERY] ${path}: nothing loaded in ${BULK_FIRST_TRY_MS / 1000}s — not even ` +
        `the map JS chunk. Treating as a dev-server transport stall and reloading once.`
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    // Discard errors from the stalled load. A stall truncates JS chunks mid-flight,
    // which surfaces as "[pageerror] SyntaxError: Invalid or unexpected token" — an
    // artifact of the aborted transfer, not an app defect. The reloaded page is
    // judged on its own errors from here. (Same rationale as the reset() the auth
    // fallback in helpers.ts performs after re-navigating.)
    reset();
    await expect(
      marker,
      `${stillLoadingMsg}. This persisted across a reload, so it is NOT a transient ` +
        `dev-server stall.`
    ).toHaveCount(0, { timeout: BULK_REMAINING_MS });
    return { reloaded: true };
  }
}

interface DistrictCheck {
  label: string;
  timings: { nav: number; bulk: number; intel: number; total: number };
  errors: PageErrors;
  bodyText: string;
}

/**
 * Loads /district/<code>, waits for every panel to finish resolving, and returns
 * what it found. Throws only on navigation/HTTP problems; content assertions are
 * left to the caller so failures name the district.
 */
async function loadDistrictPage(
  page: Page,
  context: BrowserContext,
  path: string,
  expectedCode: string
): Promise<DistrictCheck> {
  const label = districtLabel(expectedCode);
  const started = Date.now();
  const { errors, reset } = collectErrors(page);

  // (a) 200, and we are still on the district URL we asked for.
  const { response, mode } = await gotoWithAuthFallback(page, context, path, reset);
  const navMs = Date.now() - started;

  expect(response, `No navigation response for ${path}`).not.toBeNull();
  expect(
    response!.status(),
    `${path} returned HTTP ${response!.status()} (auth mode: ${mode})`
  ).toBe(200);
  expect(
    new URL(page.url()).pathname,
    `${path} redirected away to ${page.url()} (auth mode: ${mode})`
  ).toBe(path);

  await assertNoNextErrorOverlay(page, path);

  // (d) Wait for the district heading BEFORE looking at the loading markers.
  // Order matters: until the page has rendered, the "still loading" markers are
  // absent simply because nothing is on screen, so checking them first would sail
  // through and then assert "no empty states" against a blank body — a false pass.
  // The heading also pins the district identity: it must name THIS district.
  await expect(
    page.getByRole("heading", { name: `Congressional District ${label}`, exact: true }),
    `${path} never rendered the heading "Congressional District ${label}"`
  ).toBeVisible({ timeout: 30_000 });

  // Wait for the bulk fetches (news, summary, polling, perspectives, tweets).
  const bulkStarted = Date.now();
  const { reloaded } = await waitForBulkData(page, path, reset);
  const bulkMs = Date.now() - bulkStarted;

  // Wait for the AI intel block. This is the 32-58s one on a cold cache.
  const intelStarted = Date.now();
  await expect(
    page.getByText(INTEL_LOADING_MARKER, { exact: false }),
    `${path} was still showing "${INTEL_LOADING_MARKER}" after ${INTEL_TIMEOUT_MS / 1000}s — ` +
      `/api/district/ai-intel did not respond in time. Cold, this endpoint measures ` +
      `32-58s; run scripts/warm-demo-cache.mjs first.`
  ).toHaveCount(0, { timeout: INTEL_TIMEOUT_MS });
  const intelMs = Date.now() - intelStarted;

  // Let the resolved panels paint, then re-check for a late error overlay.
  await page.waitForTimeout(PAINT_MS);
  await assertNoNextErrorOverlay(page, path);

  const bodyText = ((await page.locator("body").innerText().catch(() => "")) || "").trim();

  // Guard the empty-state check below: a blank page contains none of the forbidden
  // strings and would otherwise "pass".
  expect(
    bodyText.length,
    `${path} rendered almost no visible text (${bodyText.length} chars) — page is blank`
  ).toBeGreaterThan(400);

  const timings = { nav: navMs, bulk: bulkMs, intel: intelMs, total: Date.now() - started };
  // eslint-disable-next-line no-console
  console.log(
    `[DISTRICT-TIMING] ${expectedCode} path=${path} nav=${timings.nav}ms ` +
      `bulk=${timings.bulk}ms intel=${timings.intel}ms total=${timings.total}ms` +
      (reloaded ? " (recovered from a dev-server stall via one reload)" : "")
  );

  return { label, timings, errors, bodyText };
}

/** (c) None of the empty-state strings may be on screen. */
function assertNoEmptyStates(path: string, bodyText: string) {
  const found = EMPTY_STATE_STRINGS.filter((s) => bodyText.includes(s));
  expect(
    found,
    `${path} is displaying ${found.length} empty-state string(s): ${found
      .map((s) => `"${s}"`)
      .join(", ")} — this district has no usable data and must not be demoed`
  ).toEqual([]);
}

/**
 * (d) The badge must name this district too. The heading is already asserted inside
 * loadDistrictPage (it has to be, to know the page mounted before judging it).
 */
async function assertShowsDistrict(page: Page, path: string, label: string) {
  // Header badge + map card badge both render the bare label on its own.
  await expect
    .poll(async () => page.getByText(label, { exact: true }).count(), {
      timeout: 10_000,
      message: `${path} rendered no "${label}" district badge`,
    })
    .toBeGreaterThan(0);
}

/**
 * Positive counterpart to the empty-state check: the AI intel block must have
 * actually rendered its panels. Without this, an intel spinner that vanishes for
 * the wrong reason could leave a section that is neither "unavailable" nor real.
 */
const INTEL_PANEL_HEADINGS = ["Election Outlook", "Trending Topics", "Key Insights"];

function assertIntelPanelsRendered(path: string, bodyText: string) {
  const missing = INTEL_PANEL_HEADINGS.filter((h) => !bodyText.includes(h));
  expect(
    missing,
    `${path} resolved its AI intel fetch but never rendered: ${missing.join(", ")}`
  ).toEqual([]);
}

/** (b) No uncaught page errors; third-party noise stays allowlisted by helpers.ts. */
function assertNoFatalErrors(path: string, errors: PageErrors) {
  if (errors.envConfig.length) {
    // eslint-disable-next-line no-console
    console.log(`[ENV-CONFIG-DEGRADED] ${path}:\n  ${errors.envConfig.join("\n  ")}`);
  }
  if (errors.remoteAssets.length) {
    // eslint-disable-next-line no-console
    console.log(
      `[REMOTE-ASSET-NOISE] ${path}: ${errors.remoteAssets.length} third-party asset failure(s)`
    );
  }

  expect(
    errors.fatal,
    `${path} produced ${errors.fatal.length} uncaught error(s):\n${errors.fatal.join("\n")}`
  ).toEqual([]);
}

async function verifyDistrict(
  page: Page,
  context: BrowserContext,
  path: string,
  expectedCode: string
): Promise<DistrictCheck> {
  const result = await loadDistrictPage(page, context, path, expectedCode);

  await assertShowsDistrict(page, path, result.label);
  assertNoEmptyStates(path, result.bodyText);
  assertIntelPanelsRendered(path, result.bodyText);
  assertNoFatalErrors(path, result.errors);

  return result;
}

test.describe("district pages", () => {
  // Parallel, but the runner is invoked with --workers=2 so we do not stampede
  // SerpAPI / the LLM provider with 24 simultaneous cold district builds.
  test.describe.configure({ mode: "parallel" });

  for (const code of DISTRICTS) {
    test(`district ${code} renders with real data`, async ({ page, context }) => {
      // Cold AI intel measured up to 58s; 240s leaves headroom without hanging CI.
      test.setTimeout(240_000);

      await verifyDistrict(page, context, `/district/${code}`, code);

      await page
        .screenshot({ path: `tests/e2e/screenshots/district-${code}.png`, fullPage: true })
        .catch(() => {
          /* screenshot is evidence, not an assertion */
        });
    });
  }

  /**
   * REGRESSION: the hyphenated form is what the app itself displays (sidebar
   * "CA-01", page badge "NY-01", search hint "Examples: NY-01, VA05, CA-12"), so
   * shared and hand-typed links arrive hyphenated. It used to reach the district
   * APIs verbatim, 400 every one of them, and render a 200 shell with empty panels
   * and no visible error. lib/district-code.normalizeDistrictCode now canonicalises
   * it in app/district/[code]/page.tsx; this test is the guard on that fix.
   */
  const HYPHENATED: Array<[string, string]> = [
    ["/district/NY-01", "NY01"],
    ["/district/NJ-07", "NJ07"],
  ];

  test("hyphenated district codes render equivalently to canonical codes", async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);

    for (const [path, canonical] of HYPHENATED) {
      const hyphenated = await verifyDistrict(page, context, path, canonical);

      // Equivalence, not just "renders": the hyphenated URL must produce the same
      // district identity as the canonical one. Both are warm by now, so this is
      // cheap.
      const canonicalPath = `/district/${canonical}`;
      const canonicalResult = await verifyDistrict(page, context, canonicalPath, canonical);

      expect(
        hyphenated.label,
        `${path} and ${canonicalPath} resolved to different districts`
      ).toBe(canonicalResult.label);

      // Both forms must surface the same set of populated panels. Comparing the
      // card headings (not the AI-generated prose, which is regenerated per call)
      // catches "hyphenated silently renders an empty shell".
      const panelHeadings = [
        "District Map",
        "Local News",
        "District News Summary",
        "AI Political Intelligence",
        "Political Context",
      ];
      for (const heading of panelHeadings) {
        expect(
          hyphenated.bodyText.includes(heading),
          `${path} is missing the "${heading}" panel that ${canonicalPath} renders`
        ).toBe(canonicalResult.bodyText.includes(heading));
      }
    }
  });
});
