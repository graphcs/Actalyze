import { test, expect, type Page } from "@playwright/test";
import {
  collectErrors,
  assertNoNextErrorOverlay,
  assertHasVisibleContent,
} from "./helpers";

/**
 * Pakistan subtree.
 *
 * Beyond "does it render", this asserts the two things that are specific to this
 * build and easy to regress silently:
 *
 *  1. **Direction.** Every page must carry `dir="rtl"` in Urdu and flip to `ltr` in
 *     English. The RTL utilities key off an ancestor `[dir="rtl"]`, so if that
 *     attribute is lost the page still renders — just entirely left-aligned, which
 *     is easy to miss in a screenshot and obvious to a native reader.
 *
 *  2. **No empty states.** A page can render perfectly and say nothing. These are the
 *     strings that mean a section gave up.
 */

const PK_PAGES = [
  "/pk",
  "/pk/trending",
  "/pk/instruments",
  "/pk/questions",
  "/pk/casework",
  "/pk/chat",
  "/pk/documents",
  "/pk/province/pb",
  "/pk/province/ict",
  "/pk/committees",
  "/pk/constituency/na-123",
  "/pk/constituency/na-247",
];

/** Seats and codes that must degrade gracefully rather than break. */
const EDGE_CASES = [
  { path: "/pk/constituency/na-1", expect: "vacant" },
  { path: "/pk/constituency/na-999", expect: "not found" },
];

const EMPTY_MARKERS = [
  "Polling data unavailable",
  "No posts analysed",
  "Insufficient data",
  "AI intelligence unavailable",
  "Loading perspective",
  "Trending topics are unavailable",
  "زیرِ بحث موضوعات فی الحال دستیاب نہیں",
];

async function settle(page: Page, ms = 60_000) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: ms });
  } catch {
    // Slow upstream — assert on what rendered.
  }
}

test.describe.configure({ mode: "parallel" });

test.describe("Pakistan subtree", () => {
  for (const path of PK_PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      test.setTimeout(180_000);
      const { errors } = collectErrors(page);

      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${path} should return 200`).toBe(200);
      expect(new URL(page.url()).pathname, `${path} should not redirect`).toBe(path);

      await settle(page);
      await assertNoNextErrorOverlay(page, path);
      await assertHasVisibleContent(page, path);

      // The direction contract.
      const dir = await page.locator(".pk-root").first().getAttribute("dir");
      expect(dir, `${path} should default to Urdu right-to-left`).toBe("rtl");

      expect(
        errors.fatal,
        `${path} produced page errors:\n${errors.fatal.join("\n")}`
      ).toEqual([]);

      await page.screenshot({
        path: `tests/e2e/screenshots/pk${path.replace(/\//g, "-")}.png`,
        fullPage: true,
      });
    });
  }

  test("language toggle flips direction in place", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/pk");
    await settle(page);

    expect(await page.locator(".pk-root").first().getAttribute("dir")).toBe("rtl");

    await page.getByRole("button", { name: "English", exact: true }).first().click();
    await page.waitForTimeout(600);

    expect(
      await page.locator(".pk-root").first().getAttribute("dir"),
      "toggling to English should flip the subtree to left-to-right"
    ).toBe("ltr");

    // And the copy should actually be English, not just re-aligned Urdu.
    const body = await page.locator("body").innerText();
    expect(body).toContain("Parliamentary Drafting");

    await page.screenshot({
      path: "tests/e2e/screenshots/pk-english.png",
      fullPage: true,
    });
  });

  for (const { path, expect: what } of EDGE_CASES) {
    test(`handles ${what}: ${path}`, async ({ page }) => {
      test.setTimeout(120_000);
      const { errors } = collectErrors(page);

      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBe(200);
      await settle(page, 30_000);

      // Neither case may 404, spin forever, or invent a member.
      const body = await page.locator("body").innerText();
      expect(body.length, `${path} should render something`).toBeGreaterThan(200);
      expect(body, `${path} should not be stuck loading`).not.toContain("Loading…");

      expect(errors.fatal, `${path} produced page errors`).toEqual([]);
      await page.screenshot({
        path: `tests/e2e/screenshots/pk${path.replace(/\//g, "-")}.png`,
        fullPage: true,
      });
    });
  }

  test("no page shows an empty-state marker", async ({ page }) => {
    test.setTimeout(600_000);
    const offenders: string[] = [];

    for (const path of ["/pk", "/pk/trending", "/pk/province/pb", "/pk/constituency/na-123"]) {
      await page.goto(path);
      await settle(page, 90_000);
      const body = await page.locator("body").innerText();
      for (const marker of EMPTY_MARKERS) {
        if (body.includes(marker)) offenders.push(`${path}: "${marker}"`);
      }
    }

    expect(offenders, `empty states found:\n${offenders.join("\n")}`).toEqual([]);
  });

  test("question search returns real records with replies", async ({ request }) => {
    // The value of this feature is entirely in whether the corpus actually has
    // content. A page that renders an empty result set looks identical to a working
    // one, so assert on the data rather than the DOM.
    const res = await request.get("/api/pk/questions?q=solar+net+metering", {
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.total, "expected hits for a subject known to be in the corpus").toBeGreaterThan(0);

    const record = body.hits[0].record;
    expect(record.question?.length, "a hit must carry the question text").toBeGreaterThan(40);
    expect(record.asker, "a hit must name the member who asked").toBeTruthy();
    expect(record.pdfUrl, "a hit must cite its source paper").toContain("na.gov.pk");

    // Coverage is what makes the feature credible in a demo — if the ingest
    // silently produced a handful of records, this is where it shows.
    expect(body.coverage?.questionCount ?? 0).toBeGreaterThan(200);
    expect(body.coverage?.replyCount ?? 0).toBeGreaterThan(150);
  });

  test("constituency codes are never zero-padded", async ({ page }) => {
    // Every Pakistani source writes NA-2, not NA-02. Padding is the fastest tell
    // that a product was built somewhere else.
    await page.goto("/pk");
    await settle(page, 30_000);
    const body = await page.locator("body").innerText();
    expect(body, "found a zero-padded constituency code").not.toMatch(/\bNA-0\d\b/);
  });
});
