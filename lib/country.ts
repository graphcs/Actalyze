/**
 * Country scoping.
 *
 * The app was built for a single country, so nothing in the cache layer carries a
 * country dimension. Adding a second country without one would be silently
 * destructive: `district:trending:national` is the same Supabase row for both, and
 * two-letter subnational codes collide outright (Sindh `SD` vs South Dakota `SD`).
 *
 * `US` remains the default everywhere so existing call sites and every cached row
 * keep working byte-identically.
 */

export type CountryCode = 'US' | 'PK';

export const DEFAULT_COUNTRY: CountryCode = 'US';

/** Locale hints for search retrieval, per country. */
export const COUNTRY_SEARCH_LOCALE: Record<CountryCode, { gl: string; hl: string; location: string }> = {
  US: { gl: 'us', hl: 'en', location: 'United States' },
  // Day-0 finding: `hl=ur` returns roughly half as many results as `hl=en` and mixes
  // languages, so retrieval leads with English. This is independent of the Urdu UI.
  PK: { gl: 'pk', hl: 'en', location: 'Pakistan' },
};
