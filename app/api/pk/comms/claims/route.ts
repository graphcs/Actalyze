/**
 * Sort circulating claims into three buckets, and draft a reply only for the one bucket
 * that can carry a citation.
 *
 * ── What the model decides and what it cannot ─────────────────────────────────────
 *
 * The model proposes a bucket and, for `correctable`, the document it thinks contradicts
 * the claim. Everything after that is code:
 *
 *   - `enforce()` demotes `correctable` to `unverifiable` when no usable citation came
 *     back, and to `criticism` when the text carries an opinion marker. A prompt is a
 *     request; that function is the guarantee.
 *   - `draftReply()` returns null for every bucket except `correctable`, and null even
 *     there without a citation. There is no code path that produces a reply to an
 *     opinion.
 *
 * The asymmetry is deliberate. A claim wrongly filed as criticism costs a correction
 * nobody made. A claim wrongly filed as correctable produces a government telling a
 * citizen that their opinion is factually false — which is the failure that ends a
 * pilot, and the one this whole feature is shaped around avoiding.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatCompletions } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  enforce, draftReply, bucketCounts, readsAsOpinion,
  type Claim, type ClaimBucket,
} from '@/lib/pk/claims';
import { allSchemes, formatAllocation, progressLine } from '@/lib/pk/schemes';

export const maxDuration = 60;

/**
 * The documents the classifier is allowed to cite.
 *
 * Without this the model has nothing to check against, and it correctly refuses
 * everything — the first live run returned zero `correctable` out of six statements,
 * including two that the scheme register plainly contradicts. That is the right
 * behaviour from a model with no evidence, and the wrong outcome for the feature.
 *
 * So the register is handed over as the document set, in full and as structured facts
 * rather than prose. A correction can then quote a real ADP number and a real delivery
 * figure, which is the whole standard: a correction that cannot name its source is just
 * a louder claim.
 *
 * This is also why the scheme data being illustrative matters and is labelled
 * everywhere. In production these citations are as good as the department's own
 * register, because that is what they will be.
 */
function documentSet(): string {
  return allSchemes()
    .map((s) =>
      // Each record ends in one quotable sentence, because whatever the model puts in
      // `excerpt` is what a citizen reads in the reply. Handing it labelled fields
      // produced 'delivery: 31 of 48 filtration plants (status: ongoing)' inside a
      // public correction — traceable, but not a sentence anyone would publish.
      [
        `- "${s.titleEn}" (ADP scheme ${s.adpNumber}, ${s.department} Department)`,
        `  districts: ${s.districts.join(', ')}`,
        `  QUOTE THIS: Under ADP scheme ${s.adpNumber}, ${formatAllocation(s.allocationPkr, 'en')} was allocated and ${progressLine(s, 'en')} have been delivered to date.`,
      ].join('\n')
    )
    .join('\n');
}

const SYSTEM = `You sort statements circulating about a provincial government in Pakistan.

Return JSON: { "claims": [ { "id", "text", "bucket", "rationale", "citation" } ] }

bucket is exactly one of:

  "correctable"   The statement asserts a fact, AND you can name a specific public
                  document that contradicts it — a notification, an SRO, an Act, a
                  budget line, a published scheme record. Only use this when you can
                  supply the citation. Believing something is false is not enough.

  "criticism"     Opinion, judgement, complaint, demand, prediction, or rhetorical
                  question. "The government should have acted sooner", "this scheme is a
                  failure", "why is nothing being done" — all criticism. A document
                  cannot contradict an opinion.
                  **This is the expected answer for most political speech.** It is not a
                  failure mode and not a fallback. Use it freely.

  "unverifiable"  Asserts a fact, but you cannot name a document either way.

citation, for "correctable" only, otherwise null:
  { "title", "locator", "excerpt", "url" }
  excerpt must be text you are confident appears in that document. If you are not
  confident, return bucket "unverifiable" and citation null instead. Never invent a
  notification number, an SRO number, or a figure.

rationale: one sentence, in plain words, on why it landed in that bucket.

Sorting a criticism into "correctable" is a serious error: it produces a government
telling a citizen their opinion is factually wrong. When in doubt, choose "criticism".

THE DOCUMENTS YOU MAY CITE — these and nothing else. If a statement is contradicted by
one of these records, that is a "correctable" and the citation must be that record: use
its title as given, put the ADP number in locator, and copy the record's QUOTE THIS
sentence verbatim into excerpt. If none of them bears on the statement, it is
"unverifiable" — do not cite a document you were not given.

${documentSet()}`;

interface ModelClaim {
  id?: string;
  text?: string;
  bucket?: string;
  rationale?: string;
  citation?: { title?: string; locator?: string; excerpt?: string; url?: string } | null;
}

const BUCKETS: ClaimBucket[] = ['correctable', 'criticism', 'unverifiable'];

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(request, 'pk-claims', { limit: 15, windowMs: 60_000 });
    if (limited) return limited;

    const body = (await request.json()) as {
      statements?: Array<{ text: string; source?: string; url?: string }>;
      office?: { en: string; ur: string };
    };

    const statements = (body.statements ?? []).filter((s) => s?.text?.trim()).slice(0, 25);
    if (!statements.length) {
      return NextResponse.json({ error: 'statements are required' }, { status: 400 });
    }

    const office = body.office ?? {
      en: 'Government of the Punjab',
      ur: 'حکومتِ پنجاب',
    };

    let claims: Claim[] = [];
    let provider: string | null = null;

    const ai = chatCompletions({ webSearch: false });
    if (ai) {
      provider = ai.provider;
      const res = await fetch(ai.url, {
        method: 'POST',
        headers: ai.headers,
        body: JSON.stringify({
          model: ai.model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: JSON.stringify(
                statements.map((s, i) => ({ id: `c${i + 1}`, text: s.text }))
              ),
            },
          ],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content) as { claims?: ModelClaim[] };
            claims = (parsed.claims ?? []).map((c, idx) => {
              const original = statements[idx];
              const bucket = BUCKETS.includes(c.bucket as ClaimBucket)
                ? (c.bucket as ClaimBucket)
                : 'unverifiable';
              return enforce({
                id: c.id ?? `c${idx + 1}`,
                text: c.text ?? original?.text ?? '',
                source: original?.source,
                url: original?.url,
                bucket,
                rationale: c.rationale ?? '',
                citation:
                  c.citation && c.citation.title && c.citation.excerpt
                    ? {
                        title: c.citation.title,
                        locator: c.citation.locator,
                        excerpt: c.citation.excerpt,
                        url: c.citation.url,
                      }
                    : null,
              });
            });
          } catch {
            console.warn('Claim classification returned unparseable JSON');
          }
        }
      }
    }

    /**
     * No provider, or nothing parsed: everything becomes unverifiable.
     *
     * Not `criticism`, which would silently reclassify factual claims as opinion, and
     * certainly not `correctable`. "We could not check this" is the honest degradation.
     */
    if (!claims.length) {
      claims = statements.map((s, i) =>
        enforce({
          id: `c${i + 1}`,
          text: s.text,
          source: s.source,
          url: s.url,
          bucket: readsAsOpinion(s.text) ? 'criticism' : 'unverifiable',
          rationale: provider
            ? 'The classifier did not return a usable answer for this statement.'
            : 'No classifier is configured, so this has not been checked against any document.',
          citation: null,
        })
      );
    }

    const withReplies = claims.map((c) => ({
      ...c,
      reply: {
        en: draftReply(c, office, 'en'),
        ur: draftReply(c, office, 'ur'),
      },
    }));

    return NextResponse.json({
      claims: withReplies,
      counts: bucketCounts(claims),
      office,
      meta: { provider, statementsReceived: statements.length },
    });
  } catch (error) {
    console.error('Claims error:', error);
    return NextResponse.json({ error: 'Failed to classify' }, { status: 500 });
  }
}
