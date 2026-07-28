/**
 * The development scheme register, and matching an issue to what is being done about it.
 *
 * Waleed's point was that nobody knows what the government is actually doing. The gap is
 * real, and it is not solved by talking louder — it is solved by being able to answer
 * "what are you doing about water in Rajanpur" with an ADP number, an allocation and a
 * delivery figure, in the ten seconds before the questioner moves on.
 *
 * ── The shortfall rule ────────────────────────────────────────────────────────────
 *
 * Every scheme carries `delivered` and `target`, and `progressLine()` always renders
 * both. 31 of 48, never 31.
 *
 * This is not modesty. A communications tool that surfaces only completions is one
 * freedom-of-information request away from embarrassing the office using it, and the
 * outstanding number is the one the minister will be asked about in the same breath
 * anyway. Publishing it is what makes the delivered figure believable — and an audience
 * of officials knows that better than we do, which is why showing the gap reads as
 * confidence rather than weakness.
 *
 * ── On the data ───────────────────────────────────────────────────────────────────
 *
 * `data/pk/schemes.json` is a hand-seeded demonstration subset with realistic structure,
 * not a verified register, and its metadata says so in the file. Punjab's ADP sources sit
 * behind a WAF that refuses non-browser clients, so nothing could be imported from
 * outside the country. In production this comes from the department's own database in a
 * day — which is a better answer than a scrape, because they own it.
 */

import raw from '@/data/pk/schemes.json';

export interface Scheme {
  id: string;
  adpNumber: string;
  titleEn: string;
  titleUr: string;
  department: string;
  departmentUr: string;
  districts: string[];
  issueIds: string[];
  allocationPkr: number;
  unit: string;
  unitUr: string;
  target: number;
  delivered: number;
  status: 'ongoing' | 'completed' | 'not started';
  note?: string;
}

const DATA = raw as unknown as {
  metadata: Record<string, string>;
  schemes: Scheme[];
};

export const SCHEME_META = DATA.metadata;

export function allSchemes(): Scheme[] {
  return DATA.schemes;
}

export function schemesForIssue(issueId: string, district?: string): Scheme[] {
  return DATA.schemes
    .filter((s) => s.issueIds.includes(issueId))
    .filter((s) => !district || s.districts.some((d) => d.toLowerCase() === district.toLowerCase()))
    .sort((a, b) => b.allocationPkr - a.allocationPkr);
}

export function schemesForDistrict(district: string): Scheme[] {
  return DATA.schemes
    .filter((s) => s.districts.some((d) => d.toLowerCase() === district.toLowerCase()))
    .sort((a, b) => b.allocationPkr - a.allocationPkr);
}

/** `Rs 2.1 bn`, `Rs 875 m`. Pakistani reporting uses billions and millions, not crore. */
export function formatAllocation(pkr: number, locale: 'en' | 'ur'): string {
  const bn = pkr / 1_000_000_000;
  const m = pkr / 1_000_000;
  const rs = locale === 'ur' ? 'روپے' : 'Rs';
  if (bn >= 1) {
    const v = Math.round(bn * 10) / 10;
    return locale === 'ur' ? `${v} ارب ${rs}` : `${rs} ${v} bn`;
  }
  const v = Math.round(m);
  return locale === 'ur' ? `${v} ملین ${rs}` : `${rs} ${v} m`;
}

/**
 * `31 of 48 filtration plants` — never `31 filtration plants`.
 *
 * The shortfall is part of the sentence rather than a separate field the UI could choose
 * not to render. Making it structurally inseparable is the point.
 */
export function progressLine(s: Scheme, locale: 'en' | 'ur'): string {
  const unit = locale === 'ur' ? s.unitUr : s.unit;
  return locale === 'ur'
    ? `${s.target} میں سے ${s.delivered} ${unit}`
    : `${s.delivered} of ${s.target} ${unit}`;
}

export function outstanding(s: Scheme): number {
  return Math.max(0, s.target - s.delivered);
}

export function completionPct(s: Scheme): number {
  return s.target ? Math.round((s.delivered / s.target) * 100) : 0;
}

/**
 * A publishable line about a scheme, carrying its own evidence.
 *
 * Deliberately assembled in code rather than written by a model: it is a statement of
 * public expenditure and delivery, and the numbers must come from the record unaltered.
 * The ADP number is included because it is what makes the claim checkable.
 */
export function publishableLine(s: Scheme, locale: 'en' | 'ur'): string {
  const title = locale === 'ur' ? s.titleUr : s.titleEn;
  const dept = locale === 'ur' ? s.departmentUr : s.department;
  const alloc = formatAllocation(s.allocationPkr, locale);
  const progress = progressLine(s, locale);
  const left = outstanding(s);

  if (locale === 'ur') {
    return [
      `${title} — ${dept}`,
      `مختص رقم: ${alloc} · پیش رفت: ${progress}`,
      left > 0 ? `باقی: ${left}` : 'مکمل',
      `اے ڈی پی نمبر ${s.adpNumber}`,
    ].join('\n');
  }
  return [
    `${title} — ${dept}`,
    `Allocation: ${alloc} · Progress: ${progress}`,
    left > 0 ? `Outstanding: ${left}` : 'Complete',
    `ADP scheme ${s.adpNumber}`,
  ].join('\n');
}
