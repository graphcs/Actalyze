/**
 * Provinces, their assemblies, and the one collision that will otherwise cost a demo.
 *
 * ── Read this before touching anything below ──────────────────────────────────────
 *
 * `PB` means two different things in this codebase, and both meanings are correct:
 *
 *   - **`PB` as a province code** is **Punjab**. That is ISO 3166-2:PK, which is what
 *     `PK_PROVINCES` in `parties.ts` uses and what `/pk/province/pb` already resolves
 *     to in production.
 *   - **`PB` as an assembly prefix** is the **Balochistan Assembly**. That is the
 *     Election Commission's constituency numbering — `PB-1` … `PB-51` are Balochistan
 *     seats — and it is what `PK_ASSEMBLIES` in `constituency-code.ts` uses.
 *
 * So `/pk/province/pb` is Punjab while `PB-12` is in Balochistan. Neither convention is
 * ours to change: one is an international standard already live in our URLs, the other
 * is printed on every ballot paper and question paper in the country. They simply have
 * to coexist.
 *
 * `KP` collides too — the KP Assembly prefix, the province code for Khyber Pakhtunkhwa,
 * and the `/pk` URL namespace are three different things that look alike.
 *
 * The defence is that the two namespaces are **structurally different types** and can
 * only be converted through the two functions at the bottom of this file. A raw string
 * cannot be passed where either is expected, so a mix-up is a compile error rather than
 * a map that silently colours the wrong province on stage. Parameters are named
 * `provinceCode` or `assemblyPrefix` everywhere, never just `code`.
 */

import { PK_PROVINCES, type PkProvinceCode } from './parties';
import { PK_ASSEMBLIES, type PkAssembly } from './constituency-code';

export type { PkProvinceCode, PkAssembly };

/**
 * Nominal typing. `ProvinceCode` and `AssemblyPrefix` are both strings at runtime, but
 * the phantom brand makes them mutually unassignable at compile time — which is the
 * entire point, because `'PB'` is a valid literal for both.
 */
declare const PROVINCE_BRAND: unique symbol;
declare const ASSEMBLY_BRAND: unique symbol;

export type ProvinceCode = PkProvinceCode & { readonly [PROVINCE_BRAND]: true };
export type AssemblyPrefix = PkAssembly & { readonly [ASSEMBLY_BRAND]: true };

/** Assert a string is a province code. Returns null rather than throwing, so a bad URL
 *  segment 404s instead of crashing the page. */
export function asProvinceCode(raw: string | null | undefined): ProvinceCode | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return upper in PK_PROVINCES ? (upper as ProvinceCode) : null;
}

export function asAssemblyPrefix(raw: string | null | undefined): AssemblyPrefix | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return upper in PK_ASSEMBLIES ? (upper as AssemblyPrefix) : null;
}

/**
 * The provincial assembly registry.
 *
 * `generalSeats` is the elected constituency count and matches the `max` in
 * `PK_ASSEMBLIES`. `totalSeats` includes the women-reserved and non-Muslim-reserved
 * seats, which are filled from party lists and have no constituency — the same
 * distinction the National Assembly page already draws, and for the same reason: a
 * parliamentary audience reads the total, while a map can only ever show the general
 * seats.
 *
 * Reserved-seat arithmetic per Article 106 of the Constitution.
 */
export interface ProvincialAssembly {
  /** ECP constituency prefix. NOT a province code — see the header. */
  prefix: AssemblyPrefix;
  /** ISO 3166-2:PK province this assembly legislates for. NOT the prefix. */
  province: ProvinceCode;
  nameEn: string;
  nameUr: string;
  generalSeats: number;
  womenSeats: number;
  minoritySeats: number;
  totalSeats: number;
  /** Where the roster came from, shown in the colophon. */
  rosterSource: string;
}

const ASSEMBLIES: Record<string, ProvincialAssembly> = {
  PP: {
    prefix: 'PP' as AssemblyPrefix,
    province: 'PB' as ProvinceCode, // Punjab. See the header if this looks wrong.
    nameEn: 'Provincial Assembly of the Punjab',
    nameUr: 'صوبائی اسمبلی پنجاب',
    generalSeats: 297,
    womenSeats: 66,
    minoritySeats: 8,
    totalSeats: 371,
    rosterSource: 'pap.gov.pk (unreachable) — Wikipedia, 18th Provincial Assembly',
  },
  PS: {
    prefix: 'PS' as AssemblyPrefix,
    province: 'SD' as ProvinceCode,
    nameEn: 'Provincial Assembly of Sindh',
    nameUr: 'صوبائی اسمبلی سندھ',
    generalSeats: 130,
    womenSeats: 29,
    minoritySeats: 9,
    totalSeats: 168,
    rosterSource: 'pas.gov.pk',
  },
  PK: {
    prefix: 'PK' as AssemblyPrefix,
    province: 'KP' as ProvinceCode,
    nameEn: 'Provincial Assembly of Khyber Pakhtunkhwa',
    nameUr: 'صوبائی اسمبلی خیبر پختونخوا',
    generalSeats: 115,
    womenSeats: 26,
    minoritySeats: 4,
    totalSeats: 145,
    rosterSource: 'pakp.gov.pk',
  },
  PB: {
    prefix: 'PB' as AssemblyPrefix,
    province: 'BA' as ProvinceCode, // Balochistan. See the header if this looks wrong.
    nameEn: 'Provincial Assembly of Balochistan',
    nameUr: 'صوبائی اسمبلی بلوچستان',
    generalSeats: 51,
    womenSeats: 11,
    minoritySeats: 3,
    totalSeats: 65,
    rosterSource: 'pabalochistan.gov.pk',
  },
};

/**
 * The only sanctioned way to go from a province to its assembly.
 *
 * Islamabad returns null and that is not an oversight: ICT has no provincial assembly.
 * It is federal territory legislated for by Parliament, so a CM board for Islamabad
 * would have no chief minister and no house. Callers must handle null.
 */
export function assemblyForProvince(provinceCode: ProvinceCode): ProvincialAssembly | null {
  for (const a of Object.values(ASSEMBLIES)) {
    if (a.province === provinceCode) return a;
  }
  return null;
}

/** The only sanctioned way to go from an assembly prefix back to its province. */
export function provinceForAssembly(assemblyPrefix: AssemblyPrefix): ProvinceCode | null {
  return ASSEMBLIES[assemblyPrefix]?.province ?? null;
}

export function assemblyByPrefix(assemblyPrefix: AssemblyPrefix): ProvincialAssembly | null {
  return ASSEMBLIES[assemblyPrefix] ?? null;
}

/** Every provincial assembly, in seat-count order — the order a Pakistani reader expects. */
export function allProvincialAssemblies(): ProvincialAssembly[] {
  return [ASSEMBLIES.PP, ASSEMBLIES.PS, ASSEMBLIES.PK, ASSEMBLIES.PB];
}

/**
 * Provinces that have a CM board, in the conventional order. Islamabad is deliberately
 * excluded — see `assemblyForProvince`.
 */
export function boardProvinces(): ProvinceCode[] {
  return ['PB', 'SD', 'KP', 'BA'] as ProvinceCode[];
}

export function provinceName(provinceCode: ProvinceCode, locale: 'en' | 'ur'): string {
  // The brand is a phantom property, so the intersection is not itself a valid index
  // type. Widening back to the plain union is safe precisely because the brand carries
  // no runtime value.
  const p = PK_PROVINCES[provinceCode as PkProvinceCode];
  return locale === 'ur' ? p.nameUr : p.nameEn;
}

/**
 * The COD-AB `adm1_name` for a province, which is how the geometry is keyed.
 *
 * Separate from `nameEn` on purpose: COD-AB writes "Khyber Pakhtunkhwa" and we happen
 * to as well, but the two are different namespaces and tying them together would break
 * silently the day either side renames.
 */
const CODAB_ADM1: Record<PkProvinceCode, string> = {
  PB: 'Punjab',
  SD: 'Sindh',
  KP: 'Khyber Pakhtunkhwa',
  BA: 'Balochistan',
  ICT: 'Islamabad',
};

export function codabProvinceName(provinceCode: ProvinceCode): string {
  return CODAB_ADM1[provinceCode as PkProvinceCode];
}

/** URL segment for a province: `PB` -> `pb`. */
export function toProvinceSegment(provinceCode: ProvinceCode): string {
  return provinceCode.toLowerCase();
}
