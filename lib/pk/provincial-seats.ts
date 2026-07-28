/**
 * Provincial assembly seats, and the district rollups the board is built from.
 *
 * Separate from `constituencies.ts`, which serves the National Assembly, because the
 * two datasets have different provenance and different caveats and a single loader
 * would have to carry both. The NA seed is scraped from the House itself; this one is
 * assembled from Wikipedia's per-assembly lists because three of the four provincial
 * sites cannot supply what is needed and Punjab's does not respond at all. That
 * difference is not an implementation detail — it is rendered on the page — so it lives
 * in the type rather than in a comment.
 */

import raw from '@/data/pk/provincial-constituencies.json';
import { resolveDistrict, cityGroup, normaliseDistrict } from './districts';
import type { PkPartyId } from './parties';
import type { ProvinceCode, AssemblyPrefix } from './provinces';

export interface ProvincialSeat {
  code: string;
  seatNumber: number;
  assembly: string;
  province: string;
  name: string | null;
  districts: string[];
  memberName: string | null;
  party: PkPartyId | null;
  partyRaw: string | null;
  vacant: boolean;
}

export interface AssemblyProvenance {
  assembly: string;
  province: string;
  generalSeats: number;
  filled: number;
  source: string;
  sourceUrl: string;
  officialUrl: string | null;
  officialSeatCount: number | null;
  crossCheck: string;
}

const DATA = raw as unknown as {
  scrapedAt: string;
  provenance: AssemblyProvenance[];
  constituencies: ProvincialSeat[];
};

export const PROVINCIAL_SEED_META = {
  scrapedAt: DATA.scrapedAt,
  provenance: DATA.provenance,
};

export function seatsInProvince(provinceCode: ProvinceCode): ProvincialSeat[] {
  return DATA.constituencies.filter((c) => c.province === provinceCode);
}

export function seatsInAssembly(assemblyPrefix: AssemblyPrefix): ProvincialSeat[] {
  return DATA.constituencies.filter((c) => c.assembly === assemblyPrefix);
}

export function provincialSeat(code: string): ProvincialSeat | null {
  return DATA.constituencies.find((c) => c.code === code.toUpperCase()) ?? null;
}

export function provenanceFor(provinceCode: ProvinceCode): AssemblyProvenance | null {
  return DATA.provenance.find((p) => p.province === provinceCode) ?? null;
}

/**
 * Seats by party, counting **general seats only**.
 *
 * Deliberately different from the National Assembly page, which counts all seat types
 * because a parliamentary audience reads PML-N's total as 132 rather than 93. Here the
 * reserved seats are excluded and the page says so: reserved members are returned from
 * party lists after the general result, and the four assemblies' allocations are not
 * published in a form this build has. Showing a total that silently omitted them would
 * be worse than showing the general count and naming it.
 */
export function partyCountsInProvince(provinceCode: ProvinceCode): Array<{
  party: PkPartyId;
  seats: number;
}> {
  const counts = new Map<PkPartyId, number>();
  for (const s of seatsInProvince(provinceCode)) {
    if (s.vacant || !s.party) continue;
    counts.set(s.party, (counts.get(s.party) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([party, seats]) => ({ party, seats }))
    .sort((a, b) => b.seats - a.seats);
}

export function vacantCount(provinceCode: ProvinceCode): number {
  return seatsInProvince(provinceCode).filter((s) => s.vacant).length;
}

/**
 * How many assembly seats sit in each district polygon.
 *
 * Keyed by COD-AB name so the map can look up by the same key it draws with. A seat
 * spanning two districts (`PB-1 Sherani-cum-Zhob`) counts in both — it genuinely
 * covers both, and dividing it in half would produce a table of fractional seats.
 *
 * A district header naming a whole city (Sindh groups every Karachi seat under
 * "Karachi") is spread across the city's districts, because the source does not say
 * which one a given seat is in and picking would be a guess.
 */
export function seatsByDistrict(
  provinceCode: ProvinceCode,
  codabNames: ReadonlySet<string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const seat of seatsInProvince(provinceCode)) {
    for (const d of seat.districts) {
      const group = cityGroup(d);
      if (group) {
        for (const g of group) if (codabNames.has(g)) out[g] = (out[g] ?? 0) + 1;
        continue;
      }
      const r = resolveDistrict(d, codabNames);
      if (r) out[r.codabName] = (out[r.codabName] ?? 0) + 1;
    }
  }
  return out;
}

/** The seats whose districts resolve to one polygon — used by the district page. */
export function seatsForDistrict(
  provinceCode: ProvinceCode,
  codabName: string,
  codabNames: ReadonlySet<string>
): ProvincialSeat[] {
  return seatsInProvince(provinceCode).filter((seat) =>
    seat.districts.some((d) => {
      const group = cityGroup(d);
      if (group) return group.includes(codabName);
      return resolveDistrict(d, codabNames)?.codabName === codabName;
    })
  );
}

/** Districts named by the roster that are drawn inside a parent, for the caption. */
export function approximatedDistricts(
  provinceCode: ProvinceCode,
  codabNames: ReadonlySet<string>
): Array<{ name: string; parent: string; since?: number }> {
  const seen = new Map<string, { name: string; parent: string; since?: number }>();
  for (const seat of seatsInProvince(provinceCode)) {
    for (const d of seat.districts) {
      const r = resolveDistrict(d, codabNames);
      if (r?.isApproximate && !seen.has(normaliseDistrict(d))) {
        seen.set(normaliseDistrict(d), { name: d, parent: r.codabName, since: r.since });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
