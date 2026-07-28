/**
 * Turn one typed instruction into a complete notification intake.
 *
 * ── What the model is and is not asked to do ──────────────────────────────────────
 *
 * It does not write the notification. The notification is assembled deterministically by
 * `renderNotification()` from a fixed template grounded in real published notices, and
 * the model never sees that template. Its only job is to take a sentence an officer
 * typed — "solar net metering deadline moved to 31 March" — and split it into the
 * structured fields a clerk would otherwise have to phone up and ask for.
 *
 * That split is the entire value. The clarification loop the client described is not
 * caused by bad prose; it is caused by drafts arriving without an effective date, without
 * the power they are made under, and without saying who they bind. So the model fills a
 * form, the form is shown to the officer to correct, and the document is built from the
 * corrected form.
 *
 * ── The invented-authority rule ───────────────────────────────────────────────────
 *
 * `statutoryPower` is the one field the model must leave empty when it does not know.
 * A notification citing a section of an Act that does not confer the power — or does not
 * exist — is not a draft with a small error in it, it is void, and it is the kind of
 * error that ends a pilot. The prompt says so in as many words, the schema allows null,
 * and the UI marks the field as requiring the officer's confirmation whichever way it
 * comes back.
 *
 * Everything here is a DRAFT. Nothing is issued, nothing is sent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatCompletions } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  renderAll,
  referenceNumber,
  missingFields,
  urduIsReviewed,
  urduGaps,
  COMMON_DISTRIBUTION,
  type NoticeIntake,
} from '@/lib/pk/notice';

export const maxDuration = 60;

interface ExtractedFields {
  subject?: string;
  effect?: string;
  appliesTo?: string;
  effectiveFrom?: string | null;
  statutoryPower?: string | null;
  supersedes?: string | null;
  subjectUr?: string;
  effectUr?: string;
  appliesToUr?: string;
  suggestedDistribution?: string[];
}

const SYSTEM = `You prepare drafting inputs for a Government of the Punjab notification.

You are NOT writing the notification. A fixed official template does that. You are
filling in a form so that the officer does not get it back from a clerk with questions.

Return JSON only, with these keys:

  subject        A one-line title, under 90 characters, in the register of a government
                 notification. Not a headline, not a slogan.
                 **It must carry the operative value** — the new date, the new fee, the
                 new limit. The subject is what goes out as the SMS and the social post,
                 so a subject that says "Extension of deadline" without saying what the
                 deadline now is has told the citizen nothing they needed.
  effect         One or two sentences stating exactly what changes, in the operative
                 voice a notification uses. Include the old value and the new value where
                 the instruction implies a change from something.
  appliesTo      Who is bound by it. Be specific about categories of person or body.
                 A bare noun phrase, no leading capital unless it is a proper noun, and
                 no full stop — it is dropped into the middle of a sentence.
  effectiveFrom  ISO date (YYYY-MM-DD) if a commencement date is stated or clearly
                 implied, otherwise null for "at once".
  statutoryPower The provision the power comes from, e.g. "Section 23F of the ... Act,
                 1997". **Return null unless the instruction actually names it.** Never
                 guess a section number, an Act, or a year. A notification citing a power
                 that does not confer it is void. Null is the correct, expected answer.
  supersedes     Reference of anything replaced, or null.
  subjectUr      subject, in Urdu.
  effectUr       effect, in Urdu.
  appliesToUr    appliesTo, in Urdu.
  suggestedDistribution
                 Up to six offices that plainly need a copy given the subject matter,
                 drawn from this list only:
${COMMON_DISTRIBUTION.map((d) => `                   - ${d}`).join('\n')}

Urdu must be real Urdu prose, not transliteration, and must not leave English noun
phrases embedded in it. Use Urdu-Indic digits in the Urdu fields.`;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(request, 'pk-notice', { limit: 20, windowMs: 60_000 });
    if (limited) return limited;

    const body = (await request.json()) as {
      instruction?: string;
      /** Anything the officer has already filled in wins over the model. */
      overrides?: Partial<NoticeIntake>;
    };

    const instruction = body.instruction?.trim();
    if (!instruction) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }
    if (instruction.length > 4000) {
      return NextResponse.json({ error: 'instruction is too long' }, { status: 400 });
    }

    let extracted: ExtractedFields = {};
    let provider: string | null = null;

    // Returns null when no provider is configured. The route still works: the officer
    // gets the form with their instruction in the subject and fills it in themselves,
    // which is the same workflow minus the head start.
    const ai = chatCompletions({ webSearch: false });
    if (ai) {
      provider = ai.provider;
      const res = await fetch(ai.url, {
        method: 'POST',
        headers: ai.headers,
        body: JSON.stringify({
          model: ai.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: instruction },
          ],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const content = json?.choices?.[0]?.message?.content;
        if (content) {
          try {
            extracted = JSON.parse(content) as ExtractedFields;
          } catch {
            // A malformed response is not fatal: the officer still gets the form, with
            // their instruction in the subject, and fills it in themselves.
            console.warn('Notice extraction returned unparseable JSON');
          }
        }
      }
    }

    const o = body.overrides ?? {};

    /**
     * Defaults are the Secretariat's, not the model's. The reference number, station,
     * date and signatory are administrative facts about who is issuing, and asking a
     * model to invent them would produce a plausible-looking file number that collides
     * with a real one.
     */
    const intake: NoticeIntake = {
      subject: o.subject ?? extracted.subject ?? instruction.slice(0, 90),
      effect: o.effect ?? extracted.effect ?? instruction,
      appliesTo: o.appliesTo ?? extracted.appliesTo ?? '',
      effectiveFrom:
        o.effectiveFrom !== undefined ? o.effectiveFrom : (extracted.effectiveFrom ?? null),
      statutoryPower: o.statutoryPower ?? extracted.statutoryPower ?? undefined,
      supersedes: o.supersedes ?? extracted.supersedes ?? undefined,

      department: o.department ?? '',
      wing: o.wing ?? '',
      fileNumber: o.fileNumber ?? '',
      serial: o.serial ?? '',
      year: o.year ?? new Date().getUTCFullYear(),
      station: o.station ?? 'Lahore',
      dated: o.dated ?? today(),
      signatoryName: o.signatoryName ?? '',
      signatoryDesignation: o.signatoryDesignation ?? 'Section Officer',
      distribution:
        o.distribution ??
        (extracted.suggestedDistribution?.filter((d) => COMMON_DISTRIBUTION.includes(d)) ?? []),

      subjectUr: o.subjectUr ?? extracted.subjectUr,
      effectUr: o.effectUr ?? extracted.effectUr,
      appliesToUr: o.appliesToUr ?? extracted.appliesToUr,
      departmentUr: o.departmentUr,
      stationUr: o.stationUr,
      statutoryPowerUr: o.statutoryPowerUr,
      supersedesUr: o.supersedesUr,
      signatoryNameUr: o.signatoryNameUr,
      signatoryDesignationUr: o.signatoryDesignationUr,
      distributionUr: o.distributionUr,
    };

    const missing = missingFields(intake);

    return NextResponse.json({
      intake,
      missing,
      /** True where the model supplied a power. Either way the officer must confirm it. */
      statutoryPowerFromModel: Boolean(!o.statutoryPower && extracted.statutoryPower),
      urduReviewed: urduIsReviewed(intake),
      urduGaps: urduGaps(intake),
      reference: referenceNumber(intake),
      // Rendered on every response so the officer sees the document change as they
      // correct the form, rather than after a separate "generate" step.
      rendered: { en: renderAll(intake, 'en'), ur: renderAll(intake, 'ur') },
      meta: { provider },
    });
  } catch (error) {
    console.error('Notice draft error:', error);
    return NextResponse.json({ error: 'Failed to prepare the draft' }, { status: 500 });
  }
}
