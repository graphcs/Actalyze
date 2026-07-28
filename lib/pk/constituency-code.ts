/**
 * Canonicalise a Pakistani assembly constituency code.
 *
 * Canonical form is `NA-123` — **never zero-padded**. Every Pakistani source (ECP,
 * na.gov.pk, Dawn, Geo, Wikipedia) writes `NA-2`, not `NA-02`; padding is the fastest
 * way to make the product read as foreign.
 *
 * This shape also cannot satisfy the US validator `^[A-Z]{2}\d{2}$`, so a Pakistani
 * code accidentally routed to a US endpoint fails loudly with a 400 instead of
 * silently returning American data.
 */

export const PK_ASSEMBLIES = {
  NA: { nameEn: 'National Assembly', nameUr: 'قومی اسمبلی', max: 266 },
  PP: { nameEn: 'Punjab Assembly', nameUr: 'پنجاب اسمبلی', max: 297 },
  PS: { nameEn: 'Sindh Assembly', nameUr: 'سندھ اسمبلی', max: 130 },
  PK: { nameEn: 'Khyber Pakhtunkhwa Assembly', nameUr: 'خیبر پختونخوا اسمبلی', max: 115 },
  PB: { nameEn: 'Balochistan Assembly', nameUr: 'بلوچستان اسمبلی', max: 51 },
} as const;

export type PkAssembly = keyof typeof PK_ASSEMBLIES;

/**
 * Accepts `na247`, `NA-247`, `na 247`, `NA‑247` (U+2011 non-breaking hyphen, which
 * is what you get pasting from a PDF) and the URL form `na-247`.
 *
 * Returns null when the input is not a well-formed code, or when the seat number is
 * outside the assembly's range — so a typo 404s rather than rendering an empty page.
 */
export function normalizePkCode(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const cleaned = decodeURIComponent(raw)
    .toUpperCase()
    .replace(/[‐-―]/g, '-') // assorted unicode dashes -> ASCII hyphen
    .replace(/[^A-Z0-9]/g, '');

  const m = cleaned.match(/^(NA|PP|PS|PK|PB)(\d{1,3})$/);
  if (!m) return null;

  const assembly = m[1] as PkAssembly;
  const seat = Number(m[2]);
  if (seat < 1 || seat > PK_ASSEMBLIES[assembly].max) return null;

  return `${assembly}-${seat}`;
}

/** `NA-247` -> `na-247`, the form used in URLs. */
export function toPkUrlSegment(code: string): string {
  return code.toLowerCase();
}

export function parsePkCode(code: string): { assembly: PkAssembly; seat: number } | null {
  const normalized = normalizePkCode(code);
  if (!normalized) return null;
  const [assembly, seat] = normalized.split('-');
  return { assembly: assembly as PkAssembly, seat: Number(seat) };
}

export function isPkCode(raw: string | null | undefined): boolean {
  return normalizePkCode(raw) !== null;
}
