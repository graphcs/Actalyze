/**
 * Question-hour intelligence API.
 *
 * Everything served here comes out of `data/pk/questions.json`, which is extracted
 * verbatim from the National Assembly's own question papers by
 * `scripts/pk/ingest-questions.mjs`. No model is called and nothing is generated: a
 * question or a reply is either in a published paper or it is not returned.
 *
 * ── Why the search runs here and not in the page ──────────────────────────────────
 * The index is ~1.8 MB of question and reply text. Importing it into a client component
 * would put all of it into the JavaScript bundle so that a member could type three words
 * into a search box. It stays on the server; the page fetches hits.
 *
 * This is also the shape `/pk/instruments` needs when the Rule 78 checker is extended to
 * cover condition (j) — "shall not repeat in substance questions … already answered" —
 * which is the one condition in Rule 78 that cannot be judged from the draft alone. It
 * needs the record of what has already been asked, and that is `POST` below.
 *
 *   GET  /api/pk/questions?q=passport%20office&ministry=Interior&limit=10
 *   GET  /api/pk/questions?view=ministries
 *   GET  /api/pk/questions?view=facets
 *   GET  /api/pk/questions?view=coverage
 *   POST /api/pk/questions  { "draft": "...", "ministry": "...", "sessionNumber": 28 }
 *
 * Read-only and cheap, so it is not rate limited — unlike the drafting routes, which
 * spend tokens per call.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkAlreadyAsked,
  facets,
  ministryBreakdown,
  questionIndex,
  searchQuestions,
} from '@/lib/pk/question-papers';

/** `natural`-free, filesystem-free, but the JSON import needs the Node runtime. */
export const runtime = 'nodejs';

/**
 * What the coverage statement has to say, everywhere it is shown.
 *
 * A search that finds nothing means one of two things — nobody has asked it, or the
 * paper it was asked in is not in this index — and those have opposite consequences for
 * a member about to file. So every response carries what was ingested and what was
 * refused, with the reason.
 */
function coverage() {
  return {
    generatedAt: questionIndex.generatedAt,
    source: questionIndex.source,
    tenure: questionIndex.tenure,
    sittingsIngested: questionIndex.sittingsIngested,
    sittingsListed: questionIndex.sittingsListed,
    sessionsInArchive: questionIndex.sessionsInArchive,
    questionCount: questionIndex.questionCount,
    replyCount: questionIndex.replyCount,
    sittings: questionIndex.sittings,
    skipped: questionIndex.skipped,
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const view = params.get('view');

    if (view === 'coverage') {
      return NextResponse.json({ coverage: coverage() });
    }
    if (view === 'ministries') {
      return NextResponse.json({ ministries: ministryBreakdown(), coverage: coverage() });
    }
    if (view === 'facets') {
      return NextResponse.json({ ...facets(), coverage: coverage() });
    }

    const starredParam = params.get('starred');
    const result = searchQuestions({
      q: params.get('q') ?? undefined,
      ministry: params.get('ministry') ?? undefined,
      member: params.get('member') ?? undefined,
      session: params.get('session') ?? undefined,
      starred: starredParam === 'true' ? true : starredParam === 'false' ? false : null,
      limit: Number(params.get('limit') ?? 20),
      offset: Number(params.get('offset') ?? 0),
    });

    return NextResponse.json({
      total: result.total,
      hits: result.hits,
      coverage: coverage(),
    });
  } catch (error) {
    console.error('[pk/questions] search failed:', error);
    return NextResponse.json({ error: 'Question search failed' }, { status: 500 });
  }
}

interface DuplicateRequest {
  /** The question as it would be filed. */
  draft?: string;
  /** Division the draft addresses, if known — sharpens the match. */
  ministry?: string | null;
  /** Session the draft is for. Sets the Rule 78(j) window: this session and the two before it. */
  sessionNumber?: number | null;
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DuplicateRequest;
    const draft = (body.draft ?? '').trim();

    if (draft.length < 12) {
      return NextResponse.json(
        { error: 'draft is required and must be a question, not a fragment' },
        { status: 400 }
      );
    }

    const result = checkAlreadyAsked(draft, {
      ministry: body.ministry ?? null,
      sessionNumber: body.sessionNumber ?? null,
      limit: body.limit ?? 5,
    });

    return NextResponse.json({ ...result, coverage: coverage() });
  } catch (error) {
    console.error('[pk/questions] duplicate check failed:', error);
    return NextResponse.json({ error: 'Duplicate check failed' }, { status: 500 });
  }
}
