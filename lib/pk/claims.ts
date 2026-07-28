/**
 * Claims circulating about the government, sorted into three buckets.
 *
 * ── The middle bucket is why this file exists ─────────────────────────────────────
 *
 * It would be trivial to build a tool that takes anything critical of the government and
 * produces a rebuttal. It would also be the thing that gets this product, and the
 * government using it, into the newspapers — because governments do not get into trouble
 * for correcting falsehoods, they get into trouble for treating disagreement as
 * disinformation.
 *
 * So the classifier has three outcomes and the middle one is a first-class result, not a
 * fallback:
 *
 *   `correctable`  A factual assertion contradicted by a document we can name. This is
 *                  the only bucket that produces a reply, and the reply must quote the
 *                  document.
 *   `criticism`    An opinion, a judgement, a complaint, or a prediction. Logged for the
 *                  department so somebody reads it. **No reply is drafted, ever.** A
 *                  correction aimed at an opinion is a government arguing with a citizen
 *                  about whether they are allowed to be unhappy.
 *   `unverifiable` A factual assertion we have no document either way on. Flagged so an
 *                  official can check it. Silence is the correct output.
 *
 * The count of each is shown on screen. A day where the criticism bucket is the largest
 * is the normal case, and a product that hid that would be lying about the country.
 *
 * ── The citation rule ─────────────────────────────────────────────────────────────
 *
 * `correctable` requires `citation` to be non-empty. `draftReply()` returns null without
 * one, whatever the classifier said. An uncited correction from a government account is
 * just a louder claim, and it invites the reply "says who" — which is a worse position
 * than saying nothing.
 */

export type ClaimBucket = 'correctable' | 'criticism' | 'unverifiable';

export interface Citation {
  /** What the document is called, as it would be cited. */
  title: string;
  /** The specific provision, paragraph or figure relied on. */
  locator?: string;
  /** Verbatim from the document. Never paraphrase into this field. */
  excerpt: string;
  url?: string;
}

export interface Claim {
  id: string;
  /** The claim as it is circulating, quoted. */
  text: string;
  source?: string;
  url?: string;
  bucket: ClaimBucket;
  /** One sentence on why it landed in that bucket. Shown to the officer. */
  rationale: string;
  citation: Citation | null;
}

export const BUCKET_ORDER: ClaimBucket[] = ['correctable', 'criticism', 'unverifiable'];

export const BUCKET_LABEL = {
  correctable: {
    en: 'Contradicted by a document',
    ur: 'دستاویز سے متصادم',
    noteEn: 'A factual assertion a named document contradicts. These are the only ones a reply is drafted for.',
    noteUr: 'ایسا دعویٰ جس کی تردید کوئی نامزد دستاویز کرتی ہے۔ صرف اِنہی کے لیے جواب تیار کیا جاتا ہے۔',
  },
  criticism: {
    en: 'Criticism — not for correction',
    ur: 'تنقید — تردید کے لیے نہیں',
    noteEn:
      'Opinion, judgement or complaint. Passed to the department to read. No reply is drafted: a government correcting an opinion is arguing that a citizen may not hold it.',
    noteUr:
      'رائے، تنقید یا شکایت۔ متعلقہ محکمے کے مطالعے کے لیے۔ کوئی جواب تیار نہیں کیا جاتا: رائے کی تردید کرنا شہری کے حقِ رائے پر اعتراض ہے۔',
  },
  unverifiable: {
    en: 'Unverifiable',
    ur: 'ناقابلِ تصدیق',
    noteEn: 'A factual assertion with no document either way. Flagged for checking. Silence is the correct output.',
    noteUr: 'ایسا دعویٰ جس کے حق یا خلاف کوئی دستاویز موجود نہیں۔ تصدیق کے لیے نشان زد۔ خاموشی ہی درست جواب ہے۔',
  },
} as const;

/**
 * Phrasings that mark a statement as opinion rather than assertion of fact.
 *
 * Deliberately generous. A claim wrongly sent to `criticism` costs a correction that
 * could have been made; a claim wrongly sent to `correctable` produces a government
 * telling a citizen their opinion is factually false, which is the failure that ends
 * pilots. The asymmetry is intentional and this list is the thumb on the scale.
 */
const OPINION_MARKERS = [
  /\b(should|shouldn'?t|ought to|must)\b/i,
  /\b(i think|we think|in my (?:view|opinion)|imo|feels? like|seems? to me)\b/i,
  /\b(useless|corrupt|incompetent|shameful|disgrace|disaster|failure|pathetic|hopeless)\b/i,
  /\b(better|worse|worst|best)\b/i,
  /\b(why (?:is|are|does|do|can'?t|won'?t))\b/i,
  /\b(need to|needs to|demand|resign|step down)\b/i,
  /\b(will (?:fail|collapse|never)|going to (?:fail|collapse))\b/i,
  /(چاہیے|ہونا چاہیے|نااہل|ناکام|شرمناک|استعفیٰ|بہتر ہوتا|کیوں نہیں)/,
];

/**
 * True where the text reads as opinion.
 *
 * Exported because the classifier prompt is not the only guard: a model that returns
 * `correctable` for a sentence carrying an opinion marker is overruled. A prompt is a
 * request; this is the check.
 */
export function readsAsOpinion(text: string): boolean {
  return OPINION_MARKERS.some((p) => p.test(text));
}

/**
 * Force a classification to be defensible.
 *
 * Two rules, applied after the model and regardless of what it said:
 *
 *   1. No citation, no correction. `correctable` without a usable citation becomes
 *      `unverifiable` — we may believe the claim is false, but we cannot show it.
 *   2. Opinion is never correctable, even with a citation attached. A document does not
 *      contradict "the government should have acted sooner".
 */
export function enforce(claim: Claim): Claim {
  if (claim.bucket !== 'correctable') return claim;

  if (readsAsOpinion(claim.text)) {
    return {
      ...claim,
      bucket: 'criticism',
      citation: null,
      rationale:
        'Reads as opinion rather than an assertion of fact, so it is not something a document can contradict.',
    };
  }

  const c = claim.citation;
  const usable = Boolean(c?.title?.trim() && c?.excerpt?.trim());
  if (!usable) {
    return {
      ...claim,
      bucket: 'unverifiable',
      citation: null,
      rationale:
        'No document was produced that contradicts this, so it is flagged for checking rather than answered.',
    };
  }
  return claim;
}

/**
 * The attributed reply, or null.
 *
 * Null for every bucket except `correctable`, and null even there without a citation.
 * The reply names the issuing office and quotes the document, because those two things
 * are what make it a correction rather than a contradiction.
 */
export function draftReply(
  claim: Claim,
  office: { en: string; ur: string },
  locale: 'en' | 'ur'
): string | null {
  if (claim.bucket !== 'correctable' || !claim.citation) return null;
  const c = claim.citation;
  const where = c.locator ? `${c.title}, ${c.locator}` : c.title;

  if (locale === 'ur') {
    return [
      `${where} میں درج ہے:`,
      `«${c.excerpt}»`,
      '',
      `${office.ur}`,
      c.url ?? '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    `${where} states:`,
    `“${c.excerpt}”`,
    '',
    office.en,
    c.url ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function bucketCounts(claims: Claim[]): Record<ClaimBucket, number> {
  return {
    correctable: claims.filter((c) => c.bucket === 'correctable').length,
    criticism: claims.filter((c) => c.bucket === 'criticism').length,
    unverifiable: claims.filter((c) => c.bucket === 'unverifiable').length,
  };
}
