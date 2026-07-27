import { test, expect } from "@playwright/test";
import {
  collectErrors,
  gotoWithAuthFallback,
  assertNoNextErrorOverlay,
  assertHasVisibleContent,
  screenshotName,
} from "./helpers";

/**
 * Every page that must render without error. `/topic/<id>` is covered by a
 * dedicated test because its id has to be resolved from /api/trending first.
 */
const PAGES = [
  "/",
  "/dashboard",
  "/wordcloud",
  "/casework",
  "/nationwide",
  "/draft-memo",
  "/ethics-compliance",
  "/standards-checker",
  "/upload",
  "/constituent-meetings",
  "/connect-cdp",
  "/chatbot",
  "/waitlist",
  "/state/CA",
  "/state/TX",
  // Canonical district URL form. In-app navigation always produces this shape:
  // DistrictSearch normalizes "CA-12" -> "CA12", and Sidebar/home push
  // `district.code.toLowerCase()`.
  "/district/CA12",
];

/** Time allowed after first paint for late client-side errors to surface. */
const SETTLE_MS = 2500;

async function verifyPage(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  path: string
) {
  const { errors, reset } = collectErrors(page);

  const { response, mode } = await gotoWithAuthFallback(page, context, path, reset);

  // 1. HTTP 200 and no redirect away from the target path.
  expect(response, `No navigation response for ${path}`).not.toBeNull();
  expect(response!.status(), `${path} returned HTTP ${response!.status()} (mode: ${mode})`).toBe(
    200
  );
  expect(
    new URL(page.url()).pathname,
    `${path} redirected to ${page.url()} (mode: ${mode})`
  ).toBe(path);

  // 3. Not blank, no Next.js error overlay.
  await assertNoNextErrorOverlay(page, path);
  await assertHasVisibleContent(page, path);

  // Let late async work (client fetches, chart rendering) throw before we judge.
  await page.waitForTimeout(SETTLE_MS);
  await assertNoNextErrorOverlay(page, path);

  // 4. Screenshot.
  await page.screenshot({
    path: `tests/e2e/screenshots/${screenshotName(path)}.png`,
    fullPage: true,
  });

  if (errors.envConfig.length) {
    // eslint-disable-next-line no-console
    console.log(
      `[ENV-CONFIG-DEGRADED] ${path}:\n  ${errors.envConfig.join("\n  ")}`
    );
  }

  if (errors.remoteAssets.length) {
    // eslint-disable-next-line no-console
    console.log(
      `[REMOTE-ASSET-NOISE] ${path}:\n  ${errors.remoteAssets.slice(0, 8).join("\n  ")}`
    );
  }

  // 2. No uncaught page errors / unexpected console errors.
  expect(
    errors.fatal,
    `${path} produced ${errors.fatal.length} unexpected error(s):\n${errors.fatal.join("\n")}`
  ).toEqual([]);
}

test.describe("page renders", () => {
  for (const path of PAGES) {
    test(`renders ${path}`, async ({ page, context }) => {
      await verifyPage(page, context, path);
    });
  }

  /**
   * KNOWN APP BUG (not a flaky assertion):
   * `app/district/[code]/page.tsx` reads the route param verbatim
   * (`params.code.toUpperCase()`) and forwards it to /api/district/*, which
   * only accept the un-hyphenated `VA05` shape. A hyphenated deep link — the
   * exact human-readable form the app itself displays (sidebar "CA-01", page
   * badge "CA-12", search hint "Examples: NY-01, VA05, CA-12, TX38") — makes
   * all five district data endpoints return HTTP 400 while the page still
   * renders a 200 shell with empty panels and no error shown to the user.
   * Fix: normalize the code (strip "-", zero-pad) in the page, as
   * DistrictSearch.parseDistrictCode already does.
   */
  test("renders /district/CA-12 (hyphenated district code)", async ({ page, context }) => {
    await verifyPage(page, context, "/district/CA-12");
  });

  test("renders /topic/<id> for a real trending topic", async ({ page, context, request }) => {
    const res = await request.get("/api/trending");
    expect(res.status(), "GET /api/trending must succeed to resolve a topic id").toBe(200);
    const topics = await res.json();
    expect(Array.isArray(topics), "/api/trending should return an array").toBe(true);
    expect(topics.length, "/api/trending returned no topics — cannot test /topic/<id>").toBeGreaterThan(
      0
    );

    const id = topics[0]?.id;
    expect(typeof id, "first trending topic has no string `id`").toBe("string");

    await verifyPage(page, context, `/topic/${id}`);
  });
});
