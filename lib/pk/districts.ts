/**
 * Districts: the unit the provincial build is actually about.
 *
 * A Chief Minister's writ runs through districts. A Deputy Commissioner runs one, the
 * departments report by one, and every published indicator in Pakistan is broken down
 * by one. So where the national build had to apologise for showing a district when the
 * reader wanted a constituency, here the district is the right answer rather than the
 * available one.
 *
 * ── Why there is an alias table ───────────────────────────────────────────────────
 *
 * Two independent naming authorities have to be joined: the National Assembly writes
 * constituency names like `NA-124 Lahore-VIII`, from which `districts[]` was already
 * extracted, and OCHA's COD-AB names its polygons independently. 105 of the 142
 * distinct district names match on normalisation alone. The remaining 37 are handled
 * here, and they are not all the same kind of problem:
 *
 *   - `spelling` — the same district, written differently. `Gawadar` / `Gwadar`. No
 *     information is lost and nothing needs saying on screen.
 *   - `carved` — a district created after COD-AB's vintage, which therefore has **no
 *     polygon of its own** and is drawn inside the parent it was split from. That is a
 *     real approximation and `isApproximate` marks it so the map can caption it. Nine
 *     of Pakistan's newest districts are in this position, most of them Punjab's 2022
 *     round.
 *
 * Getting this wrong is not subtle in front of this audience: a Punjabi official knows
 * perfectly well that Talagang stopped being part of Chakwal in 2022.
 */

import { type ProvinceCode, codabProvinceName } from './provinces';

export type AliasKind = 'spelling' | 'carved';

interface Alias {
  /** COD-AB `adm2_name` to draw. */
  codab: string;
  kind: AliasKind;
  /** Year the district was created, where known. Rendered in the caption. */
  since?: number;
}

/**
 * Assembly-source district name -> COD-AB polygon.
 *
 * Keys are matched after `normaliseDistrict()`, so case, dots, apostrophes and hyphen
 * spacing do not need to be repeated here.
 */
const ALIASES: Record<string, Alias> = {
  // ── Spelling and transliteration ────────────────────────────────────────────────
  'dgkhan': { codab: 'Dera Ghazi Khan', kind: 'spelling' },
  'dera ismail khan': { codab: 'D. I. Khan', kind: 'spelling' },
  'layyah': { codab: 'Leiah', kind: 'spelling' },
  'battagram': { codab: 'Batagram', kind: 'spelling' },
  'laki marwat': { codab: 'Lakki Marwat', kind: 'spelling' },
  'torghar': { codab: 'Tor Ghar', kind: 'spelling' },
  'kolai pallas kohistan': { codab: 'Kolai Palas Kohistan', kind: 'spelling' },
  'lower kohistan': { codab: 'Kohistan Lower', kind: 'spelling' },
  'kohistan': { codab: 'Kohistan Lower', kind: 'spelling' },
  'south waziristan lower': { codab: 'South Waziristan', kind: 'spelling' },
  'south waziristan upper': { codab: 'South Waziristan', kind: 'spelling' },
  'kamber shahdadkot': { codab: 'Kambar Shahdad Kot', kind: 'spelling' },
  'mirpurkhas': { codab: 'Mirpur Khas', kind: 'spelling' },
  'naushero feroze': { codab: 'Naushahro Feroze', kind: 'spelling' },
  'shaheed benazirabad': { codab: 'Shaheed Benazir Abad', kind: 'spelling' },
  'umerkot': { codab: 'Umer Kot', kind: 'spelling' },
  'gawadar': { codab: 'Gwadar', kind: 'spelling' },
  'lech': { codab: 'Kech', kind: 'spelling' },
  'dukki': { codab: 'Duki', kind: 'spelling' },
  'musa khail': { codab: 'Musakhel', kind: 'spelling' },
  'naseerabad': { codab: 'Nasirabad', kind: 'spelling' },
  'shobat pur': { codab: 'Sohbatpur', kind: 'spelling' },
  'ict': { codab: 'Islamabad', kind: 'spelling' },

  // ── Spellings the provincial sources use that the National Assembly does not ────
  // Added when the four provincial assembly rosters were joined; the same district can
  // reach us under two spellings depending on which House named it.
  'sheikhpura': { codab: 'Sheikhupura', kind: 'spelling' },
  'qambar shahdadkot': { codab: 'Kambar Shahdad Kot', kind: 'spelling' },
  'umarkot': { codab: 'Umer Kot', kind: 'spelling' },
  'jafarabad': { codab: 'Jaffarabad', kind: 'spelling' },
  'kolai palas': { codab: 'Kolai Palas Kohistan', kind: 'spelling' },
  'lower chitral': { codab: 'Chitral Lower', kind: 'spelling' },
  'upper chitral': { codab: 'Chitral Upper', kind: 'spelling' },
  'lower south waziristan': { codab: 'South Waziristan', kind: 'spelling' },
  'upper south waziristan': { codab: 'South Waziristan', kind: 'spelling' },
  'lower dir': { codab: 'Lower Dir', kind: 'spelling' },
  'upper dir': { codab: 'Upper Dir', kind: 'spelling' },
  'tonsa': { codab: 'Dera Ghazi Khan', kind: 'carved', since: 2023 },

  // ── Karachi: the assembly writes "Karachi X", COD-AB writes "X Karachi" ─────────
  'karachi central': { codab: 'Central Karachi', kind: 'spelling' },
  'karachi east': { codab: 'East Karachi', kind: 'spelling' },
  'karachi south': { codab: 'South Karachi', kind: 'spelling' },
  'karachi west': { codab: 'West Karachi', kind: 'spelling' },
  'malir': { codab: 'Malir Karachi', kind: 'spelling' },

  // ── Carved after COD-AB's vintage: no polygon of their own ─────────────────────
  'kot addu': { codab: 'Muzaffargarh', kind: 'carved', since: 2022 },
  'talagang': { codab: 'Chakwal', kind: 'carved', since: 2022 },
  'taunsa': { codab: 'Dera Ghazi Khan', kind: 'carved', since: 2023 },
  'murree': { codab: 'Rawalpindi', kind: 'carved', since: 2022 },
  'wazirabad': { codab: 'Gujranwala', kind: 'carved', since: 2022 },
  'karachi keamari': { codab: 'West Karachi', kind: 'carved', since: 2020 },
  'hub': { codab: 'Lasbela', kind: 'carved', since: 2022 },
  'usta muhammad': { codab: 'Jaffarabad', kind: 'carved', since: 2021 },
  'surab': { codab: 'Kalat', kind: 'carved', since: 2021 },
};

/**
 * Fold the spelling variation that is not worth an alias entry: case, full stops,
 * apostrophes (`Killa` vs `Qilla` is NOT folded — that is a real difference and belongs
 * in the table where it is visible), and hyphen-versus-space.
 */
export function normaliseDistrict(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[.'’`]/g, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * District headers that name a city rather than one of COD-AB's districts.
 *
 * The Sindh Assembly groups all its Karachi seats under a single "Karachi" header,
 * while COD-AB splits the city into six districts. There is no way to tell from the
 * header alone which of the six a given seat sits in, so `Karachi` resolves to the set
 * rather than to one polygon — the map highlights the whole city, which is true, rather
 * than picking a district, which would be a guess with a one-in-six chance.
 */
const CITY_GROUPS: Record<string, string[]> = {
  karachi: [
    'Central Karachi',
    'East Karachi',
    'South Karachi',
    'West Karachi',
    'Korangi Karachi',
    'Malir Karachi',
  ],
};

/** The polygons a city-level name covers, or null where the name is not a city group. */
export function cityGroup(name: string): string[] | null {
  return CITY_GROUPS[normaliseDistrict(name)] ?? null;
}

export interface DistrictResolution {
  /** The COD-AB polygon name to draw. */
  codabName: string;
  /** True where the district has no polygon of its own and is drawn as its parent. */
  isApproximate: boolean;
  /** Set when `isApproximate` — the district the reader actually asked about. */
  requestedName?: string;
  since?: number;
}

/**
 * Resolve an assembly-sourced district name to a polygon.
 *
 * Returns null rather than guessing when the name is unknown. A missing district draws
 * nothing and is reported in the caption; a *wrongly guessed* district draws confident
 * colour over the wrong part of the province, which is far worse and much harder to
 * notice from the back of a room.
 */
export function resolveDistrict(
  name: string,
  codabNames: ReadonlySet<string>
): DistrictResolution | null {
  const key = normaliseDistrict(name);

  // Direct hit against the polygon set, normalised on both sides.
  for (const codab of codabNames) {
    if (normaliseDistrict(codab) === key) {
      return { codabName: codab, isApproximate: false };
    }
  }

  const alias = ALIASES[key];
  if (!alias) return null;

  // The alias target must itself exist, or the table has drifted from the geometry.
  const target = [...codabNames].find((c) => normaliseDistrict(c) === normaliseDistrict(alias.codab));
  if (!target) return null;

  return alias.kind === 'carved'
    ? { codabName: target, isApproximate: true, requestedName: name, since: alias.since }
    : { codabName: target, isApproximate: false };
}

/** Every alias whose target is a parent polygon — used to build the map caption. */
export function carvedDistricts(): Array<{ name: string; parent: string; since?: number }> {
  return Object.entries(ALIASES)
    .filter(([, a]) => a.kind === 'carved')
    .map(([name, a]) => ({ name, parent: a.codab, since: a.since }));
}

/** COD-AB adm1 name for a province — re-exported so map code needs one import. */
export { codabProvinceName };
export type { ProvinceCode };
