/**
 * The indicators a district can be ranked and shaded by.
 *
 * ── The rule this file exists to enforce ──────────────────────────────────────────
 *
 * **An indicator cannot be defined without naming its source and its year.** They are
 * required fields, and every component that renders a figure renders `source` and
 * `year` beside it. This is not decoration: a Chief Minister reading "literacy 64.9%"
 * needs to know whether that is this year's number or from before their government took
 * office, and a vendor who cannot say is a vendor guessing.
 *
 * ── And the rule about what is NOT here ───────────────────────────────────────────
 *
 * There is no composite index. No "district performance score", no weighted ranking, no
 * traffic-light rating. Every such score embeds a judgement about how much education is
 * worth relative to sanitation, presented in the typography of a measurement. Districts
 * rank on **one named indicator at a time**, and which one is always on screen.
 *
 * ── Why the list is short ─────────────────────────────────────────────────────────
 *
 * Because these four are what exists at district level under a licence we can use, as
 * of the Day-0 survey. The 2023 census district tables are behind a JavaScript portal
 * with no reachable data endpoint, and ASER refuses non-browser clients. Padding the
 * picker with plausible-sounding series we cannot source would defeat the point of
 * having it.
 */

export type IndicatorId = 'population' | 'density' | 'urban_share' | 'sex_ratio';

/** Which end of the range is the one a Chief Minister should worry about. */
export type Concern = 'low' | 'high' | 'none';

export interface Indicator {
  id: IndicatorId;
  /** Property name on the district GeoJSON feature. */
  field: string;
  labelEn: string;
  labelUr: string;
  /** What the number actually means, in one line. Rendered under the picker. */
  noteEn: string;
  noteUr: string;
  unitEn: string;
  unitUr: string;
  /** Required. Rendered next to every figure derived from this indicator. */
  source: string;
  sourceUr: string;
  year: string;
  /**
   * Which direction is bad. `none` where the indicator has no good or bad end —
   * ranking a league table by it would imply a judgement the data does not support.
   */
  concern: Concern;
  /** Decimal places. Population is a count; shares are one place. */
  decimals: number;
}

const INDICATORS: Record<IndicatorId, Indicator> = {
  population: {
    id: 'population',
    field: 'pop_total',
    labelEn: 'Population',
    labelUr: 'آبادی',
    noteEn: 'Total district population as enumerated in the 2017 census.',
    noteUr: 'مردم شماری ۲۰۱۷ کے مطابق ضلعے کی کل آبادی۔',
    unitEn: 'people',
    unitUr: 'افراد',
    source: 'Census 2017 (Pakistan Bureau of Statistics, via OCHA COD-PS)',
    sourceUr: 'مردم شماری ۲۰۱۷ (ادارہ شماریات پاکستان، بذریعہ او سی ایچ اے)',
    year: '2017',
    // A large district is not a failing one. Ranking by size would be a population
    // table pretending to be a performance table.
    concern: 'none',
    decimals: 0,
  },
  density: {
    id: 'density',
    field: 'density',
    labelEn: 'Population density',
    labelUr: 'کثافتِ آبادی',
    noteEn:
      'People per square kilometre. Derived from the 2017 census count and the district area in the boundary file.',
    noteUr:
      'فی مربع کلومیٹر افراد۔ مردم شماری ۲۰۱۷ اور حدودی فائل میں درج رقبے سے اخذ کردہ۔',
    unitEn: 'per km²',
    unitUr: 'فی مربع کلومیٹر',
    source: 'Census 2017 population over COD-AB district area',
    sourceUr: 'مردم شماری ۲۰۱۷ کی آبادی تقسیم بر رقبہ (سی او ڈی-اے بی)',
    year: '2017',
    // Density drives the cost of delivering almost everything, but neither end of it is
    // a failure — a sparse district is expensive to serve, a dense one is strained.
    concern: 'none',
    decimals: 0,
  },
  urban_share: {
    id: 'urban_share',
    field: 'urban_share',
    labelEn: 'Urban share',
    labelUr: 'شہری آبادی کا تناسب',
    noteEn: 'Share of the district population the census recorded as living in urban areas.',
    noteUr: 'ضلعے کی وہ آبادی جو مردم شماری میں شہری علاقوں میں شمار ہوئی۔',
    unitEn: '%',
    unitUr: '٪',
    source: 'Census 2017 urban and rural counts',
    sourceUr: 'مردم شماری ۲۰۱۷ کے شہری و دیہی اعداد',
    year: '2017',
    concern: 'none',
    decimals: 1,
  },
  sex_ratio: {
    id: 'sex_ratio',
    field: 'sex_ratio',
    labelEn: 'Sex ratio',
    labelUr: 'تناسبِ جنس',
    noteEn:
      'Males per 100 females. A ratio well above 100 usually reflects male labour migration into the district rather than a demographic imbalance.',
    noteUr:
      'فی ۱۰۰ خواتین کے مقابلے مرد۔ ۱۰۰ سے نمایاں زیادہ تناسب عموماً مردوں کی محنت کے لیے نقل مکانی کا نتیجہ ہوتا ہے۔',
    unitEn: 'M per 100 F',
    unitUr: 'مرد فی ۱۰۰ خواتین',
    source: 'Census 2017 sex-disaggregated counts',
    sourceUr: 'مردم شماری ۲۰۱۷ کے صنفی اعداد',
    year: '2017',
    concern: 'none',
    decimals: 1,
  },
};

export function indicator(id: IndicatorId): Indicator {
  return INDICATORS[id];
}

export function allIndicators(): Indicator[] {
  return [INDICATORS.population, INDICATORS.density, INDICATORS.urban_share, INDICATORS.sex_ratio];
}

export const DEFAULT_INDICATOR: IndicatorId = 'density';

export function indicatorLabel(i: Indicator, locale: 'en' | 'ur'): string {
  return locale === 'ur' ? i.labelUr : i.labelEn;
}

export function indicatorSource(i: Indicator, locale: 'en' | 'ur'): string {
  return locale === 'ur' ? i.sourceUr : i.source;
}

/**
 * Format a value for display. Western digits throughout — universally read in Pakistan,
 * and they keep axes, `toLocaleString` and every regex in one number system.
 */
export function formatValue(value: number | null | undefined, i: Indicator): string {
  if (value == null || Number.isNaN(value)) return '—';
  return i.decimals === 0
    ? Math.round(value).toLocaleString('en-US')
    : value.toFixed(i.decimals);
}
