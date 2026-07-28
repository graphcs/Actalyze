#!/usr/bin/env node
/**
 * Ingest the Pakistani legislative corpus into the existing RAG pipeline.
 *
 * Everything here is a real, publicly published document fetched from the issuing
 * institution — na.gov.pk, pakistancode.gov.pk, the Wafaqi Mohtasib, the KP and
 * Punjab law portals. Nothing is synthesised.
 *
 * ── Why the text-layer gate exists ────────────────────────────────────────────────
 * A large share of Pakistani government PDFs are scans with no embedded text. They
 * download fine, `pdf-parse` returns without error, and the extracted string is a
 * handful of whitespace characters. Pushed through the pipeline they produce zero or
 * near-zero chunks and the document sits in the library looking ingested while being
 * invisible to retrieval — the worst possible failure mode, because it is silent.
 *
 * So every PDF is extracted and measured BEFORE it is uploaded, and anything under
 * MIN_CHARS_PER_PAGE is refused with the page/char counts printed. The canonical
 * example is the Rules of Procedure: na.gov.pk serves the same document at two paths,
 * and only one of them has a text layer.
 *
 *   uploads/documents/1539239593_412.pdf   → ~330 chars/page. Use this one.
 *   uploads/publications/rules_procedure.pdf → scanned images. Silently empty.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────────
 *   node scripts/pk/ingest-documents.mjs --verify        # text-layer report only
 *   node scripts/pk/ingest-documents.mjs                 # verify then ingest
 *   node scripts/pk/ingest-documents.mjs --only=rules-2007
 *   node scripts/pk/ingest-documents.mjs --force         # re-ingest existing titles
 *
 * Requires a dev server on --base (default http://localhost:3103) because ingestion
 * goes through `POST /api/documents/upload`, the same pipeline the web uploader uses.
 */

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(ROOT, '.pk-doc-cache');

// ── env ────────────────────────────────────────────────────────────────────────────
// The script is standalone, so it reads .env.local itself rather than relying on the
// Next runtime having loaded it.
function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvLocal();

// ── the corpus ─────────────────────────────────────────────────────────────────────
/**
 * `sourceType` is constrained by POST /api/documents/upload to the five values the US
 * uploader accepts. That validation is in a US route this build must not touch, so
 * Pakistani documents are mapped onto the nearest of the five and the real provenance
 * is carried in `jurisdiction` and `metadata`. The database column itself is plain
 * TEXT with no CHECK constraint, and `search_documents` never reads it.
 */
const DOCUMENTS = [
  // ── the two documents the assistant is asked about most ─────────────────────────
  {
    id: 'rules-2007',
    title: 'Rules of Procedure and Conduct of Business in the National Assembly, 2007',
    // NOT uploads/publications/rules_procedure.pdf — that path is a scan.
    url: 'https://na.gov.pk/uploads/documents/1539239593_412.pdf',
    sourceType: 'regulation',
    category: 'parliamentary_procedure',
    jurisdiction: 'Pakistan (Federal)',
    year: 2007,
    publisher: 'National Assembly of Pakistan',
  },
  {
    id: 'constitution-en',
    title: 'The Constitution of the Islamic Republic of Pakistan, 1973',
    url: 'https://www.pakp.gov.pk/wp-content/uploads/2024/07/Constitution.pdf',
    sourceType: 'federal_law',
    category: 'constitutional_law',
    jurisdiction: 'Pakistan (Federal)',
    year: 1973,
    publisher: 'Provincial Assembly of Khyber Pakhtunkhwa',
  },

  // ── conflict of interest: the provincial analogues ──────────────────────────────
  // These matter more than their size suggests. There is no federal conflict-of-
  // interest statute and no consolidated code of conduct for MNAs, so when the
  // assistant is asked about gifts or outside employment these two Acts are the only
  // enacted Pakistani law it can point at. Without them in the library the model has
  // nothing to ground "there is no federal rule, but two provinces have legislated".
  {
    id: 'kp-coi-2016',
    title: 'The Khyber Pakhtunkhwa Prevention of Conflict of Interest Act, 2016',
    url: 'https://kpcode.kp.gov.pk/uploads/2016_13_THE_KHYBER_PAKHTUNKHWA_PREVENTION_OFCONFLICT_OF_INTEREST_ACT_2016.pdf',
    sourceType: 'state_law',
    category: 'ethics_and_conflict_of_interest',
    jurisdiction: 'Khyber Pakhtunkhwa',
    year: 2016,
    publisher: 'Khyber Pakhtunkhwa Code',
  },
  {
    id: 'punjab-coi-2019',
    title: 'The Punjab Prevention of Conflict of Interest Act 2019 (Act V of 2019)',
    // punjablaws.gov.pk and punjablaws.punjab.gov.pk both refuse connections from
    // here (ECONNREFUSED on :443, not a 4xx — the host is down, not blocking us), and
    // the Punjab portal serves this Act as HTML rather than a PDF in any case. The
    // Internet Archive's April 2025 capture of the official page is the same text
    // from the same publisher, so it is ingested as HTML through the pipeline's
    // `content` path instead of the file path.
    kind: 'html',
    url: 'http://web.archive.org/web/20250402194602/http://punjablaws.gov.pk/laws//2727.html',
    fallbackUrls: [
      'http://punjablaws.gov.pk/laws/2727.html',
      'https://punjablaws.punjab.gov.pk/uploads/articles/act-xv-of-2019-pdf.pdf',
    ],
    sourceType: 'state_law',
    category: 'ethics_and_conflict_of_interest',
    jurisdiction: 'Punjab',
    year: 2019,
    publisher: 'Punjab Laws Online (via Internet Archive)',
  },

  // ── electoral and accountability framework ──────────────────────────────────────
  {
    id: 'elections-act-2017',
    title: 'The Elections Act, 2017',
    url: 'https://pakistancode.gov.pk/pdffiles/administratorf21c97fb85cfdc593f840a4c008caa45.pdf',
    sourceType: 'federal_law',
    category: 'electoral_law',
    jurisdiction: 'Pakistan (Federal)',
    year: 2017,
    publisher: 'The Pakistan Code',
  },
  {
    id: 'elections-amendment-2024',
    title: 'The Elections (Amendment) Act, 2024 (Act No. XI of 2024)',
    url: 'https://www.na.gov.pk/uploads/documents/668cde32235b3_548.pdf',
    sourceType: 'federal_law',
    category: 'electoral_law',
    jurisdiction: 'Pakistan (Federal)',
    year: 2024,
    publisher: 'National Assembly of Pakistan',
  },

  // ── how the Chair has actually ruled ────────────────────────────────────────────
  {
    id: 'rulings-1999-2017',
    title: 'Rulings of the Chair, National Assembly of Pakistan, 1999–2017',
    url: 'https://na.gov.pk/uploads/documents/Rulings-of-the-Chair-1999-2017.pdf',
    sourceType: 'case_law',
    category: 'parliamentary_procedure',
    jurisdiction: 'Pakistan (Federal)',
    year: 2017,
    publisher: 'National Assembly of Pakistan',
  },

  // ── Acts of the current tenure, from the NA's own index ─────────────────────────
  {
    id: 'act-finance-2026',
    title: 'The Finance Act, 2026 (Act No. XLIII of 2026)',
    url: 'https://na.gov.pk/uploads/documents/6a422720f05a0_626.pdf',
    sourceType: 'federal_law',
    category: 'public_finance',
    jurisdiction: 'Pakistan (Federal)',
    year: 2026,
    publisher: 'National Assembly of Pakistan',
  },
  {
    id: 'act-nab-amendment-2026',
    title: 'The National Accountability (Amendment) Act, 2026 (Act No. XIV of 2026)',
    url: 'https://na.gov.pk/uploads/documents/69aae3c34958b_411.pdf',
    sourceType: 'federal_law',
    category: 'accountability',
    jurisdiction: 'Pakistan (Federal)',
    year: 2026,
    publisher: 'National Assembly of Pakistan',
  },
  {
    id: 'act-crpc-amendment-2026',
    title: 'The Code of Criminal Procedure (Amendment) Act, 2026 (Act No. XXXVI of 2026)',
    url: 'https://na.gov.pk/uploads/documents/6a27b92def6c0_429.pdf',
    sourceType: 'federal_law',
    category: 'criminal_law',
    jurisdiction: 'Pakistan (Federal)',
    year: 2026,
    publisher: 'National Assembly of Pakistan',
  },
  {
    id: 'act-pemra-amendment-2026',
    title: 'The Pakistan Electronic Media Regulatory Authority (Amendment) Act, 2026 (Act No. XXIV of 2026)',
    url: 'https://na.gov.pk/uploads/documents/69d4e453c23cd_630.pdf',
    sourceType: 'federal_law',
    category: 'media_regulation',
    jurisdiction: 'Pakistan (Federal)',
    year: 2026,
    publisher: 'National Assembly of Pakistan',
  },
  {
    id: 'act-citizenship-amendment-2026',
    title: 'The Pakistan Citizenship (Amendment) Act, 2026 (Act No. XXVII of 2026)',
    url: 'https://na.gov.pk/uploads/documents/69ccf33119e8e_822.pdf',
    sourceType: 'federal_law',
    category: 'citizenship',
    jurisdiction: 'Pakistan (Federal)',
    year: 2026,
    publisher: 'National Assembly of Pakistan',
  },
  {
    id: 'act-fiscal-responsibility-2026',
    title: 'The Fiscal Responsibility and Debt Limitation (Amendment) Act, 2026 (Act No. XLI of 2026)',
    url: 'https://na.gov.pk/uploads/documents/6a3bac663218e_634.pdf',
    sourceType: 'federal_law',
    category: 'public_finance',
    jurisdiction: 'Pakistan (Federal)',
    year: 2026,
    publisher: 'National Assembly of Pakistan',
  },

  // ── what the House is actually doing this week ──────────────────────────────────
  {
    id: 'orders-of-the-day-2026-06-24',
    title: 'Orders of the Day, National Assembly, 24 June 2026',
    url: 'https://na.gov.pk/uploads/documents/Orders of the Day 24-06-2026.pdf',
    sourceType: 'regulation',
    category: 'parliamentary_business',
    jurisdiction: 'Pakistan (Federal)',
    year: 2026,
    publisher: 'National Assembly of Pakistan',
  },

  // ── Urdu ────────────────────────────────────────────────────────────────────────
  // Kept in the manifest even though both are rejected below, because the rejection
  // is the finding: every Urdu PDF on pakistancode.gov.pk is typeset in a legacy
  // InPage/ASCII-mapped font, so `pdf-parse` extracts thousands of characters that
  // contain not one character in the Arabic Unicode block — page numbers and
  // whitespace where the Urdu should be. They pass a naive chars/page check and would
  // ingest as pure noise. The Arabic-script Urdu the library actually holds comes from
  // the National Assembly's own Orders of the Day, which are properly Unicode.
  {
    id: 'rti-2017-ur',
    title: 'حق رسائی معلومات ایکٹ 2017 — Right of Access to Information Act, 2017 (Urdu)',
    url: 'https://pakistancode.gov.pk/pdffiles/administratorcurdua7f4f2b3b5b93d09a4aa0567.pdf',
    sourceType: 'federal_law',
    category: 'transparency',
    jurisdiction: 'Pakistan (Federal)',
    year: 2017,
    language: 'ur',
    publisher: 'The Pakistan Code (Urdu)',
  },
  {
    id: 'harassment-2010-ur',
    title: 'خواتین کو مقامِ کار پر ہراساں کرنے کے خلاف تحفظ کا ایکٹ 2010 — Protection Against Harassment of Women at the Workplace Act, 2010 (Urdu)',
    url: 'https://pakistancode.gov.pk/pdffiles/administratorcurdua7f4f2b3b5b93d09a4aa6757.pdf',
    sourceType: 'federal_law',
    category: 'workplace_rights',
    jurisdiction: 'Pakistan (Federal)',
    year: 2010,
    language: 'ur',
    publisher: 'The Pakistan Code (Urdu)',
  },

  // ── Islamic-law constitutional review: the corpus behind /pk/repugnancy ─────────
  //
  // Article 227 forbids the enactment of a law repugnant to the Injunctions of Islam.
  // Two bodies say what that means in practice: the Council of Islamic Ideology, which
  // ADVISES under Articles 229–230, and the Federal Shariat Court, which DECIDES under
  // Article 203D. A drafting tool must be able to quote them rather than reason about
  // them, so their published output is what goes in here.
  //
  // WHAT RESOLVED AND WHAT DID NOT — checked on the date of this commit:
  //
  //   cii.gov.pk                  UP, but serves an incomplete certificate chain, so
  //                               Node's `fetch` rejects it while `curl` accepts it.
  //                               Its /publications/ index is real and extensive —
  //                               ~120 titles — but every file is hosted on Google
  //                               Drive, not on the Council's own domain.
  //
  //   federalshariatcourt.gov.pk  DOWN. DNS resolves (203.124.43.226) and both :80 and
  //                               :443 time out with no response. The Internet
  //                               Archive's most recent capture, 8 November 2023,
  //                               is a single page reading "Website is under
  //                               Maintenance." There is therefore NO Federal Shariat
  //                               Court judgment available to ingest, from the Court
  //                               or from an archive. The repugnancy page states this
  //                               as a corpus gap rather than implying the Court has
  //                               said nothing.
  //
  //   pakistancode.gov.pk         UP. Its search form returns "No Records Found" for
  //                               every query issued outside a browser session, so
  //                               laws can only be reached by their obfuscated
  //                               permalinks. The Zakat and Ushr Ordinance was found
  //                               that way and has a clean text layer. The Enforcement
  //                               of Shari'ah Act 1991 and the Hudood Ordinances could
  //                               not be reached without the site's own search, and
  //                               are deliberately NOT guessed at.
  //
  // Of the Council's ~120 published titles only the three most recent annual reports
  // survive the gates below. See the note on MIN_WORD_HIT_RATE for why the rest do not.
  {
    id: 'cii-annual-2020-21',
    title: 'اسلامی نظریاتی کونسل، سالانہ رپورٹ 2020-21 — Council of Islamic Ideology, Annual Report 2020–21',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/1_h0k-5bQhBAGipK6r3_7e4oIMr4wTEla/view',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2021,
    language: 'ur',
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'cii-annual-2019-20',
    title: 'اسلامی نظریاتی کونسل، سالانہ رپورٹ 2019-20 — Council of Islamic Ideology, Annual Report 2019–20',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/1V-WwxYFczNDcoBlSKtngOie0JsfGXp4H/view',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2020,
    language: 'ur',
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'cii-annual-2018-19',
    title: 'اسلامی نظریاتی کونسل، سالانہ رپورٹ 2018-19 — Council of Islamic Ideology, Annual Report 2018–19',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/1xAqMExZiAEVew2IVS4r8k0hrlgHgPLqF/view?usp=sharing',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2019,
    language: 'ur',
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'zakat-ushr-1980',
    // Reached through the obfuscated permalink on pakistancode.gov.pk, because the
    // site's own search returns nothing to a non-browser client.
    title: 'The Zakat and Ushr Ordinance, 1980 (Ordinance No. XVIII of 1980)',
    url: 'https://pakistancode.gov.pk/pdffiles/administratorfd19eec0a97080f151dac2a8406dea88.pdf',
    sourceType: 'federal_law',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 1980,
    publisher: 'The Pakistan Code',
  },

  // ── refused, and kept here because the refusal is the finding ───────────────────
  // Each of these is a genuine Council publication that a naive ingester would accept.
  // Running `--verify` prints the measurement that rejects it. Do not "fix" them by
  // lowering a gate: a corpus of mis-mapped glyphs is worse than a smaller honest one,
  // because retrieval will still return it and it will still look like a citation.
  {
    id: 'cii-final-report-1839-1973',
    title: 'Council of Islamic Ideology, Final Report on Existing Laws 1839–1973',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/0B-rVUBSs5jBnUm54TDBFQ3RxVDg/view?usp=sharing&resourcekey=0-6R6-WhMq7MSSVMLM-ADAUA',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2008,
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'cii-86-reports-summary',
    title: 'اسلامی نظریاتی کونسل، پاکستان میں رائج قوانین (1976–2006) کا جائزہ — 86 رپورٹوں کا خلاصہ',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/0B-rVUBSs5jBncFRZdk5fT0c4Qmc/view?resourcekey=0-bKa4UCzEkEOvqu8f-j9Hiw',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2008,
    language: 'ur',
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'cii-islamization-vol-1',
    title: 'Council of Islamic Ideology, 1st Report on Islamization of Laws (Vol. I)',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/0B-rVUBSs5jBnakZPdF9kcE1fMzg/view?usp=sharing&resourcekey=0-Q76JzFHiVVGkVu7sD8-xpg',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 1981,
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'cii-govt-references',
    title: 'اسلامی نظریاتی کونسل، حکومتی استفسارات — Government References to the Council',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/13RjGcDPapTLPTRwT92T65TqO0w99XezC/view',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2019,
    language: 'ur',
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'cii-annual-2017-18',
    title: 'اسلامی نظریاتی کونسل، سالانہ رپورٹ 2017-18',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/1O2Sd2vSicG1duZZAUv84yn33PzrsqsGh/view',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2018,
    language: 'ur',
    publisher: 'Council of Islamic Ideology',
  },
  {
    id: 'cii-annual-2014-15',
    title: 'اسلامی نظریاتی کونسل، سالانہ رپورٹ 2014-15',
    kind: 'drive',
    url: 'https://drive.google.com/file/d/18-6GXqw3Lb5FY4FGVpLG1Q45Vc3A63MI/view',
    sourceType: 'regulation',
    category: 'islamic_law_review',
    jurisdiction: 'Pakistan (Federal)',
    year: 2015,
    language: 'ur',
    publisher: 'Council of Islamic Ideology',
  },

  // ── the ombudsman, which is where most constituent casework actually lands ──────
  // Last deliberately: at 1.6M extracted characters this is roughly ten times every
  // other document combined, and embeddings are generated one chunk at a time. Running
  // it last means the corpus the assistant is actually demoed against is complete long
  // before this finishes.
  {
    id: 'mohtasib-2024',
    title: 'Wafaqi Mohtasib (Federal Ombudsman) Annual Report 2024',
    url: 'https://mohtasib.gov.pk/SiteImage/Downloads/WMS%20Annual%20Report%202024_compressed.pdf',
    sourceType: 'regulation',
    category: 'ombudsman_and_redress',
    jurisdiction: 'Pakistan (Federal)',
    year: 2024,
    publisher: 'Wafaqi Mohtasib Secretariat',
  },
];

// ── size gate ──────────────────────────────────────────────────────────────────────
/**
 * The largest document the upload route can swallow in one piece.
 *
 * `saveDocumentChunks()` in lib/document-processor.ts inserts every chunk of a document
 * in a SINGLE `insert()` call. For the Constitution that is 843 rows of 1536-dimension
 * vectors and it completes. For the Council of Islamic Ideology's 2020–21 annual report
 * — 1.33M characters, 1,557 chunks, roughly 9.5MB of float payload — PostgREST answers:
 *
 *     canceling statement due to statement timeout
 *
 * The fix belongs in `saveDocumentChunks()`, which should insert in batches. That
 * function is shared with the US build and is not this build's to change, so instead a
 * document above this ceiling is uploaded as several parts, each a contiguous slice of
 * the SAME extracted text, each titled "(Part n of N)" and each carrying the same
 * `source_url`. Nothing is dropped and nothing is reordered; the reader sees which part
 * a citation came from, and can open the one original behind all of them.
 *
 * 380,000 characters lands around 450 chunks — comfortably under the 843 that is known
 * to complete, with room for the variation paragraph-based chunking introduces.
 */
const MAX_CHARS_PER_UPLOAD = 380_000;

/**
 * Split text into `parts` slices, cutting only at blank lines.
 *
 * Cutting mid-sentence would put half a recommendation at the end of one part and half
 * at the start of the next, and both halves would then be embedded as though they were
 * complete thoughts. Paragraph boundaries are where the chunker would have split anyway.
 */
function splitOnParagraphs(text, parts) {
  if (parts <= 1) return [text];
  const paragraphs = text.split(/\n\s*\n/);
  const target = Math.ceil(text.length / parts);
  const slices = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current.length >= target && slices.length < parts - 1) {
      slices.push(current);
      current = '';
    }
    current += paragraph + '\n\n';
  }
  if (current.trim()) slices.push(current);
  return slices;
}

// ── text-layer gate ────────────────────────────────────────────────────────────────
/**
 * A page of set legal text runs 1,500–3,000 characters. A scan runs 0–5 (page
 * furniture the producer happened to embed). 120 sits far enough above the noise floor
 * to catch a scan and far enough below real text to never reject a genuine document,
 * including sparse ones like an Orders of the Day sheet.
 */
const MIN_CHARS_PER_PAGE = 120;
const MIN_TOTAL_CHARS = 800;

/**
 * The second gate, and the one that is easy to forget.
 *
 * A chars/page floor catches scans. It does NOT catch the other failure this corpus is
 * full of: a PDF typeset in a legacy InPage or custom-mapped font. Those carry a real
 * text layer, so extraction "succeeds" and returns thousands of characters — but the
 * glyph-to-codepoint map is nonsense, and what comes out is digits, spaces and
 * punctuation with zero letters in any script. Every Urdu PDF on pakistancode.gov.pk
 * fails exactly this way. Embedding that produces chunks of page numbers.
 *
 * So require that a real share of the extracted characters are letters — Latin or
 * Arabic-script. Legal prose is well over half letters; a mis-mapped font is near zero.
 */
const MIN_LETTER_RATIO = 0.25;
const LETTERS = /[A-Za-z؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const URDU_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;

/**
 * The third gate, and the one the first two cannot do.
 *
 * The letter-ratio gate above was written against pakistancode.gov.pk's Urdu PDFs,
 * which extract to digits and whitespace. It does not survive contact with the Council
 * of Islamic Ideology's back catalogue, which fails a different way: those volumes are
 * Urdu typeset in a legacy InPage font whose glyphs are mapped onto the LATIN range.
 * `pdf-parse` returns hundreds of thousands of characters, most of them letters, and
 * the first two gates wave it straight through. What it actually looks like is this,
 * from the Council's own Final Report on Existing Laws:
 *
 *     ZsòÃc*CÃ±ÔÓ#Ö0*Îy ZsxM!*Š ‚Ñ:g7g^ Y2007-2008 )8241D9241|(
 *
 * 38% of those characters are letters. None of them are words. Embedded and indexed,
 * that document is retrieved against real questions and cited as though it said
 * something — the exact failure the letter-ratio gate was added to prevent, arriving
 * through a door the letter-ratio gate does not watch.
 *
 * So the last test is whether the text is made of WORDS. Prose in either language is
 * dense in a small closed set of function words: English legal text runs 25–40% of
 * tokens in `the/of/and/to/shall`, and Urdu runs 20–30% in `کے/کی/اور/میں/سے`. A
 * mis-mapped font scores under 6%, because its "words" are glyph accidents. Measured
 * across this corpus the two populations do not overlap and are not close:
 *
 *     Annual Report 2018-19  26.6%   OK      Annual Report 2014-15    3.7%   refused
 *     Annual Report 2019-20  27.0%   OK      86-report summary        5.2%   refused
 *     Annual Report 2020-21  24.0%   OK      Final Report 1839–1973   ~4%    refused
 *     Zakat & Ushr Ordinance 39.0%   OK      Introduction & Working   0.5%   refused
 *
 * 15% sits in the empty middle. The stop-word lists are deliberately tiny and
 * deliberately boring — this is a check for "is this language at all", not a language
 * identifier, and a longer list would only make it easier to tune a bad document past.
 */
const MIN_WORD_HIT_RATE = 0.15;

const EN_STOP = new Set([
  'the', 'of', 'and', 'to', 'in', 'a', 'is', 'shall', 'that', 'for', 'be', 'by', 'as',
  'on', 'it', 'or', 'with', 'which', 'this', 'are', 'not', 'has', 'have', 'was', 'an',
  'from', 'at', 'any', 'may', 'such',
]);

const UR_STOP = new Set([
  'کے', 'کی', 'اور', 'میں', 'سے', 'ہے', 'کا', 'پر', 'کو', 'نے', 'ہیں', 'یہ', 'جو',
  'کہ', 'ایک', 'بھی', 'اس', 'ان', 'گیا', 'کیا', 'ہو', 'تھا', 'لیے', 'طور', 'گئی',
]);

/** Share of whitespace-separated tokens that are common function words. */
function wordHitRate(text) {
  const tokens = text
    .toLowerCase()
    // Urdu punctuation (، ۔) splits words exactly as Latin punctuation does.
    .split(/[\s.,;:()[\]"'،۔]+/)
    .filter(Boolean);
  // Below this there is not enough text for the ratio to mean anything; the
  // total-chars gate has already dealt with documents that short.
  if (tokens.length < 200) return 1;
  let hits = 0;
  for (const token of tokens) {
    if (EN_STOP.has(token) || UR_STOP.has(token)) hits++;
  }
  return hits / tokens.length;
}

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const VERIFY_ONLY = flag('verify');
const FORCE = flag('force');
const ONLY = opt('only', null);
const BASE = opt('base', process.env.PK_INGEST_BASE || 'http://localhost:3103');

function supabase() {
  const url = process.env.ACTALYZE_SUPABASE_URL;
  const key = process.env.ACTALYZE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('ACTALYZE_SUPABASE_URL / ACTALYZE_SUPABASE_ANON_KEY not set');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Fetch a file the Council of Islamic Ideology publishes through Google Drive.
 *
 * The Council hosts nothing on cii.gov.pk itself — every one of the ~120 titles on its
 * publications page is a Drive link. Two things make that awkward:
 *
 *   1. Files above Drive's virus-scan threshold (all of these; they run 20–40MB) answer
 *      the first request with an HTML interstitial carrying a `confirm` token and a
 *      `uuid`, which must be echoed back on a second request WITH the cookie the first
 *      response set. `fetch` has no cookie jar, so this shells out to curl, which does.
 *   2. Files shared before 2021 additionally require the `resourcekey` from the sharing
 *      link. Without it Drive answers with a Google sign-in page rather than an error,
 *      so the failure looks like a 200 and has to be caught by sniffing for %PDF-.
 */
function driveDownload(id, resourcekey, destination) {
  const rk = resourcekey ? `&resourcekey=${resourcekey}` : '';
  const url = `https://drive.usercontent.google.com/download?id=${id}&export=download${rk}`;
  const script = `
set -e
JAR=$(mktemp); FIRST=$(mktemp)
curl -sL -c "$JAR" -A "${UA}" "${url}" -o "$FIRST"
if head -c 5 "$FIRST" | grep -q '%PDF-'; then cp "$FIRST" "${destination}"; exit 0; fi
CONFIRM=$(sed -n 's/.*name="confirm" value="\\([^"]*\\)".*/\\1/p' "$FIRST" | head -1)
UUID=$(sed -n 's/.*name="uuid" value="\\([^"]*\\)".*/\\1/p' "$FIRST" | head -1)
if [ -n "$CONFIRM" ] || [ -n "$UUID" ]; then
  curl -sL -b "$JAR" -A "${UA}" "${url}&confirm=$CONFIRM&uuid=$UUID" -o "${destination}"
else
  cp "$FIRST" "${destination}"
fi
`;
  execFileSync('bash', ['-c', script], { stdio: 'pipe' });
  return readFileSync(destination);
}

/** na.gov.pk, the provincial portals and Google Drive all 403 or divert a bare UA. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

async function download(doc) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const ext = doc.kind === 'html' ? 'html' : 'pdf';
  const cached = path.join(CACHE_DIR, `${doc.id}.${ext}`);
  if (existsSync(cached) && !flag('refetch')) {
    return { buffer: readFileSync(cached), url: doc.url, cached: true };
  }

  if (doc.kind === 'drive') {
    const id = (doc.url.match(/\/d\/([A-Za-z0-9_-]+)/) || [])[1];
    const resourcekey = (doc.url.match(/resourcekey=([A-Za-z0-9_-]+)/) || [])[1];
    if (!id) return { buffer: null, error: `${doc.url} → no Drive file id in URL` };
    try {
      const buffer = driveDownload(id, resourcekey, cached);
      if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        const head = buffer.subarray(0, 400).toString('latin1');
        const why = /accounts\.google\.com/.test(head)
          ? 'Drive answered with a sign-in page — the share link needs a resourcekey'
          : 'Drive answered with HTML rather than the file';
        return { buffer: null, error: `${doc.url} → ${why}` };
      }
      return { buffer, url: doc.url, cached: false };
    } catch (err) {
      return { buffer: null, error: `${doc.url} → ${err.message}` };
    }
  }

  const candidates = [doc.url, ...(doc.fallbackUrls || [])];
  const failures = [];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(120_000),
        headers: {
          // na.gov.pk and the provincial portals 403 a bare fetch UA.
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
          Accept: 'application/pdf,*/*',
        },
      });
      if (!res.ok) {
        failures.push(`${url} → HTTP ${res.status}`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (doc.kind !== 'html' && buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
        failures.push(`${url} → not a PDF (starts "${buffer.subarray(0, 16).toString('latin1').replace(/\s+/g, ' ')}")`);
        continue;
      }
      writeFileSync(cached, buffer);
      return { buffer, url, cached: false };
    } catch (err) {
      failures.push(`${url} → ${err.message}`);
    }
  }
  return { buffer: null, error: failures.join('; ') };
}

/** Strip an HTML page down to the legislative text it wraps. */
function htmlToText(buffer) {
  let s = buffer.toString('utf8');
  s = s.replace(/<(script|style|head|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(br|\/p|\/div|\/tr|\/h[1-6])[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ');
  // The Punjab portal emits cp1252 non-breaking spaces that arrive as U+FFFD runs.
  s = s.replace(/�/g, ' ');
  s = s.replace(/[ \t ]+/g, ' ').replace(/\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Extract and measure. Returns the decision, never throws. */
async function inspect(doc) {
  const { buffer, url, error, cached } = await download(doc);
  if (!buffer) return { ok: false, reason: `download failed — ${error}` };

  let text;
  let pages;

  if (doc.kind === 'html') {
    text = htmlToText(buffer);
    // No pagination to reason about; treat it as one page so the per-page gate
    // degenerates to the total-chars gate, which is the right test for HTML.
    pages = 1;
  } else {
    let parsed;
    try {
      parsed = await pdfParse(buffer);
    } catch (err) {
      return { ok: false, reason: `pdf-parse failed — ${err.message}` };
    }
    text = (parsed.text || '').trim();
    pages = parsed.numpages || 1;
  }

  const chars = text.length;
  const perPage = Math.round(chars / pages);
  const letters = (text.match(LETTERS) || []).length;
  const letterRatio = chars > 0 ? letters / chars : 0;
  const urduChars = (text.match(URDU_SCRIPT) || []).length;
  const wordRate = wordHitRate(text);
  const base = { pages, chars, perPage, letterRatio, wordRate, urduChars, bytes: buffer.length, resolvedUrl: url };

  if (chars < MIN_TOTAL_CHARS || perPage < MIN_CHARS_PER_PAGE) {
    return {
      ...base,
      ok: false,
      reason: `no text layer — ${chars} chars across ${pages} page(s) (${perPage}/page, floor ${MIN_CHARS_PER_PAGE}). Scanned images.`,
    };
  }

  if (letterRatio < MIN_LETTER_RATIO) {
    return {
      ...base,
      ok: false,
      reason:
        `text layer present but unreadable — ${chars} chars, only ${letters} are letters ` +
        `(${(letterRatio * 100).toFixed(1)}%, floor ${MIN_LETTER_RATIO * 100}%). ` +
        `Legacy non-Unicode font mapping; extraction yields digits and whitespace, not script.`,
    };
  }

  if (wordRate < MIN_WORD_HIT_RATE) {
    return {
      ...base,
      ok: false,
      reason:
        `letters but not words — only ${(wordRate * 100).toFixed(1)}% of tokens are common ` +
        `function words (floor ${MIN_WORD_HIT_RATE * 100}%). Legacy InPage font mapped onto the ` +
        `Latin range: extraction returns ${chars.toLocaleString()} characters of glyph accidents. ` +
        `Ingesting this would put a citeable-looking document of nonsense in the index.`,
    };
  }

  return { ...base, ok: true, text, buffer, cached };
}

async function existingTitles() {
  const { data, error } = await supabase()
    .from('documents')
    .select('id,title')
    .eq('is_active', true)
    .limit(1000);
  if (error) throw new Error(`could not list documents: ${error.message}`);
  return new Map((data || []).map((d) => [d.title, d.id]));
}

/**
 * Delete a document and its chunks.
 *
 * Chunks are removed explicitly: the checked-in schema declares the foreign key as
 * `ON DELETE CASCADE`, but the deployed database is not guaranteed to match it, and
 * orphaned chunks would remain searchable while the document they belong to had
 * vanished from the library — a retrieval citing a document nobody can open.
 */
async function removeDocument(documentId) {
  const db = supabase();
  const { error: chunkError } = await db.from('document_chunks').delete().eq('document_id', documentId);
  if (chunkError) throw new Error(`could not delete chunks: ${chunkError.message}`);
  const { error } = await db.from('documents').delete().eq('id', documentId);
  if (error) throw new Error(`could not delete document: ${error.message}`);
}

/**
 * POST the document to the upload route — through curl, not `fetch`.
 *
 * `fetch` was the obvious choice and it is the wrong one here, for a reason worth
 * recording because the failure is completely silent about its cause.
 *
 * The upload route generates embeddings one chunk at a time, inside the request, and
 * sends nothing at all until every chunk is done. The Council of Islamic Ideology's
 * annual reports run to about 1,700 chunks, which is fifteen to twenty minutes of
 * response headers not arriving. Node's `fetch` is undici, and undici enforces a
 * `headersTimeout` of 300 seconds that `AbortSignal.timeout` does not override and
 * cannot extend. At five minutes it aborts with the message "fetch failed" — no status,
 * no cause, nothing to distinguish it from the server being down.
 *
 * The server, meanwhile, has no idea the client left and keeps embedding. So the script
 * moved on to the next document and started a second upload, and two 1,700-chunk
 * documents embedding concurrently took the dev server out of memory. One misleading
 * error message, two failure modes.
 *
 * curl has no equivalent timeout and waits as long as `--max-time` allows, so the
 * script blocks until the route genuinely finishes and the documents are processed one
 * at a time as intended.
 */
function upload(doc, check, part) {
  const metadata = JSON.stringify({
    country: 'PK',
    pk_doc_id: part ? `${doc.id}-p${part.index}` : doc.id,
    publisher: doc.publisher,
    language: doc.language || (check.urduChars > 500 ? 'ur-en' : 'en'),
    source_url: check.resolvedUrl,
    pages: check.pages,
    extracted_chars: part ? part.text.length : check.chars,
    ...(part ? { part: part.index, part_count: part.total, whole_document_chars: check.chars } : {}),
    ingested_by: 'scripts/pk/ingest-documents.mjs',
  });

  const title = part ? `${doc.title} (Part ${part.index} of ${part.total})` : doc.title;

  const args = [
    '-s',
    '--max-time',
    '5400',
    '-X',
    'POST',
    '-F',
    `title=${title}`,
    '-F',
    `source_type=${doc.sourceType}`,
    '-F',
    `category=${doc.category}`,
    '-F',
    `jurisdiction=${doc.jurisdiction}`,
    '-F',
    `year=${doc.year}`,
    '-F',
    `metadata=${metadata}`,
  ];

  if (part) {
    // A part is text, not a file: it is a slice of what pdf-parse already extracted,
    // and re-uploading the whole PDF would make the route extract all of it again.
    const textFile = path.join(CACHE_DIR, `${doc.id}-p${part.index}.txt`);
    writeFileSync(textFile, part.text);
    args.push('-F', `content=<${textFile}`);
  } else if (doc.kind === 'html') {
    // `@` would attach a file; `<` sends its contents as a plain field value.
    const textFile = path.join(CACHE_DIR, `${doc.id}.txt`);
    writeFileSync(textFile, check.text);
    args.push('-F', `content=<${textFile}`);
  } else {
    const pdfFile = path.join(CACHE_DIR, `${doc.id}.pdf`);
    args.push('-F', `file=@${pdfFile};type=application/pdf;filename=${doc.id}.pdf`);
  }

  args.push(`${BASE}/api/documents/upload`);

  const raw = execFileSync('curl', args, { maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`upload route returned non-JSON: ${raw.slice(0, 200)}`);
  }
  if (body.error) throw new Error(body.error);
  return body;
}

/**
 * Stamp the chunk count onto the document row.
 *
 * The library page needs it, and there is no PK-owned documents API route in this
 * build — `/api/documents/list` is a US route and returns `metadata` verbatim, so
 * writing the count there is the one place the page can read it from without touching
 * a file this build does not own.
 */
async function stampChunkCount(documentId) {
  const db = supabase();
  const { count, error } = await db
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId);
  if (error) throw new Error(error.message);

  const { data: row } = await db.from('documents').select('metadata').eq('id', documentId).single();
  const metadata = { ...(row?.metadata || {}), chunk_count: count ?? 0 };
  const { error: upErr } = await db.from('documents').update({ metadata }).eq('id', documentId);
  if (upErr) throw new Error(upErr.message);
  return count ?? 0;
}

async function main() {
  const targets = ONLY ? DOCUMENTS.filter((d) => d.id === ONLY) : DOCUMENTS;
  if (targets.length === 0) {
    console.error(`No document matches --only=${ONLY}`);
    process.exit(1);
  }

  console.log(`\n📚 Pakistan document ingestion — ${targets.length} candidate(s)`);
  console.log(`   pipeline: POST ${BASE}/api/documents/upload`);
  console.log(
    `   gates: ${MIN_CHARS_PER_PAGE} chars/page, ${MIN_TOTAL_CHARS} chars total, ` +
      `${MIN_LETTER_RATIO * 100}% letters, ${MIN_WORD_HIT_RATE * 100}% function words\n`
  );

  const existing = VERIFY_ONLY ? new Map() : await existingTitles();
  const ingested = [];
  const skipped = [];

  for (const doc of targets) {
    process.stdout.write(`→ ${doc.id.padEnd(32)} `);

    const check = await inspect(doc);
    if (!check.ok) {
      console.log(`SKIP  ${check.reason}`);
      skipped.push({ id: doc.id, title: doc.title, reason: check.reason });
      continue;
    }

    console.log(
      `text OK  ${check.pages}pp  ${check.chars.toLocaleString()} chars  ${check.perPage}/page  ` +
        `${(check.letterRatio * 100).toFixed(0)}% letters  ${(check.wordRate * 100).toFixed(0)}% words` +
        (check.urduChars > 500 ? `  (${check.urduChars.toLocaleString()} Urdu)` : '')
    );

    if (VERIFY_ONLY) continue;

    // A document over the ceiling goes up as several parts. See MAX_CHARS_PER_UPLOAD.
    const partCount = Math.ceil(check.chars / MAX_CHARS_PER_UPLOAD);
    const slices =
      partCount > 1
        ? splitOnParagraphs(check.text, partCount).map((text, i, all) => ({
            index: i + 1,
            total: all.length,
            text,
          }))
        : [null];

    if (partCount > 1) {
      console.log(
        `  ↳ ${check.chars.toLocaleString()} chars exceeds the ${MAX_CHARS_PER_UPLOAD.toLocaleString()}-char ` +
          `single-insert ceiling — uploading as ${slices.length} parts`
      );
    }

    for (const part of slices) {
      const title = part ? `${doc.title} (Part ${part.index} of ${part.total})` : doc.title;
      const label = part ? `${doc.id} p${part.index}/${part.total}` : doc.id;

      if (existing.has(title)) {
        const id = existing.get(title);
        if (!FORCE) {
          const chunks = await stampChunkCount(id).catch(() => null);
          console.log(`  ↳ ${label}: already in library (${chunks ?? '?'} chunks) — pass --force to re-ingest`);
          ingested.push({ id: label, title, chunks, pages: check.pages, reused: true });
          continue;
        }
        // --force means replace, not add. Uploading over an existing title would leave
        // two copies of the same Act in the index, which silently doubles its weight in
        // every retrieval — and that is exactly how the Constitution ended up in the
        // library twice during this build.
        await removeDocument(id);
        console.log(`  ↳ ${label}: removed existing copy before re-ingesting`);
      }

      try {
        const started = Date.now();
        const result = await upload(doc, check, part);
        // The upload route answers `document_id`; the processor's own return value uses
        // `documentId`. Accept either so this does not break if the route is reshaped.
        const documentId = result.document_id || result.documentId || result.document?.id;
        if (!documentId) throw new Error(`upload returned no document id: ${JSON.stringify(result).slice(0, 200)}`);
        const chunks = await stampChunkCount(documentId);
        const secs = Math.round((Date.now() - started) / 1000);
        console.log(`  ↳ ${label}: ingested — ${chunks} chunks in ${secs}s`);
        ingested.push({ id: label, title, chunks, pages: check.pages });
      } catch (err) {
        console.log(`  ↳ ${label}: FAILED — ${err.message}`);
        skipped.push({ id: label, title, reason: `upload failed — ${err.message}` });
      }
    }
  }

  console.log(`\n─────────────────────────────────────────────`);
  console.log(`ingested/present : ${ingested.length}`);
  console.log(`skipped          : ${skipped.length}`);
  for (const s of skipped) console.log(`  · ${s.id}: ${s.reason}`);
  console.log('');
}

main().catch((err) => {
  console.error('\n💥', err);
  process.exit(1);
});
