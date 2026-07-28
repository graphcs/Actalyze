/**
 * One government communication, six ways.
 *
 * ── The problem this models ───────────────────────────────────────────────────────
 *
 * A Punjab department issuing a single notification runs it through several rounds of
 * editing and review, prints it, signs it, scans it, and distributes it through five to
 * ten staff — with clerks coming back to the originating officer for clarification.
 *
 * That is two different problems wearing one coat:
 *
 *   1. **Intake.** The clerk comes back because the draft arrived without the fields a
 *      notification cannot be issued without — what power it is made under, when it
 *      takes effect, who it binds, what it supersedes. `NoticeIntake` below asks for
 *      those up front. Every field on it exists because a clerk would otherwise have to
 *      chase it.
 *
 *   2. **Fan-out.** The same content is then retyped into a notification, a press
 *      release, an SMS, a social post and a WhatsApp broadcast by different people, in
 *      two languages, and they drift. Here they are ten renderings of one record, so
 *      they cannot.
 *
 * ── Why the format is copied exactly ──────────────────────────────────────────────
 *
 * See `data/pk/NOTIFICATION-FORMAT.md`, which is grounded against real published
 * notifications from six departments. The conventions reproduced here — the `.—` after
 * the reference number, `Endst. No. & Date Even`, the ordinal dateline, the wing
 * abbreviation appearing in both the number and the signature block — are the same class
 * of detail as Rule 78's word limit on the drafting page. An audience of officials reads
 * one of these a day. A document that gets the shape right is credible before anyone has
 * read a word of it; one that gets it wrong is dismissed just as fast.
 *
 * ── What this does NOT do ─────────────────────────────────────────────────────────
 *
 * It does not send anything. Every artefact names the issuing office and is handed back
 * for a human to approve and release. There is no posting integration, no scheduler, and
 * no concept of an account that is not the department's own.
 */

export type Locale = 'en' | 'ur';

/** Where a communication is in the approval chain. Nothing skips a step. */
export type NoticeStage = 'draft' | 'reviewed' | 'approved' | 'issued';

export const NOTICE_STAGES: NoticeStage[] = ['draft', 'reviewed', 'approved', 'issued'];

export interface ApprovalStep {
  stage: NoticeStage;
  /** Who acted. Free text: the Secretariat records designations, not user accounts. */
  by: string;
  at: string;
  note?: string;
}

/**
 * What a notification cannot be issued without.
 *
 * `statutoryPower` is optional because not every notification exercises one — a transfer
 * or an appointment opens directly with its operative sentence. But when it is absent the
 * rendered document omits the "In exercise of the powers conferred by…" opening entirely
 * rather than leaving a gap, because a half-filled statutory formula is worse than none.
 */
export interface NoticeIntake {
  /** Plain-language instruction. The one thing the officer actually types. */
  subject: string;

  department: string;
  /** Wing abbreviation, e.g. `CAB-I`, `P-III`, `SOR-III`. Appears in the number AND the
   *  signature block, which is why it is one field rather than two. */
  wing: string;
  /** Departmental file number, e.g. `2-9`. */
  fileNumber: string;
  serial: string;
  year: number;

  /** `Lahore` for the provincial secretariat; a division for a divisional office. */
  station: string;
  /** ISO date the notification is dated. */
  dated: string;

  /** e.g. `Section 26 of the Provincial Motor Vehicles Ordinance, 1965`. */
  statutoryPower?: string;
  /** The operative change, in the officer's own words. */
  effect: string;
  /** ISO date, or null for "at once". */
  effectiveFrom: string | null;
  /** Who it binds. */
  appliesTo: string;
  /** Reference of anything this replaces. */
  supersedes?: string;

  signatoryName: string;
  /** Usually `Section Officer`. */
  signatoryDesignation: string;

  distribution: string[];

  /**
   * Urdu the officer supplies.
   *
   * Every one of these is a field that would otherwise sit in English inside an Urdu
   * legal instrument — "اس کا اطلاق all applicants under the Punjab Solar Initiative پر
   * ہوگا" is not a sentence anyone would sign. The renderer falls back to the English
   * rather than machine-translating, and `urduIsReviewed()` reports the gap so the page
   * can refuse to call the Urdu version issuable.
   */
  subjectUr?: string;
  effectUr?: string;
  departmentUr?: string;
  stationUr?: string;
  appliesToUr?: string;
  statutoryPowerUr?: string;
  supersedesUr?: string;
  signatoryNameUr?: string;
  signatoryDesignationUr?: string;
  distributionUr?: string[];
}

/**
 * Distribution lists observed across real notifications. Offered as one-click additions
 * so the officer is not retyping the same eight lines; not defaults, because who needs a
 * copy is a judgement about the subject matter.
 */
export const COMMON_DISTRIBUTION = [
  'All Administrative Secretaries to Government of the Punjab',
  'All Heads of Attached Departments, Government of the Punjab',
  'All Divisional Commissioners in the Punjab',
  'All Deputy Commissioners in the Punjab',
  'The Accountant General Punjab, Lahore',
  'The Secretary to Governor, Punjab',
  'The Principal Secretary to Chief Minister, Punjab',
  'The Director General Public Relations, Punjab',
  'Web Administrator, with the request to place it on the departmental website',
  'Master file / Office copy',
];

// ─────────────────────────────────────────────────────────────────────────────────────
// Reference number and dateline
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The wing, stripped of any `SO(...)` wrapper the officer typed.
 *
 * `wing` is the bare abbreviation — `CAB-I`, `PE-II`, `P-III`. But an officer copying
 * from a document in front of them will type `SO(PE-II)` about half the time, because
 * that is how it appears on the page. Wrapping that again produces
 * `No.SO(SO(PE-II))4-2/2026`, which is instantly wrong to anyone who reads these, and it
 * is not the officer's mistake to make — the field accepts both forms.
 */
function bareWing(wing: string): string {
  return wing
    .trim()
    .replace(/^no\.?\s*/i, '')
    .replace(/^so\s*\(/i, '')
    .replace(/\)\s*$/, '')
    .replace(/^so[.\s-]+/i, '')
    .trim();
}

/**
 * `No.SO(CAB-I)2-9/2015`.
 *
 * The wing goes in parentheses immediately after `SO`, then the file number, a hyphen,
 * the serial, a slash and the year. Verified against six departments' published output.
 */
export function referenceNumber(i: NoticeIntake): string {
  const wing = bareWing(i.wing);
  const file = i.fileNumber.trim();
  const serial = i.serial.trim();
  // An unfilled field renders as a visible blank rather than collapsing. `No.SO()/2026`
  // reads as a bug; `No.SO(——)——/2026` reads as a form waiting for the officer, which is
  // what it is. The same reasoning applies to the letterhead and signature block below.
  return `No.SO(${wing || BLANK})${file || BLANK}${serial ? `-${serial}` : ''}/${i.year}`;
}

/** Em dashes, not underscores: this gets printed, and a rule of underscores looks like a
 *  form to sign rather than a field to complete. */
const BLANK = '——';

/**
 * `Energy` -> `Energy Department`, but `Finance Department` is left alone.
 *
 * Departments are referred to with the word in running prose — "Issued by the Energy
 * Department" — and officers type the name with or without it depending on the day.
 */
function departmentName(department: string, locale: Locale): string {
  const d = department.trim();
  if (locale === 'ur') return /محکمہ/.test(d) ? d : `محکمہ ${d}`;
  return /\bdepartment\b/i.test(d) ? d : `${d} Department`;
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_UR = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر',
];

/**
 * Urdu-Indic digits, used for dates in the Urdu rendering only.
 *
 * The rest of this build uses Western digits deliberately — they are universally read in
 * Pakistan and they keep axes, `toLocaleString` and every regex in one number system.
 * A notification is the exception: it is a legal instrument, an Urdu one is typeset with
 * Urdu-Indic digits, and an officer typing `۳۱ مارچ` into the effect field would
 * otherwise see it sit next to a machine-rendered `31 March` two lines below.
 *
 * The reference number keeps Western digits in both languages, because it is a code that
 * gets quoted back, searched for and typed into other systems.
 */
const URDU_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function urduDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => URDU_DIGITS[Number(d)]);
}

/** `25th`, `1st`, `22nd`, `13th`. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * `Dated Lahore, the 25th April, 2022`.
 *
 * Not ISO and not `25/04/2022`. The ordinal form is what every published notification
 * uses, and it is the first thing on the page after the letterhead.
 */
export function dateline(i: NoticeIntake, locale: Locale): string {
  if (locale === 'ur') {
    // Station first, then the date — the Urdu order, not a translation of the English
    // one. And note the `ء` goes on the YEAR, marking it Common Era. Putting it on the
    // month, which the first version did, produces `جولائیء` — a non-word, and the kind
    // of error that tells a native reader in one glance that nobody Urdu-literate has
    // read this.
    return `بمقام ${stationName(i, 'ur')}، بتاریخ ${longDate(i.dated, 'ur')}`;
  }
  const d = new Date(i.dated);
  return `Dated ${i.station}, the ${ordinal(d.getUTCDate())} ${MONTHS_EN[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

function longDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return locale === 'ur'
    ? `${urduDigits(d.getUTCDate())} ${MONTHS_UR[d.getUTCMonth()]} ${urduDigits(d.getUTCFullYear())}ء`
    : `${ordinal(d.getUTCDate())} ${MONTHS_EN[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/**
 * Station names in Urdu.
 *
 * Only the handful a provincial notification is ever dated from. Anything else falls
 * through to whatever the officer typed, which is correct: an unrecognised station is
 * more likely to be a divisional office we have not listed than a mistake.
 */
const STATION_UR: Record<string, string> = {
  lahore: 'لاہور',
  rawalpindi: 'راولپنڈی',
  multan: 'ملتان',
  faisalabad: 'فیصل آباد',
  gujranwala: 'گوجرانوالہ',
  bahawalpur: 'بہاولپور',
  sargodha: 'سرگودھا',
  'dera ghazi khan': 'ڈیرہ غازی خان',
  sahiwal: 'ساہیوال',
  karachi: 'کراچی',
  peshawar: 'پشاور',
  quetta: 'کوئٹہ',
  islamabad: 'اسلام آباد',
};

function stationName(i: NoticeIntake, locale: Locale): string {
  if (locale !== 'ur') return i.station;
  return i.stationUr?.trim() || STATION_UR[i.station.trim().toLowerCase()] || i.station;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// The six artefacts
// ─────────────────────────────────────────────────────────────────────────────────────

export interface RenderedNotice {
  /** Monospaced, print-ready body of the notification itself. */
  notification: string;
  pressRelease: string;
  sms: string;
  socialPost: string;
  whatsapp: string;
  /** Short lines for the 1200×675 card. Rendered as DOM, not composed here. */
  card: { eyebrow: string; headline: string; detail: string; reference: string };
}

const T = {
  en: {
    govt: 'GOVERNMENT OF THE PUNJAB',
    notification: 'NOTIFICATION',
    inExercise: (p: string) => `In exercise of the powers conferred by ${p}, the Governor of the Punjab is pleased to direct as follows:—`,
    commenceAt: 'This notification shall come into force at once.',
    commenceOn: (d: string) => `This notification shall come into force with effect from ${d}.`,
    supersedes: (r: string) => `This supersedes ${r}.`,
    appliesTo: (a: string) => `This applies to ${a}.`,
    endst: 'Endst. No. & Date Even',
    forwarded: 'A copy is forwarded for information and necessary action to:-',
    prTitle: 'PRESS RELEASE',
    prImmediate: 'FOR IMMEDIATE RELEASE',
    prContact: 'For further information: Directorate General Public Relations, Punjab',
    effectiveAtOnce: 'with immediate effect',
    effectiveFrom: (d: string) => `with effect from ${d}`,
    issuedBy: (d: string) => `Issued by the ${departmentName(d, 'en')}, Government of the Punjab`,
    refLabel: 'Ref',
  },
  ur: {
    govt: 'حکومتِ پنجاب',
    notification: 'نوٹیفکیشن',
    inExercise: (p: string) => `${p} کے تحت حاصل شدہ اختیارات بروئے کار لاتے ہوئے، گورنر پنجاب حسبِ ذیل ہدایت جاری کرتے ہیں:—`,
    commenceAt: 'یہ نوٹیفکیشن فی الفور نافذ العمل ہوگا۔',
    commenceOn: (d: string) => `یہ نوٹیفکیشن ${d} سے نافذ العمل ہوگا۔`,
    supersedes: (r: string) => `یہ ${r} کی جگہ لے گا۔`,
    appliesTo: (a: string) => `اس کا اطلاق ${a} پر ہوگا۔`,
    endst: 'اینڈسٹ نمبر و تاریخ ایضاً',
    forwarded: 'نقل بغرضِ اطلاع و ضروری کارروائی ارسالِ خدمت ہے:-',
    prTitle: 'پریس ریلیز',
    prImmediate: 'فوری اشاعت کے لیے',
    prContact: 'مزید معلومات کے لیے: محکمہ تعلقاتِ عامہ، پنجاب',
    effectiveAtOnce: 'فی الفور',
    effectiveFrom: (d: string) => `${d} سے`,
    issuedBy: (d: string) => `جاری کردہ: ${departmentName(d, 'ur')}، حکومتِ پنجاب`,
    refLabel: 'حوالہ',
  },
} as const;

function subjectOf(i: NoticeIntake, locale: Locale): string {
  return locale === 'ur' ? (i.subjectUr || i.subject) : i.subject;
}
function effectOf(i: NoticeIntake, locale: Locale): string {
  return locale === 'ur' ? (i.effectUr || i.effect) : i.effect;
}
/**
 * Fit a phrase into the middle of a sentence.
 *
 * `appliesTo` and `supersedes` arrive as standalone phrases — from a model, or from an
 * officer typing into a labelled box — so they come capitalised and full-stopped. Dropped
 * straight into "This applies to …" that produces *"This applies to All individuals and
 * entities interested in applying for solar net metering in Punjab.."*: a stray capital
 * and a doubled full stop, in the operative paragraph of a legal instrument.
 *
 * Only the first letter is lowered, and only when the rest of the first word is not
 * already capitalised — so `NADRA`, `DISCOs` and `All Deputy Commissioners` keep the case
 * they were given, because those are proper nouns and titles rather than sentence case.
 */
function embed(phrase: string): string {
  const s = phrase.trim().replace(/[.。]+$/, '');
  if (!s) return s;
  const firstWord = s.split(/\s+/)[0];
  const isProperNoun = /^[A-Z][A-Z]/.test(firstWord) || /^[A-Z]\w*[A-Z]/.test(firstWord);
  if (isProperNoun) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function appliesToOf(i: NoticeIntake, locale: Locale): string {
  return embed(locale === 'ur' ? (i.appliesToUr || i.appliesTo) : i.appliesTo);
}
function powerOf(i: NoticeIntake, locale: Locale): string | undefined {
  return locale === 'ur' ? (i.statutoryPowerUr || i.statutoryPower) : i.statutoryPower;
}
function supersedesOf(i: NoticeIntake, locale: Locale): string | undefined {
  const v = locale === 'ur' ? (i.supersedesUr || i.supersedes) : i.supersedes;
  return v ? embed(v) : undefined;
}
function deptOf(i: NoticeIntake, locale: Locale): string {
  return locale === 'ur' ? (i.departmentUr || i.department) : i.department;
}
function distributionOf(i: NoticeIntake, locale: Locale): string[] {
  return locale === 'ur' && i.distributionUr?.length ? i.distributionUr : i.distribution;
}

/**
 * The notification itself.
 *
 * Assembled as text rather than markup because the officer needs to be able to read it
 * against the one on their desk, line for line, before they trust anything else here.
 */
export function renderNotification(i: NoticeIntake, locale: Locale): string {
  const t = T[locale];
  const ref = referenceNumber(i);
  const lines: string[] = [];

  lines.push(t.govt);
  lines.push(
    i.department.trim()
      ? locale === 'ur'
        ? departmentName(deptOf(i, 'ur'), 'ur')
        : departmentName(i.department, 'en').toUpperCase()
      : `${BLANK} ${locale === 'ur' ? 'محکمہ' : 'DEPARTMENT'}`
  );
  lines.push('');
  lines.push(dateline(i, locale));
  lines.push('');
  lines.push(t.notification);
  lines.push('');

  // The `.—` running straight into the operative text is the statutory drafting
  // convention; the reference number is part of the sentence, not a header above it.
  const power = powerOf(i, locale);
  const opening = power ? `${ref}.— ${t.inExercise(power)}` : `${ref}.—`;
  lines.push(opening);
  lines.push('');
  lines.push(effectOf(i, locale));

  const numbered: string[] = [];
  if (i.appliesTo) numbered.push(t.appliesTo(appliesToOf(i, locale)));
  numbered.push(i.effectiveFrom ? t.commenceOn(longDate(i.effectiveFrom, locale)) : t.commenceAt);
  const sup = supersedesOf(i, locale);
  if (sup) numbered.push(t.supersedes(sup));

  lines.push('');
  numbered.forEach((n, idx) =>
    lines.push(`${locale === 'ur' ? urduDigits(idx + 2) : idx + 2}.   ${n}`)
  );

  lines.push('');
  lines.push('');
  const signatory = (locale === 'ur' ? i.signatoryNameUr || i.signatoryName : i.signatoryName).trim();
  lines.push(`(${signatory || BLANK})`);
  lines.push(
    locale === 'ur'
      ? `${i.signatoryDesignationUr || i.signatoryDesignation} (${bareWing(i.wing) || BLANK})`
      : `${i.signatoryDesignation.toUpperCase()} (${bareWing(i.wing) || BLANK})`
  );
  lines.push('');
  // `Even` = the same number and date as the notification above. An endorsement issued
  // separately would carry its own; this one never does.
  lines.push(t.endst);
  lines.push('');
  lines.push(t.forwarded);
  lines.push('');
  distributionOf(i, locale).forEach((d, idx) =>
    lines.push(`  ${locale === 'ur' ? urduDigits(idx + 1) : idx + 1}.  ${d}`)
  );

  return lines.join('\n');
}

export function renderPressRelease(i: NoticeIntake, locale: Locale): string {
  const t = T[locale];
  const when = i.effectiveFrom ? t.effectiveFrom(longDate(i.effectiveFrom, locale)) : t.effectiveAtOnce;
  return [
    t.prTitle,
    t.prImmediate,
    '',
    subjectOf(i, locale),
    '',
    dateline(i, locale),
    '',
    `${effectOf(i, locale)} — ${when}.`,
    '',
    i.appliesTo ? t.appliesTo(appliesToOf(i, locale)) : '',
    supersedesOf(i, locale) ? t.supersedes(supersedesOf(i, locale)!) : '',
    '',
    `${t.refLabel}: ${referenceNumber(i)}`,
    t.issuedBy(deptOf(i, locale)),
    t.prContact,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/**
 * SMS, hard-capped at 160 characters.
 *
 * Counted and truncated **in code**, never left to the model, for the same reason Rule
 * 78's 150-word limit is counted in code on the drafting page: a limit a model is asked
 * to respect is a limit that will be exceeded on the day it matters. Urdu is counted in
 * the same units — a UCS-2 SMS is actually 70 characters, which the UI surfaces
 * separately; this function guarantees the GSM-7 bound.
 */
export const SMS_LIMIT = 160;

export function renderSms(i: NoticeIntake, locale: Locale): string {
  const t = T[locale];
  const when = i.effectiveFrom ? t.effectiveFrom(longDate(i.effectiveFrom, locale)) : t.effectiveAtOnce;
  const full = `${subjectOf(i, locale)} ${when}. ${referenceNumber(i)}`.replace(/\s+/g, ' ').trim();
  if (full.length <= SMS_LIMIT) return full;

  // Truncate the subject, never the reference — a citizen who cannot verify the notice
  // has received a rumour with a government letterhead on it.
  const tail = ` ${when}. ${referenceNumber(i)}`;
  const room = SMS_LIMIT - tail.length - 1;
  const head = subjectOf(i, locale).slice(0, Math.max(0, room)).replace(/\s+\S*$/, '');
  return `${head}…${tail}`.slice(0, SMS_LIMIT);
}

export const SOCIAL_LIMIT = 280;

export function renderSocialPost(i: NoticeIntake, locale: Locale): string {
  const t = T[locale];
  const when = i.effectiveFrom ? t.effectiveFrom(longDate(i.effectiveFrom, locale)) : t.effectiveAtOnce;
  const body = `${subjectOf(i, locale)} — ${when}.`;
  const attribution = t.issuedBy(deptOf(i, locale));
  const ref = `${t.refLabel}: ${referenceNumber(i)}`;

  // Attribution and reference are never dropped to fit. If something has to go it is the
  // body, because a post nobody can trace back to a document is the thing this product
  // exists not to produce.
  const fixed = `\n${attribution}\n${ref}`;
  const room = SOCIAL_LIMIT - fixed.length;
  const trimmed = body.length <= room ? body : `${body.slice(0, Math.max(0, room - 1)).replace(/\s+\S*$/, '')}…`;
  return `${trimmed}${fixed}`;
}

/** WhatsApp — the channel Pakistani government offices actually use. No length limit,
 *  so this is the one that carries the full distribution context. */
export function renderWhatsapp(i: NoticeIntake, locale: Locale): string {
  const t = T[locale];
  const when = i.effectiveFrom ? t.effectiveFrom(longDate(i.effectiveFrom, locale)) : t.effectiveAtOnce;
  return [
    `*${subjectOf(i, locale)}*`,
    '',
    effectOf(i, locale),
    '',
    `${when}.`,
    i.appliesTo ? t.appliesTo(appliesToOf(i, locale)) : '',
    '',
    `${t.refLabel}: ${referenceNumber(i)}`,
    `${dateline(i, locale)}`,
    t.issuedBy(deptOf(i, locale)),
  ]
    .filter((l) => l !== '')
    .join('\n');
}

export function renderCard(i: NoticeIntake, locale: Locale): RenderedNotice['card'] {
  const t = T[locale];
  return {
    eyebrow: t.issuedBy(deptOf(i, locale)),
    headline: subjectOf(i, locale),
    detail: i.effectiveFrom
      ? t.effectiveFrom(longDate(i.effectiveFrom, locale))
      : t.effectiveAtOnce,
    reference: referenceNumber(i),
  };
}

export function renderAll(i: NoticeIntake, locale: Locale): RenderedNotice {
  return {
    notification: renderNotification(i, locale),
    pressRelease: renderPressRelease(i, locale),
    sms: renderSms(i, locale),
    socialPost: renderSocialPost(i, locale),
    whatsapp: renderWhatsapp(i, locale),
    card: renderCard(i, locale),
  };
}

/**
 * What is missing before this can be issued.
 *
 * Returned as a list rather than a boolean so the UI can show the officer exactly what a
 * clerk would otherwise come back and ask for — which is the whole point of the intake.
 */
export function missingFields(i: Partial<NoticeIntake>): string[] {
  const missing: string[] = [];
  if (!i.subject?.trim()) missing.push('subject');
  if (!i.effect?.trim()) missing.push('effect');
  if (!i.department?.trim()) missing.push('department');
  if (!i.wing?.trim()) missing.push('wing');
  if (!i.fileNumber?.trim()) missing.push('fileNumber');
  if (!i.year) missing.push('year');
  if (!i.dated) missing.push('dated');
  if (!i.appliesTo?.trim()) missing.push('appliesTo');
  if (!i.signatoryName?.trim()) missing.push('signatoryName');
  if (!i.distribution?.length) missing.push('distribution');
  return missing;
}

/**
 * Which fields would render in English inside the Urdu notification.
 *
 * Checked field by field rather than as a boolean on the subject alone, because the
 * fallback is silent by design: a missing `signatoryNameUr` does not break anything, it
 * just puts "Muhammad Adnan Rafique / SECTION OFFICER" into an otherwise Urdu legal
 * instrument, and a `supersedes` reference carries "dated 4th December, 2025" with it.
 * Those are the gaps a native reader notices immediately and an English-reading reviewer
 * does not see at all, so the page names them individually.
 */
export function urduGaps(i: NoticeIntake): string[] {
  const gaps: string[] = [];
  if (!i.subjectUr?.trim()) gaps.push('subject');
  if (!i.effectUr?.trim()) gaps.push('effect');
  if (i.appliesTo?.trim() && !i.appliesToUr?.trim()) gaps.push('appliesTo');
  if (i.department?.trim() && !i.departmentUr?.trim()) gaps.push('department');
  if (i.statutoryPower?.trim() && !i.statutoryPowerUr?.trim()) gaps.push('statutoryPower');
  if (i.supersedes?.trim() && !i.supersedesUr?.trim()) gaps.push('supersedes');
  if (i.signatoryName?.trim() && !i.signatoryNameUr?.trim()) gaps.push('signatoryName');
  if (i.signatoryDesignation?.trim() && !i.signatoryDesignationUr?.trim())
    gaps.push('signatoryDesignation');
  if (i.distribution?.length && !i.distributionUr?.length) gaps.push('distribution');
  return gaps;
}

/**
 * Pull a bare day-and-month back onto the right year.
 *
 * Asked to date "14 August" with no year, a model will happily answer `2023-08-14`. On a
 * notification issued in 2026 that renders as "shall come into force with effect from
 * 14th August, 2023" — a commencement three years before the instrument exists. It is
 * nonsense, it is instantly visible to anyone in the room, and it was caught on the live
 * service rather than in review, which is where these things always surface.
 *
 * A commencement date genuinely can be retrospective, so this does not forbid the past —
 * it rolls a date more than a month behind the notification forward to the next
 * occurrence of the same day and month, and reports that it did so. An officer who
 * really means a retrospective date types it and it stands, because their value always
 * wins over the model's.
 */
export function normaliseEffectiveFrom(
  effectiveFrom: string | null,
  dated: string
): { value: string | null; adjusted: boolean } {
  if (!effectiveFrom) return { value: null, adjusted: false };
  const eff = new Date(effectiveFrom);
  const ref = new Date(dated);
  if (Number.isNaN(eff.getTime()) || Number.isNaN(ref.getTime())) {
    return { value: effectiveFrom, adjusted: false };
  }

  const GRACE_DAYS = 31;
  const behindBy = (ref.getTime() - eff.getTime()) / 86_400_000;
  if (behindBy <= GRACE_DAYS) return { value: effectiveFrom, adjusted: false };

  for (let year = ref.getUTCFullYear(); year <= ref.getUTCFullYear() + 1; year++) {
    const candidate = new Date(
      Date.UTC(year, eff.getUTCMonth(), eff.getUTCDate())
    );
    if (candidate.getTime() >= ref.getTime()) {
      return { value: candidate.toISOString().slice(0, 10), adjusted: true };
    }
  }
  return { value: effectiveFrom, adjusted: false };
}

/** Whether the Urdu is the officer's throughout, so the UI can say which. */
export function urduIsReviewed(i: NoticeIntake): boolean {
  return urduGaps(i).length === 0;
}
