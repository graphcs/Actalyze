/**
 * Canonicalise a congressional district code.
 *
 * The district APIs validate against /^[A-Z]{2}\d{2}$/ ("CA12"), but the UI shows
 * and advertises the hyphenated form ("CA-12") in the sidebar, page badges and the
 * search placeholder. Links that use the advertised format therefore hit every
 * district endpoint with a 400 and render an empty page with no error shown.
 *
 * Accepts "CA-12", "ca12", "CA 12", "CA-1" and returns "CA12". Returns the
 * uppercased input unchanged when it does not look like a district code, so
 * genuinely invalid values still reach the existing validation path.
 */
export function normalizeDistrictCode(raw: string | undefined | null): string {
  if (!raw) return '';
  const cleaned = decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = cleaned.match(/^([A-Z]{2})(\d{1,2})$/);
  if (!m) return cleaned;
  return `${m[1]}${m[2].padStart(2, '0')}`;
}
