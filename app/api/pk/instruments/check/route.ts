/**
 * Rule 78 admissibility checker.
 *
 * Rule 78 of the Rules of Procedure and Conduct of Business in the National Assembly,
 * 2007 lists twenty-two conditions — (a) to (v) — that a question must satisfy before the
 * Speaker will admit it. A notice that fails any of them comes back from the Secretariat,
 * and a member typically finds out days later, having burned one of the two starred
 * questions Rule 73 allows for that day.
 *
 * ── Why the word count is not asked of the model ────────────────────────────────────
 * Rule 78(f): "it shall not ordinarily exceed one hundred and fifty words."
 *
 * That is the only condition in Rule 78 that is pure arithmetic, and it is also the one
 * a member is most likely to trip. Asking an LLM to count words produces a confident,
 * plausible, wrong number — off by five or ten, every time, in either direction. So
 * condition (f) is decided by `countQuestionWords()` in lib/pk/instruments.ts and the
 * model is never shown the question's length at all. The other twenty-one conditions are
 * genuine judgement calls about tone, subject matter and justiciability, which is exactly
 * what a model is for.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatCompletions } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  RULE_78_CONDITIONS,
  RULE_78_WORD_LIMIT,
  countQuestionWords,
} from '@/lib/pk/instruments';

export const maxDuration = 60;

export interface ConditionVerdict {
  id: string;
  citation: string;
  textEn: string;
  textUr: string;
  /** true = satisfied, false = not satisfied. */
  pass: boolean;
  /** One short sentence saying why. Always present. */
  reasonEn: string;
  /** True for Rule 78(f), which was decided in code. */
  deterministic: boolean;
}

interface CheckRequest {
  /** The question text as it would be filed. */
  text?: string;
  /** Language for the model's reasons. The rule text itself is already translated. */
  locale?: 'en' | 'ur';
}

/** The conditions the model is asked to judge — everything except (f). */
const MODEL_CONDITIONS = RULE_78_CONDITIONS.filter((c) => !c.deterministic);

const SYSTEM_PROMPT = `You are a clerk in the National Assembly of Pakistan Secretariat applying Rule 78 of the Rules of Procedure and Conduct of Business in the National Assembly, 2007 to a question notice submitted by a Member.

You must decide, for each condition below, whether the question as drafted SATISFIES it. Be a strict but fair clerk: mark a condition as failed only where the text actually breaches it, not where a breach is merely conceivable. Most well-drafted questions satisfy most conditions — do not manufacture failures.

Conditions to assess:
${MODEL_CONDITIONS.map((c) => `${c.id}. [${c.citation}] ${c.textEn}`).join('\n')}

Guidance on the conditions that catch real questions most often:
- (c) is breached by argumentative or loaded framing: "the Government's shameful failure", "criminal negligence", "why has the Ministry been unable to". A question must ask for facts, not characterise them.
- (d) is breached by "does the Minister agree that…", "would it not be better if…", or any request for an opinion.
- (l) is breached where the figure asked for is already in a published budget document, annual report, gazette or on the Division's own website.
- (n) is breached by naming a newspaper or television channel, or by asking whether a press report is correct.
- (r) and (u) are breached where the specific matter is before a court, tribunal or commission of inquiry.
- (s) is breached where the question is really a demand dressed as a question: "will the Minister take steps to immediately restore…".
- (v) is breached where the subject is one on which the Federal and a Provincial Government are known to correspond — provincial subjects such as police, land records or school education raised as federal questions.

Return ONLY a JSON object of this exact shape, with one entry per condition id listed above:
{
  "results": [
    { "id": "a", "pass": true, "reason": "one short sentence" },
    { "id": "q(i)", "pass": true, "reason": "one short sentence" }
  ]
}

Every reason must be a single short sentence. Where a condition passes, say briefly why it is not engaged (e.g. "No newspaper is named."). Where it fails, quote the offending words.`;

/**
 * Language directive for the reasons.
 *
 * The rule text itself is translated in `RULE_78_CONDITIONS` and never comes from the
 * model. Only the per-condition reason is generated, so only that needs a language
 * instruction — and the offending words must stay in the language the member wrote them
 * in, because a translated quotation is no longer a quotation.
 */
const URDU_DIRECTIVE = `\n\nWrite every "reason" in Urdu (اردو), in natural Pakistani parliamentary register. Keep rule numbers, Latin acronyms, and any words you quote from the member's question in their original script — a quotation translated is no longer a quotation.`;

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(request, 'pk-instruments-check', {
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = (await request.json()) as CheckRequest;
    const { text } = body;
    const locale = body.locale === 'ur' ? 'ur' : 'en';

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    // ── Rule 78(f): decided here, in code, before anything else happens ────────────
    const wordCount = countQuestionWords(text);
    const overLimit = wordCount > RULE_78_WORD_LIMIT;
    const excess = wordCount - RULE_78_WORD_LIMIT;

    const wordCondition = RULE_78_CONDITIONS.find((c) => c.id === 'f')!;
    const fVerdict: ConditionVerdict = {
      id: wordCondition.id,
      citation: wordCondition.citation,
      textEn: wordCondition.textEn,
      textUr: wordCondition.textUr,
      pass: !overLimit,
      reasonEn:
        locale === 'ur'
          ? overLimit
            ? `یہ سوال ${wordCount} الفاظ پر مشتمل ہے، جو قاعدہ 78(f) کی ${RULE_78_WORD_LIMIT} الفاظ کی حد سے ${excess} الفاظ زائد ہے۔`
            : `یہ سوال ${wordCount} الفاظ پر مشتمل ہے، جو قاعدہ 78(f) کی ${RULE_78_WORD_LIMIT} الفاظ کی حد کے اندر ہے۔`
          : overLimit
            ? `This question is ${wordCount} words, exceeding the Rule 78(f) limit of ${RULE_78_WORD_LIMIT} by ${excess} ${excess === 1 ? 'word' : 'words'}.`
            : `This question is ${wordCount} words, within the Rule 78(f) limit of ${RULE_78_WORD_LIMIT}.`,
      deterministic: true,
    };

    const provider = chatCompletions();
    if (!provider) {
      // Still return the deterministic verdict — a word count does not need an LLM,
      // and a member checking length should not be blocked by a missing API key.
      return NextResponse.json({
        wordCount,
        wordLimit: RULE_78_WORD_LIMIT,
        overLimit,
        excess: overLimit ? excess : 0,
        conditions: [fVerdict],
        passedCount: overLimit ? 0 : 1,
        failedCount: overLimit ? 1 : 0,
        totalConditions: RULE_78_CONDITIONS.length,
        partial: true,
        note: 'No LLM provider configured — only the Rule 78(f) word count was checked.',
      });
    }

    const response = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          {
            role: 'system',
            content: locale === 'ur' ? SYSTEM_PROMPT + URDU_DIRECTIVE : SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Assess this question notice against each Rule 78 condition. Respond with JSON only.\n\n---\n${text.trim()}\n---`,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        // JSON mode. OpenRouter's Perplexity models reject response_format, so it is
        // only sent to OpenAI; the prompt asks for JSON either way and the parse below
        // tolerates a fenced response.
        ...(provider.provider === 'openai'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`Rule 78 check failed: ${response.status} ${detail.slice(0, 300)}`);
      // Degrade to the deterministic half rather than failing the whole screen.
      return NextResponse.json({
        wordCount,
        wordLimit: RULE_78_WORD_LIMIT,
        overLimit,
        excess: overLimit ? excess : 0,
        conditions: [fVerdict],
        passedCount: overLimit ? 0 : 1,
        failedCount: overLimit ? 1 : 0,
        totalConditions: RULE_78_CONDITIONS.length,
        partial: true,
        note: 'The model check was unavailable — only the Rule 78(f) word count was applied.',
      });
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';
    const cleaned = raw
      .replace(/^\s*```[a-z]*\n?/i, '')
      .replace(/```\s*$/, '')
      .trim();

    let parsed: { results?: Array<{ id?: string; pass?: boolean; reason?: string }> } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Rule 78 check: unparseable model response', cleaned.slice(0, 300));
    }

    const byId = new Map(
      (parsed.results ?? [])
        .filter((r) => typeof r?.id === 'string')
        .map((r) => [String(r.id), r])
    );

    // Rebuild the list in Rule 78's own order, so the UI reads down the rule as
    // printed rather than in whatever order the model happened to emit.
    const conditions: ConditionVerdict[] = RULE_78_CONDITIONS.map((cond) => {
      if (cond.deterministic) return fVerdict;

      const r = byId.get(cond.id);
      return {
        id: cond.id,
        citation: cond.citation,
        textEn: cond.textEn,
        textUr: cond.textUr,
        // Absence of a verdict is treated as "satisfied": a clerk does not reject a
        // notice on a condition nobody raised, and inventing a failure is worse than
        // missing one.
        pass: r?.pass !== false,
        reasonEn:
          r?.reason?.trim() ||
          (locale === 'ur'
            ? r
              ? 'اس شرط کے تحت کوئی خرابی سامنے نہیں آئی۔'
              : 'جانچ نہیں کی گئی۔'
            : r
              ? 'No issue identified under this condition.'
              : 'Not assessed.'),
        deterministic: false,
      };
    });

    const failedCount = conditions.filter((c) => !c.pass).length;

    return NextResponse.json({
      wordCount,
      wordLimit: RULE_78_WORD_LIMIT,
      overLimit,
      excess: overLimit ? excess : 0,
      conditions,
      passedCount: conditions.length - failedCount,
      failedCount,
      totalConditions: conditions.length,
      partial: false,
      provider: provider.provider,
    });
  } catch (error) {
    console.error('Rule 78 check error:', error);
    return NextResponse.json({ error: 'Admissibility check failed' }, { status: 500 });
  }
}

/** The rule text itself, so the page can render the conditions before any check runs. */
export async function GET() {
  return NextResponse.json({
    wordLimit: RULE_78_WORD_LIMIT,
    conditions: RULE_78_CONDITIONS,
    source:
      'Rules of Procedure and Conduct of Business in the National Assembly, 2007, rule 78',
    sourceUrl: 'https://na.gov.pk/uploads/documents/1539239593_412.pdf',
  });
}
