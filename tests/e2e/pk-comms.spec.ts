import { test, expect } from "@playwright/test";
import { collectErrors } from "./helpers";
import {
  renderAll, referenceNumber, missingFields, normaliseEffectiveFrom,
  SMS_LIMIT, SOCIAL_LIMIT,
  type NoticeIntake,
} from "../../lib/pk/notice";

/**
 * The notification pipeline.
 *
 * The assertions here are the product's promises, not its implementation: one record,
 * six artefacts, two languages that cannot drift, a length limit that is counted rather
 * than requested, and a document that never claims an authority nobody gave it.
 */

const BASE: NoticeIntake = {
  subject: "Solar net metering application deadline extended to 31 March 2026",
  effect:
    "The last date for submission of applications for net metering licences is extended from 31 January 2026 to 31 March 2026.",
  appliesTo: "all applicants under the Punjab Solar Initiative",
  effectiveFrom: "2026-03-31",
  statutoryPower: "Section 23F of the Regulation of Generation, Transmission and Distribution of Electric Power Act, 1997",
  supersedes: "No.SO(PE-II)4-2-96/2025 dated 4th December, 2025",
  department: "Energy",
  wing: "PE-II",
  fileNumber: "4-2",
  serial: "117",
  year: 2026,
  station: "Lahore",
  dated: "2026-07-28",
  signatoryName: "Muhammad Adnan Rafique",
  signatoryDesignation: "Section Officer",
  distribution: [
    "All Administrative Secretaries to Government of the Punjab",
    "Master file / Office copy",
  ],
  subjectUr: "سولر نیٹ میٹرنگ کی درخواستوں کی آخری تاریخ ۳۱ مارچ ۲۰۲۶ء تک بڑھا دی گئی",
  effectUr: "نیٹ میٹرنگ لائسنس کی درخواستیں جمع کرانے کی آخری تاریخ ۳۱ مارچ ۲۰۲۶ء کر دی گئی ہے۔",
  appliesToUr: "پنجاب سولر انیشی ایٹو کے تمام درخواست گزاروں",
  departmentUr: "توانائی",
  distributionUr: ["حکومتِ پنجاب کے تمام ایڈمنسٹریٹو سیکرٹریز", "ماسٹر فائل / دفتری نقل"],
  statutoryPowerUr: "ضابطہ برائے پیداوار، ترسیل و تقسیمِ برقی توانائی ایکٹ ۱۹۹۷ء کی دفعہ ۲۳ ف",
  supersedesUr: "نوٹیفکیشن نمبر ۴-۲-۹۶/۲۰۲۵ مورخہ ۴ دسمبر ۲۰۲۵ء",
  signatoryNameUr: "محمد عدنان رفیق",
  signatoryDesignationUr: "سیکشن آفیسر",
};

test.describe("Notification pipeline", () => {
  test("the reference number and dates are identical across both languages", () => {
    /**
     * The drift test — the single reason this is one record rather than six documents.
     * Today the notification, the press release and the SMS are retyped by different
     * people, so a corrected date reaches some of them and not others. Every artefact in
     * both languages must carry the same reference; the number is the thing a citizen
     * quotes back and a clerk files under.
     */
    const en = renderAll(BASE, "en");
    const ur = renderAll(BASE, "ur");
    const ref = referenceNumber(BASE);

    for (const [label, r] of [["en", en], ["ur", ur]] as const) {
      for (const [name, text] of Object.entries({
        notification: r.notification,
        pressRelease: r.pressRelease,
        sms: r.sms,
        socialPost: r.socialPost,
        whatsapp: r.whatsapp,
        card: r.card.reference,
      })) {
        expect(text, `${label}.${name} must carry the reference`).toContain(ref);
      }
    }

    // The reference stays in Western digits in both languages: it is a code that gets
    // quoted, searched and typed into other systems.
    expect(ref).toBe("No.SO(PE-II)4-2-117/2026");
    expect(ur.notification).toContain(ref);
  });

  test("SMS is within 160 characters in both languages, and keeps the reference", () => {
    // Counted in code, never asked of a model. And when it truncates it drops the
    // subject, not the reference — a citizen who cannot verify a notice has received a
    // rumour with a government letterhead on it.
    const long: NoticeIntake = {
      ...BASE,
      subject: "Extension of the last date for submission of applications for net metering licences under the Punjab Solar Initiative for domestic and commercial consumers across every district",
      subjectUr: "پنجاب سولر انیشی ایٹو کے تحت گھریلو اور تجارتی صارفین کے لیے نیٹ میٹرنگ لائسنس کی درخواستیں جمع کرانے کی آخری تاریخ میں توسیع کا اعلان تمام اضلاع کے لیے",
    };
    for (const locale of ["en", "ur"] as const) {
      const sms = renderAll(long, locale).sms;
      expect(sms.length, `${locale} SMS must be within ${SMS_LIMIT}`).toBeLessThanOrEqual(SMS_LIMIT);
      expect(sms, `${locale} SMS must keep the reference`).toContain(referenceNumber(long));
    }
  });

  test("a social post never loses its attribution to fit", () => {
    const long = { ...BASE, subject: "x".repeat(400) };
    const post = renderAll(long, "en").socialPost;
    expect(post.length).toBeLessThanOrEqual(SOCIAL_LIMIT);
    expect(post, "attribution is not droppable").toContain("Government of the Punjab");
    expect(post).toContain(referenceNumber(long));
  });

  test("the notification carries the conventions a Secretariat reader checks", () => {
    const n = renderAll(BASE, "en").notification;
    expect(n).toContain("GOVERNMENT OF THE PUNJAB");
    expect(n).toContain("NOTIFICATION");
    // The reference runs straight into the operative text — the statutory drafting form.
    expect(n).toMatch(/No\.SO\(PE-II\)4-2-117\/2026\.—/);
    expect(n).toContain("Dated Lahore, the 28th July, 2026");
    // The endorsement reuses the notification's own number and date.
    expect(n).toContain("Endst. No. & Date Even");
    expect(n).toContain("A copy is forwarded for information and necessary action to:-");
    // The wing appears in both the number and the signature block.
    expect(n).toContain("SECTION OFFICER (PE-II)");
  });

  test("no statutory power is claimed when none was given", () => {
    /**
     * A notification citing a provision that does not confer the power is void. So when
     * the field is empty the "In exercise of the powers conferred by…" formula must be
     * absent entirely — a half-filled statutory opening is worse than none.
     */
    const withoutPower: NoticeIntake = { ...BASE, statutoryPower: undefined };
    const n = renderAll(withoutPower, "en").notification;
    expect(n).not.toContain("In exercise of the powers conferred");
    expect(renderAll(BASE, "en").notification).toContain("In exercise of the powers conferred");
  });

  test("unfilled fields render as visible blanks rather than collapsing", () => {
    const empty: NoticeIntake = {
      ...BASE, department: "", wing: "", fileNumber: "", serial: "", signatoryName: "",
    };
    const n = renderAll(empty, "en").notification;
    expect(n, "an empty reference must read as a blank, not as a bug").not.toContain("No.SO()");
    expect(n).toContain("——");
    expect(missingFields(empty)).toEqual(
      expect.arrayContaining(["department", "wing", "fileNumber", "signatoryName"])
    );
  });

  test("the Urdu notification contains no stray English prose", () => {
    // "اس کا اطلاق all applicants under the Punjab Solar Initiative پر ہوگا" is not a
    // sentence anyone would sign. Only the reference number may be Latin.
    const n = renderAll(BASE, "ur").notification;
    const withoutRef = n.split("\n").filter((l) => !l.includes("No.SO(")).join(" ");
    const latinWords = withoutRef.match(/\b[A-Za-z]{4,}\b/g) ?? [];
    expect(latinWords, `stray English in the Urdu notification: ${latinWords.join(", ")}`).toEqual([]);
  });

  test("a commencement date is never left in a guessed past year", () => {
    /**
     * Caught on the live service: asked to date "14 August" with no year, the model
     * answered 2023, and a notification issued in 2026 rendered "shall come into force
     * with effect from 14th August, 2023". Nonsense, and visible from the back of a room.
     */
    const rolled = normaliseEffectiveFrom("2023-08-14", "2026-07-28");
    expect(rolled.value).toBe("2026-08-14");
    expect(rolled.adjusted).toBe(true);

    // Already in the future: untouched.
    expect(normaliseEffectiveFrom("2026-08-14", "2026-07-28")).toEqual({
      value: "2026-08-14",
      adjusted: false,
    });

    // A day-and-month that has passed this year rolls to next year, not backwards.
    expect(normaliseEffectiveFrom("2023-01-05", "2026-07-28").value).toBe("2027-01-05");

    // Genuinely retrospective commencement, within a month, is left alone — that is a
    // real thing a department does, and forbidding it would be wrong.
    expect(normaliseEffectiveFrom("2026-07-10", "2026-07-28").adjusted).toBe(false);

    // "At once" stays null.
    expect(normaliseEffectiveFrom(null, "2026-07-28").value).toBeNull();
  });

  test("the page turns one instruction into six artefacts", async ({ page }) => {
    test.setTimeout(180_000);
    const { errors } = collectErrors(page);

    const res = await page.goto("/pk/comms/notice", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    expect(await page.locator(".pk-root").first().getAttribute("dir")).toBe("rtl");

    await page.getByRole("button", { name: "English", exact: true }).first().click();
    await page.waitForTimeout(600);

    await page.locator("textarea").first().fill("solar net metering deadline moved to 31 March");
    await page.getByRole("button", { name: /Prepare the draft/i }).click();

    // Six artefact panels, all from one record.
    await expect(page.locator("section header span.text-xs.font-semibold")).toHaveCount(6, {
      timeout: 90_000,
    });

    const body = await page.locator("body").innerText();
    expect(body).toContain("GOVERNMENT OF THE PUNJAB");
    expect(body).toContain("Endst. No. & Date Even");
    // The clerk's callback list is the feature, so it must actually render.
    expect(body).toContain("A clerk would send this back for");
    // And the page must say it does not send.
    expect(body).toMatch(/Nothing here is sent/i);

    expect(errors.fatal).toEqual([]);
    await page.screenshot({ path: "tests/e2e/screenshots/pk-comms-notice.png", fullPage: false });
  });
});
