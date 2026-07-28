import type { Locale } from "../i18n/dictionary";

/**
 * Copy that belongs to the landing page's institutional furniture.
 *
 * Kept here rather than in `i18n/dictionary.ts` on purpose. That file is being
 * appended to by several agents at once and every key in it is a *product* string —
 * a label a feature needs. These are identity strings: an eyebrow, a masthead line,
 * a provenance note. They travel with the components that render them, and keeping
 * them out of the shared catalogue means this work merges without touching a file
 * three other branches are editing.
 *
 * ── Translation status ─────────────────────────────────────────────────────────────
 * A first pass, and the register matters more here than anywhere else in the app:
 * this is the copy an official reads first. `formalState` quotes the Constitution's
 * own naming of Parliament and should be checked against the Urdu text of Article 50
 * before the demo. `independence` is the disclaimer that keeps a foreign vendor's
 * product from looking like an official publication of the Secretariat — get a
 * native speaker to confirm the phrasing is unambiguous.
 */
const COPY = {
  en: {
    /** Names the institution this is built for. Never claims to be issued by it. */
    eyebrow: "National Assembly of Pakistan",
    /**
     * The Constitution's own name for Parliament. Chosen over any patriotic slogan:
     * an institutional audience reads a constitutional citation as competence and a
     * slogan from a foreign vendor as pandering.
     */
    formalState: "Majlis-e-Shoora (Parliament) · Islamic Republic of Pakistan",
    findSeat: "Find a constituency",
    findSeatHelp: "Type a seat number, a member's name, or a district.",
    houseHeading: "The House at a glance",
    houseSub: "Counted from the Assembly roster, not written down — general, women-reserved and minority-reserved seats together.",
    capabilities: "Capabilities",
    independence:
      "An independent service. Not published by, and not endorsed by, the National Assembly Secretariat.",
    menu: "Menu",
    seatDetail: "Open constituency",
    /** Unit label under a seat count. Not `common.seat`, which is singular. */
    seatsLabel: "NA seats",
  },
  ur: {
    eyebrow: "قومی اسمبلی پاکستان",
    formalState: "مجلسِ شوریٰ (پارلیمنٹ) · اسلامی جمہوریہ پاکستان",
    findSeat: "حلقہ تلاش کریں",
    findSeatHelp: "نشست کا نمبر، رکن کا نام، یا ضلع لکھیں۔",
    houseHeading: "ایوان ایک نظر میں",
    houseSub: "اعداد اسمبلی کی فہرست سے شمار کیے جاتے ہیں — جنرل، خواتین اور اقلیتی نشستیں سمیت۔",
    capabilities: "خدمات",
    independence:
      "یہ ایک غیر سرکاری خدمت ہے۔ قومی اسمبلی سیکرٹریٹ کی جانب سے شائع کردہ یا توثیق شدہ نہیں۔",
    menu: "مینو",
    seatDetail: "حلقہ کھولیں",
    seatsLabel: "نشستیں",
  },
} as const;

export type IdentityKey = keyof (typeof COPY)["en"];

export function identity(locale: Locale, key: IdentityKey): string {
  return COPY[locale][key] ?? COPY.en[key];
}
