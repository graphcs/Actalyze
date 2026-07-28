import { test, expect, type Page } from "@playwright/test";
import { collectErrors, assertNoNextErrorOverlay } from "./helpers";
import { resolveDistrict, cityGroup } from "../../lib/pk/districts";
import {
  asProvinceCode,
  asAssemblyPrefix,
  assemblyForProvince,
  provinceForAssembly,
} from "../../lib/pk/provinces";
import { seatsInProvince, provincialSeat } from "../../lib/pk/provincial-seats";

/**
 * The provincial build.
 *
 * Beyond "does it render", this pins the three things that would be embarrassing
 * rather than merely broken:
 *
 *  1. **`PB` means two different things** and they must never be unified.
 *  2. **The map must draw one polygon per district** — the winding-order bug that made
 *     it a solid rectangle produced correct path data, correct fills, and no error.
 *  3. **No figure may render without a source and a year.**
 */

const PROVINCES = [
  { path: "/pk/province/pb", name: "Punjab", districts: 36, seats: 297 },
  { path: "/pk/province/sd", name: "Sindh", districts: 29, seats: 130 },
  { path: "/pk/province/kp", name: "Khyber Pakhtunkhwa", districts: 35, seats: 115 },
  { path: "/pk/province/ba", name: "Balochistan", districts: 35, seats: 51 },
];

async function settle(page: Page, ms = 45_000) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: ms });
  } catch {
    // Slow upstream — assert on what rendered.
  }
}

test.describe.configure({ mode: "parallel" });

test.describe("Pakistan provincial build", () => {
  for (const prov of PROVINCES) {
    test(`renders ${prov.path} with a real district map`, async ({ page }) => {
      test.setTimeout(180_000);
      const { errors } = collectErrors(page);

      const res = await page.goto(prov.path, { waitUntil: "domcontentloaded" });
      expect(res?.status()).toBe(200);
      await settle(page);
      await assertNoNextErrorOverlay(page, prov.path);

      expect(
        await page.locator(".pk-root").first().getAttribute("dir"),
        "provincial pages default to Urdu right-to-left"
      ).toBe("rtl");

      // One path per district. A count of 0 means the geometry did not load; a count
      // that disagrees with COD-AB means the province filter or the alias table drifted.
      const polygons = page.locator('svg[role="img"] path[role="button"]');
      await expect(polygons).toHaveCount(prov.districts, { timeout: 30_000 });

      /**
       * Each district must be its own shape.
       *
       * The winding-order failure rendered every district as the projection's clip
       * rectangle with itself punched out — so every path shared one bounding box
       * covering the whole frame. Nothing else about the page looked wrong. Comparing
       * the first two paths' bounding boxes catches exactly that, and it is the reason
       * this assertion is here rather than a screenshot diff.
       */
      const boxes = await polygons.evaluateAll((els) =>
        els.slice(0, 2).map((el) => {
          const b = (el as SVGPathElement).getBBox();
          return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)];
        })
      );
      expect(
        JSON.stringify(boxes[0]),
        "every district shares one bounding box — the polygons are winding-inverted and each is drawing the clip rectangle"
      ).not.toBe(JSON.stringify(boxes[1]));

      expect(errors.fatal, `${prov.path} produced page errors`).toEqual([]);
      await page.screenshot({
        path: `tests/e2e/screenshots/pk-province-${prov.path.split("/").pop()}.png`,
        fullPage: true,
      });
    });
  }

  test("no figure renders without a source and a year", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/pk/province/pb");
    await settle(page);
    await page.getByRole("button", { name: "English", exact: true }).first().click();
    await page.waitForTimeout(800);

    const body = await page.locator("body").innerText();
    // Every population figure on this board comes from the 2017 census, and the board
    // must say so — a Chief Minister knows the 2023 numbers and will ask.
    expect(body, "population figures must name the census they come from").toContain("Census 2017");
    expect(body, "boundary provenance must be stated").toMatch(/COD-AB|Common Operational Datasets/);
    // General-seat counts must state what they exclude.
    expect(body).toContain("Reserved seats");
  });

  test("the drill-down deep-links and zooms", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/pk/province/pb?district=Lahore");
    await settle(page);

    // A deep link must open zoomed, which means the viewBox is no longer the full frame.
    const viewBox = await page.locator('svg[role="img"]').getAttribute("viewBox");
    expect(viewBox, "a deep-linked district should zoom the viewBox").not.toBe("0 0 800 600");

    await expect(page.getByText("Lahore").first()).toBeVisible();
  });

  test("PB is Punjab as a province and Balochistan as an assembly", () => {
    /**
     * The collision, asserted in one place so the two namespaces can never be quietly
     * unified by someone tidying up. `/pk/province/pb` is Punjab; `PB-12` is a
     * Balochistan seat. Both are correct and neither convention is ours to change.
     */
    const punjab = asProvinceCode("pb");
    expect(punjab).toBe("PB");
    expect(assemblyForProvince(punjab!)?.prefix, "Punjab's House is the PP series").toBe("PP");

    const balochistanAssembly = asAssemblyPrefix("PB");
    expect(balochistanAssembly).toBe("PB");
    expect(
      provinceForAssembly(balochistanAssembly!),
      "the PB seat series belongs to Balochistan, not Punjab"
    ).toBe("BA");

    // And the data agrees: PB-12 is a Balochistan seat, PP-12 a Punjab one.
    expect(provincialSeat("PB-12")?.province).toBe("BA");
    expect(provincialSeat("PP-12")?.province).toBe("PB");

    // Islamabad has no provincial assembly and must return null rather than guess.
    expect(assemblyForProvince(asProvinceCode("ict")!)).toBeNull();
  });

  test("every assembly is fully seeded and every district resolves to a polygon", async ({
    request,
  }) => {
    for (const prov of PROVINCES) {
      const code = asProvinceCode(prov.path.split("/").pop()!)!;
      const seats = seatsInProvince(code);
      expect(seats.length, `${prov.name} should have ${prov.seats} seats`).toBe(prov.seats);

      const slug = { PB: "punjab", SD: "sindh", KP: "kp", BA: "balochistan" }[code as string]!;
      const res = await request.get(`/pk/geo/${slug}.json`);
      expect(res.status()).toBe(200);
      const fc = await res.json();
      expect(fc.features.length).toBe(prov.districts);

      // Every district a seat claims must resolve to a polygon, or the map has holes
      // it cannot explain.
      const names = new Set<string>(
        fc.features.map((f: { properties: { adm2_name: string } }) => f.properties.adm2_name)
      );
      const unresolved: string[] = [];
      for (const seat of seats) {
        for (const d of seat.districts) {
          if (!resolveDistrict(d, names) && !cityGroup(d)) unresolved.push(`${seat.code}: ${d}`);
        }
      }
      expect(unresolved, `${prov.name} has unresolved districts`).toEqual([]);
    }
  });

  test("provincial codes are never zero-padded", async ({ page }) => {
    await page.goto("/pk/province/pb");
    await settle(page, 30_000);
    const body = await page.locator("body").innerText();
    expect(body, "found a zero-padded provincial code").not.toMatch(/\b(PP|PS|PK|PB)-0\d\b/);
  });
});
