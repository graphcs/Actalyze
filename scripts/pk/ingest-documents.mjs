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

async function download(doc) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const ext = doc.kind === 'html' ? 'html' : 'pdf';
  const cached = path.join(CACHE_DIR, `${doc.id}.${ext}`);
  if (existsSync(cached) && !flag('refetch')) {
    return { buffer: readFileSync(cached), url: doc.url, cached: true };
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
  const base = { pages, chars, perPage, letterRatio, urduChars, bytes: buffer.length, resolvedUrl: url };

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

async function upload(doc, check) {
  const form = new FormData();
  form.set('title', doc.title);
  form.set('source_type', doc.sourceType);
  form.set('category', doc.category);
  form.set('jurisdiction', doc.jurisdiction);
  form.set('year', String(doc.year));
  form.set(
    'metadata',
    JSON.stringify({
      country: 'PK',
      pk_doc_id: doc.id,
      publisher: doc.publisher,
      language: doc.language || (check.urduChars > 500 ? 'ur-en' : 'en'),
      source_url: check.resolvedUrl,
      pages: check.pages,
      extracted_chars: check.chars,
      ingested_by: 'scripts/pk/ingest-documents.mjs',
    })
  );

  if (doc.kind === 'html') {
    form.set('content', check.text);
  } else {
    form.set('file', new File([check.buffer], `${doc.id}.pdf`, { type: 'application/pdf' }));
  }

  const res = await fetch(`${BASE}/api/documents/upload`, {
    method: 'POST',
    body: form,
    // Embeddings are generated one chunk at a time inside the route, so a long
    // document legitimately holds the connection open for tens of minutes.
    signal: AbortSignal.timeout(3_600_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
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
  console.log(`   text-layer floor: ${MIN_CHARS_PER_PAGE} chars/page, ${MIN_TOTAL_CHARS} chars total\n`);

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
        `${(check.letterRatio * 100).toFixed(0)}% letters` +
        (check.urduChars > 500 ? `  (${check.urduChars.toLocaleString()} Urdu)` : '')
    );

    if (VERIFY_ONLY) continue;

    if (existing.has(doc.title)) {
      const id = existing.get(doc.title);
      if (!FORCE) {
        const chunks = await stampChunkCount(id).catch(() => null);
        console.log(`  ↳ already in library (${chunks ?? '?'} chunks) — pass --force to re-ingest`);
        ingested.push({ id: doc.id, title: doc.title, chunks, pages: check.pages, reused: true });
        continue;
      }
      // --force means replace, not add. Uploading over an existing title would leave
      // two copies of the same Act in the index, which silently doubles its weight in
      // every retrieval — and that is exactly how the Constitution ended up in the
      // library twice during this build.
      await removeDocument(id);
      console.log(`  ↳ removed existing copy before re-ingesting`);
    }

    try {
      const started = Date.now();
      const result = await upload(doc, check);
      // The upload route answers `document_id`; the processor's own return value uses
      // `documentId`. Accept either so this does not break if the route is reshaped.
      const documentId = result.document_id || result.documentId || result.document?.id;
      if (!documentId) throw new Error(`upload returned no document id: ${JSON.stringify(result).slice(0, 200)}`);
      const chunks = await stampChunkCount(documentId);
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(`  ↳ ingested — ${chunks} chunks in ${secs}s`);
      ingested.push({ id: doc.id, title: doc.title, chunks, pages: check.pages });
    } catch (err) {
      console.log(`  ↳ FAILED — ${err.message}`);
      skipped.push({ id: doc.id, title: doc.title, reason: `upload failed — ${err.message}` });
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
