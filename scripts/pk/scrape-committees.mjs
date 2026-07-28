#!/usr/bin/env node
/**
 * Scrape National Assembly committee composition and business into a seed dataset.
 *
 * Run this once and commit the output. Do NOT call it at request time — but DO
 * re-run it before a demo: chairmanships fall vacant, members are added, and the
 * upcoming-meetings list is only useful while it is in the future.
 *
 *   node scripts/pk/scrape-committees.mjs [--out data/pk]
 *
 * ── Where each field comes from ───────────────────────────────────────────────────
 *
 *  · `cmen.php?type=N`      — the four committee INDEX pages. `type` is the class of
 *                             committee: 1 standing, 2 special, 5 parliamentary,
 *                             6 the "other" set that holds PAC, Business Advisory,
 *                             House and Library, Government Assurances and Rules of
 *                             Procedure and Privileges. Each row carries the
 *                             chairperson and a link to the composition page.
 *  · `cmen.php?comm=<b64>`  — one committee's COMPOSITION. `comm` is the committee's
 *                             numeric id base64-encoded (id 14 -> "MTQ="). Rows carry
 *                             the member's profile uid, party as the NA Secretariat
 *                             writes it, and the constituency code — which is what
 *                             lets every member join to `data/pk/members.json` and
 *                             resolve to a constituency page.
 *  · `committee-reports.php`— every report a committee has presented to the House.
 *  · `meetings.php`         — upcoming meetings with date, time, venue and the notice
 *                             PDF. This is the single most perishable field here.
 *
 * ── Two things this script deliberately does NOT do ───────────────────────────────
 *
 *  1. **No Urdu committee names.** `na.gov.pk/ur/` returns 404 for every path tried
 *     (`/ur/`, `/ur/index.php`, `/ur/cmen.php?type=1`): the Secretariat publishes
 *     committee names in English only. Machine-translating a committee's name and
 *     presenting it as its name would be a fabrication in front of the people who
 *     sit on it, so the English name travels through to the UI unchanged and the
 *     Urdu interface wraps it in a real Urdu descriptor ("قائمہ کمیٹی برائے …").
 *
 *  2. **No invented remit.** The composition page carries no terms of reference. A
 *     standing committee's remit is set by the Rules of Procedure by reference to the
 *     ministry or division it shadows, so the remit is derived at read time from the
 *     retrieved rule text, not written here.
 *
 * Report titles on na.gov.pk are free text typed by hand and contain real
 * misspellings — "Interior and Narcotics Conntrol", "Inerior", "Naional Heritage" —
 * so reports are matched to committees by an explicit alias list rather than by
 * parsing the title. Anything that matches nothing is counted in `meta.warnings`
 * rather than being force-fitted to the nearest committee.
 */

import fs from 'fs';
import path from 'path';

const BASE = 'https://na.gov.pk/en';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const outDir = (() => {
  const i = process.argv.indexOf('--out');
  return path.resolve(i > -1 ? process.argv[i + 1] : 'data/pk');
})();

/** The four committee index pages, with the class each one lists. */
const INDEX_PAGES = [
  { type: 1, kind: 'standing', labelEn: 'Standing Committee' },
  { type: 2, kind: 'special', labelEn: 'Special Committee' },
  { type: 5, kind: 'parliamentary', labelEn: 'Parliamentary Committee' },
  { type: 6, kind: 'other', labelEn: 'Committee' },
];

/**
 * Party abbreviations as the NA Secretariat writes them.
 *
 * Same table as `scrape-na-members.mjs`, and the same two traps: "PML" here means
 * PML-Q, not PML-N; "JUI (P)" is the party everyone calls JUI-F.
 *
 * The committee pages are hand-edited per committee, so the same party appears under
 * four or five spellings across them — "PML (N)", "PML(N)", "PMLN", "Pakistan Muslim
 * League Nawaz (PMLN)". The Senators seated on the PAC and the parliamentary
 * committees come from a different list again. All spellings observed on the live
 * pages are mapped; anything unmapped is recorded in `meta.warnings` and rendered as
 * unknown rather than guessed.
 */
const PARTY = {
  'PML (N)': { code: 'PMLN', common: 'PML-N' },
  'PML(N)': { code: 'PMLN', common: 'PML-N' },
  PMLN: { code: 'PMLN', common: 'PML-N' },
  'PML-N': { code: 'PMLN', common: 'PML-N' },
  'Pakistan Muslim League Nawaz (PMLN)': { code: 'PMLN', common: 'PML-N' },
  'Pakistan Muslim League Nawaz (PML-N)': { code: 'PMLN', common: 'PML-N' },
  MQMP: { code: 'MQMP', common: 'MQM-P' },
  'MQM-P': { code: 'MQMP', common: 'MQM-P' },
  JUI: { code: 'JUIF', common: 'JUI-F' },
  'JUI-F': { code: 'JUIF', common: 'JUI-F' },
  'Jamiat Ulema-e-Islam Pakistan (JUIP)': { code: 'JUIF', common: 'JUI-F' },
  'Pakistan Tehreek-e-Insaf': { code: 'PTI', common: 'PTI' },
  'Pakistan Tehreek-e-Insaf (PTI)': { code: 'PTI', common: 'PTI' },
  'Pakistan Peoples Party Parliamentarians (PPPP)': { code: 'PPP', common: 'PPP' },
  'Balochistan Awami Party (BAP)': { code: 'BAP', common: 'BAP' },
  PPPP: { code: 'PPP', common: 'PPP' },
  PPP: { code: 'PPP', common: 'PPP' },
  IND: { code: 'IND', common: 'Independent' },
  PTI: { code: 'PTI', common: 'PTI' },
  MQM: { code: 'MQMP', common: 'MQM-P' },
  'JUI (P)': { code: 'JUIF', common: 'JUI-F' },
  PML: { code: 'PMLQ', common: 'PML-Q' },
  IPP: { code: 'IPP', common: 'IPP' },
  SIC: { code: 'SIC', common: 'SIC' },
  MWMP: { code: 'MWM', common: 'MWM' },
  MWM: { code: 'MWM', common: 'MWM' },
  'PML (Z)': { code: 'PMLZ', common: 'PML-Z' },
  BAP: { code: 'BAP', common: 'BAP' },
  NP: { code: 'NP', common: 'NP' },
  PKMAP: { code: 'PKMAP', common: 'PkMAP' },
  PKNAP: { code: 'PKNAP', common: 'PKNAP' },
  BNP: { code: 'BNPM', common: 'BNP-M' },
  ANP: { code: 'ANP', common: 'ANP' },
  JI: { code: 'JI', common: 'JI' },
};

/**
 * Extra strings that identify a committee in a hand-typed report or meeting title.
 *
 * Keyed by committee id. Only aliases that cannot collide with another committee are
 * listed: "Interior" is safe because no other committee's name contains it, while a
 * bare "Education" is not listed because several report titles run education together
 * with heritage and culture, which are separate committees in this Assembly.
 */
const ALIASES = {
  1: ['Cabinet Secretariat'],
  2: ['Commerce'],
  3: ['Communications'],
  4: ['Information Technology and Telecommunication', 'Information Technology and Telecommunicaion',
      'Information Technology and Telecomunication', 'Information and Telecommunication', 'IT and Telecom'],
  6: ['Defence'],
  7: ['Defence Production'],
  8: ['Inter-Provincial Coordination', 'Inter Provincial Coordination', 'IPC'],
  10: ['Interior and Narcotics Control', 'Interior and Narcotics control', 'Interior and Narcotics Conntrol',
       'Interior and Narcotic Control', 'Interior', 'Inerior', 'Narcotics Control'],
  11: ['Overseas Pakistanis and Human Resource Development', 'Overseas Pakistanis'],
  13: ['Kashmir Affairs, Gilgit-Baltistan and States and Frontier Regions', 'Kashmir Affairs and Gilgit-Baltistan'],
  14: ['Finance and Revenue', 'Finance And Revenue', 'Finance & Revenue'],
  16: ['Law and Justice', 'Law and justice', 'LAW AND JUSTICE'],
  20: ['Foreign Affairs'],
  23: ['National Health Services, Regulations and Coordination', 'National Health Services'],
  24: ['House and Library'],
  25: ['Housing and Works', 'Housing and works'],
  28: ['Industries and Production', 'Industries and'],
  29: ['Information and Broadcasting'],
  30: ['Energy (Petroleum Division)', 'Petroleum Division', 'Petroleum'],
  31: ['Maritime Affairs'],
  35: ['Railways'],
  36: ['Religious Affairs and Inter-faith Harmony', 'Religious Affairs and Inter-Faith Harmony', 'Religious Affairs'],
  37: ['Rules of Procedure and Privileges'],
  38: ['Science and Technology', 'Science And Technology'],
  44: ['Water Resources'],
  58: ['Federal Education and Professional Training', 'Federal Education, Professional Training',
       'FEDERAL EDUCATION, PROFESSIONAL TRAINING', 'Federal Education'],
  62: ['National Food Security and Research', 'National Food Security And Research', 'National Food Security'],
  72: ['Parliamentary Affairs'],
  80: ['Planning, Development and Special Initiatives', 'Planning, Development'],
  82: ['Government Assurances'],
  86: ['Climate Change and Environmental Coordination', 'Climate Change and Envirnmental Coordination',
       'Climate Change'],
  91: ['Human Rights'],
  110: ['Privatization'],
  123: ['Business Advisory Committee'],
  127: ['Public Accounts Committee', 'PAC', 'Public Account Committee'],
  143: ['Energy (Power Division)', 'Power Division'],
  164: ['Economic Affairs Division', 'Economic Affairs'],
  167: ['Poverty Alleviation and Social Safety', 'Poverty Alleviation and Society Safety', 'Poverty Alleviation'],
  174: ['National Heritage & Culture Division', 'National Heritage and Culture'],
  182: ['Parliamentary Committee on Kashmir'],
  183: ['Special Committee to Discuss, Analyze and Firm up'],
  185: ['Special Parliamentary Committee'],
  192: ['Special Committee on Gender Mainstreaming', 'Gender Mainstreaming'],
};

// ── HTML helpers ───────────────────────────────────────────────────────────────────

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const rowsOf = (html) => [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
const cellsOf = (row) =>
  [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => strip(m[1]));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * na.gov.pk returns a sporadic HTTP 500 under a fast sequential crawl — the same URL
 * succeeds on retry a second later. Aborting the whole scrape on one of those would
 * leave a partial dataset, so retry, and let the caller decide whether a persistent
 * failure is fatal.
 */
async function get(url, { attempts = 4, ...init } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      process.stderr.write(`  fetch ${url}${i > 1 ? ` (attempt ${i})` : ''}\n`);
      const res = await fetch(url, {
        headers: { 'user-agent': UA },
        signal: AbortSignal.timeout(90_000),
        ...init,
      });
      if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      if (i < attempts) await sleep(1500 * i);
    }
  }
  throw lastError;
}

const b64 = (n) => Buffer.from(String(n), 'utf8').toString('base64');

/**
 * Parentheses are load-bearing in committee names and must survive into the slug:
 * "Energy (Petroleum Division)" and "Energy (Power Division)" are two committees
 * with two chairmen, and dropping the bracket collapses both to `energy`.
 */
function slugify(name) {
  const full = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (full.length <= 56) return full;
  // Cut on a word boundary. A hard slice lands mid-word — "…-frontier-reg" — which
  // reads as a bug in the address bar of a page a committee secretary will print.
  const cut = full.slice(0, 56);
  return cut.slice(0, cut.lastIndexOf('-')).replace(/-+$/, '');
}

/**
 * The Secretariat writes one of the 34 standing committees as "Standing Committee on
 * Interior and Narcotics Control" and the other 33 as bare subject names. Stripping
 * the prefix makes the list read consistently; `nameOfficial` keeps what the site
 * actually publishes so the difference is auditable.
 */
function displayName(name) {
  return name.replace(/^Standing\s+Committee\s+on\s+/i, '').trim();
}

/** `Monday, June 22, 2026` -> `2026-06-22`. Returns null rather than guessing. */
function isoFromLongDate(s) {
  const ms = Date.parse(s.replace(/^[A-Za-z]+,\s*/, ''));
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** `28-07-2026` -> `2026-07-28`. dd-mm-yyyy: na.gov.pk uses British order throughout. */
function isoFromDmy(s) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function absolute(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href.replace(/^\.\.\//, ''), 'https://na.gov.pk/').toString();
}

const warnings = [];

// ── 1. the four index pages: committee list + chairperson ──────────────────────────

process.stderr.write('committee index pages …\n');

const catalogue = new Map(); // id -> committee

for (const page of INDEX_PAGES) {
  const html = await get(`${BASE}/cmen.php?type=${page.type}`);
  for (const row of rowsOf(html)) {
    const link = /cmen\.php\?comm=([A-Za-z0-9+/=]+)/.exec(row);
    if (!link) continue;
    const id = Number(Buffer.from(link[1], 'base64').toString('utf8'));
    if (!Number.isFinite(id)) continue;

    const cells = cellsOf(row);
    // S.No. | Chairperson | Committee (+ "Members' List") | Phone | Picture
    const chairRaw = cells[1] ?? '';
    const name = (cells[2] ?? '').replace(/Members'?\s*List\s*$/i, '').trim();
    if (!name) continue;

    const chairVacant = /^vacant$/i.test(chairRaw);
    catalogue.set(id, {
      id,
      slug: slugify(displayName(name)),
      name: displayName(name),
      nameOfficial: name,
      kind: page.kind,
      kindLabelEn: page.labelEn,
      indexType: page.type,
      chairName: chairVacant ? null : chairRaw || null,
      chairVacant,
      chairPhone: cells[3] && /\d/.test(cells[3]) ? cells[3] : null,
      sourceUrl: `${BASE}/cmen.php?comm=${b64(id)}`,
      members: [],
      exOfficio: [],
      senators: [],
      secretary: null,
      reports: [],
      meetings: [],
    });
  }
}

process.stderr.write(`  ${catalogue.size} committees\n`);
if (catalogue.size === 0) throw new Error('no committees found — page structure changed');

// ── 2. composition, one page per committee ─────────────────────────────────────────

process.stderr.write('committee composition …\n');

/**
 * The class the Secretariat itself gives the committee, from the page's own <h1>:
 * `MEMBERS OF Standing COMMITTEE`, `MEMBERS OF Non-Ministerial Standing COMMITTEE`.
 *
 * Read from the <h1> rather than from the whole document: the site nav contains other
 * "…COMMITTEE" strings, and matching the first one anywhere on the page picks up a
 * menu entry instead of the heading.
 */
function headingClass(html) {
  // Scan every <h1>: the site chrome opens with its own branding <h1>, so taking the
  // first one returns the masthead rather than the page heading.
  for (const h1 of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const m = /MEMBERS\s+OF\s+(.*?)\s*COMMITTEE\s*$/i.exec(strip(h1[1]));
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

for (const c of catalogue.values()) {
  let html;
  try {
    html = await get(c.sourceUrl);
  } catch (error) {
    // A committee whose composition page will not load keeps its index-page row
    // (name and chairperson) and gets an empty roster. The UI must then say the
    // composition is unavailable rather than render an empty list as "no members".
    warnings.push(`composition page failed for "${c.name}" (id ${c.id}): ${error.message}`);
    c.compositionUnavailable = true;
    continue;
  }
  c.compositionClass = headingClass(html);

  let inSecretariat = false;
  for (const row of rowsOf(html)) {
    const cells = cellsOf(row);
    if (!cells.length) continue;

    // The staff table follows the member table and has its own header row.
    if (cells.some((v) => /^Designation$/i.test(v))) {
      inSecretariat = true;
      continue;
    }

    if (inSecretariat) {
      // Name | Designation | Contact No | Email
      if (cells.length >= 3 && cells[0] && /secretary|officer/i.test(cells[1] ?? '')) {
        c.secretary = {
          name: cells[0],
          designation: cells[1],
          phone: cells[2] || null,
          email: cells[3] || null,
        };
      }
      continue;
    }

    if (!/^\d+\.$/.test(cells[0] ?? '')) continue;

    const uidMatch = /profile\.php\?uid=(\d+)/.exec(row);
    const rawName = (cells[1] ?? '').trim();
    if (!rawName) continue;

    const seatCell = (cells[4] ?? '').trim();

    // "(Minister In-charge)" occupies a numbered row with no name and no uid.
    if (/^\(?Minister\s+In-?charge\)?$/i.test(rawName) || /Ex-officio/i.test(seatCell)) {
      c.exOfficio.push(rawName || 'Minister In-charge');
      continue;
    }

    const isChair = /\(\s*chair(man|person)\s*\)/i.test(rawName);
    const name = rawName.replace(/\(\s*chair(man|person)\s*\)/i, '').trim();

    // Where the chairmanship is unfilled the Secretariat still emits a numbered row
    // reading "Vacant (Chairman)". That is a vacancy, not a member — leaving it in
    // the roster would put a person called "Vacant" on the printed member list.
    if (/^vacant$/i.test(name)) {
      c.chairVacant = true;
      continue;
    }

    // "---" is how the Secretariat writes "no party recorded on this page"; it is a
    // blank, not an unrecognised party, and the roster join usually fills it in.
    const partyCell = (cells[2] ?? '').trim();
    const partyRaw = /^-+$/.test(partyCell) ? '' : partyCell;
    const mapped = PARTY[partyRaw] ?? null;
    if (partyRaw && !mapped) warnings.push(`unmapped party "${partyRaw}" (${c.name})`);

    const contact = (cells[3] ?? '').trim();
    const constituency = /^NA-\d+$/i.test(seatCell) ? seatCell.toUpperCase() : null;

    const entry = {
      uid: uidMatch ? Number(uidMatch[1]) : null,
      name,
      partyRaw: partyRaw || null,
      party: mapped?.code ?? null,
      partyCommon: mapped?.common ?? null,
      constituency,
      // "RS (Women)", "RS (Non-Muslim)" — reserved seats have no geography.
      seatLabel: constituency ? null : seatCell || null,
      phone: contact && contact !== 'N/A' && /\d/.test(contact) ? contact : null,
      chairman: isChair,
    };

    // The PAC and several special committees seat Senators, who are not members of
    // this House and are absent from data/pk/members.json by design.
    if (/^senator$/i.test(seatCell)) c.senators.push(entry);
    else c.members.push(entry);
  }

  if (c.members.length === 0) warnings.push(`no members parsed for "${c.name}" (id ${c.id})`);
}

// ── 3. reports presented to the House ──────────────────────────────────────────────

process.stderr.write('committee reports …\n');

const aliasIndex = Object.entries(ALIASES).flatMap(([id, names]) =>
  names.map((n) => ({ id: Number(id), needle: n.toLowerCase() }))
);
// Longest alias first, so "Interior and Narcotics Control" wins over "Interior".
aliasIndex.sort((a, b) => b.needle.length - a.needle.length);

function matchCommittee(title) {
  const t = title.toLowerCase();
  for (const { id, needle } of aliasIndex) if (t.includes(needle)) return id;
  return null;
}

{
  const html = await get(`${BASE}/committee-reports.php`);
  let unmatched = 0;
  let total = 0;
  for (const row of rowsOf(html)) {
    const cells = cellsOf(row);
    if (cells.length < 3 || !/^\d+$/.test(cells[0] ?? '')) continue;
    const [, dateRaw, title] = cells;
    if (!title) continue;
    total += 1;

    const id = matchCommittee(title);
    if (id === null || !catalogue.has(id)) {
      unmatched += 1;
      continue;
    }
    const href = /href="([^"]+\.pdf)"/i.exec(row);
    catalogue.get(id).reports.push({
      date: isoFromLongDate(dateRaw),
      dateLabel: dateRaw,
      title,
      url: absolute(href?.[1]),
    });
  }
  process.stderr.write(`  ${total} reports, ${unmatched} unattributable\n`);
  if (unmatched) {
    warnings.push(
      `${unmatched} of ${total} committee reports could not be attributed to a committee from their title and are omitted rather than guessed`
    );
  }
}

// ── 4. upcoming meetings ───────────────────────────────────────────────────────────

process.stderr.write('upcoming meetings …\n');

{
  const html = await get(`${BASE}/meetings.php`);
  // Each meeting is a facebox panel of label/value rows: Committee Name, Meeting
  // Schedule, Time, Venue, Download. Walk rows and accumulate into a record.
  let current = null;
  let unmatched = 0;
  let total = 0;
  const flush = () => {
    if (!current || !current.title) return;
    total += 1;
    const id = matchCommittee(current.title);
    if (id === null || !catalogue.has(id)) {
      unmatched += 1;
    } else {
      catalogue.get(id).meetings.push({
        date: current.date,
        dateLabel: current.dateLabel,
        time: current.time ?? null,
        venue: current.venue ?? null,
        title: current.title,
        noticeUrl: current.noticeUrl ?? null,
        // "Sub-Committee-V of the PAC …" is business of a sub-committee, and a
        // committee secretary needs to see that it is not the full committee.
        subCommittee: /sub-?committee/i.test(current.title),
      });
    }
    current = null;
  };

  for (const row of rowsOf(html)) {
    const cells = cellsOf(row);
    if (cells.length < 2) continue;
    const [label, value] = cells;

    if (/^Committee\s*Name$/i.test(label)) {
      flush();
      current = { title: value };
    } else if (current && /^Meeting\s*Schedule$/i.test(label)) {
      current.date = isoFromDmy(value);
      current.dateLabel = value;
    } else if (current && /^Time$/i.test(label)) {
      current.time = value;
    } else if (current && /^Venue$/i.test(label)) {
      current.venue = value;
    } else if (current && /^Download$/i.test(label)) {
      const href = /href="([^"]+\.pdf)"/i.exec(row);
      current.noticeUrl = absolute(href?.[1]);
    }
  }
  flush();
  process.stderr.write(`  ${total} upcoming meetings, ${unmatched} unattributable\n`);
  if (unmatched) {
    warnings.push(`${unmatched} of ${total} upcoming meetings could not be attributed to a committee`);
  }
}

// ── 5. join the roster, sort, write ────────────────────────────────────────────────

const roster = JSON.parse(fs.readFileSync(path.join(outDir, 'members.json'), 'utf8'));
const byUid = new Map(roster.members.map((m) => [m.uid, m]));

let matched = 0;
let unmatchedMembers = 0;
for (const c of catalogue.values()) {
  for (const m of c.members) {
    const r = m.uid !== null ? byUid.get(m.uid) : null;
    m.rosterMatch = Boolean(r);
    if (r) {
      matched += 1;
      // The roster is authoritative for party and seat: it was scraped from
      // all-members.php in one pass and is internally consistent, whereas the
      // committee pages are edited per committee and drift.
      m.party = r.party;
      m.partyCommon = r.partyCommon;
      m.province = r.province ?? null;
      m.seatType = r.seatType;
      if (r.constituency) m.constituency = r.constituency;
      if (m.constituency && r.constituency && m.constituency !== r.constituency) {
        warnings.push(
          `${m.name} (uid ${m.uid}) is ${m.constituency} on the ${c.name} page and ${r.constituency} on the roster; roster wins`
        );
      }
    } else {
      // Not on the current roster. Real case, not a parsing bug: uid 1866 sits on
      // two committee pages as the member for NA-251, but all-members.php now
      // returns a different member for that seat. The committee page is stale.
      // The seat link is suppressed downstream so nobody follows it expecting him.
      unmatchedMembers += 1;
      m.province = null;
      m.seatType = null;
      warnings.push(
        `${m.name} (uid ${m.uid ?? '—'}) sits on "${c.name}" but is not on the current roster` +
          `${m.constituency ? ` — the committee page gives ${m.constituency}` : ''}`
      );
    }
  }

  c.reports.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  c.meetings.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  // The chairperson on the index page and the "(Chairman)" flag on the composition
  // page are two independent statements of the same fact. Where they disagree, say so.
  const flagged = c.members.find((m) => m.chairman);
  if (flagged && c.chairName) {
    const a = flagged.name.replace(/\s+/g, ' ').toLowerCase();
    const b = c.chairName.replace(/\s+/g, ' ').toLowerCase();
    if (!a.includes(b.split(',')[0]) && !b.includes(a)) {
      warnings.push(`chair mismatch for "${c.name}": index says ${c.chairName}, composition flags ${flagged.name}`);
    }
  }
  c.chairUid = flagged?.uid ?? null;
}

const committees = [...catalogue.values()].sort((a, b) => a.name.localeCompare(b.name));

// Slugs are the URL, so a collision would silently serve the wrong pack.
const slugs = new Set();
for (const c of committees) {
  if (slugs.has(c.slug)) throw new Error(`duplicate slug ${c.slug}`);
  slugs.add(c.slug);
}

const out = {
  meta: {
    sources: {
      index: `${BASE}/cmen.php?type=1|2|5|6`,
      composition: `${BASE}/cmen.php?comm=<base64 committee id>`,
      reports: `${BASE}/committee-reports.php`,
      meetings: `${BASE}/meetings.php`,
      roster: 'data/pk/members.json',
    },
    scrapedAt: new Date().toISOString(),
    committeeCount: committees.length,
    byKind: committees.reduce((acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }), {}),
    memberSeats: matched + unmatchedMembers,
    memberSeatsJoinedToRoster: matched,
    memberSeatsUnjoined: unmatchedMembers,
    senatorSeats: committees.reduce((n, c) => n + c.senators.length, 0),
    reportsAttached: committees.reduce((n, c) => n + c.reports.length, 0),
    meetingsAttached: committees.reduce((n, c) => n + c.meetings.length, 0),
    urduNamesAvailable: false,
    urduNamesNote:
      'na.gov.pk/ur/ returns HTTP 404 for every committee path; the Secretariat publishes committee names in English only.',
    warnings,
  },
  committees,
};

fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, 'committees.json');
fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);

process.stderr.write(
  `\nwrote ${file}\n` +
    `  ${committees.length} committees\n` +
    `  ${matched}/${matched + unmatchedMembers} member seats joined to the roster\n` +
    `  ${out.meta.reportsAttached} reports, ${out.meta.meetingsAttached} upcoming meetings\n` +
    `  ${warnings.length} warning(s)\n`
);
for (const w of warnings) process.stderr.write(`  ! ${w}\n`);
