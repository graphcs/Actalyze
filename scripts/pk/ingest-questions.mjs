#!/usr/bin/env node
/**
 * Build the question-hour index from the National Assembly's own question papers.
 *
 * Rule 78(j) of the Rules of Procedure, 2007 bars a question that "repeat[s] in
 * substance questions admitted for the same session, or already answered or disallowed
 * by the Speaker, or to which an answer was refused in the Assembly during the last two
 * sessions". Nothing in the Assembly's published record makes that testable before
 * filing: the papers are per-sitting PDFs, forty megabytes each, with no index, no
 * search and no machine-readable form. A member finds out the question was a repeat
 * when the Secretariat returns it.
 *
 * This script turns those PDFs into a searchable record: question number, starred or
 * unstarred, the member who asked, the Division addressed, the question, the Minister's
 * reply, the sitting and a link back to the source page of record.
 *
 * ── Where the papers come from ────────────────────────────────────────────────────
 * https://na.gov.pk/en/questions.php?type=list drives three chained selects — tenure,
 * parliamentary year, session — against one AJAX endpoint:
 *
 *   includes/getpartlimentyears.php?tenure_id=21                       → years
 *   includes/getpartlimentyears.php?Tenure_ID=21&ParYear_id=74         → sessions
 *   includes/getpartlimentyears.php?tenureid=21&py_id=74&session_id=524 → sittings
 *
 * (The three casings of the same parameters are the site's, not a typo here.)
 * `--index` walks all three and prints the inventory. Nothing is hardcoded except the
 * tenure, which is the only one the site offers.
 *
 * ── The text-layer gate ───────────────────────────────────────────────────────────
 * Two failure modes, and only the first is obvious.
 *
 * 1. A scanned paper extracts to a handful of characters per page. A chars-per-page
 *    floor catches it.
 * 2. A paper typeset in a legacy non-Unicode font extracts to *thousands* of
 *    characters that contain no letters in any script — digits, spaces, punctuation.
 *    It sails through a chars-per-page check and ingests as noise. Only a letter-ratio
 *    floor catches it. `scripts/pk/ingest-documents.mjs` found this on the Urdu PDFs
 *    at pakistancode.gov.pk; the same gate is applied here.
 *
 * Both gates are measured on the English question sections specifically, not on the
 * whole file. A question paper is mostly annexures — hundreds of pages of scanned
 * tables whose OCR is genuinely unusable — so a whole-file average is dominated by
 * material this index does not use and would pass a paper whose actual question text
 * failed to extract. Measuring what is ingested is the point of the gate.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────────
 *   node scripts/pk/ingest-questions.mjs --index          # inventory, no downloads
 *   node scripts/pk/ingest-questions.mjs --verify         # download + gate report
 *   node scripts/pk/ingest-questions.mjs                  # verify, parse, write JSON
 *   node scripts/pk/ingest-questions.mjs --sessions=524,523 --limit=10
 *   node scripts/pk/ingest-questions.mjs --refetch        # ignore the PDF cache
 *
 * No API key, no database and no dev server: the output is a static JSON file the
 * route reads at request time. The papers run 30–45 MB each, so downloads are cached
 * under .pk-question-cache/ and the parsed text beside them.
 */

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(ROOT, '.pk-question-cache');
const OUT_FILE = path.join(ROOT, 'data', 'pk', 'questions.json');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const BASE = 'https://na.gov.pk';
const LIST_PAGE = `${BASE}/en/questions.php?type=list`;
const AJAX = `${BASE}/en/includes/getpartlimentyears.php`;

/** The only tenure na.gov.pk currently indexes questions for: 29 Feb 2024 – 28 Feb 2029. */
const TENURE_ID = '21';
const TENURE_LABEL = 'February 29, 2024 – February 28, 2029';

/**
 * Which sittings to ingest by default.
 *
 * The 26th, 27th and 28th Sessions — the three most recent — because Rule 78(j)'s bar
 * is scoped to the current session and the two before it, so a duplicate check is only
 * useful over a contiguous recent window. Ten sittings is enough to be credible and
 * small enough to stay honest: 116 sittings are listed for this tenure and ingesting
 * all of them would be four gigabytes of download for no additional demonstration.
 */
const DEFAULT_SESSIONS = ['524', '523', '522', '521'];
const DEFAULT_LIMIT = 10;

// ── gates ──────────────────────────────────────────────────────────────────────────
const MIN_TOTAL_CHARS = 800;

/**
 * The letter-ratio floor is applied to the extracted QUESTION text, not to the paper.
 *
 * A whole-file ratio is the wrong measure for this corpus and would reject good papers
 * and accept bad ones. A question paper is mostly replies, replies are mostly tables of
 * figures, and a perfectly clean paper whose replies are heavy on tables measures 47–60%
 * letters — below any floor that would still catch a mangled font. The questions
 * themselves are uniform English prose in every paper, which measures 78–80% when the
 * text layer is real and collapses when it is not. So that is what is measured.
 */
const MIN_QUESTION_LETTER_RATIO = 0.7;

/** Below this over the whole file, there is no readable text layer at all. */
const MIN_DOC_LETTER_RATIO = 0.35;

const LETTERS = /[A-Za-z؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;

function letterRatioOf(text) {
  const chars = text.length;
  const letters = (text.match(LETTERS) || []).length;
  return { chars, letters, ratio: chars > 0 ? letters / chars : 0 };
}

// ── args ───────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const INDEX_ONLY = flag('index');
const VERIFY_ONLY = flag('verify');
const REFETCH = flag('refetch');
const LIMIT = Number(opt('limit', DEFAULT_LIMIT));
const SESSIONS = opt('sessions', DEFAULT_SESSIONS.join(',')).split(',').filter(Boolean);

// ── http ───────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * na.gov.pk returns an intermittent 500 on the AJAX endpoint under any sustained
 * sequence of requests — the same URL succeeds on a retry a second later. Without a
 * retry the inventory walk fails roughly one run in three, at a random session.
 */
async function get(url, { binary = false, timeout = 600_000, attempts = 4 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: binary ? 'application/pdf,*/*' : 'text/html,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (err) {
      last = err;
      if (i < attempts - 1) await sleep(1500 * (i + 1));
    }
  }
  throw last;
}

const decode = (s) =>
  s
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

// ── the site's inventory ───────────────────────────────────────────────────────────
async function parliamentaryYears() {
  const html = await get(`${AJAX}?tenure_id=${TENURE_ID}`, { timeout: 60_000 });
  return [...html.matchAll(/<option value='(\d+)'>([^<]*)<\/option>/g)].map((m) => ({
    id: m[1],
    label: decode(m[2]),
  }));
}

async function sessionsOf(yearId) {
  const html = await get(`${AJAX}?Tenure_ID=${TENURE_ID}&ParYear_id=${yearId}`, { timeout: 60_000 });
  return [...html.matchAll(/<option value="(\d+)"\s*>\s*([\s\S]*?)<\/option>/g)].map((m) => ({
    id: m[1],
    label: decode(m[2]),
  }));
}

async function sittingsOf(yearId, sessionId) {
  const html = await get(`${AJAX}?tenureid=${TENURE_ID}&py_id=${yearId}&session_id=${sessionId}`, {
    timeout: 60_000,
  });
  // Three cells: row number, sitting date, download link. `[^<]*` keeps the capture
  // inside the date cell — `[\s\S]*?` would start at the row-number cell and swallow
  // the markup between the two.
  const rows = [
    ...html.matchAll(
      /<td align="left">\s*([^<]*?)\s*<\/td>\s*<td align="left">\s*<a href="([^"]+)"[^>]*title="(\d+)"/g
    ),
  ];
  return rows.map((r) => ({
    date: decode(r[1]),
    pdfUrl: new URL(r[2].replace(/^\.\.\//, '/'), BASE).toString(),
    sittingId: r[3],
  }));
}

/**
 * Walk tenure → year → session → sitting.
 *
 * `only` restricts the sitting lookup to the session ids being ingested — the session
 * list itself is always walked in full so the run can report how much of the archive it
 * is *not* taking.
 */
async function buildIndex(only = null) {
  const years = await parliamentaryYears();
  const out = [];
  let listedSessions = 0;
  for (const y of years) {
    const sessions = await sessionsOf(y.id);
    listedSessions += sessions.length;
    for (const s of sessions) {
      if (only && !only.includes(s.id)) continue;
      // Joint sittings of both Houses do not take questions; the site lists them in the
      // same select and they return an empty table.
      const sittings = await sittingsOf(y.id, s.id);
      for (const sit of sittings) {
        out.push({
          parliamentaryYearId: y.id,
          parliamentaryYear: y.label,
          sessionId: s.id,
          session: s.label,
          sessionNumber: sessionNumber(s.label),
          ...sit,
        });
      }
    }
  }
  out.listedSessions = listedSessions;
  return out;
}

function sessionNumber(label) {
  const m = /^\s*(\d+)(?:st|nd|rd|th)\s+Session/i.exec(label);
  return m ? Number(m[1]) : null;
}

// ── dates ──────────────────────────────────────────────────────────────────────────
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** "Thursday, 11th June, 2026" → "2026-06-11". Returns null rather than guessing. */
function isoDate(label) {
  const m = /(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/.exec(label || '');
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

// ── download + extract ─────────────────────────────────────────────────────────────
async function fetchPdfText(pdfUrl) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const name = pdfUrl.split('/').pop();
  const pdfFile = path.join(CACHE_DIR, name);
  const txtFile = path.join(CACHE_DIR, `${name}.txt`);
  const metaFile = path.join(CACHE_DIR, `${name}.meta.json`);

  if (!REFETCH && existsSync(txtFile) && existsSync(metaFile)) {
    return { text: readFileSync(txtFile, 'utf8'), ...JSON.parse(readFileSync(metaFile, 'utf8')), cached: true };
  }

  let buffer;
  if (!REFETCH && existsSync(pdfFile)) {
    buffer = readFileSync(pdfFile);
  } else {
    buffer = await get(pdfUrl, { binary: true });
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new Error(`not a PDF (starts "${buffer.subarray(0, 16).toString('latin1')}")`);
    }
    writeFileSync(pdfFile, buffer);
  }

  const parsed = await pdfParse(buffer);
  const text = parsed.text || '';
  const meta = { pages: parsed.numpages || 1, bytes: buffer.length };
  writeFileSync(txtFile, text);
  writeFileSync(metaFile, JSON.stringify(meta));
  return { text, ...meta, cached: false };
}

// ── parsing ────────────────────────────────────────────────────────────────────────
/**
 * Superscript ordinals extract onto their own line — "the 11" / "th" / " June, 2026",
 * "(Deferred during 21" / "st" / " Session)". Rejoin them before anything else looks at
 * the text, or every date and every session reference in the paper is broken.
 */
function normalise(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (/^(st|nd|rd|th)$/i.test(t) && out.length) {
      out[out.length - 1] = out[out.length - 1].replace(/\s*$/, '') + t;
      continue;
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n');
}

const STARRED_HEAD = /"?QUESTIONS\s+FOR\s+ORAL\s+ANSWERS?\s+AND\s+THEIR\s+REPLIES"?/i;
const UNSTARRED_HEAD = /"?UN-?\s*STARRED\s+QUESTIONS\s+AND\s+THEIR\s+REPLIES"?/i;
const WRITTEN_HEAD = /"?QUESTIONS\s+FOR\s+WRITTEN\s+ANSWERS?\s+AND\s+THEIR\s+REPLIES"?/i;

/**
 * Each English section is closed by the Secretary's dateline, then the printer's
 * imprint, then the Urdu translation and the annexures. All four are terminators — the
 * dateline is set on its own line in most papers and run together with the Secretary's
 * name in others, and a section that is not closed swallows the Urdu text and hundreds
 * of pages of scanned annexure into the last question's reply.
 */
const SECTION_END = [
  /^\s*Islamabad,?\s*$/i,
  /^\s*Islamabad,\s+[A-Z][A-Z\s.]{4,60},?\s*$/,
  /^\s*PCPPI\b/i,
];
/** A line that is more than half Urdu script: the translation has begun. */
const URDU_LINE = /^[^A-Za-z]*[؀-ۿ][\s\S]*$/;
const PAGE_NO = /^\s*(?:-:\s*\d+\s*:-|\d{1,3})\s*$/;

/**
 * A question header: number, an optional star, the member's name.
 *
 *   "11.  * Mr. Awais Haider Jakhar:"     (28th Session, 11 June 2026)
 *   "23.  * Syed Rafiullah"               (28th Session, 10 June 2026 — no colon)
 *
 * The trailing colon is inconsistent between papers, so it is optional, which makes
 * this pattern loose enough to also match a numbered paragraph inside a reply. Every
 * candidate is therefore confirmed against a "Will the Minister…" line below it before
 * it is accepted.
 */
const QHEAD = /^\s{0,8}(\d{1,4})\s*[.)]\s*(\*?)\s*([A-Z][^:]{2,120}?)\s*:?\s*$/;
const WILL = /\b[Ww]ill\s+the\s+(?:Ministers?|Prime\s+Minister)\b/;
const DEFERRED = /\(\s*Deferred\s+during\s+([^)]{2,60})\)/i;

/**
 * The reply opens with the answering Minister's portfolio and name, then a colon:
 *
 *   "Minister for Defence (Khawaja Muhammad Asif):"
 *   "Minister for Energy (Petroleum Division) (Mr. Ali Pervaiz): (a) On the eve of…"
 *
 * The second form is why the parenthetical cannot simply be taken as the person: the
 * Division is itself parenthesised. Match up to the first colon — no portfolio contains
 * one — then split the LAST parenthetical off as the Minister and keep the rest as the
 * portfolio.
 */
const REPLY_START =
  /^\s*((?:Prime\s+Minister|Ministers?(?:\s+of\s+State)?(?:\s+[Ii]n[-\s]?[Cc]harge)?\s+(?:for|of)\s+)[^:]{2,220}?)\s*:(?:\s|$)/;

/**
 * Where a Ministry has not answered, the paper says so in place of the reply. That is
 * itself a finding — a starred question left unanswered at the sitting it was set down
 * for — so it is recorded as a status rather than treated as a failed extraction.
 */
const NO_REPLY_NOTES = [
  { re: /\(?\s*Reply\s+not\s+received\.?\s*\)?/i, status: 'not-received' },
  { re: /\(?\s*(?:Deferred\s+)?for\s+answer\s+on\s+Next\s+Rota\s+Day\.?\s*\)?/i, status: 'deferred' },
];

/**
 * A few pages in this archive are typeset in a font whose encoding pdf-parse cannot
 * map, and the run comes out Caesar-shifted: "Minister In-FKDUJHRIWKH3ULPH0LQLVWHU¶V
 * Office" is "Minister In-charge of the Prime Minister's Office" with every byte 29 low.
 * It is confined to short runs inside otherwise clean papers, so the paper is kept — but
 * the affected records are flagged, because the alternative is a record that reads as
 * authoritative with a mangled Division on it. A digit embedded in a run of capitals is
 * the signature; real text in these papers never produces it.
 */
const FONT_ARTIFACT = /[A-Z]{2,}[0-9][A-Z]{4,}/;

/** Names that are honorific-led or otherwise plausibly a member, not a stray sentence. */
function looksLikeMember(name) {
  const words = name.trim().split(/\s+/);
  if (words.length > 12) return false;
  if (/[.?!]$/.test(name.trim())) return false;
  return /^[A-Z]/.test(name.trim());
}

/** Split "Energy (Petroleum Division)" into ministry and division. */
function splitPortfolio(portfolio) {
  const m = /^(.*?)\s*\(([^)]*(?:Division|Department)[^)]*)\)\s*$/i.exec(portfolio);
  if (m) return { ministry: m[1].trim(), division: m[2].trim() };
  return { ministry: portfolio.trim(), division: null };
}

/**
 * A reply that is mostly a table extracts as a column of one- and two-word lines. It is
 * still the real answer and is shown as extracted, but the page says so rather than
 * letting a reader assume the Ministry answered in fragments.
 */
function looksTabular(reply) {
  // Very little of it is letters: the answer is a table of figures, or a bare list of
  // part labels whose substance is in an annexure lodged with the Library.
  if (letterRatioOf(reply).ratio < 0.55) return true;
  const lines = reply.split('\n').filter((l) => l.trim());
  if (lines.length < 8) return false;
  const short = lines.filter((l) => l.trim().split(/\s+/).length <= 3).length;
  return short / lines.length > 0.5;
}

/**
 * Repair a paper whose text layer is offset by a fixed code-point shift.
 *
 * A minority of these papers embed a subsetted Type 1 font with a custom encoding whose
 * glyph codes sit 29 below the ASCII value of the character they draw. pdf-parse returns
 * the raw codes, so the 2nd April 2026 paper extracts as:
 *
 *   ³48(67,216)2525$/$16:(56 …
 *
 * which is "QUESTIONS FOR ORAL ANSWERS …" with every byte 29 low. This is recoverable
 * exactly, and refusing a whole sitting for a solved encoding problem would be wrong.
 *
 * The repair is guarded so it can never damage a good paper: it is attempted only when
 * the document does NOT already contain the printed heading, and the result is kept only
 * when it DOES. A shift applied to correct text destroys that heading, so the guard
 * fails closed.
 *
 * Newlines, tabs and real spaces are left alone — the font's own space is code 0x03 and
 * shifts to 0x20 — and the font's apostrophe glyph lands on ¶, which is mapped back.
 */
const HEADING_PLAIN = /QUESTIONS\s+FOR\s+ORAL\s+ANSWERS\s+AND\s+THEIR\s+REPLIES/i;
const ENCODING_SHIFT = 29;

function repairShiftedEncoding(text) {
  if (HEADING_PLAIN.test(text)) return { text, repaired: false };
  let out = '';
  for (const ch of text) {
    const n = ch.charCodeAt(0);
    if (n === 0x09 || n === 0x0a || n === 0x0d || n === 0x20) out += ch;
    else if (n >= 0x03 && n <= 0x61) out += String.fromCharCode(n + ENCODING_SHIFT);
    else if (n === 0xb6) out += '’';
    else out += ch;
  }
  if (!HEADING_PLAIN.test(out)) return { text, repaired: false };
  return { text: out, repaired: true };
}

function parsePaper(rawText) {
  const { text: repairedText, repaired } = repairShiftedEncoding(rawText);
  const text = normalise(repairedText);
  const lines = text.split('\n');

  const sections = [];
  lines.forEach((l, i) => {
    if (STARRED_HEAD.test(l)) sections.push({ kind: 'starred', start: i });
    else if (UNSTARRED_HEAD.test(l)) sections.push({ kind: 'unstarred', start: i });
    else if (WRITTEN_HEAD.test(l)) sections.push({ kind: 'written', start: i });
  });
  sections.forEach((s, i) => {
    // Bounded by the next section as well as by the closers: where the dateline is set
    // run together with the Secretary's name, the closer can be missed, and an unbounded
    // starred section then re-parses the whole un-starred listing and reports every
    // question in it twice.
    let end = i + 1 < sections.length ? sections[i + 1].start : lines.length;
    for (let j = s.start + 1; j < end; j++) {
      if (SECTION_END.some((re) => re.test(lines[j])) || URDU_LINE.test(lines[j])) {
        end = j;
        break;
      }
    }
    s.end = end;
  });

  const join = (from, to, { dropPageNumbers = false } = {}) =>
    lines
      .slice(Math.max(from, 0), Math.max(to, 0))
      .filter((l) => (dropPageNumbers ? !PAGE_NO.test(l) : !/^\s*-:\s*\d+\s*:-\s*$/.test(l)))
      .map((l) => l.trim())
      .join('\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const records = [];
  const sectionText = [];

  for (const s of sections) {
    sectionText.push(join(s.start, s.end));

    const heads = [];
    for (let i = s.start + 1; i < s.end; i++) {
      const m = QHEAD.exec(lines[i]);
      if (!m || !looksLikeMember(m[3])) continue;
      let confirmed = false;
      for (let j = i + 1; j < Math.min(i + 8, s.end); j++) {
        if (WILL.test(lines[j])) {
          confirmed = true;
          break;
        }
        if (QHEAD.test(lines[j])) break;
      }
      if (confirmed) {
        heads.push({
          line: i,
          number: Number(m[1]),
          starred: m[2] === '*' || s.kind === 'starred',
          asker: m[3].replace(/\s{2,}/g, ' ').trim(),
        });
      }
    }

    heads.forEach((h, idx) => {
      const blockEnd = idx + 1 < heads.length ? heads[idx + 1].line : s.end;

      let replyLine = -1;
      let portfolio = null;
      for (let i = h.line + 1; i < blockEnd; i++) {
        const flat = lines[i].replace(/\s{2,}/g, ' ');
        let m = REPLY_START.exec(flat);
        if (!m && i + 1 < blockEnd) {
          // A long portfolio wraps; try the line joined with the next one.
          m = REPLY_START.exec(`${flat} ${lines[i + 1].replace(/\s{2,}/g, ' ').trim()}`);
        }
        if (m) {
          replyLine = i;
          portfolio = m[1].replace(/\s{2,}/g, ' ').trim();
          break;
        }
      }

      // "(Deferred during 21st Session)" wraps across lines in some papers.
      const preamble = join(h.line + 1, Math.min(h.line + 4, blockEnd)).replace(/\n/g, ' ');
      const def = DEFERRED.exec(preamble);
      let questionStart = h.line + 1;
      if (def) {
        for (let i = h.line + 1; i < Math.min(h.line + 5, blockEnd); i++) {
          if (/\)/.test(lines[i]) && /Deferred/i.test(join(h.line + 1, i + 1))) {
            questionStart = i + 1;
            break;
          }
        }
      }

      // Page numbers are dropped from the question but not from the reply: some papers
      // set them as a bare numeral on its own line, and a reply rendered from a table has
      // legitimate cells that look identical.
      let question = join(questionStart, replyLine === -1 ? blockEnd : replyLine, { dropPageNumbers: true })
        .replace(DEFERRED, '')
        .trim();
      const replyBlock = replyLine === -1 ? '' : join(replyLine, blockEnd);

      // Where the reply is absent, the paper prints the reason in its place. Lift it out
      // of the question text and record it.
      let replyStatus = replyLine === -1 ? 'not-extracted' : 'answered';
      if (replyLine === -1) {
        for (const note of NO_REPLY_NOTES) {
          if (note.re.test(question)) {
            replyStatus = note.status;
            question = question.replace(note.re, '').trim();
            break;
          }
        }
      }

      // Strip the portfolio prefix off the reply body — it is stored as a field.
      let reply = replyBlock;
      if (portfolio) {
        const cut = replyBlock.indexOf(':');
        if (cut !== -1 && cut < portfolio.length + 40) reply = replyBlock.slice(cut + 1).trim();
      }

      let answeredBy = null;
      let portfolioText = portfolio;
      if (portfolio) {
        const lastParen = /^(.*)\(([^)]{2,120})\)\s*$/.exec(portfolio);
        if (lastParen && !/Division|Department/i.test(lastParen[2])) {
          answeredBy = lastParen[2].replace(/\s{2,}/g, ' ').trim();
          portfolioText = lastParen[1].trim();
        }
      }
      portfolioText = (portfolioText || '')
        .replace(/^Ministers?(?:\s+of\s+State)?(?:\s+[Ii]n[-\s]?[Cc]harge)?\s+(?:for|of)\s+/i, '')
        .replace(/^the\s+/i, '')
        .trim();

      // Prefer the portfolio as the Ministry itself names it in the reply; fall back to
      // the "Will the Minister for X" address when the paper carries no reply at all.
      let { ministry, division } = splitPortfolio(portfolioText);
      if (!ministry) {
        const addressed =
          /\b[Ww]ill\s+the\s+Ministers?\s+(?:for|of)\s+([\s\S]{2,120}?)\s+be\s+pleased\b/.exec(
            question.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ')
          );
        if (addressed) ({ ministry, division } = splitPortfolio(addressed[1].replace(/^the\s+/i, '').trim()));
      }

      records.push({
        number: h.number,
        starred: h.starred,
        listing: s.kind,
        asker: h.asker,
        deferredFrom: def ? def[1].replace(/\s+/g, ' ').trim() : null,
        ministry: ministry || null,
        division,
        answeredBy,
        question,
        reply,
        hasReply: reply.length > 0,
        replyStatus,
        replyIsTabular: reply ? looksTabular(reply) : false,
        fontArtifact: FONT_ARTIFACT.test(question) || FONT_ARTIFACT.test(reply) || FONT_ARTIFACT.test(ministry || ''),
      });
    });
  }

  return {
    records,
    sectionText: sectionText.join('\n\n'),
    sectionCount: sections.length,
    encodingRepaired: repaired,
    text,
  };
}

// ── the third failure mode: an OCR layer over a scan ───────────────────────────────
/**
 * Some papers in this archive carry a text layer that is neither the typeset text nor
 * empty: it is OCR run over a scan. It passes a chars-per-page floor comfortably and a
 * letter-ratio floor comfortably — the 26th Session papers below extract at 60% letters
 * — and it is still unusable, because what it gets wrong is precisely the parts a
 * question record is made of:
 *
 *   "QUESTIONS FOR ORAL ANSWERS AND THErR REPLTES"   ← heading
 *   "1'1.  " MR. AWAIS HAIDER JAKHAR"                ← question number and member
 *   "(Defened during 2'1"' Session)"                 ← the deferral note
 *
 * Ingesting that produces records that look complete and are wrong in their identifiers
 * and their figures. Since the heading is fixed boilerplate, its edit distance from the
 * real string is a direct measure of the OCR's error rate on this document — and a
 * nonzero distance is proof the text layer was not typeset. That is the test.
 */
const HEADING_CANON = 'QUESTIONSFORORALANSWERSANDTHEIRREPLIES';
const HEADING_CANON_UNSTARRED = 'UNSTARREDQUESTIONSANDTHEIRREPLIES';

function lettersOnly(s) {
  return s.toUpperCase().replace(/[^A-Z]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 12) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Best fuzzy match to the boilerplate heading anywhere in the document.
 *
 * The OCR'd papers break the heading across lines — ".QUESTIONS" / "FOR ORAL ANSWERS AND
 * THErR REPLTES" — so single lines are not enough; windows of up to four consecutive
 * lines are tried. A distance of zero means the paper is typeset and the heading simply
 * wrapped; anything above zero is OCR error on a string that cannot vary.
 */
function ocrProbe(text) {
  const lines = text.split('\n');
  let best = { distance: 99, line: null };
  for (let i = 0; i < lines.length; i++) {
    let window = '';
    for (let w = 0; w < 4 && i + w < lines.length; w++) {
      window += ` ${lines[i + w]}`;
      const l = lettersOnly(window);
      if (l.length < 24) continue;
      if (l.length > 60) break;
      for (const canon of [HEADING_CANON, HEADING_CANON_UNSTARRED]) {
        const d = levenshtein(l, canon);
        if (d < best.distance) best = { distance: d, line: window.replace(/\s+/g, ' ').trim() };
      }
    }
  }
  return best;
}

/**
 * The first thing in the document that should be a question header, quoted verbatim.
 * Evidence for the skip reason: on a typeset paper this reads "11. * Mr. Awais Haider
 * Jakhar:", on an OCR'd one it reads "1'1. " MR. AWAIS HAIDER JAKHAR".
 */
function firstCorruptSample(text) {
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.length < 6 || t.length > 70) continue;
    if (!/^[0-9'"|lI][0-9'"|lI]{0,4}\s*[.,]/.test(t)) continue;
    if (!/[A-Za-z]{3,}/.test(t)) continue;
    return t.replace(/\s+/g, ' ');
  }
  return null;
}

// ── the gate ───────────────────────────────────────────────────────────────────────
function gate({ records, pages, sectionCount, fullText }) {
  const doc = letterRatioOf(fullText);
  const prose = records.map((r) => r.question).join('\n');
  const q = letterRatioOf(prose);
  const stats = {
    sectionCount,
    records: records.length,
    chars: q.chars,
    letters: q.letters,
    letterRatio: q.ratio,
    docLetterRatio: doc.ratio,
    perPage: pages > 0 ? Math.round(doc.chars / pages) : 0,
  };

  if (sectionCount === 0 || records.length === 0) {
    if (doc.ratio < MIN_DOC_LETTER_RATIO) {
      return {
        ok: false,
        ...stats,
        reason:
          `text layer present but unreadable — ${doc.chars} chars across ${pages} page(s), only ` +
          `${doc.letters} are letters (${(doc.ratio * 100).toFixed(1)}%, floor ` +
          `${MIN_DOC_LETTER_RATIO * 100}%). Legacy non-Unicode font mapping; extraction yields ` +
          `digits and punctuation, not script.`,
      };
    }
    const probe = ocrProbe(fullText);
    // The heading is fixed boilerplate. If it is recoverable only by rejoining lines,
    // the extractor is reading OCR output over a scan: OCR breaks lines mid-phrase and
    // makes character errors at the same rate everywhere else in the document — on the
    // question numbers, the member names and the figures that a record is made of.
    if (probe.distance <= 10) {
      const sample = firstCorruptSample(fullText);
      return {
        ok: false,
        ...stats,
        reason:
          `OCR over a scan, not a typeset text layer — the paper's fixed heading is recoverable ` +
          `only by rejoining broken lines ("${probe.line}"${probe.distance ? `, ${probe.distance} character edits from the printed wording` : ''})` +
          `${sample ? `, and the first question header reads "${sample}"` : ''}. The same error rate ` +
          `falls on every question number, member name and figure, so the records would look ` +
          `complete and be wrong.`,
      };
    }
    return {
      ok: false,
      ...stats,
      reason:
        sectionCount === 0
          ? 'no "QUESTIONS … AND THEIR REPLIES" heading found — the document is not a question ' +
            'paper, or its heading did not extract'
          : 'the question sections were found but no question could be parsed out of them',
    };
  }

  if (q.chars < MIN_TOTAL_CHARS) {
    return {
      ok: false,
      ...stats,
      reason: `only ${q.chars} characters of question text across ${pages} page(s) (floor ${MIN_TOTAL_CHARS}) — no usable text layer.`,
    };
  }
  if (q.ratio < MIN_QUESTION_LETTER_RATIO) {
    return {
      ok: false,
      ...stats,
      reason:
        `question text extracted but unreadable — ${q.chars} chars, only ${q.letters} are letters ` +
        `(${(q.ratio * 100).toFixed(1)}%, floor ${MIN_QUESTION_LETTER_RATIO * 100}%). Question text ` +
        `is uniform prose and measures 78–80% in a clean paper; this is a mis-mapped font.`,
    };
  }
  return { ok: true, ...stats };
}

// ── main ───────────────────────────────────────────────────────────────────────────
function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('National Assembly question papers — na.gov.pk');
  console.log(`  tenure ${TENURE_LABEL}\n`);

  const index = await buildIndex(INDEX_ONLY ? null : SESSIONS);
  console.log(
    `  ${index.length} sitting(s) listed in ${new Set(index.map((s) => s.sessionId)).size} of ` +
      `${index.listedSessions} sessions\n`
  );

  if (INDEX_ONLY) {
    const bySession = new Map();
    for (const s of index) {
      if (!bySession.has(s.session)) bySession.set(s.session, []);
      bySession.get(s.session).push(s);
    }
    for (const [session, sittings] of bySession) {
      console.log(`  ${session} (id ${sittings[0].sessionId}) — ${sittings.length} sitting(s)`);
      for (const s of sittings) console.log(`      ${s.date}  ${s.pdfUrl}`);
    }
    return;
  }

  // Newest first, so `--limit` trims the oldest sittings rather than the current
  // session's — the current session is the one Rule 78(j) is tested against. The limit
  // counts sittings that actually made it in: a scanned paper is skipped and the next
  // one down is taken instead, rather than the run silently coming up short.
  const candidates = index
    .filter((s) => SESSIONS.includes(s.sessionId))
    .sort((a, b) => (isoDate(b.date) || '').localeCompare(isoDate(a.date) || ''));
  console.log(
    `  ingesting up to ${LIMIT} sitting(s) from ${candidates.length} candidate(s) in ` +
      `session id(s) ${SESSIONS.join(', ')}\n`
  );

  const sittings = [];
  const skipped = [];
  const questions = [];

  for (const s of candidates) {
    if (sittings.length >= LIMIT) break;
    const label = `${s.session} — ${s.date}`;
    process.stdout.write(`  ${label}\n      ${s.pdfUrl}\n`);
    let extracted;
    try {
      extracted = await fetchPdfText(s.pdfUrl);
    } catch (err) {
      console.log(`      SKIP  download/extract failed — ${err.message}\n`);
      skipped.push({ ...s, reason: `download or extraction failed — ${err.message}` });
      continue;
    }

    const parsed = parsePaper(extracted.text);
    const verdict = gate({
      records: parsed.records,
      pages: extracted.pages,
      sectionCount: parsed.sectionCount,
      fullText: parsed.text,
    });

    console.log(
      `      ${extracted.pages} pp, ${(extracted.bytes / 1e6).toFixed(1)} MB${extracted.cached ? ' (cached)' : ''} — ` +
        `${parsed.sectionCount} section(s), ${parsed.records.length} parsed, ` +
        `question text ${verdict.chars} chars at ${(verdict.letterRatio * 100).toFixed(0)}% letters ` +
        `(whole file ${(verdict.docLetterRatio * 100).toFixed(0)}%)` +
        `${parsed.encodingRepaired ? ' — font encoding shift repaired' : ''}`
    );

    if (!verdict.ok) {
      console.log(`      SKIP  ${verdict.reason}\n`);
      skipped.push({ ...s, reason: verdict.reason });
      continue;
    }

    const date = isoDate(s.date);
    const sittingId = `${s.sessionId}-${s.sittingId}`;
    const withReply = parsed.records.filter((r) => r.hasReply).length;
    console.log(`      ${parsed.records.length} questions, ${withReply} with a reply\n`);

    sittings.push({
      id: sittingId,
      sessionId: s.sessionId,
      session: s.session,
      sessionNumber: s.sessionNumber,
      parliamentaryYear: s.parliamentaryYear,
      dateLabel: s.date,
      date,
      pdfUrl: s.pdfUrl,
      pages: extracted.pages,
      bytes: extracted.bytes,
      questionCount: parsed.records.length,
      replyCount: withReply,
      letterRatio: Number(verdict.letterRatio.toFixed(4)),
      /** The paper's text layer needed the code-point shift undone before it was usable. */
      encodingRepaired: parsed.encodingRepaired,
    });

    for (const r of parsed.records) {
      questions.push({
        id: `${sittingId}-${r.listing}-${r.number}-${slug(r.asker).slice(0, 32)}`,
        sittingId,
        sessionId: s.sessionId,
        session: s.session,
        sessionNumber: s.sessionNumber,
        parliamentaryYear: s.parliamentaryYear,
        date,
        dateLabel: s.date,
        pdfUrl: s.pdfUrl,
        ...r,
      });
    }
  }

  const ministries = {};
  for (const q of questions) {
    const key = q.ministry || 'Unattributed';
    ministries[key] = (ministries[key] || 0) + 1;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: LIST_PAGE,
    tenure: TENURE_LABEL,
    /** Sittings the site lists for the sessions this run covered, not for the archive. */
    sittingsListed: index.length,
    sessionsInArchive: index.listedSessions,
    sittingsIngested: sittings.length,
    questionCount: questions.length,
    replyCount: questions.filter((q) => q.hasReply).length,
    /** answered / not-received / deferred / not-extracted. */
    replyStatusCounts: questions.reduce((acc, q) => {
      acc[q.replyStatus] = (acc[q.replyStatus] || 0) + 1;
      return acc;
    }, {}),
    fontArtifactCount: questions.filter((q) => q.fontArtifact).length,
    sittings,
    skipped,
    questions,
  };

  const statuses = {};
  for (const q of questions) statuses[q.replyStatus] = (statuses[q.replyStatus] || 0) + 1;

  console.log('  ── summary ─────────────────────────────────────────────');
  console.log(`  sittings ingested : ${sittings.length}`);
  console.log(`  sittings skipped  : ${skipped.length}`);
  console.log(`  questions         : ${questions.length}`);
  console.log(`  with a reply      : ${payload.replyCount}`);
  console.log(`  reply status      : ${Object.entries(statuses).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  font artifacts    : ${questions.filter((q) => q.fontArtifact).length}`);
  console.log('  ministries:');
  for (const [m, n] of Object.entries(ministries).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(3)}  ${m}`);
  }

  if (VERIFY_ONLY) {
    console.log('\n  --verify: nothing written.');
    return;
  }

  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\n  wrote ${path.relative(ROOT, OUT_FILE)} (${(JSON.stringify(payload).length / 1024).toFixed(0)} KB)`);
}

// Exported so the parser can be exercised against a cached paper without running the
// whole pipeline; guarded so importing it does not kick off a download.
export { parsePaper, gate, isoDate };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`\nfatal: ${err.stack || err.message}`);
    process.exit(1);
  });
}
