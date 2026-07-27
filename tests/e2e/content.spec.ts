import { test, expect, Page } from "@playwright/test";

/**
 * Content-quality checks.
 *
 * The render tests in pages.spec.ts only prove a page mounts without throwing.
 * These assert the pages actually have DATA in them — a district page full of
 * "unavailable" / "No posts analysed" / "Insufficient data" renders perfectly
 * and is still useless in a demo.
 */

/** Phrases that mean a section gave up. Any of these on screen is a failure. */
const EMPTY_MARKERS = [
  "Polling data unavailable",
  "No posts analysed",
  "Insufficient data",
  "No trending topics detected",
  "No notable insights detected",
  "AI intelligence unavailable",
  "Party analysis is unavailable",
  "Trending topics are unavailable",
  "Loading perspective",
];

async function visibleEmptyMarkers(page: Page): Promise<string[]> {
  const body = (await page.locator("body").innerText()).toLowerCase();
  return EMPTY_MARKERS.filter((m) => body.includes(m.toLowerCase()));
}

/** Wait until the page has stopped fetching, with a ceiling. */
async function settle(page: Page, ms = 45_000) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: ms });
  } catch {
    // Long-poll or a slow upstream — fall through and assert on what we have.
  }
}

test.describe("content quality", () => {
  test("home page is open — no login wall, sign-in is optional", async ({ page }) => {
    await page.goto("/");
    await settle(page);

    // No blocking modal.
    await expect(page.locator(".fixed.inset-0.z-50")).toHaveCount(0);
    await expect(page.getByText("Welcome to Actalyze", { exact: false })).toHaveCount(0);

    // Real content is present.
    const body = await page.locator("body").innerText();
    expect(body.length, "home page should render substantive content").toBeGreaterThan(400);

    // Optional sign-in affordance exists.
    await expect(
      page.getByRole("button", { name: /sign in/i }).first()
    ).toBeVisible();

    await page.screenshot({ path: "tests/e2e/screenshots/content-home.png", fullPage: true });
  });

  test("dashboard shows trending topics", async ({ page }) => {
    await page.goto("/dashboard");
    await settle(page);

    const markers = await visibleEmptyMarkers(page);
    expect(markers, `dashboard shows empty-state text: ${markers.join(", ")}`).toEqual([]);

    await page.screenshot({ path: "tests/e2e/screenshots/content-dashboard.png", fullPage: true });
  });

  for (const code of ["CA12", "PA07"]) {
    test(`district ${code} has real intelligence, not empty states`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(`/district/${code}`);
      await settle(page, 120_000);

      // The AI intel blocks resolve after the API returns; give them room.
      await page
        .waitForFunction(
          () => !document.body.innerText.includes("No posts analysed"),
          undefined,
          { timeout: 150_000 }
        )
        .catch(() => {
          /* assertion below reports it properly */
        });

      const markers = await visibleEmptyMarkers(page);
      await page.screenshot({
        path: `tests/e2e/screenshots/content-district-${code}.png`,
        fullPage: true,
      });
      expect(
        markers,
        `/district/${code} still shows empty-state text: ${markers.join(", ")}`
      ).toEqual([]);
    });
  }

  test("state page has party analysis", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/state/CA");
    await settle(page, 90_000);

    const markers = await visibleEmptyMarkers(page);
    await page.screenshot({ path: "tests/e2e/screenshots/content-state-CA.png", fullPage: true });
    expect(markers, `/state/CA shows empty-state text: ${markers.join(", ")}`).toEqual([]);
  });

  test("topic page has tweets and headlines", async ({ page, request }) => {
    test.setTimeout(180_000);
    const trending = await (await request.get("/api/trending")).json();
    test.skip(!Array.isArray(trending) || trending.length === 0, "no trending topics available");

    await page.goto(`/topic/${trending[0].id}`);
    await settle(page, 90_000);

    const body = await page.locator("body").innerText();
    expect(body, "topic page should not be stuck loading").not.toContain("Loading topic...");

    const markers = await visibleEmptyMarkers(page);
    await page.screenshot({ path: "tests/e2e/screenshots/content-topic.png", fullPage: true });
    expect(markers, `topic page shows empty-state text: ${markers.join(", ")}`).toEqual([]);
  });

  test("no page presents fabricated provenance", async ({ page }) => {
    // Three pages each allowed up to 90s to settle, so the default 60s cap is far
    // too tight — without this the test times out mid-navigation rather than failing
    // on an actual assertion.
    test.setTimeout(360_000);

    // These strings claimed sources that never produced the numbers shown.
    const BANNED = ["FiveThirtyEight", "Cook Political Report", "Traditional polls"];
    for (const path of ["/dashboard", "/district/CA12", "/state/CA"]) {
      await page.goto(path);
      await settle(page, 90_000);
      const body = await page.locator("body").innerText();
      for (const phrase of BANNED) {
        expect(body, `${path} must not cite "${phrase}"`).not.toContain(phrase);
      }
    }
  });
});
