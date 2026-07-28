import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { searchDocuments } from '@/lib/document-processor';
import { OPENROUTER_KEY } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Legislative assistant for the National Assembly of Pakistan.
 *
 * The retrieval half of this needed no changes at all. `documents.source_type` is a
 * plain TEXT column — the five-value enum exists only as a comment in the schema and
 * as validation inside the US upload route — and `search_documents` is pure pgvector
 * cosine, so it never touches the `to_tsvector('english')` GIN indexes that would
 * otherwise mangle Urdu. `text-embedding-3-large` embeds Urdu directly. So this route
 * calls `searchDocuments()` unchanged and the Urdu path works for free.
 *
 * What did have to change is everything above retrieval: the subject matter, the
 * answer language, and — most importantly — what the assistant is allowed to claim
 * exists.
 */

const openai = new OpenAI({
  apiKey: OPENROUTER_KEY || process.env.OPENAI_API_KEY!,
  baseURL: OPENROUTER_KEY ? 'https://openrouter.ai/api/v1' : undefined,
  defaultHeaders: OPENROUTER_KEY
    ? {
        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
        'X-Title': 'Actalyze Pakistan',
      }
    : undefined,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RetrievedChunk {
  content: string;
  document_title: string;
  document_category?: string;
  document_jurisdiction?: string;
  document_year?: number;
  similarity: number;
}

/**
 * Which language to answer in.
 *
 * The instruction "answer in the language of the question" is reliable on its own, but
 * only mostly — a two-word Urdu question with an English acronym in it ("ECP کیا ہے؟")
 * drifts to English often enough to be embarrassing in front of the person who asked.
 * Detecting the script here and stating the answer language as a fact removes the
 * judgement call from the model.
 *
 * The test is presence, not majority: Pakistani parliamentary Urdu is full of Latin
 * acronyms (NA, ECP, IMF, CNIC) and Western digits, so a majority test would misread
 * a genuinely Urdu question as English.
 */
const URDU_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

function answerLanguage(message: string): 'Urdu' | 'English' {
  return URDU_SCRIPT.test(message) ? 'Urdu' : 'English';
}

/**
 * The single most important paragraph in this file.
 *
 * Pakistan has no federal conflict-of-interest statute and no consolidated code of
 * conduct for members of the National Assembly. A model that has read the US House
 * Ethics Manual will happily produce a rupee-denominated gift limit on request, and a
 * Pakistani parliamentarian would spot the fabrication in the first sentence. There is
 * no gift limit to state, so the assistant states that there is none and then says
 * what does exist — which is a more useful answer than the invented one would have
 * been, because the gap is itself the finding.
 *
 * Every claim below was checked against the documents in the library:
 *   · Rule 70, Rules of Procedure 2007 — fifteen clear days notice for a question.
 *   · s.137 Elections Act 2017 — annual statement of assets and liabilities to the ECP.
 *   · KP Act XIII of 2016 and Punjab Act V of 2019 — recusal, post-employment and
 *     declaration duties for *provincial* public office holders. Neither contains the
 *     word "gift" at all, so neither may be cited as a gift rule.
 */
const CONFLICT_OF_INTEREST_BRIEF = `
NON-NEGOTIABLE — GIFTS, HOSPITALITY, OUTSIDE EMPLOYMENT AND LOBBYING:

Pakistan has NO federal conflict-of-interest statute and NO consolidated code of
conduct for members of the National Assembly. It follows that there is:
  - no federal gift limit or gift ceiling for MNAs, in rupees or any other unit;
  - no hospitality or travel-acceptance threshold;
  - no general ban on outside employment or paid directorships;
  - no lobbying registration or disclosure regime.

NEVER state, estimate, or "recall" a figure. There is no Pakistani equivalent of the
US House gift rule and inventing one is the single worst error you can make.

An answer to any such question is INCOMPLETE unless it contains ALL FOUR of the
following. Do not stop after the first one — "there is no rule" on its own is true but
useless, and the reader needs to know what fills the gap:

  1. THE GAP. No binding federal rule exists. Say it plainly and first.

  2. WHY IT IS STILL A GAP. A private member's bill on conflict of interest was
     introduced in 2016. It was referred to the standing committee, and the committee
     recommended that it not be passed. Nothing has been enacted federally since.

  3. THE PROVINCIAL ANALOGUES — always name both, by title:
       · the Khyber Pakhtunkhwa Prevention of Conflict of Interest Act 2016
         (Act XIII of 2016), and
       · the Punjab Prevention of Conflict of Interest Act 2019 (Act V of 2019).
     These are the only enacted conflict-of-interest legislation anywhere in Pakistan.
     CRITICAL: both bind PROVINCIAL public office holders, not MNAs, and NEITHER sets a
     gift limit — the word "gift" does not appear in either Act. They impose duties to
     recuse, to file a summary statement of interests and to observe post-employment
     restrictions, overseen by an ethics commission. Describe them accurately; do not
     let them stand in for a gift rule that does not exist.

  4. WHAT DOES BIND AN MNA, which is disclosure and disqualification rather than any
     acceptance limit: Article 62 and Article 63 of the Constitution (qualification and
     disqualification, including office of profit), and section 137 of the Elections
     Act 2017, which requires an annual statement of assets and liabilities to be filed
     with the Election Commission of Pakistan. Conduct inside the Chamber is governed by
     the Rules of Procedure and Conduct of Business in the National Assembly, 2007 —
     there is no ethics code above it.

Cite the library with [n] wherever one of these documents is the source of the claim.
`.trim();

function buildSystemPrompt(context: string, historyText: string, language: 'Urdu' | 'English'): string {
  return `You are the Actalyze legislative assistant for the National Assembly of Pakistan. You
serve members of the National Assembly and their staff. Your subject is Pakistani
legislation, parliamentary procedure and the machinery of the Pakistani state — the
National Assembly and the Senate, the Rules of Procedure and Conduct of Business in the
National Assembly 2007, the Constitution of the Islamic Republic of Pakistan, federal
Acts, the Election Commission of Pakistan, the Wafaqi Mohtasib, and the provincial
assemblies where the subject is a provincial one.

You are NOT a US politics assistant. Do not reason by analogy to Congress, and never
describe a US rule as though it applied in Pakistan.

ANSWER LANGUAGE — ${language.toUpperCase()}:
Answer in the language of the question. The user has asked in ${language}, so your
entire answer must be in ${language}.${
    language === 'Urdu'
      ? ` Write natural parliamentary Urdu, not transliteration and not
translated-sounding English. Keep proper nouns, constituency codes, acronyms (NA, ECP,
IMF, CNIC, NADRA) and numerals in Latin script and Western digits, exactly as Pakistani
newspapers and the National Assembly Secretariat print them.`
      : ''
  }

GROUNDING AND CITATION:
- The numbered documents below are the library. Prefer them over recollection.
- Cite with numbered brackets — [1], [2] — placed immediately after the claim they
  support. Reuse the same number for the same document.
- Quote the rule or section number when you have it: "Rule 70 requires fifteen clear
  days notice [1]" is worth far more to a member than a paraphrase.
- If the documents do not answer the question, say what they do and do not cover, then
  answer from general knowledge and make clear that you are doing so.
- Never apologise for the library's contents and never list document titles in the body
  text. Do NOT write a "References" or "Sources" section and do not restate the document
  titles at the end — the interface renders the numbered sources beneath your answer,
  with their jurisdiction and year. Your job is the prose and the inline [n] markers.

HONESTY ABOUT GAPS:
Where Pakistani law is silent, say so directly. "There is no such rule" is a correct and
valuable answer. Never fill a gap with a plausible-sounding number, deadline or
threshold. Never present a bill that was not passed as though it were law.

${CONFLICT_OF_INTEREST_BRIEF}

${context ? `LIBRARY DOCUMENTS:\n${context}\n` : 'LIBRARY DOCUMENTS: none matched this question.\n'}
${historyText ? `CONVERSATION SO FAR:\n${historyText}\n` : ''}`;
}

export async function POST(request: NextRequest) {
  try {
    // Public route, and every call spends embedding plus completion tokens.
    // Per-instance only — see lib/rate-limit.ts.
    const limited = checkRateLimit(request, 'pk-chat', { limit: 20, windowMs: 60_000 });
    if (limited) return limited;

    const { message, history = [] } = (await request.json()) as {
      message?: string;
      history?: ChatMessage[];
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const language = answerLanguage(message);

    // Retrieval is the unmodified US pipeline. A slightly wider net than the US route
    // because the Pakistani corpus is a handful of very long documents rather than
    // many short ones, so the useful chunks cluster inside one or two of them.
    const { results } = await searchDocuments(message, { limit: 8, threshold: 0.25 });
    const chunks = (results || []) as unknown as RetrievedChunk[];

    // Group by document so citation numbers are per-document, not per-chunk. A member
    // reading "[4]" should be able to go and open one thing.
    const byDocument = new Map<string, RetrievedChunk[]>();
    for (const chunk of chunks) {
      const title = chunk.document_title || 'Untitled';
      const list = byDocument.get(title);
      if (list) list.push(chunk);
      else byDocument.set(title, [chunk]);
    }

    const context = [...byDocument.entries()]
      .map(([title, docChunks], index) => {
        const first = docChunks[0];
        const meta = [
          first.document_jurisdiction && `Jurisdiction: ${first.document_jurisdiction}`,
          first.document_year && `Year: ${first.document_year}`,
          first.document_category && `Category: ${first.document_category}`,
        ]
          .filter(Boolean)
          .join(', ');
        const body = docChunks.map((c) => c.content).join('\n\n');
        return `[${index + 1}] ${title}${meta ? `\n(${meta})` : ''}\n\n${body}`;
      })
      .join('\n\n---\n\n');

    const historyText = history
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const sources = [...byDocument.entries()].map(([title, docChunks], index) => ({
      index: index + 1,
      title,
      jurisdiction: docChunks[0].document_jurisdiction ?? null,
      year: docChunks[0].document_year ?? null,
      relevance: Math.max(...docChunks.map((c) => c.similarity ?? 0)),
    }));

    const stream = await openai.chat.completions.create({
      model: OPENROUTER_KEY ? 'perplexity/sonar' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(context, historyText, language) },
        { role: 'user', content: message },
      ],
      max_tokens: 1800,
      // Low. This assistant is asked what a rule says; there is a right answer and
      // creative variation is only a way to get it wrong.
      temperature: 0.2,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

        try {
          for await (const part of stream) {
            const content = part.choices[0]?.delta?.content;
            if (content) send({ content });
          }

          // No plain-text reference list is appended. The US route does that because it
          // has nowhere else to put it; here the sources travel as structured data in
          // the `done` frame and the page renders them with jurisdiction and year, so
          // appending them to the prose as well would print every title twice.
          send({ done: true, language, sourcesUsed: chunks.length, sources });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('PK chat streaming error:', error);
          send({ error: 'Streaming failed' });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('PK chat API error:', error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
