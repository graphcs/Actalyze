#!/usr/bin/env node
/**
 * Build the four provincial assembly rosters.
 *
 *   node scripts/pk/scrape-provincial-members.mjs [--out data/pk]
 *
 * Run this once and commit the output. Do NOT call it at request time — but DO re-run
 * it before a demo: provincial floors move faster than the National Assembly's, and
 * Punjab in particular has seen sustained defection from the Sunni Ittehad Council.
 *
 * ── Why Wikipedia is the primary source here, when na.gov.pk was not ──────────────
 *
 * The National Assembly publishes its whole roster on one page, so the national build
 * scrapes the House itself. The provinces do not give us that option:
 *
 *   - **Punjab** — `pap.gov.pk` does not respond. DNS resolves to 103.226.217.162 and
 *     both :80 and :443 time out. There is no first-party source to scrape at all, and
 *     Punjab is the province this build is deepest in.
 *   - **Sindh** — `pas.gov.pk` paginates, and page one carries 78 of 130.
 *   - **KP** — `pakp.gov.pk/members/` lists all 115 seats but **carries no party
 *     affiliation**, which is the field the composition bar exists to show.
 *   - **Balochistan** — `pabalochistan.gov.pk/list-members` is the one genuinely
 *     complete first-party source.
 *
 * Wikipedia's per-assembly member lists are complete for Punjab, KP and Balochistan,
 * are structured as one table with the district carried in a `rowspan`, and name
 * parties consistently across all four — which the four official sites do not.
 *
 * So the roster comes from Wikipedia and is **cross-checked against the official site
 * seat counts** wherever one responds. Where the two disagree the script says so rather
 * than picking a winner. `sourceNote` records the provenance per assembly, and the UI
 * renders it: a government buyer is entitled to know which numbers came from the House
 * and which did not.
 */

import fs from 'fs';
import path from 'path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const outDir = (() => {
  const i = process.argv.indexOf('--out');
  return path.resolve(i > -1 ? process.argv[i + 1] : 'data/pk');
})();

const ASSEMBLIES = [
  {
    prefix: 'PP',
    province: 'PB',
    seats: 297,
    page: 'List of members of the 18th Provincial Assembly of the Punjab',
    official: null, // pap.gov.pk unreachable
    officialNote: 'pap.gov.pk did not respond when this roster was built',
  },
  {
    // The SIXTEENTH. Sindh numbers its assemblies from 1937, so the "7th" is the
    // 1985-88 house — a real page, a plausible title, and forty years out of date.
    // `assertCurrent` below exists because of it.
    prefix: 'PS',
    province: 'SD',
    seats: 130,
    page: 'List of members of the 16th Provincial Assembly of Sindh',
    official: 'https://pas.gov.pk/assembly-members-directory',
    officialNote: 'pas.gov.pk paginates its directory, so its first page lists fewer seats than the House has',
  },
  {
    prefix: 'PK',
    province: 'KP',
    seats: 115,
    page: 'List of members of the 12th Provincial Assembly of Khyber Pakhtunkhwa',
    official: 'https://www.pakp.gov.pk/members/',
    officialNote: "pakp.gov.pk's list includes the reserved-seat members, so it exceeds the general-seat count",
  },
  {
    prefix: 'PB',
    province: 'BA',
    seats: 51,
    page: 'List of members of the 12th Provincial Assembly of Balochistan',
    official: 'https://pabalochistan.gov.pk/list-members',
  },
];

/**
 * Wikipedia's party article titles -> our ids.
 *
 * Two of these carry real political weight and getting them wrong is noticed:
 *
 *  - **Sunni Ittehad Council** is the vehicle PTI-backed independents joined after PTI
 *    lost the bat symbol. In Punjab it is the largest opposition bloc. It is its own
 *    party id, not PTI and not Independent.
 *  - **Pakistan Muslim League (Q)** is written `PML` by some sources and is emphatically
 *    not PML-N.
 */
const PARTY = {
  'pakistan muslim league (n)': 'PMLN',
  'pakistan peoples party': 'PPP',
  'pakistan peoples party parliamentarians': 'PPP',
  'pakistan tehreek-e-insaf': 'PTI',
  'pakistan tehreek-e-insaf parliamentarians': 'PTI',
  'sunni ittehad council': 'SIC',
  'independent': 'IND',
  'independent politician': 'IND',
  'muttahida qaumi movement – pakistan': 'MQMP',
  'muttahida qaumi movement - pakistan': 'MQMP',
  'muttahida qaumi movement (pakistan)': 'MQMP',
  'jamiat ulema-e-islam (f)': 'JUIF',
  'jamiat ulema-e-islam': 'JUIF',
  'pakistan muslim league (q)': 'PMLQ',
  'pakistan muslim league (quaid)': 'PMLQ',
  'istehkam-e-pakistan party': 'IPP',
  'majlis wahdat-e-muslimeen': 'MWM',
  'pakistan muslim league (z)': 'PMLZ',
  'balochistan awami party': 'BAP',
  'national party': 'NP',
  'national party (pakistan)': 'NP',
  'pashtunkhwa milli awami party': 'PKMAP',
  'balochistan national party (mengal)': 'BNPM',
  'balochistan national party': 'BNPM',
  'awami national party': 'ANP',
  'jamaat-e-islami': 'JI',
  'jamaat-e-islami pakistan': 'JI',
  'haq do tehreek': 'OTHER',
  'pakistan muslim league': 'PMLQ',
  "pakistan people's party": 'PPP',
  "pakistan people's party parliamentarians": 'PPP',
  'jamiat ulema-e-islam (f)': 'JUIF',
  'grand democratic alliance': 'OTHER',
  'pakistan tehreek-e-insaf': 'PTI',
};

function partyId(raw) {
  if (!raw) return 'UNKNOWN';
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  return PARTY[key] ?? 'OTHER';
}

/** `[[PP-1 Attock-I]]` / `[[Foo|Bar]]` / `Bar` -> the display text. */
function unlink(s) {
  return String(s || '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/'''?/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function wikitext(page) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&page=' +
    encodeURIComponent(page);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  if (json.error) throw new Error(`${page}: ${json.error.info}`);
  return json.parse.wikitext;
}

/**
 * Refuse to build a roster from the wrong House.
 *
 * The first version of this script pointed Sindh at "the 7th Provincial Assembly",
 * which is a real, well-formed, complete article — about the assembly that sat from
 * 1985 to 1988. Sindh numbers its assemblies from 1937, so the plausible-looking
 * ordinal is off by nine. It parsed cleanly and would have put members elected under
 * Zia on a 2026 Chief Minister's board.
 *
 * The tenure of every current provincial assembly runs 2024–2029, so a page that never
 * mentions 2024 is not the current House whatever its title says.
 */
function assertCurrent(wt, page) {
  if (!/\b2024\b/.test(wt)) {
    throw new Error(
      `"${page}" never mentions 2024 — this is probably a historical assembly, not the current one. Refusing to build a roster from it.`
    );
  }
}

/**
 * Split a wikitext table row into cells, discarding cell attributes.
 *
 * A cell is `| content` or `| attributes | content`, and telling them apart matters:
 * `| bgcolor="{{party color|Sunni Ittehad Council}}" |` is an empty cell whose
 * attribute happens to name a party, and reading it as content shifts every subsequent
 * column by one. That misalignment is what put party names in the member field on the
 * first attempt.
 *
 * The attribute half is kept separately rather than thrown away, because on these
 * tables the colour swatch's attribute is the most reliable statement of the party —
 * it carries the full article title where the visible cell carries only an
 * abbreviation.
 */
/**
 * Table column headings, which must never be mistaken for a district.
 *
 * KP and Balochistan have no district column, so their first header cell is `!No.` —
 * which the row-header branch happily read as the name of a district, and every seat in
 * both provinces then claimed to be in a district called "No.".
 */
const COLUMN_LABELS = new Set([
  'no', 'no.', 'name', 'party', 'member', 'members', 'constituency', 'district',
  'ref', 'refs', 'note', 'notes', 'note(s)', 'serial', 'sr', 'sr.', 's.no', 'seat',
  'name of member', 'elected member',
]);

function isColumnLabel(text) {
  return COLUMN_LABELS.has(String(text || '').toLowerCase().replace(/\s+/g, ' ').trim());
}

/**
 * Derive districts from a constituency name, the way the National Assembly seed does.
 *
 * Balochistan and KP name their seats after the districts they cover, and a seat
 * spanning two takes both names joined by `-cum-`: `PB-1 Sherani-cum-Zhob` is in
 * Sherani and Zhob. Roman-numeral suffixes mark the nth seat within one district —
 * `Attock-I`, `Attock-II` — and are not part of the name.
 */
function districtsFromName(name) {
  if (!name) return [];
  return String(name)
    .split(/\s*-?\s*cum\s*-?\s*/i)
    .map((part) =>
      part
        .replace(/\s*[-–]\s*(?:[IVXLC]+|\d+)$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
}

function splitCells(block) {
  return block
    // References carry pipes and newlines and would otherwise be split into cells,
    // spilling `{{Cite web |title=…}}` into whichever column followed them. Strip them
    // before the row is divided rather than after.
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<ref[^>]*\/>/g, '')
    .split(/\n[|!]/)
    .slice(1)
    .map((raw) => {
      const s = raw.replace(/^\s*[|!]/, '');
      // Only an unbracketed `|` separates attributes from content, so links and
      // templates in the content are safe. Attributes always contain `=`.
      const at = s.search(/\|(?![^[]*\]\])/);
      if (at > -1) {
        const head = s.slice(0, at);
        if (/=/.test(head) && !/\[\[/.test(head)) {
          return { attr: head, text: s.slice(at + 1) };
        }
      }
      return { attr: '', text: s };
    });
}

/** Full party name out of `{{party color|X}}` / `{{party color cell|X}}`, if present. */
function partyFromColour(s) {
  const m = String(s).match(/\{\{\s*party color(?: cell)?\s*\|\s*([^}|]+)/i);
  return m ? m[1].trim() : null;
}

/** The article a `[[Target|Label]]` points at — a party abbreviation's true name. */
function linkTarget(s) {
  const m = String(s).match(/\[\[([^\]|#]+)/);
  return m ? m[1].trim() : null;
}

/**
 * Parse one assembly table by identifying cells semantically rather than positionally.
 *
 * The four pages do not share a column order: Punjab and Sindh lead with a district
 * header spanning several rows, while KP and Balochistan carry the seat code first and
 * no district column at all. Rather than three layout-specific parsers that each break
 * when an editor adds a column, each row is searched for the cell that looks like a
 * seat code, the cell that names a party, and the remaining person-shaped cell.
 *
 * The district sits in a `rowspan` header opening a run of constituencies, so it is
 * carried forward. The span is read rather than inferred — "carry until the next
 * header" breaks on single-seat districts, whose header has no rowspan at all.
 */
function parseAssembly(wt, prefix) {
  const rows = [];
  let district = null;
  let remaining = 0;

  const CODE = new RegExp(`\\b${prefix}-(\\d+)\\b`);

  for (const block of wt.split(/\n\|-/)) {
    const cells = splitCells(block);
    if (!cells.length) continue;

    // Leading header cell naming a district, e.g. `! rowspan="3" | [[Jacobabad District|Jacobabad]]`
    const head = cells[0];
    const isHeader = /^\s*!/.test(block.slice(block.indexOf('\n') + 1)) || /rowspan/i.test(head.attr);
    const headText = unlink(head.text).replace(/\s*District$/i, '').trim();
    if (isHeader && !CODE.test(head.text) && headText && !isColumnLabel(headText)) {
      district = headText;
      const span = head.attr.match(/rowspan\s*=\s*"?(\d+)"?/i);
      remaining = span ? Number(span[1]) : 1;
    }

    const codeCell = cells.find((c) => CODE.test(c.text));
    if (!codeCell) continue;
    const seat = Number(codeCell.text.match(CODE)[1]);
    const code = `${prefix}-${seat}`;

    // Constituency name: whatever follows the code in that cell, or the cell after it.
    const inline = unlink(codeCell.text).replace(new RegExp(`^${code}\\s*`), '').trim();
    const after = cells.slice(cells.indexOf(codeCell) + 1);
    const name = inline || unlink(after[0]?.text ?? '') || null;

    // Party: prefer the colour template's full article title, which is unambiguous;
    // fall back to a party cell's link target, then to its visible text.
    let partyName = null;
    for (const c of cells) {
      partyName = partyFromColour(c.attr) || partyFromColour(c.text);
      if (partyName) break;
    }
    let partyCellIdx = -1;
    if (!partyName) {
      partyCellIdx = cells.findIndex(
        (c) => !CODE.test(c.text) && (linkTarget(c.text) || '') && partyId(linkTarget(c.text)) !== 'OTHER'
      );
      if (partyCellIdx > -1) partyName = linkTarget(cells[partyCellIdx].text);
    } else {
      partyCellIdx = cells.findIndex((c) => partyId(linkTarget(c.text) || unlink(c.text)) !== 'OTHER' && !CODE.test(c.text));
    }

    /**
     * Member: the last linked person in the row.
     *
     * "Person-shaped" here means a wiki-linked cell that is neither the seat code, nor
     * the party, nor a reference — taking the LAST such cell rather than the first,
     * because the party column always precedes the member column on all four pages and
     * a party that failed to map would otherwise be mistaken for a name.
     */
    let member = null;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (i === partyCellIdx) continue;
      const c = cells[i];
      if (CODE.test(c.text)) continue;
      const t = unlink(c.text);
      if (!t || t.length < 3) continue;
      if (/^ref\b|^\d+$|^n\/?a$/i.test(t)) continue;
      if (partyName && t.toLowerCase() === String(partyName).toLowerCase()) continue;
      if (partyId(linkTarget(c.text) || t) !== 'OTHER') continue; // still a party cell
      member = t;
      break;
    }

    const seatName = name && name !== code ? name : null;

    // A seat whose member column reads "Vacant" is unfilled, not held by someone called
    // Vacant. Two Sindh seats are in this state and both rendered as members until this
    // was caught.
    if (member && /^(vacant|seat vacant|—|-|n\/?a)$/i.test(member.trim())) {
      member = null;
      partyName = null;
    }

    rows.push({
      code,
      seatNumber: seat,
      name: seatName,
      // KP and Balochistan have no district column, so fall back to the seat name,
      // which in both provinces is the district (or districts) the seat covers.
      districts: district ? [district] : districtsFromName(seatName),
      memberName: member,
      party: partyId(partyName),
      partyRaw: partyName,
    });
    if (remaining > 0) remaining--;
  }

  // Later duplicates win: by-election results are appended below the original table on
  // some of these pages, and the more recent row is the one to keep.
  const byCode = new Map();
  for (const r of rows) byCode.set(r.code, r);
  return [...byCode.values()].sort((a, b) => a.seatNumber - b.seatNumber);
}

/** Count distinct seat codes an official site shows, purely as a cross-check. */
async function officialCount(url, prefix) {
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;
    const html = await res.text();
    return new Set(html.match(new RegExp(`\\b${prefix}-\\d+`, 'g')) || []).size;
  } catch {
    return null;
  }
}

const constituencies = [];
const members = [];
const provenance = [];

for (const a of ASSEMBLIES) {
  process.stdout.write(`${a.prefix} (${a.province}) … `);
  const wt = await wikitext(a.page);
  assertCurrent(wt, a.page);
  const parsed = parseAssembly(wt, a.prefix);
  const official = await officialCount(a.official, a.prefix);

  // Synthesise the gaps so a seat number always resolves to something rather than 404ing
  // mid-demo. A missing seat is shown as unfilled, never invented.
  const seen = new Map(parsed.map((r) => [r.seatNumber, r]));
  for (let n = 1; n <= a.seats; n++) {
    const r = seen.get(n);
    const code = `${a.prefix}-${n}`;
    if (r) {
      // A row exists but names no member: the seat is in the table and vacant. Keep the
      // constituency (its name and district are still true and the map still needs it)
      // and add no member.
      const held = Boolean(r.memberName);
      constituencies.push({
        code,
        seatNumber: n,
        assembly: a.prefix,
        province: a.province,
        name: r.name,
        districts: r.districts ?? [],
        memberName: r.memberName,
        party: held ? r.party : null,
        partyRaw: held ? r.partyRaw : null,
        vacant: !held,
      });
      if (held) {
        members.push({
          name: r.memberName,
          party: r.party,
          partyRaw: r.partyRaw,
          province: a.province,
          assembly: a.prefix,
          constituency: code,
          seatType: 'general',
        });
      }
    } else {
      constituencies.push({
        code,
        seatNumber: n,
        assembly: a.prefix,
        province: a.province,
        name: null,
        districts: [],
        memberName: null,
        party: null,
        partyRaw: null,
        vacant: true,
      });
    }
  }

  const filled = parsed.length;
  const agree = official == null ? null : official === filled;
  provenance.push({
    assembly: a.prefix,
    province: a.province,
    generalSeats: a.seats,
    filled,
    source: `Wikipedia — ${a.page}`,
    sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(a.page.replace(/ /g, '_'))}`,
    officialUrl: a.official,
    officialSeatCount: official,
    officialNote: a.officialNote ?? null,
    // A count that differs from the official site is usually explained rather than
    // wrong — Sindh paginates, KP counts its reserved seats in the same list. Where the
    // reason is known it is stated; where it is not, the disagreement is reported plainly
    // rather than smoothed over.
    crossCheck:
      official == null
        ? (a.officialNote ?? 'the Assembly site did not respond to the cross-check')
        : agree
          ? `matches the ${official} seats listed on the Assembly's own site`
          : a.officialNote
            ? `${a.officialNote} (it lists ${official})`
            : `differs from the Assembly's own site, which lists ${official} — unexplained`,
  });

  console.log(
    `${filled}/${a.seats} filled` +
      (official == null ? '  (no official cross-check)' : `  official lists ${official}${agree ? ' ✓' : ' ✗'}`)
  );
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'provincial-constituencies.json'),
  JSON.stringify({ scrapedAt: new Date().toISOString(), provenance, constituencies }, null, 2)
);
fs.writeFileSync(
  path.join(outDir, 'provincial-members.json'),
  JSON.stringify({ scrapedAt: new Date().toISOString(), provenance, members }, null, 2)
);

console.log(`\nWrote ${constituencies.length} constituencies, ${members.length} members to ${outDir}`);
for (const p of provenance) console.log(`  ${p.assembly}: ${p.crossCheck}`);
