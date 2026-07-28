/**
 * National Assembly committees.
 *
 * Backed by `data/pk/committees.json`, produced by `scripts/pk/scrape-committees.mjs`
 * from na.gov.pk. Re-run that script before a demo: chairmanships fall vacant, members
 * are added, and the upcoming-meetings list is only useful while it is in the future.
 *
 * ── What is real here and what is not ─────────────────────────────────────────────
 *
 * Everything in this file is scraped or joined. Nothing is written from memory:
 *
 *  · Committee names, chairmen, members, parties and constituencies come from
 *    `cmen.php`, and every member with a `uid` is joined to `data/pk/members.json`
 *    so the constituency link resolves to a real seat page.
 *  · Reports and meetings come from `committee-reports.php` and `meetings.php`.
 *  · The REMIT is deliberately absent. na.gov.pk publishes no terms of reference for
 *    any committee, and a standing committee's functions are set by the Rules of
 *    Procedure rather than by the Secretariat's web page. The oversight pack therefore
 *    quotes the Rules from the document library at read time instead of asserting a
 *    remit here — see `ruleQuery()`.
 *
 * ── Urdu ──────────────────────────────────────────────────────────────────────────
 *
 * There are no Urdu committee names. `na.gov.pk/ur/` returns HTTP 404 for every path,
 * so the Secretariat publishes these names in English only. The UI renders the English
 * name inside a real Urdu descriptor rather than machine-translating it, because the
 * audience for this page sits on these committees and would recognise an invented
 * Urdu name immediately.
 */

import raw from '@/data/pk/committees.json';
import type { PkMember } from './constituencies';
import { party, type PkPartyId, type PkProvinceCode } from './parties';

export type PkCommitteeKind = 'standing' | 'special' | 'parliamentary' | 'other';

export interface PkCommitteeMember {
  /** na.gov.pk profile id. `null` for Senators, who have no NA profile. */
  uid: number | null;
  name: string;
  /** The party string exactly as the committee page writes it. */
  partyRaw: string | null;
  party: PkPartyId | null;
  partyCommon: string | null;
  /** `NA-221`, or null for a reserved seat or a Senator. */
  constituency: string | null;
  /** `RS (Women)`, `RS (Non-Muslim)`, `Senator` — set when there is no constituency. */
  seatLabel: string | null;
  phone: string | null;
  chairman: boolean;
  /** False where the member is not on the current roster; suppress the seat link. */
  rosterMatch?: boolean;
  province?: PkProvinceCode | null;
  seatType?: PkMember['seatType'] | null;
}

export interface PkCommitteeReport {
  /** ISO date, or null where the published date did not parse. */
  date: string | null;
  dateLabel: string;
  title: string;
  url: string | null;
}

export interface PkCommitteeMeeting {
  date: string | null;
  dateLabel: string;
  time: string | null;
  venue: string | null;
  title: string;
  noticeUrl: string | null;
  /** True where the sitting is of a sub-committee rather than the full committee. */
  subCommittee: boolean;
}

export interface PkCommittee {
  id: number;
  slug: string;
  /** Display name, with the redundant "Standing Committee on " prefix removed. */
  name: string;
  /** Exactly as na.gov.pk publishes it. */
  nameOfficial: string;
  kind: PkCommitteeKind;
  kindLabelEn: string;
  /** The class the Secretariat's own page heading gives: `Non-Ministerial Standing`. */
  compositionClass: string | null;
  compositionUnavailable?: boolean;
  chairName: string | null;
  chairVacant: boolean;
  chairPhone: string | null;
  chairUid: number | null;
  sourceUrl: string;
  members: PkCommitteeMember[];
  /** Senators seated on the committee. Not members of this House. */
  senators: PkCommitteeMember[];
  exOfficio: string[];
  secretary: {
    name: string;
    designation: string;
    phone: string | null;
    email: string | null;
  } | null;
  reports: PkCommitteeReport[];
  meetings: PkCommitteeMeeting[];
}

interface Seed {
  meta: {
    sources: Record<string, string>;
    scrapedAt: string;
    committeeCount: number;
    byKind: Record<string, number>;
    memberSeats: number;
    memberSeatsJoinedToRoster: number;
    memberSeatsUnjoined: number;
    senatorSeats: number;
    reportsAttached: number;
    meetingsAttached: number;
    urduNamesAvailable: boolean;
    urduNamesNote: string;
    warnings: string[];
  };
  committees: PkCommittee[];
}

const seed = raw as unknown as Seed;

export const PK_COMMITTEE_META = seed.meta;
export const PK_COMMITTEES: PkCommittee[] = seed.committees;

const bySlug = new Map(PK_COMMITTEES.map((c) => [c.slug, c]));

export function getCommittee(slug: string | null | undefined): PkCommittee | null {
  if (!slug) return null;
  return bySlug.get(slug.trim().toLowerCase()) ?? null;
}

/**
 * Ordering for the index: standing committees first because they are what the House
 * actually runs on, then the non-ministerial set that holds the PAC, then the rest.
 */
const KIND_ORDER: Record<PkCommitteeKind, number> = {
  standing: 0,
  other: 1,
  parliamentary: 2,
  special: 3,
};

export function listCommittees(kind?: PkCommitteeKind): PkCommittee[] {
  const all = kind ? PK_COMMITTEES.filter((c) => c.kind === kind) : PK_COMMITTEES;
  return [...all].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name)
  );
}

/**
 * Party strength on a committee.
 *
 * Senators are excluded: they sit on the PAC and on several joint committees but are
 * not members of this House, and folding them into a National Assembly party count
 * would inflate every total by up to five.
 */
export function partyBreakdown(c: PkCommittee): Array<{ party: PkPartyId; seats: number }> {
  const counts = new Map<PkPartyId, number>();
  for (const m of c.members) {
    const id = (m.party ?? 'UNKNOWN') as PkPartyId;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([p, seats]) => ({ party: p, seats }))
    .sort((a, b) => b.seats - a.seats || party(a.party).commonName.localeCompare(party(b.party).commonName));
}

/** Government / opposition / neutral split, by the bloc each party sits in. */
export function blocBreakdown(c: PkCommittee): {
  government: number;
  opposition: number;
  neutral: number;
} {
  const out = { government: 0, opposition: 0, neutral: 0 };
  for (const m of c.members) out[party(m.party).bloc] += 1;
  return out;
}

/**
 * Committees a given member sits on.
 *
 * The join runs the other way from everything else here, and it is what a constituency
 * page needs: a member's committee seats are the most concrete thing about what they
 * actually do in the House. Left here for whoever wires the constituency cross-link at
 * merge — this feature owns no other page.
 */
export function committeesForUid(uid: number): PkCommittee[] {
  return PK_COMMITTEES.filter((c) => c.members.some((m) => m.uid === uid));
}

/** Search the index by committee name, chairman or subject word. */
export function searchCommittees(query: string, limit = 10): PkCommittee[] {
  const q = query.trim().toLowerCase();
  if (!q) return listCommittees();
  const scored: Array<{ c: PkCommittee; score: number }> = [];
  for (const c of PK_COMMITTEES) {
    const name = c.name.toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if ((c.chairName ?? '').toLowerCase().includes(q)) score = 40;
    else if (c.members.some((m) => m.name.toLowerCase().includes(q))) score = 20;
    if (score) scored.push({ c, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((s) => s.c);
}

// ── Retrieval inputs ───────────────────────────────────────────────────────────────

/**
 * Words that carry no subject meaning in a committee name and would only dilute a
 * news query. "Division" and "Affairs" appear in a third of the names.
 */
const NOISE = new Set([
  'and',
  'of',
  'the',
  'on',
  'to',
  'division',
  'committee',
  'standing',
  'special',
  'parliamentary',
  'coordination',
  'affairs',
  'pac',
]);

/**
 * Subject vocabulary a Pakistani newsroom actually uses for a committee's portfolio.
 *
 * These are search terms, not claims: they widen recall for the committees whose
 * formal name is not what the press calls the subject — nobody writes "Energy (Power
 * Division)", they write NEPRA, tariff, load-shedding. Committees without an entry
 * fall back to the words in their own name, which is adequate for the plainly-named
 * ones ("Commerce", "Railways", "Water Resources").
 *
 * Nothing here is asserted to the reader or given to the model as fact.
 */
const SUBJECT_TERMS: Record<string, string> = {
  'finance-and-revenue': 'budget FBR taxation IMF revenue finance bill',
  'public-accounts-committee-pac': 'Auditor General audit paras public accounts recoveries',
  'energy-power-division': 'NEPRA electricity tariff load-shedding circular debt power sector',
  'energy-petroleum-division': 'OGRA petrol diesel gas price LNG petroleum levy',
  'planning-development-and-special-initiatives': 'PSDP development projects planning commission uplift',
  'national-health-services-regulations-and-coordination': 'DRAP health polio hospitals drug prices',
  'federal-education-and-professional-training': 'schools HEC curriculum out-of-school children education',
  'climate-change-and-environmental-coordination': 'smog climate floods environment emissions',
  'national-food-security-and-research': 'wheat support price fertiliser agriculture farmers crops',
  'water-resources': 'IRSA canals dams water share irrigation Indus',
  'information-technology-and-telecommunication': 'PTA internet broadband spectrum IT exports',
  'overseas-pakistanis-and-human-resource-development': 'remittances overseas Pakistanis labour emigration',
  'poverty-alleviation-and-social-safety-division': 'BISP Benazir Income Support cash transfer poverty',
  'privatization': 'privatisation PIA state-owned enterprises divestment',
  'railways': 'Pakistan Railways trains ML-1 freight',
  'interior-and-narcotics-control': 'NADRA FIA police narcotics passports interior ministry',
  'law-and-justice': 'judiciary courts legal reform law ministry',
  'commerce': 'exports imports trade tariff commerce ministry',
  'foreign-affairs': 'foreign office diplomacy Pakistan foreign policy',
  'human-rights': 'human rights commission enforced disappearances minorities',
  'rules-of-procedure-and-privileges': 'privilege motion rules of procedure National Assembly',
  'housing-and-works': 'public works housing Pak PWD federal lodges',
  'maritime-affairs': 'Karachi Port Qasim shipping ports maritime',
  'industries-and-production': 'industry manufacturing Utility Stores steel mills',
  'communications': 'National Highway Authority motorway roads NHA',
  'defence': 'defence ministry armed forces cantonment',
  'science-and-technology': 'science technology research PCSIR standards',
  'religious-affairs-and-inter-faith-harmony': 'Hajj Umrah pilgrims religious affairs',
  'kashmir-affairs-gilgit-baltistan-and-states-and': 'Kashmir Gilgit-Baltistan AJK',
  'parliamentary-committee-on-kashmir': 'Kashmir occupied Jammu Kashmir United Nations',
  'inter-provincial-coordination': 'Council of Common Interests NFC provinces sports board',
  'economic-affairs-division': 'foreign loans World Bank ADB economic affairs',
  'national-heritage-and-culture-division': 'heritage culture archaeology arts council',
  'cabinet-secretariat': 'cabinet division establishment federal government',
  'defence-production': 'defence production POF HIT ordnance',
  'information-and-broadcasting': 'PEMRA PTV press media broadcasting',
  'parliamentary-affairs': 'parliamentary affairs legislation government business',
  'government-assurances': 'assurances given on the floor implementation ministries',
  'business-advisory-committee': 'National Assembly session business agenda',
  'house-and-library': 'Parliament House library members facilities',
  'special-committee-on-gender-mainstreaming': 'women parliamentarians gender budgeting',
};

/**
 * Search queries for this committee's subject area, widest signal first.
 *
 * The caller runs these in order and stops as soon as it has enough, because every
 * one of them is a paid search.
 */
export function newsQueries(c: PkCommittee): string[] {
  const subject = SUBJECT_TERMS[c.slug];
  const bare = c.name
    .replace(/\(.*?\)/g, ' ')
    .split(/[^A-Za-z-]+/)
    .filter((w) => w.length > 2 && !NOISE.has(w.toLowerCase()))
    .join(' ');

  const queries = [
    `"National Assembly" "${c.name}" committee Pakistan`,
    subject
      ? `Pakistan ${subject}`
      : `Pakistan "${bare}" National Assembly standing committee`,
  ];
  if (c.chairName && !c.chairVacant) {
    queries.push(`"${c.chairName}" Pakistan National Assembly committee`);
  }
  return queries;
}

/**
 * Retrieval queries for the Rules of Procedure.
 *
 * The Rules of Procedure and Conduct of Business in the National Assembly, 2007 is in
 * the document library. Rules 198 onward govern committees; the Public Accounts
 * Committee has its own rules and so does the Committee on Rules of Procedure and
 * Privileges. Rather than asserting which rule says what, these queries pull the rule
 * text out of the library and the reader is shown the retrieved passage with the rule
 * number the document itself carries.
 *
 * The queries are written as passages rather than as questions, and several of them
 * quote the rule book's own phrasing. That is retrieval engineering, not an assertion:
 * `search_documents` is an approximate-nearest-neighbour search whose per-query recall
 * on this corpus is narrow — measured, one query returning a single chunk above
 * threshold and the next returning twenty — so a query has to land close to the target
 * passage in embedding space to reach it at all. Nothing here is shown to the reader
 * and nothing is passed to the model: only what comes back is.
 */
export function ruleQueries(c: PkCommittee): string[] {
  /**
   * Three queries that between them reach the whole committee chapter.
   *
   * Each was checked against the live index rather than guessed, and each is here
   * because it reaches a stretch of the chapter the others miss:
   *   · the first returns the reference-and-functions rules and the run from the PAC
   *     through Government Assurances;
   *   · the second is the only phrasing found that reaches rule 198 — the rule that
   *     says a committee deals with the subjects assigned to the Division or Ministry
   *     it is concerned with, which is what "remit" means here;
   *   · the third returns the conduct rules — membership, quorum, voting, in camera.
   *
   * Recall per query is narrow and moves under us: the embeddings sit in an IVFFlat
   * index over a corpus several agents are writing to, and a query that returned rule
   * 198 at 0.678 one hour returned nothing from the committee chapter the next. The
   * answer is breadth — run all of them, take the union, and let the page show what
   * actually came back.
   */
  const general = [
    'Functions.- The functions of a Standing Committee shall be to consider a Bill referred to it and to examine',
    'Functions of the Public Accounts Committee report of the Auditor-General appropriation accounts audit',
    'standing committee report bill referred quorum meetings chairman elected sittings in camera',
    'Whenever there is any change in the composition of Ministries or their nomenclature the Speaker shall in consultation with the Minister for Parliamentary Affairs',
  ];

  if (c.slug === 'public-accounts-committee-pac') {
    return [
      'Public Accounts Committee shall examine the accounts showing the appropriation of sums granted by the Assembly and the report of the Auditor-General',
      ...general,
    ];
  }
  if (c.slug === 'rules-of-procedure-and-privileges') {
    return [
      'The Committee shall consider matters of procedure and conduct of business in the Assembly and recommend amendments to these rules, and examine every question of privilege referred to it',
      ...general,
    ];
  }
  if (c.slug === 'business-advisory-committee') {
    return [
      'Business Advisory Committee allotment of time for Government business and private members business',
      ...general,
    ];
  }
  if (c.slug === 'house-and-library') {
    return [
      'admission cards for galleries, residential accommodation for members, supervision over facilities and amenities, Library of the Assembly',
      ...general,
    ];
  }
  if (c.slug === 'government-assurances') {
    return [
      'Committee on Government Assurances to scrutinise the assurances, promises and undertakings given by Ministers on the floor of the House',
      ...general,
    ];
  }
  if (c.kind === 'special' || c.kind === 'parliamentary') {
    return [
      'Special Committees.- The Assembly may by motion appoint a Special Committee which shall have such composition and functions as may be specified in the motion',
      ...general,
    ];
  }
  return general;
}

/**
 * Members of this committee whose seat page exists.
 *
 * Only members joined to the roster get a link. A member the Secretariat still lists
 * who is no longer on the roster would otherwise link to a seat now held by somebody
 * else — which is worse than no link at all, because it looks like it worked. This is
 * not hypothetical: uid 1866 sits on two committee pages as the member for NA-251, and
 * all-members.php now returns a different member for that seat.
 */
export function linkableMembers(c: PkCommittee): PkCommitteeMember[] {
  return c.members.filter((m) => m.rosterMatch !== false && m.constituency);
}
