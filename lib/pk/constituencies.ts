/**
 * Access to the National Assembly seed dataset.
 *
 * Backed by `data/pk/constituencies.json`, produced by
 * `scripts/pk/scrape-na-members.mjs` from na.gov.pk. Re-run that script the morning
 * of a demo — party totals move with by-elections and defections.
 *
 * Three seats (NA-1, NA-175, NA-256) are currently vacant and are present in the data
 * with `vacant: true`. Callers must render "vacant" rather than 404 or invent a
 * member; an audience of parliamentarians will know which seats are empty.
 */

import raw from '@/data/pk/constituencies.json';
import rawMembers from '@/data/pk/members.json';
import { normalizePkCode } from './constituency-code';
import { PK_PROVINCES, type PkPartyId, type PkProvinceCode } from './parties';

export interface PkConstituency {
  code: string;
  seatNumber: number;
  assembly: 'NA';
  /** null when the seat is vacant. */
  name: string | null;
  /** True where we corrected an upstream naming defect (NA-48 was labelled ICT-II). */
  nameOverridden?: boolean;
  province: PkProvinceCode | null;
  provinceNameEn?: string;
  /** Administrative districts the seat covers. More than one for `-cum-` seats. */
  districts: string[];
  memberUid: number | null;
  memberName: string | null;
  party: PkPartyId | null;
  partyCommon: string | null;
  vacant: boolean;
}

interface Seed {
  meta: {
    source: string;
    scrapedAt: string;
    seatsFilled: number;
    vacant: string[];
    partyTotals: Record<string, number>;
  };
  constituencies: PkConstituency[];
}

export type PkSeatType = 'general' | 'women_reserved' | 'minority_reserved';

export interface PkMember {
  uid: number;
  name: string;
  seatType: PkSeatType;
  party: PkPartyId;
  partyCommon: string;
  /** null for reserved seats, which are allocated from party lists and have no geography. */
  constituency: string | null;
  province: PkProvinceCode | null;
  phone: string | null;
  profileUrl: string;
}

const seed = raw as unknown as Seed;

export const PK_SEED_META = seed.meta;
export const PK_CONSTITUENCIES: PkConstituency[] = seed.constituencies;
export const PK_MEMBERS: PkMember[] = (rawMembers as unknown as { members: PkMember[] }).members;

const byCode = new Map(PK_CONSTITUENCIES.map((c) => [c.code, c]));

export function getConstituency(code: string | null | undefined): PkConstituency | null {
  const normalized = normalizePkCode(code);
  return normalized ? byCode.get(normalized) ?? null : null;
}

export function constituenciesInProvince(province: PkProvinceCode): PkConstituency[] {
  return PK_CONSTITUENCIES.filter((c) => c.province === province);
}

/**
 * Party strength in the House.
 *
 * This counts ALL seats — general plus the 60 women-reserved and 10 minority-reserved
 * — because that is what "seats by party" means to anyone who follows the National
 * Assembly. Counting only the general seats would show PML-N at 93 rather than 132,
 * and an audience of parliamentarians would query it immediately.
 *
 * Pass `generalOnly` where the count must line up with constituencies on a map.
 */
export function seatCountsByParty(
  opts: { generalOnly?: boolean } = {}
): Array<{ party: PkPartyId; seats: number }> {
  const counts = new Map<PkPartyId, number>();

  if (opts.generalOnly) {
    for (const c of PK_CONSTITUENCIES) {
      if (c.vacant || !c.party) continue;
      counts.set(c.party, (counts.get(c.party) ?? 0) + 1);
    }
  } else {
    for (const m of PK_MEMBERS) {
      counts.set(m.party, (counts.get(m.party) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([party, seats]) => ({ party, seats }))
    .sort((a, b) => b.seats - a.seats);
}

/** Total seats currently filled, across all seat types. */
export function totalSeatsFilled(): number {
  return PK_MEMBERS.length;
}

/**
 * Search by code, seat name, member name or district — powers the landing-page
 * picker. Matches are ranked so an exact code wins.
 */
export function searchConstituencies(query: string, limit = 8): PkConstituency[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact = normalizePkCode(q);
  const results: Array<{ c: PkConstituency; score: number }> = [];

  for (const c of PK_CONSTITUENCIES) {
    if (exact && c.code === exact) { results.push({ c, score: 100 }); continue; }

    const code = c.code.toLowerCase();
    const name = (c.name ?? '').toLowerCase();
    const member = (c.memberName ?? '').toLowerCase();

    let score = 0;
    if (code.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (member.includes(q)) score = 40;
    else if (name.includes(q)) score = 30;
    else if (c.districts.some((d) => d.toLowerCase().includes(q))) score = 20;

    if (score) results.push({ c, score });
  }

  return results
    .sort((a, b) => b.score - a.score || a.c.seatNumber - b.c.seatNumber)
    .slice(0, limit)
    .map((r) => r.c);
}

export function provinceOf(code: string): (typeof PK_PROVINCES)[PkProvinceCode] | null {
  const c = getConstituency(code);
  return c?.province ? PK_PROVINCES[c.province] : null;
}
