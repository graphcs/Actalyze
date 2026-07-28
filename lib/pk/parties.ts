/**
 * Pakistan's party model.
 *
 * The US code encodes a two-party contest in its type system — `'D'|'R'|'I'`, a
 * signed scalar margin, and a `'Safe D'…'Safe R'` ladder. None of that survives
 * contact with a 336-seat house holding fourteen parties, so this file replaces the
 * binary rather than trying to parameterise it.
 *
 * Two naming traps, both of which a Pakistani audience would catch immediately:
 *
 *  - na.gov.pk writes **`PML`** for what everyone calls **PML-Q**. Rendering the raw
 *    abbreviation invites confusion with PML-N, the largest party in the house.
 *  - na.gov.pk writes **`JUI (P)`** (Jamiat Ulama-e-Islam Pakistan) for the party the
 *    public, press and Wikipedia all call **JUI-F**.
 *
 * Colours are Wikipedia's `Module:Political party` values — the hexes Pakistani
 * readers have seen on election tables for years — with three overrides where the
 * canonical colour is unusable in a UI. Those are marked below.
 */

export type PkPartyId =
  | 'PMLN' | 'PPP' | 'PTI' | 'IND_PTI' | 'IND'
  | 'MQMP' | 'JUIF' | 'PMLQ' | 'IPP' | 'SIC'
  | 'MWM' | 'PMLZ' | 'BAP' | 'NP' | 'PKMAP' | 'PKNAP' | 'BNPM'
  | 'ANP' | 'JI' | 'OTHER' | 'UNKNOWN';

export interface PkParty {
  id: PkPartyId;
  /** What the NA Secretariat calls it. */
  officialName: string;
  /** What everyone else calls it — use this in the UI. */
  commonName: string;
  nameUr: string;
  color: string;
  /** Set where `color` deviates from Wikipedia, with the reason. */
  colorNote?: string;
  bloc: 'government' | 'opposition' | 'neutral';
}

export const PK_PARTIES: Record<PkPartyId, PkParty> = {
  PMLN: {
    id: 'PMLN', officialName: 'Pakistan Muslim League (N)', commonName: 'PML-N',
    nameUr: 'پاکستان مسلم لیگ (ن)', color: '#228B22', bloc: 'government',
  },
  PPP: {
    id: 'PPP', officialName: 'Pakistan Peoples Party Parliamentarians', commonName: 'PPP',
    nameUr: 'پاکستان پیپلز پارٹی', color: '#1A1A1A', bloc: 'government',
    colorNote: 'Wikipedia uses pure black (#000); lightened so it works as a map and chart fill.',
  },
  PTI: {
    id: 'PTI', officialName: 'Pakistan Tehreek-e-Insaf', commonName: 'PTI',
    nameUr: 'پاکستان تحریک انصاف', color: '#E70A0A', bloc: 'opposition',
  },
  IND_PTI: {
    id: 'IND_PTI', officialName: 'Independent (PTI-backed)', commonName: 'Independent (PTI-backed)',
    nameUr: 'آزاد (پی ٹی آئی سے وابستہ)', color: '#E70A0A', bloc: 'opposition',
    colorNote: 'PTI red, rendered at reduced opacity with a hatch so it reads as distinct from PTI proper.',
  },
  IND: {
    id: 'IND', officialName: 'Independent', commonName: 'Independent',
    nameUr: 'آزاد', color: '#7A7A7A', bloc: 'neutral',
  },
  MQMP: {
    id: 'MQMP', officialName: 'Muttahida Qaumi Movement Pakistan', commonName: 'MQM-P',
    nameUr: 'متحدہ قومی موومنٹ پاکستان', color: '#BE1212', bloc: 'government',
  },
  JUIF: {
    id: 'JUIF', officialName: 'Jamiat Ulama-e-Islam Pakistan', commonName: 'JUI-F',
    nameUr: 'جمعیت علمائے اسلام (ف)', color: '#003800', bloc: 'opposition',
  },
  PMLQ: {
    id: 'PMLQ', officialName: 'Pakistan Muslim League', commonName: 'PML-Q',
    nameUr: 'پاکستان مسلم لیگ (ق)', color: '#5CB85C', bloc: 'government',
    colorNote: 'Wikipedia uses pure lime (#00FF00), which fails contrast on white.',
  },
  IPP: {
    id: 'IPP', officialName: 'Istehkam-e-Pakistan Party', commonName: 'IPP',
    nameUr: 'استحکام پاکستان پارٹی', color: '#67BA27', bloc: 'government',
  },
  SIC: {
    id: 'SIC', officialName: 'Sunni Ittehad Council', commonName: 'SIC',
    nameUr: 'سنی اتحاد کونسل', color: '#2F4F4F', bloc: 'opposition',
  },
  MWM: {
    id: 'MWM', officialName: 'Majlis Wahdat-e-Muslimeen Pakistan', commonName: 'MWM',
    nameUr: 'مجلس وحدت مسلمین', color: '#0B9A51', bloc: 'opposition',
  },
  PMLZ: {
    id: 'PMLZ', officialName: 'Pakistan Muslim League (Zia-ul-Haq Shaheed)', commonName: 'PML-Z',
    nameUr: 'پاکستان مسلم لیگ (ض)', color: '#00A877', bloc: 'government',
  },
  BAP: {
    id: 'BAP', officialName: 'Balochistan Awami Party', commonName: 'BAP',
    nameUr: 'بلوچستان عوامی پارٹی', color: '#6B8E23', bloc: 'government',
  },
  NP: {
    id: 'NP', officialName: 'National Party', commonName: 'NP',
    nameUr: 'نیشنل پارٹی', color: '#CD5C5C', bloc: 'opposition',
  },
  PKMAP: {
    id: 'PKMAP', officialName: 'Pashtoonkhwa Milli Awami Party', commonName: 'PkMAP',
    nameUr: 'پشتونخوا ملی عوامی پارٹی', color: '#FF4500', bloc: 'opposition',
  },
  PKNAP: {
    id: 'PKNAP', officialName: 'Pashtoonkhwa National Awami Party', commonName: 'PKNAP',
    nameUr: 'پشتونخوا نیشنل عوامی پارٹی', color: '#DC143C', bloc: 'opposition',
  },
  BNPM: {
    id: 'BNPM', officialName: 'Balochistan National Party (Mengal)', commonName: 'BNP-M',
    nameUr: 'بلوچستان نیشنل پارٹی', color: '#D6C200', bloc: 'opposition',
    colorNote: 'Wikipedia uses #FFEF00, unreadable on white.',
  },
  ANP: {
    id: 'ANP', officialName: 'Awami National Party', commonName: 'ANP',
    nameUr: 'عوامی نیشنل پارٹی', color: '#C83737', bloc: 'opposition',
  },
  JI: {
    id: 'JI', officialName: 'Jamaat-e-Islami', commonName: 'JI',
    nameUr: 'جماعت اسلامی', color: '#078EDF', bloc: 'opposition',
  },
  OTHER: {
    id: 'OTHER', officialName: 'Other', commonName: 'Other',
    nameUr: 'دیگر', color: '#9CA3AF', bloc: 'neutral',
  },
  UNKNOWN: {
    id: 'UNKNOWN', officialName: 'Unknown', commonName: 'Unknown',
    nameUr: 'نامعلوم', color: '#D1D5DB', bloc: 'neutral',
  },
};

export function party(id: string | null | undefined): PkParty {
  if (!id) return PK_PARTIES.UNKNOWN;
  return PK_PARTIES[id as PkPartyId] ?? PK_PARTIES.OTHER;
}

/**
 * Six of the parties in this house are some shade of green (PML-N, PML-Q, JUI-F,
 * IPP, PML-Z, MWM), which is unreadable when they sit adjacent on a map or a stacked
 * bar. Callers should hatch the ones flagged here rather than relying on hue alone.
 */
export const GREEN_FAMILY: ReadonlySet<PkPartyId> = new Set([
  'PMLN', 'PMLQ', 'JUIF', 'IPP', 'PMLZ', 'MWM', 'BAP',
]);

export function needsPatternFill(id: PkPartyId): boolean {
  return GREEN_FAMILY.has(id);
}

export const PK_PROVINCES = {
  PB: { code: 'PB', nameEn: 'Punjab', nameUr: 'پنجاب', naSeats: 141 },
  SD: { code: 'SD', nameEn: 'Sindh', nameUr: 'سندھ', naSeats: 61 },
  KP: { code: 'KP', nameEn: 'Khyber Pakhtunkhwa', nameUr: 'خیبر پختونخوا', naSeats: 45 },
  BA: { code: 'BA', nameEn: 'Balochistan', nameUr: 'بلوچستان', naSeats: 16 },
  ICT: { code: 'ICT', nameEn: 'Islamabad Capital Territory', nameUr: 'اسلام آباد', naSeats: 3 },
} as const;

export type PkProvinceCode = keyof typeof PK_PROVINCES;
