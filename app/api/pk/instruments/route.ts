import { NextRequest, NextResponse } from 'next/server';
import { chatCompletions } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  getInstrument,
  countQuestionWords,
  RULE_78_WORD_LIMIT,
} from '@/lib/pk/instruments';
import { getConstituency } from '@/lib/pk/constituencies';

export const maxDuration = 60;

interface DraftRequest {
  instrumentId?: string;
  subject?: string;
  /** Official designation of the Division, e.g. "Poverty Alleviation and Social Safety". */
  division?: string;
  memberName?: string;
  /** e.g. "NA-127" — used to ground the draft in a real constituency. */
  constituency?: string;
  /** Interface language; only affects the three communications formats. */
  locale?: 'en' | 'ur';
}

export async function POST(request: NextRequest) {
  try {
    // Public route, and every call spends tokens. Per-instance only — see lib/rate-limit.ts.
    const limited = checkRateLimit(request, 'pk-instruments', {
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = (await request.json()) as DraftRequest;
    const { instrumentId, subject, division, memberName, constituency } = body;
    const locale = body.locale === 'ur' ? 'ur' : 'en';

    if (!instrumentId || !subject?.trim()) {
      return NextResponse.json(
        { error: 'instrumentId and subject are required' },
        { status: 400 }
      );
    }

    const instrument = getInstrument(instrumentId);
    if (!instrument) {
      return NextResponse.json({ error: 'Unknown instrument' }, { status: 400 });
    }

    const provider = chatCompletions();
    if (!provider) {
      return NextResponse.json(
        { error: 'No LLM provider is configured' },
        { status: 500 }
      );
    }

    // Ground the draft in the real seat where the code resolves, so the model does not
    // invent a district. `getConstituency` is the shared foundation lookup.
    const seat = constituency ? getConstituency(constituency) : undefined;

    const memberLine =
      memberName?.trim() ||
      seat?.memberName ||
      '<Member name>';

    const seatContext = seat
      ? `The member sits for ${seat.code}${seat.name ? ` (${seat.name})` : ''}${
          seat.districts.length ? `, district ${seat.districts.join(' and ')}` : ''
        }${seat.provinceNameEn ? `, ${seat.provinceNameEn}` : ''}.`
      : constituency
        ? `The member sits for ${constituency}.`
        : '';

    // Notices are drafted in English (the form printed in the Orders of the Day);
    // the three communications formats follow the interface language. See
    // DRAFT_LANGUAGE_NOTE in lib/pk/instruments.ts.
    const languageDirective = instrument.isNotice
      ? 'Write the notice in English.'
      : locale === 'ur'
        ? 'Write in Urdu (اردو). Use natural Pakistani Urdu, not a literal translation of English. Keep constituency codes, figures and Latin acronyms in Latin script.'
        : 'Write in English.';

    const systemPrompt = [
      instrument.systemPrompt,
      '',
      '## Required form',
      instrument.formatGuidance,
      '',
      '## Procedural constraints this notice must satisfy',
      ...instrument.constraints.map((c) => `- ${c.rule}: ${c.textEn}`),
      '',
      languageDirective,
      '',
      'Substitute the real member name, Division and constituency given below into the placeholders. Do not leave angle-bracket placeholders in the output unless the value genuinely was not supplied.',
    ].join('\n');

    const userPrompt = [
      `Subject: ${subject.trim()}`,
      division?.trim()
        ? `Minister / Division addressed: Minister for ${division.trim()}`
        : 'Minister / Division addressed: choose the correct Federal Division for this subject and name it by its official designation.',
      `Member name: ${memberLine}`,
      seatContext,
      instrument.wordLimit
        ? `HARD LIMIT: the question text must be at most ${instrument.wordLimit} words (Rule 78(f)). Count as you write and stay comfortably under it — aim for 90 to 130 words.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1400,
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`PK instruments draft failed: ${response.status} ${detail.slice(0, 300)}`);
      return NextResponse.json({ error: 'Drafting failed' }, { status: 502 });
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '';

    // Models occasionally wrap output in a fence despite being told not to.
    const draft = raw
      .replace(/^\s*```[a-z]*\n?/i, '')
      .replace(/```\s*$/, '')
      .trim();

    if (!draft) {
      return NextResponse.json({ error: 'Empty draft returned' }, { status: 502 });
    }

    // The word count is arithmetic, so it is done here and never asked of the model.
    const wordCount = instrument.wordLimit ? countQuestionWords(draft) : undefined;

    return NextResponse.json({
      instrumentId: instrument.id,
      draft,
      wordCount,
      wordLimit: instrument.wordLimit ?? null,
      overWordLimit:
        wordCount !== undefined && instrument.wordLimit
          ? wordCount > instrument.wordLimit
          : false,
      ruleCitation: instrument.ruleCitation,
      ruleRange: instrument.ruleRange,
      noticeDays: instrument.noticeDays,
      clearDays: instrument.clearDays,
      perSittingLimit: instrument.perSittingLimit,
      isQuestion: instrument.isQuestion,
      constraints: instrument.constraints,
      rule78WordLimit: RULE_78_WORD_LIMIT,
      provider: provider.provider,
    });
  } catch (error) {
    console.error('PK instruments draft error:', error);
    return NextResponse.json({ error: 'Drafting failed' }, { status: 500 });
  }
}
