/**
 * Parliamentary instruments available to a Member of the National Assembly of Pakistan.
 *
 * Every rule citation, notice period, numeric limit and quoted phrase in this file was
 * taken verbatim from the **Rules of Procedure and Conduct of Business in the National
 * Assembly, 2007** (as amended), the text-layer PDF published by the Assembly at
 * https://na.gov.pk/uploads/documents/1539239593_412.pdf
 *
 * The generic US build offers five memo formats — "policy memo", "constituent letter",
 * "press release" and so on. None of those is a thing a Member of the National Assembly
 * files. A member's actual output is a *notice*: a starred question, a calling attention
 * notice, an adjournment motion. Each has a specific rule, a specific notice period and a
 * specific numeric cap, and a notice that misses any of them is returned by the
 * Secretariat before it ever reaches the Orders of the Day. Encoding those constraints —
 * rather than asking a model to remember them — is the whole point of this module.
 *
 * ── What is verified and what is not ──────────────────────────────────────────────
 * VERIFIED: every `ruleCitation`, `noticeDays`, `perSittingLimit`, `wordLimit` and every
 * string inside `constraints[].textEn`, against the 2007 Rules PDF.
 *
 * NEEDS LOCAL REVIEW: `nameUr` — parliamentary Urdu is a register of terms of art, and
 * the National Assembly Secretariat's own Urdu forms should be preferred over these.
 * Also `formatGuidance` for instruments other than the starred question: the starred
 * question form is confirmed against a real question paper, the rest are reconstructed
 * from the rule text and ordinary Secretariat practice.
 */

import type { MessageKey } from '@/app/pk/i18n/dictionary';

export type InstrumentId =
  | 'starred-question'
  | 'unstarred-question'
  | 'short-notice-question'
  | 'calling-attention'
  | 'adjournment-motion'
  | 'privilege-question'
  | 'resolution'
  | 'private-members-bill'
  | 'press-release'
  | 'constituent-letter'
  | 'social-post';

/** A single procedural requirement, shown as a bullet beside the draft. */
export interface InstrumentConstraint {
  /** e.g. "Rule 73" — rendered inside <Ltr> because it is Latin script + digits. */
  rule: string;
  textEn: string;
  textUr: string;
}

export interface Instrument {
  id: InstrumentId;
  nameEn: string;
  nameUr: string;
  /** Dictionary key so the picker can use the shared translation. */
  nameKey: MessageKey;
  /** The single rule a clerk would cite when returning the notice, e.g. "Rule 70". */
  ruleCitation: string;
  /** The full span of rules governing the instrument, e.g. "Rules 69–73, 77–78". */
  ruleRange: string;
  /**
   * Clear days of notice required. `null` means the instrument is not a notice to the
   * Secretariat at all (a press release has no notice period).
   */
  noticeDays: number | null;
  /** True where the Rules say "clear days" rather than plain days. */
  clearDays: boolean;
  /** How many the same member may put down for one sitting/day. `null` = uncapped. */
  perSittingLimit: number | null;
  /** Rule 78(f): questions "shall not ordinarily exceed one hundred and fifty words". */
  wordLimit?: number;
  /** True for the three question types, which the Rule 78 checker applies to. */
  isQuestion: boolean;
  /**
   * True where the instrument is a formal notice to the Secretariat. Those are drafted
   * in English here — see the note on `DRAFT_LANGUAGE_NOTE` below.
   */
  isNotice: boolean;
  systemPrompt: string;
  formatGuidance: string;
  constraints: InstrumentConstraint[];
}

/**
 * Rule 281(1) lets a member address the Assembly "in Urdu or English", and 281(3) keeps
 * the official record in both. The template reproduced in `formatGuidance` for the
 * starred question is the **English** form, taken from a National Assembly question
 * paper, so notices are drafted in English regardless of interface language. The three
 * communications formats at the end of this list follow the interface language instead —
 * a press release for a Pakistani constituency is far more often Urdu than English.
 */
export const DRAFT_LANGUAGE_NOTE = {
  en: 'Notices are drafted in English, the form printed in the Orders of the Day. Rule 281 permits Urdu or English; the official record is kept in both.',
  ur: 'نوٹس انگریزی میں تیار کیے جاتے ہیں، وہی صورت جو ایجنڈے میں شائع ہوتی ہے۔ قاعدہ 281 اردو یا انگریزی دونوں کی اجازت دیتا ہے اور سرکاری ریکارڈ دونوں زبانوں میں رکھا جاتا ہے۔',
} as const;

/**
 * The canonical starred-question form, confirmed against a National Assembly question
 * paper. The asterisk is not decoration: Rule 71(2) requires a member who wants an oral
 * answer to "distinguish it with an asterisk".
 */
export const STARRED_QUESTION_TEMPLATE =
  '* <Member name>: Will the Minister for <Division> be pleased to state <question>?';

const QUESTION_BASE_PROMPT = `You are a clerk in the National Assembly of Pakistan Secretariat drafting a question notice for a Member of the National Assembly.

The question must be admissible under Rule 78 of the Rules of Procedure and Conduct of Business in the National Assembly, 2007. In particular it must NOT:
- exceed one hundred and fifty words (Rule 78(f));
- contain arguments, inferences, ironical expressions, imputations, epithets or defamatory statements (Rule 78(c));
- ask for an expression of opinion, or the solution of an abstract legal question or a hypothetical proposition (Rule 78(d));
- refer to the character or conduct of any person except in his official or public capacity (Rule 78(e));
- ask for information contained in documents accessible to the public or in ordinary works of reference (Rule 78(l));
- contain references to newspapers by name, or ask whether press statements are accurate (Rule 78(n));
- ask about Cabinet discussions or advice given to the President (Rule 78(o));
- contain any reflection on the conduct of the President or a Judge (Rule 78(q)(i));
- contain remarks likely to prejudice a matter which is sub-judice (Rule 78(r));
- amount in substance to a suggestion for a particular course of action (Rule 78(s)).

Ask for FACTS the Division holds: numbers, dates, districts, amounts disbursed, applications pending, steps taken. Never editorialise. Never ask "why has the Government failed to…". A question that reads as a complaint is returned by the Secretariat.

Write in English. Output the notice text only — no preamble, no commentary, no markdown fences.`;

export const INSTRUMENTS: Instrument[] = [
  // ── Questions ────────────────────────────────────────────────────────────────────
  {
    id: 'starred-question',
    nameEn: 'Starred question (oral answer)',
    nameUr: 'ستارہ دار سوال (زبانی جواب)',
    nameKey: 'instruments.starredQuestion',
    ruleCitation: 'Rule 71',
    ruleRange: 'Rules 69–73, 77–78',
    noticeDays: 15,
    clearDays: true,
    perSittingLimit: 2,
    wordLimit: 150,
    isQuestion: true,
    isNotice: true,
    systemPrompt: `${QUESTION_BASE_PROMPT}

This is a STARRED question — Rule 2 defines it as "a question for an oral answer". It is asked during question hour and the member may follow it with supplementary questions, so keep the main question tight and factual; the pressure comes from the supplementaries, not from the wording of the notice.`,
    formatGuidance: `Use exactly this form:

${STARRED_QUESTION_TEMPLATE}

Rule 71(2) requires a starred question to be distinguished with an asterisk, so the line begins with "*". Rule 71(1) requires the notice to specify the official designation of the Minister, so name the Division exactly ("Minister for Poverty Alleviation and Social Safety", not "the BISP minister").

Where the subject has several strands, put a single stem and lettered parts:

* <Member name>: Will the Minister for <Division> be pleased to state:
(a) <first factual limb>;
(b) <second factual limb>; and
(c) <third factual limb>?`,
    constraints: [
      {
        rule: 'Rule 70',
        textEn: 'Fifteen clear days’ notice of a question shall be given, unless the Speaker with the consent of the Minister concerned allows shorter notice.',
        textUr: 'سوال کا پندرہ صاف دن کا نوٹس دیا جائے گا، الا یہ کہ اسپیکر متعلقہ وزیر کی رضامندی سے کم مدت کی اجازت دے۔',
      },
      {
        rule: 'Rule 73',
        textEn: 'Not more than two starred questions (including a short notice question) and two unstarred questions from the same member may be placed on the list for any one day.',
        textUr: 'ایک ہی رکن کے دو سے زائد ستارہ دار سوال (بشمول قلیل مدتی نوٹس کا سوال) اور دو غیر ستارہ دار سوال کسی ایک دن کی فہرست میں شامل نہیں کیے جا سکتے۔',
      },
      {
        rule: 'Rule 69',
        textEn: 'The first hour of every sitting is available for questions — but there shall be no question hour on Tuesdays.',
        textUr: 'ہر اجلاس کا پہلا گھنٹہ سوالات کے لیے مختص ہے — تاہم منگل کو سوالیہ وقفہ نہیں ہوتا۔',
      },
      {
        rule: 'Rule 78(f)',
        textEn: 'A question shall not ordinarily exceed one hundred and fifty words.',
        textUr: 'کوئی سوال عام طور پر ایک سو پچاس الفاظ سے زیادہ نہیں ہونا چاہیے۔',
      },
      {
        rule: 'Rule 71(2)',
        textEn: 'A member who desires to ask a starred question shall distinguish it with an asterisk.',
        textUr: 'ستارہ دار سوال پوچھنے کا خواہشمند رکن اسے ستارے سے ممتاز کرے گا۔',
      },
      {
        rule: 'Rule 72',
        textEn: 'No question is placed on the list until ten clear days have expired from the day the Secretary gave notice of the Speaker’s admission to the Minister.',
        textUr: 'کوئی سوال اس وقت تک فہرست میں شامل نہیں ہوتا جب تک سیکرٹری کی جانب سے وزیر کو اسپیکر کی منظوری کی اطلاع دیے جانے سے دس صاف دن نہ گزر جائیں۔',
      },
    ],
  },
  {
    id: 'unstarred-question',
    nameEn: 'Unstarred question (written answer)',
    nameUr: 'غیر ستارہ دار سوال (تحریری جواب)',
    nameKey: 'instruments.unstarredQuestion',
    ruleCitation: 'Rule 70',
    ruleRange: 'Rules 2, 70, 73, 77–78',
    noticeDays: 15,
    clearDays: true,
    perSittingLimit: 2,
    wordLimit: 150,
    isQuestion: true,
    isNotice: true,
    systemPrompt: `${QUESTION_BASE_PROMPT}

This is an UNSTARRED question — Rule 2 defines it as "a question for a written answer". There are no supplementaries, so everything the member wants must be inside the notice. Prefer several lettered parts asking for a specific table or figure the Division can lay before the Assembly: district-wise breakdowns, numbers pending, dates, amounts. This is the instrument for extracting data, not for making a point.`,
    formatGuidance: `Use the same form as a starred question but WITHOUT the leading asterisk, since Rule 71(2) reserves the asterisk for questions for oral answer:

<Member name>: Will the Minister for <Division> be pleased to state:
(a) <specific figure or table sought>;
(b) <district-wise or year-wise breakdown sought>; and
(c) <steps taken, with dates>?`,
    constraints: [
      {
        rule: 'Rule 2',
        textEn: '"Unstarred Question" means a question for a written answer.',
        textUr: '"غیر ستارہ دار سوال" سے مراد وہ سوال ہے جس کا جواب تحریری ہو۔',
      },
      {
        rule: 'Rule 70',
        textEn: 'Fifteen clear days’ notice of a question shall be given.',
        textUr: 'سوال کا پندرہ صاف دن کا نوٹس دیا جائے گا۔',
      },
      {
        rule: 'Rule 73',
        textEn: 'Not more than two unstarred questions from the same member may be placed on the list for any one day.',
        textUr: 'ایک ہی رکن کے دو سے زائد غیر ستارہ دار سوال کسی ایک دن کی فہرست میں شامل نہیں کیے جا سکتے۔',
      },
      {
        rule: 'Rule 78(f)',
        textEn: 'A question shall not ordinarily exceed one hundred and fifty words.',
        textUr: 'کوئی سوال عام طور پر ایک سو پچاس الفاظ سے زیادہ نہیں ہونا چاہیے۔',
      },
    ],
  },
  {
    id: 'short-notice-question',
    nameEn: 'Short notice question',
    nameUr: 'قلیل مدتی نوٹس کا سوال',
    nameKey: 'instruments.shortNoticeQuestion',
    ruleCitation: 'Rule 79',
    ruleRange: 'Rule 79',
    noticeDays: 0,
    clearDays: false,
    perSittingLimit: 1,
    wordLimit: 150,
    isQuestion: true,
    isNotice: true,
    systemPrompt: `${QUESTION_BASE_PROMPT}

This is a SHORT NOTICE question under Rule 79 — it is asked with notice shorter than the ordinary fifteen clear days, and it is admitted only if the Speaker is of the opinion that the question is of an urgent character.

CRITICAL: the notice must OPEN with a short statement of the REASONS for short notice, before the question itself. A short notice question that does not state its reasons is returned. The reasons must establish urgency of an objective kind — an event within the last few days, a deadline about to pass, a payment cycle already missed, a facility already closed — not merely that the member considers the matter important.

Rule 79(1)(b) also bars a short notice question that anticipates the reply to a question already noticed, so do not restate a question already on the list.`,
    formatGuidance: `Two blocks. Reasons first, then the question in the ordinary form:

REASONS FOR SHORT NOTICE (Rule 79): <two or three sentences establishing urgency, with the date of the triggering event>

* <Member name>: Will the Minister for <Division> be pleased to state <question>?`,
    constraints: [
      {
        rule: 'Rule 79(1)',
        textEn: 'A question relating to a matter of public importance may be asked with notice shorter than fifteen clear days if the Speaker is of the opinion that the question is of an urgent character.',
        textUr: 'عوامی اہمیت کے معاملے پر سوال پندرہ صاف دن سے کم نوٹس کے ساتھ پوچھا جا سکتا ہے اگر اسپیکر کی رائے میں سوال فوری نوعیت کا ہو۔',
      },
      {
        rule: 'Rule 79(1)',
        textEn: 'The member must state the reasons for short notice. A notice that does not is returned by the Secretariat.',
        textUr: 'رکن کو قلیل مدتی نوٹس کی وجوہات بیان کرنا لازم ہیں۔ ایسا نہ کرنے پر نوٹس سیکرٹریٹ سے واپس کر دیا جاتا ہے۔',
      },
      {
        rule: 'Rule 79(1)(a)',
        textEn: 'A member may not ask more than one short notice question on any one day.',
        textUr: 'کوئی رکن ایک دن میں ایک سے زیادہ قلیل مدتی نوٹس کا سوال نہیں پوچھ سکتا۔',
      },
      {
        rule: 'Rule 79(1)(b)',
        textEn: 'A short notice question may not be asked to anticipate the reply to a question of which notice has already been given.',
        textUr: 'قلیل مدتی نوٹس کا سوال ایسے سوال کے جواب کو پیشگی حاصل کرنے کے لیے نہیں پوچھا جا سکتا جس کا نوٹس پہلے دیا جا چکا ہو۔',
      },
      {
        rule: 'Rule 73',
        textEn: 'A short notice question counts against the member’s cap of two starred questions for the day.',
        textUr: 'قلیل مدتی نوٹس کا سوال رکن کے اُس دن کے دو ستارہ دار سوالات کی حد میں شمار ہوتا ہے۔',
      },
    ],
  },

  // ── Notices and motions ──────────────────────────────────────────────────────────
  {
    id: 'calling-attention',
    nameEn: 'Calling attention notice',
    nameUr: 'توجہ دلاؤ نوٹس',
    nameKey: 'instruments.callingAttention',
    ruleCitation: 'Rule 88',
    ruleRange: 'Rules 88–94',
    noticeDays: 1,
    clearDays: false,
    perSittingLimit: 1,
    isQuestion: false,
    isNotice: true,
    systemPrompt: `You are a clerk in the National Assembly of Pakistan Secretariat drafting a CALLING ATTENTION notice under Rules 88 to 94 for a Member of the National Assembly.

Rule 88: a member may, with the previous permission of the Speaker, call the attention of a Minister to any matter of urgent public importance, and the Minister may make a brief statement or ask for time to make one later.

The notice is short — a single paragraph. It must:
- identify a matter of URGENT PUBLIC IMPORTANCE, with the place and the date it arose;
- name the Minister by official designation, not by personal name;
- state the concrete public consequence (people affected, days without service, amount unpaid), because that is what makes it urgent rather than merely important;
- ask the Minister to make a statement. It does NOT argue, and it does not demand a particular remedy — Rule 89 bars any debate on the statement, so a notice written as a speech is wasted.

Write in English. Output the notice text only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `A single paragraph in the Secretariat's standing form:

CALLING ATTENTION NOTICE (Rules 88–94)

I beg to call the attention of the Minister for <Division> to a matter of urgent public importance, namely, <the matter, with place and date and the number of people affected>, and I request that the Minister be pleased to make a statement thereon.

<Member name>
Member, National Assembly — <constituency code>`,
    constraints: [
      {
        rule: 'Rule 91',
        textEn: 'Notice of Calling Attention shall be given one day before the day on which the notice is to be considered.',
        textUr: 'توجہ دلاؤ نوٹس اُس دن سے ایک دن قبل دیا جائے گا جس دن اس پر غور ہونا ہے۔',
      },
      {
        rule: 'Rule 88',
        textEn: 'No member shall give more than one such notice for any one sitting.',
        textUr: 'کوئی رکن کسی ایک اجلاس کے لیے ایک سے زیادہ ایسا نوٹس نہیں دے سکتا۔',
      },
      {
        rule: 'Rule 92',
        textEn: 'Not more than two such matters shall be raised at the same sitting, and the second may not be raised by the same members who raised the first.',
        textUr: 'ایک ہی اجلاس میں دو سے زائد ایسے معاملات نہیں اٹھائے جا سکتے، اور دوسرا معاملہ وہی اراکین نہیں اٹھا سکتے جنہوں نے پہلا اٹھایا ہو۔',
      },
      {
        rule: 'Rule 89',
        textEn: 'Names of not more than five members shall be shown in the Orders of the Day.',
        textUr: 'ایجنڈے میں پانچ سے زیادہ اراکین کے نام نہیں دکھائے جائیں گے۔',
      },
      {
        rule: 'Rule 94',
        textEn: 'All notices not taken up at the sitting for which they were given shall LAPSE at the end of that sitting.',
        textUr: 'جو نوٹس اُس اجلاس میں نہ لیے جائیں جس کے لیے دیے گئے تھے، وہ اجلاس کے اختتام پر ختم ہو جاتے ہیں۔',
      },
      {
        rule: 'Rule 90',
        textEn: 'Where a notice is signed by more than one member, it is deemed to have been given by the first signatory only.',
        textUr: 'اگر نوٹس پر ایک سے زیادہ اراکین کے دستخط ہوں تو وہ صرف پہلے دستخط کنندہ کی جانب سے تصور ہوتا ہے۔',
      },
    ],
  },
  {
    id: 'adjournment-motion',
    nameEn: 'Adjournment motion',
    nameUr: 'تحریکِ التوا',
    nameKey: 'instruments.adjournmentMotion',
    ruleCitation: 'Rule 110',
    ruleRange: 'Rules 109–117',
    noticeDays: 1,
    clearDays: false,
    perSittingLimit: 1,
    isQuestion: false,
    isNotice: true,
    systemPrompt: `You are a clerk in the National Assembly of Pakistan Secretariat drafting an ADJOURNMENT MOTION under Rules 109 to 117 for a Member of the National Assembly.

Rule 109: a motion for adjournment of the business of the House for the purpose of discussing a definite matter of urgent public importance may be made with the consent of the Speaker.

Rule 111 sets the conditions of admissibility. The motion:
(a) shall raise an issue of urgent public importance;
(b) shall relate substantially to ONE DEFINITE ISSUE — not a survey of a policy area;
(c) shall be restricted to a matter of RECENT OCCURRENCE — give the date;
(d) shall not repeat in substance a motion already refused, found inadmissible, or already discussed.

The notice explains the matter proposed to be discussed. Keep it to one tight paragraph naming the event, its date, its location, the responsible Division, and the public consequence. Do not draft a speech: Rule 117 caps the whole discussion at two hours and each member at ten minutes, so the notice is a hook, not an argument.

Write in English. Output the notice text only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `Head the notice with the quadruplicate requirement, because that is what the Secretariat checks first.

NOTICE OF ADJOURNMENT MOTION (Rules 109–117) — to be delivered to the Secretary IN QUADRUPLICATE

I beg to give notice that I shall move for an adjournment of the business of the House for the purpose of discussing a definite matter of urgent public importance, namely, <the single definite issue, with the date of occurrence and the place>.

<Member name>
Member, National Assembly — <constituency code>`,
    constraints: [
      {
        rule: 'Rule 110',
        textEn: 'Notice shall be delivered to the Secretary IN QUADRUPLICATE not less than one day before the commencement of the sitting in which the motion is proposed to be moved.',
        textUr: 'نوٹس سیکرٹری کو چار نقول میں، اُس اجلاس کے آغاز سے کم از کم ایک دن قبل پہنچایا جائے گا جس میں تحریک پیش کی جانی ہے۔',
      },
      {
        rule: 'Rule 110',
        textEn: 'No member shall give more than one such notice for any one sitting.',
        textUr: 'کوئی رکن کسی ایک اجلاس کے لیے ایک سے زیادہ ایسا نوٹس نہیں دے سکتا۔',
      },
      {
        rule: 'Rule 111',
        textEn: 'The motion must raise an issue of urgent public importance, relate substantially to one definite issue, and be restricted to a matter of recent occurrence.',
        textUr: 'تحریک کا فوری عوامی اہمیت کا معاملہ اٹھانا، بنیادی طور پر ایک متعین مسئلے سے متعلق ہونا، اور حالیہ واقعے تک محدود ہونا ضروری ہے۔',
      },
      {
        rule: 'Rule 115',
        textEn: 'Not more than one motion shall be admitted on any one day.',
        textUr: 'کسی ایک دن میں ایک سے زیادہ تحریک منظور نہیں کی جائے گی۔',
      },
      {
        rule: 'Rule 117',
        textEn: 'A discussion on the adjournment motion shall not exceed two hours, and shall not exceed ten minutes for each member.',
        textUr: 'تحریکِ التوا پر بحث دو گھنٹے سے زیادہ نہیں ہو گی، اور ہر رکن کے لیے دس منٹ سے زیادہ نہیں۔',
      },
      {
        rule: 'Rule 114',
        textEn: 'On any one day the aggregate time for asking for, and granting or withholding, leave shall not exceed half an hour.',
        textUr: 'کسی ایک دن میں اجازت طلب کرنے اور اسے دینے یا روکنے کا مجموعی وقت آدھے گھنٹے سے زیادہ نہیں ہو گا۔',
      },
    ],
  },
  {
    id: 'privilege-question',
    nameEn: 'Question of privilege',
    nameUr: 'تحریکِ استحقاق',
    nameKey: 'instruments.privilegeMotion',
    ruleCitation: 'Rule 96',
    ruleRange: 'Rules 95–98',
    noticeDays: 0,
    clearDays: false,
    perSittingLimit: 1,
    isQuestion: false,
    isNotice: true,
    systemPrompt: `You are a clerk in the National Assembly of Pakistan Secretariat drafting a QUESTION OF PRIVILEGE under Rules 95 to 98 for a Member of the National Assembly.

Rule 95: a member may, with the consent of the Speaker, raise a question involving a breach of privilege either of a member, or of the Assembly, or of a Committee thereof.

Rule 97 governs admissibility:
(a) not more than one question shall be raised by the same member at the same sitting;
(b) the question shall relate to a SPECIFIC matter and shall be raised at the EARLIEST OPPORTUNITY;
(c) the matter shall be such as REQUIRES THE INTERVENTION OF THE ASSEMBLY.

The notice must therefore do three things explicitly: identify the specific act and its date; explain why this is being raised at the earliest opportunity (state when the member came to know of it); and explain why the matter requires the intervention of the Assembly rather than an ordinary complaint. A privilege notice that omits the "earliest opportunity" point is the most common ground for rejection.

Where the breach is evidenced by a document — a letter, a notification, a summons served on the member — say so expressly and list the document, because Rule 96 requires the document to ACCOMPANY the notice.

Write in English. Output the notice text only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `Address the Secretary. Four short numbered paragraphs, then the enclosure line.

NOTICE OF QUESTION OF PRIVILEGE (Rules 95–98)

To: The Secretary, National Assembly of Pakistan

Under Rule 95 I wish to raise a question of privilege at the sitting of <date>.

1. THE MATTER: <the specific act, the officer or body responsible by designation, the date and place>.
2. THE BREACH: <how it obstructed the member in the discharge of his or her duties, or affronted the Assembly or a Committee>.
3. EARLIEST OPPORTUNITY: <when the member came to know of the matter, and why this is the first sitting at which it could be raised>.
4. INTERVENTION OF THE ASSEMBLY: <why the matter requires the Assembly's intervention>.

ENCLOSED (Rule 96): <list each document relied upon — the notice is incomplete without them>.

<Member name>
Member, National Assembly — <constituency code>`,
    constraints: [
      {
        rule: 'Rule 96',
        textEn: 'A member wishing to raise a question of privilege shall give notice in writing to the Secretary BEFORE the commencement of the sitting on the day the question is proposed to be raised.',
        textUr: 'تحریکِ استحقاق اٹھانے کا خواہشمند رکن، جس دن سوال اٹھانا مقصود ہو، اُس دن اجلاس کے آغاز سے قبل سیکرٹری کو تحریری نوٹس دے گا۔',
      },
      {
        rule: 'Rule 96',
        textEn: 'If the question raised is based on a document, THE NOTICE SHALL BE ACCOMPANIED BY THE DOCUMENT.',
        textUr: 'اگر اٹھایا گیا سوال کسی دستاویز پر مبنی ہو تو نوٹس کے ساتھ وہ دستاویز منسلک کرنا لازم ہے۔',
      },
      {
        rule: 'Rule 97(a)',
        textEn: 'Not more than one question of privilege shall be raised by the same member at the same sitting.',
        textUr: 'ایک ہی رکن ایک ہی اجلاس میں ایک سے زیادہ تحریکِ استحقاق نہیں اٹھا سکتا۔',
      },
      {
        rule: 'Rule 97(b)',
        textEn: 'The question shall relate to a specific matter and shall be raised at the earliest opportunity.',
        textUr: 'سوال کسی متعین معاملے سے متعلق ہو گا اور پہلی دستیاب فرصت میں اٹھایا جائے گا۔',
      },
      {
        rule: 'Rule 97(c)',
        textEn: 'The matter shall be such as requires the intervention of the Assembly.',
        textUr: 'معاملہ ایسا ہو جو اسمبلی کی مداخلت کا متقاضی ہو۔',
      },
      {
        rule: 'Rule 99',
        textEn: 'A question of privilege has precedence over adjournment motions.',
        textUr: 'تحریکِ استحقاق کو تحریکِ التوا پر فوقیت حاصل ہے۔',
      },
    ],
  },
  {
    id: 'resolution',
    nameEn: 'Resolution',
    nameUr: 'قرارداد',
    nameKey: 'instruments.resolution',
    ruleCitation: 'Rule 158',
    ruleRange: 'Rules 157–160',
    noticeDays: 7,
    clearDays: false,
    perSittingLimit: 5,
    isQuestion: false,
    isNotice: true,
    systemPrompt: `You are a clerk in the National Assembly of Pakistan Secretariat drafting a RESOLUTION under Rules 157 to 160 for a private member.

Rule 159 defines the permissible forms: a resolution may be in the form of a declaration of opinion, or a recommendation, or it may convey a message, or commend, urge or request an action, or call attention to a matter or situation for consideration by the Government.

Rule 160 sets the contents:
(1) it shall relate to a matter primarily the concern of the Government, or in which the Government has substantial financial interest;
(2) it shall be CLEARLY AND PRECISELY EXPRESSED and shall raise substantially ONE DEFINITE ISSUE;
(3) it shall NOT contain arguments, inferences, ironical expressions or defamatory statements; shall not refer to the conduct or character of a person except in his official or public capacity; shall not raise discussion detrimental to public interest; shall not contain reflection on a Judge of the Supreme Court, a High Court or any subordinate Court; and shall not relate to any matter pending before any court.

Keep it to one sentence of operative text where possible, preceded by recitals if genuinely needed. A resolution is a statement of the House's opinion, not a speech.

Write in English. Output the resolution text only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `The standing form opens "This Assembly resolves that…" or, where recitals are needed, "Whereas… ; Now, therefore, this Assembly…".

RESOLUTION (Rules 157–160)

Whereas <the factual premise, stated neutrally>;

Now, therefore, this Assembly <recommends to / urges / calls upon> the Federal Government to <the single definite action sought>.

<Member name>
Member, National Assembly — <constituency code>`,
    constraints: [
      {
        rule: 'Rule 158(1)',
        textEn: 'A private member shall give seven days’ notice and submit a copy of the resolution with the notice.',
        textUr: 'پرائیویٹ ممبر سات دن کا نوٹس دے گا اور نوٹس کے ساتھ قرارداد کی نقل جمع کرائے گا۔',
      },
      {
        rule: 'Rule 158(2)',
        textEn: 'The names of all members giving notice are BALLOTED, and each successful member is allotted one resolution in the Orders of the Day.',
        textUr: 'نوٹس دینے والے تمام اراکین کے ناموں کا قرعہ اندازی کے ذریعے انتخاب ہوتا ہے، اور ہر کامیاب رکن کو ایجنڈے میں ایک قرارداد الاٹ کی جاتی ہے۔',
      },
      {
        rule: 'Rule 157',
        textEn: 'The number of resolutions to be moved by a private member in the same session shall not exceed five.',
        textUr: 'ایک ہی سیشن میں پرائیویٹ ممبر کی پیش کردہ قراردادوں کی تعداد پانچ سے زیادہ نہیں ہو سکتی۔',
      },
      {
        rule: 'Rule 159',
        textEn: 'A resolution may be a declaration of opinion or a recommendation, or convey a message, or commend, urge or request an action, or call attention to a matter for consideration by the Government.',
        textUr: 'قرارداد رائے کا اظہار، سفارش، پیغام، تحسین، زور دینے یا کسی اقدام کی درخواست، یا حکومت کی توجہ کسی معاملے کی طرف دلانے کی صورت میں ہو سکتی ہے۔',
      },
      {
        rule: 'Rule 160(2)',
        textEn: 'It shall be clearly and precisely expressed and shall raise substantially one definite issue.',
        textUr: 'یہ واضح اور دو ٹوک انداز میں بیان کی جائے گی اور بنیادی طور پر ایک متعین مسئلہ اٹھائے گی۔',
      },
      {
        rule: 'Rule 160(3)(e)',
        textEn: 'It shall not relate to any matter which is pending before any court.',
        textUr: 'یہ کسی ایسے معاملے سے متعلق نہیں ہو گی جو کسی عدالت میں زیرِ التوا ہو۔',
      },
    ],
  },
  {
    id: 'private-members-bill',
    nameEn: "Private member's bill",
    nameUr: 'پرائیویٹ ممبر بل',
    nameKey: 'instruments.privateMembersBill',
    ruleCitation: 'Rule 118',
    ruleRange: 'Rules 118–119',
    noticeDays: 10,
    clearDays: true,
    perSittingLimit: null,
    isQuestion: false,
    isNotice: true,
    systemPrompt: `You are a clerk in the National Assembly of Pakistan Secretariat preparing a PRIVATE MEMBER'S BILL under Rules 118 and 119.

Rule 118(1): a private member shall give ten clear days' written notice to the Secretary to move for leave to introduce a Bill.
Rule 118(2): three copies of the Bill, together with a STATEMENT OF OBJECTS AND REASONS SIGNED BY THE MEMBER, shall accompany the notice.
Rule 118(3): if the Bill requires the consent of the Government under the Constitution for its introduction, the notice shall also contain a request to obtain that consent through the Ministry of Parliamentary Affairs and the Ministry of Law and Justice. A Bill touching taxation or expenditure from the Federal Consolidated Fund is the usual case — flag it where it arises.

Produce: the long title, the enacting formula, a short clause structure (short title/extent/commencement, definitions, the operative clauses, and any consequential amendment), and then the Statement of Objects and Reasons. Keep the drafting plain and short — this is a working draft for the Secretariat, not a finished statute.

Write in English. Output the Bill text only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `Follow the Pakistani statutory drafting convention.

THE <SUBJECT> BILL, <year>

A BILL
to <long title stating the purpose>

WHEREAS it is expedient to <purpose> and to provide for matters connected therewith or ancillary thereto;

It is hereby enacted as follows:—

1. Short title, extent and commencement.— (1) This Act may be called the <Subject> Act, <year>.
   (2) It extends to the whole of Pakistan.
   (3) It shall come into force at once.
2. Definitions.— In this Act, unless there is anything repugnant in the subject or context,—
   (a) …
3. <Operative clause>.— …

STATEMENT OF OBJECTS AND REASONS
<the mischief, the remedy, and why federal legislation is competent>

<Member name>
Member, National Assembly — <constituency code>`,
    constraints: [
      {
        rule: 'Rule 118(1)',
        textEn: 'A private member shall give ten clear days’ written notice to move for leave to introduce a Bill.',
        textUr: 'پرائیویٹ ممبر بل پیش کرنے کی اجازت کی تحریک کے لیے دس صاف دن کا تحریری نوٹس دے گا۔',
      },
      {
        rule: 'Rule 118(2)',
        textEn: 'Three copies of the Bill along with a Statement of Objects and Reasons SIGNED BY THE MEMBER shall accompany the notice.',
        textUr: 'نوٹس کے ساتھ بل کی تین نقول اور رکن کے دستخط شدہ اغراض و مقاصد کا بیان منسلک ہونا لازم ہے۔',
      },
      {
        rule: 'Rule 118(3)',
        textEn: 'Where the Constitution requires the Government’s consent for introduction, the notice must request it through the Ministry of Parliamentary Affairs and the Ministry of Law and Justice.',
        textUr: 'جہاں آئین کے تحت پیش کرنے کے لیے حکومت کی رضامندی درکار ہو، نوٹس میں وزارتِ پارلیمانی امور اور وزارتِ قانون و انصاف کے ذریعے اس کی درخواست شامل ہونی چاہیے۔',
      },
      {
        rule: 'Rule 119(1)',
        textEn: 'The motion for leave to introduce is set down in the Orders of the Day on private members’ day.',
        textUr: 'پیش کرنے کی اجازت کی تحریک پرائیویٹ ممبرز ڈے کے ایجنڈے میں شامل کی جاتی ہے۔',
      },
      {
        rule: 'Rule 118(5)',
        textEn: 'The National Assembly Secretariat shall render possible assistance so that Bills are not rejected merely on technical grounds.',
        textUr: 'قومی اسمبلی سیکرٹریٹ ممکنہ معاونت فراہم کرے گا تاکہ بل محض تکنیکی بنیادوں پر مسترد نہ ہوں۔',
      },
    ],
  },

  // ── Communications (no rule; these follow the interface language) ────────────────
  {
    id: 'press-release',
    nameEn: 'Press release',
    nameUr: 'پریس ریلیز',
    nameKey: 'instruments.pressRelease',
    ruleCitation: '',
    ruleRange: '',
    noticeDays: null,
    clearDays: false,
    perSittingLimit: null,
    isQuestion: false,
    isNotice: false,
    systemPrompt: `You are a media officer in the constituency office of a Member of the National Assembly of Pakistan, writing a press release for release to Pakistani newspapers and television channels.

Lead with what the member DID — the notice tabled, the meeting held, the figure obtained — not with what the member thinks. Pakistani political desks run the first two paragraphs almost verbatim, so put the news in them. Include one short direct quotation attributed to the member. Name divisions and agencies by their correct designations. Keep it under 300 words.

Output the press release only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `PRESS RELEASE — FOR IMMEDIATE RELEASE
<City>, <date>

<Headline: the action, in one line>

<Lead paragraph: who, what, where, when — the news.>
<Second paragraph: the numbers and the constituency detail.>
"<Direct quotation from the member.>" said <Member name>, Member of the National Assembly for <constituency code>.
<Closing paragraph: what happens next.>

— ENDS —
For further information: Constituency Office, <constituency code>`,
    constraints: [],
  },
  {
    id: 'constituent-letter',
    nameEn: 'Letter to a constituent',
    nameUr: 'ووٹر کے نام خط',
    nameKey: 'instruments.constituentLetter',
    ruleCitation: '',
    ruleRange: '',
    noticeDays: null,
    clearDays: false,
    perSittingLimit: null,
    isQuestion: false,
    isNotice: false,
    systemPrompt: `You are a caseworker in the constituency office of a Member of the National Assembly of Pakistan, writing to a constituent about their case.

Be concrete and honest. Say exactly what the office has done, with dates and reference numbers where they exist; say what the agency has said; say what happens next and by when. Where the subject is provincial — police, land records, schools, local government — say plainly that a Member of the National Assembly has no formal locus and direct the constituent to their MPA or the provincial ombudsman. Never promise an outcome the office cannot deliver. Do not use the passive voice to hide who is responsible.

Output the letter only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `Constituency Office of <Member name>, MNA
<constituency code>
<date>

Dear <name>,

Re: <subject, with any file or reference number>

<What the office has done, with dates.>
<What the agency has said.>
<What happens next, and by when.>
<Where to escalate if it stalls — the Pakistan Citizen's Portal or the Wafaqi Mohtasib as appropriate.>

Yours sincerely,
<Member name>
Member, National Assembly — <constituency code>`,
    constraints: [],
  },
  {
    id: 'social-post',
    nameEn: 'Social media post',
    nameUr: 'سوشل میڈیا پوسٹ',
    nameKey: 'instruments.socialPost',
    ruleCitation: '',
    ruleRange: '',
    noticeDays: null,
    clearDays: false,
    perSittingLimit: null,
    isQuestion: false,
    isNotice: false,
    systemPrompt: `You are the digital officer for a Member of the National Assembly of Pakistan, writing a post for X and Facebook.

One post, under 280 characters. Lead with the action or the number. Politics on Pakistani social media is fast and adversarial — be factual and specific rather than rhetorical, because specifics survive a quote-tweet and adjectives do not. Add two or three hashtags that a Pakistani audience actually uses. Include the constituency code.

Output the post only — no preamble, no commentary, no markdown fences.`,
    formatGuidance: `A single post under 280 characters: the action or figure first, then the constituency, then two or three hashtags.`,
    constraints: [],
  },
];

export const INSTRUMENTS_BY_ID: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i])
);

export function getInstrument(id: string): Instrument | undefined {
  return INSTRUMENTS_BY_ID[id];
}

/** The three instruments the Rule 78 admissibility checker applies to. */
export const QUESTION_INSTRUMENT_IDS: InstrumentId[] = INSTRUMENTS.filter(
  (i) => i.isQuestion
).map((i) => i.id);

// ─────────────────────────────────────────────────────────────────────────────────────
// Rule 78 — admissibility of questions
// ─────────────────────────────────────────────────────────────────────────────────────

export interface Rule78Condition {
  /** "a" … "v", or "q(i)" for the sub-clauses of (q). */
  id: string;
  /** Rendered citation, e.g. "Rule 78(f)". */
  citation: string;
  /** Verbatim text from the 2007 Rules. Trimmed of the leading "it shall not". */
  textEn: string;
  textUr: string;
  /**
   * True where the condition can be decided in code rather than by a model.
   * Only (f) qualifies — a word count is arithmetic, and a checker that gets the
   * arithmetic wrong is worse than no checker.
   */
  deterministic?: boolean;
}

/**
 * All twenty-two conditions of Rule 78, verbatim from the Rules of Procedure and
 * Conduct of Business in the National Assembly, 2007, pp. 32–33.
 *
 * (q) has five sub-clauses in the original. They are listed as separate rows here
 * because they test genuinely different things and a member needs to know which one
 * caught the question.
 */
export const RULE_78_CONDITIONS: Rule78Condition[] = [
  {
    id: 'a',
    citation: 'Rule 78(a)',
    textEn: 'It shall not bring in any name or statement not strictly necessary to make the question intelligible.',
    textUr: 'اس میں کوئی ایسا نام یا بیان شامل نہیں ہو گا جو سوال کو قابلِ فہم بنانے کے لیے سختی سے ضروری نہ ہو۔',
  },
  {
    id: 'b',
    citation: 'Rule 78(b)',
    textEn: 'If it contains a statement, the member shall make himself responsible for the accuracy of the statement.',
    textUr: 'اگر اس میں کوئی بیان شامل ہو تو رکن اس بیان کی صحت کا خود ذمہ دار ہو گا۔',
  },
  {
    id: 'c',
    citation: 'Rule 78(c)',
    textEn: 'It shall not contain arguments, inferences, ironical expressions, imputations, epithets or defamatory statements.',
    textUr: 'اس میں دلائل، نتائج، طنزیہ عبارات، الزامات، القاب یا ہتک آمیز بیانات شامل نہیں ہوں گے۔',
  },
  {
    id: 'd',
    citation: 'Rule 78(d)',
    textEn: 'It shall not ask for an expression of opinion or the solution of an abstract legal question or a hypothetical proposition.',
    textUr: 'اس میں رائے کے اظہار، کسی مجرد قانونی سوال کے حل، یا فرضی مفروضے کا مطالبہ نہیں کیا جائے گا۔',
  },
  {
    id: 'e',
    citation: 'Rule 78(e)',
    textEn: 'It shall not refer to the character or conduct of any person except in his official or public capacity, nor to character or conduct which can be challenged only on a substantive motion.',
    textUr: 'اس میں کسی شخص کے کردار یا طرزِ عمل کا حوالہ اس کی سرکاری یا عوامی حیثیت کے سوا نہیں دیا جائے گا، اور نہ ہی ایسے کردار کا جسے صرف اصولی تحریک کے ذریعے چیلنج کیا جا سکتا ہو۔',
  },
  {
    id: 'f',
    citation: 'Rule 78(f)',
    textEn: 'It shall not ordinarily exceed one hundred and fifty words.',
    textUr: 'یہ عام طور پر ایک سو پچاس الفاظ سے زیادہ نہیں ہو گا۔',
    deterministic: true,
  },
  {
    id: 'g',
    citation: 'Rule 78(g)',
    textEn: 'It shall not relate to a matter which is not primarily the concern of the Government.',
    textUr: 'یہ کسی ایسے معاملے سے متعلق نہیں ہو گا جو بنیادی طور پر حکومت کی ذمہ داری نہ ہو۔',
  },
  {
    id: 'h',
    citation: 'Rule 78(h)',
    textEn: 'It shall not make or imply a charge of a personal character.',
    textUr: 'اس میں ذاتی نوعیت کا الزام نہ لگایا جائے گا اور نہ ہی اس کا اشارہ دیا جائے گا۔',
  },
  {
    id: 'i',
    citation: 'Rule 78(i)',
    textEn: 'It shall not raise a question of policy too large to be dealt with within the limits of an answer to a question.',
    textUr: 'اس میں پالیسی کا ایسا سوال نہیں اٹھایا جائے گا جو کسی سوال کے جواب کی حدود میں نمٹایا نہ جا سکے۔',
  },
  {
    id: 'j',
    citation: 'Rule 78(j)',
    textEn: 'It shall not repeat in substance questions admitted for the same session, or already answered or disallowed by the Speaker, or to which an answer was refused in the Assembly during the last two sessions.',
    textUr: 'یہ اسی سیشن کے لیے منظور شدہ، یا پہلے جواب دیے گئے یا اسپیکر کے مسترد کردہ سوالات، یا جن کا جواب گزشتہ دو سیشنوں میں اسمبلی میں دینے سے انکار کیا گیا ہو، ان کو مضمون کے اعتبار سے نہیں دہرائے گا۔',
  },
  {
    id: 'k',
    citation: 'Rule 78(k)',
    textEn: 'It shall not be trivial, vexatious, vague or meaningless.',
    textUr: 'یہ معمولی، تنگ کرنے والا، مبہم یا بے معنی نہیں ہو گا۔',
  },
  {
    id: 'l',
    citation: 'Rule 78(l)',
    textEn: 'It shall not ask for information contained in documents accessible to the public or in ordinary works of reference.',
    textUr: 'اس میں ایسی معلومات طلب نہیں کی جائیں گی جو عوام کے لیے قابلِ رسائی دستاویزات یا عام حوالہ جاتی کتب میں موجود ہوں۔',
  },
  {
    id: 'm',
    citation: 'Rule 78(m)',
    textEn: 'It shall not ask for information on matters under the control of bodies or persons not primarily responsible to the Government, or in which the Government has no financial interest.',
    textUr: 'اس میں ایسے معاملات پر معلومات طلب نہیں کی جائیں گی جو ان اداروں یا افراد کے زیرِ انتظام ہوں جو بنیادی طور پر حکومت کو جوابدہ نہیں، یا جن میں حکومت کا کوئی مالی مفاد نہ ہو۔',
  },
  {
    id: 'n',
    citation: 'Rule 78(n)',
    textEn: 'It shall not contain references to newspapers by name, and shall not ask whether statements in the press or by private individuals or by non-official bodies are accurate.',
    textUr: 'اس میں اخبارات کا نام لے کر حوالہ نہیں دیا جائے گا، اور نہ یہ پوچھا جائے گا کہ پریس، نجی افراد یا غیر سرکاری اداروں کے بیانات درست ہیں یا نہیں۔',
  },
  {
    id: 'o',
    citation: 'Rule 78(o)',
    textEn: 'It shall not ask for information regarding Cabinet discussions, or any advice given to the President, or in relation to any matter in respect of which there is a constitutional or statutory obligation not to disclose information.',
    textUr: 'اس میں کابینہ کے مباحث، صدر کو دی گئی کسی مشاورت، یا کسی ایسے معاملے سے متعلق معلومات طلب نہیں کی جائیں گی جس کے بارے میں معلومات ظاہر نہ کرنے کی آئینی یا قانونی پابندی ہو۔',
  },
  {
    id: 'p',
    citation: 'Rule 78(p)',
    textEn: 'It shall not ask for information on matters under consideration before a Committee of the Assembly, nor about the proceedings of any such Committee unless those proceedings have been placed before the Assembly or reported by the Committee.',
    textUr: 'اس میں اسمبلی کی کسی کمیٹی کے زیرِ غور معاملات پر معلومات طلب نہیں کی جائیں گی، اور نہ ہی ایسی کمیٹی کی کارروائی کے بارے میں، تاوقتیکہ وہ کارروائی اسمبلی کے سامنے پیش یا کمیٹی کی رپورٹ کے ذریعے رپورٹ نہ کر دی گئی ہو۔',
  },
  {
    id: 'q(i)',
    citation: 'Rule 78(q)(i)',
    textEn: 'It shall not contain any reflection on the conduct of the President or a Judge of the Supreme Court or of a High Court.',
    textUr: 'اس میں صدر، یا سپریم کورٹ یا ہائی کورٹ کے کسی جج کے طرزِ عمل پر کوئی تنقیدی اشارہ شامل نہیں ہو گا۔',
  },
  {
    id: 'q(ii)',
    citation: 'Rule 78(q)(ii)',
    textEn: 'It shall not ask for information on matters which have already been discussed by means of an adjournment motion or otherwise during the same session.',
    textUr: 'اس میں ایسے معاملات پر معلومات طلب نہیں کی جائیں گی جن پر اسی سیشن کے دوران تحریکِ التوا یا کسی اور طریقے سے پہلے ہی بحث ہو چکی ہو۔',
  },
  {
    id: 'q(iii)',
    citation: 'Rule 78(q)(iii)',
    textEn: 'It shall not contain any criticism of the decision of the Assembly or the Senate.',
    textUr: 'اس میں اسمبلی یا سینیٹ کے فیصلے پر کوئی تنقید شامل نہیں ہو گی۔',
  },
  {
    id: 'q(iv)',
    citation: 'Rule 78(q)(iv)',
    textEn: 'It shall not seek information about matters which are in their nature secret or sensitive.',
    textUr: 'اس میں ایسے معاملات کے بارے میں معلومات طلب نہیں کی جائیں گی جو بذاتِ خود خفیہ یا حساس نوعیت کے ہوں۔',
  },
  {
    id: 'q(v)',
    citation: 'Rule 78(q)(v)',
    textEn: 'It shall not criticise or refer discourteously to a foreign country.',
    textUr: 'اس میں کسی غیر ملک پر تنقید یا اس کا غیر مہذب حوالہ نہیں دیا جائے گا۔',
  },
  {
    id: 'r',
    citation: 'Rule 78(r)',
    textEn: 'It shall not contain any reflection on a decision of a court of law or statutory tribunal established in Pakistan, or such remarks as are likely to prejudice a matter which is sub-judice.',
    textUr: 'اس میں پاکستان میں قائم کسی عدالت یا قانونی ٹریبونل کے فیصلے پر کوئی تنقیدی اشارہ، یا ایسے کلمات شامل نہیں ہوں گے جو کسی زیرِ سماعت معاملے کو متاثر کر سکیں۔',
  },
  {
    id: 's',
    citation: 'Rule 78(s)',
    textEn: 'It shall not amount in substance to a suggestion for a particular course of action.',
    textUr: 'یہ مضمون کے اعتبار سے کسی خاص طریقِ کار کی تجویز کے مترادف نہیں ہو گا۔',
  },
  {
    id: 't',
    citation: 'Rule 78(t)',
    textEn: 'It shall not ordinarily ask for information on matters of past history.',
    textUr: 'اس میں عام طور پر ماضی کے تاریخی معاملات کے بارے میں معلومات طلب نہیں کی جائیں گی۔',
  },
  {
    id: 'u',
    citation: 'Rule 78(u)',
    textEn: 'It shall not ordinarily ask about matters pending before any statutory tribunal or authority performing judicial or quasi-judicial functions, or any commission or court of inquiry — though it may refer to procedure, subject or stage of enquiry if that is not likely to prejudice consideration of the matter.',
    textUr: 'اس میں عام طور پر ایسے معاملات کے بارے میں نہیں پوچھا جائے گا جو کسی قانونی ٹریبونل یا عدالتی یا نیم عدالتی اختیارات رکھنے والے ادارے، یا کسی کمیشن یا تحقیقاتی عدالت کے سامنے زیرِ التوا ہوں — البتہ کارروائی کے طریقِ کار، موضوع یا مرحلے کا حوالہ دیا جا سکتا ہے بشرطیکہ اس سے معاملے پر غور متاثر نہ ہو۔',
  },
  {
    id: 'v',
    citation: 'Rule 78(v)',
    textEn: 'It shall not relate to a matter, except as to a matter of fact, which is, or has been, the subject-matter of correspondence between the Federal Government and a Provincial Government.',
    textUr: 'یہ ایسے معاملے سے متعلق نہیں ہو گا — سوائے واقعاتی امر کے — جو وفاقی حکومت اور کسی صوبائی حکومت کے درمیان خط و کتابت کا موضوع ہو یا رہا ہو۔',
  },
];

/** Rule 78(f): "it shall not ordinarily exceed one hundred and fifty words". */
export const RULE_78_WORD_LIMIT = 150;

/**
 * The Rule 78(f) word count — computed here rather than by the model.
 *
 * A model asked "how many words is this?" will produce a plausible number that is
 * usually wrong by five or ten, and the whole value of this screen is that a member can
 * trust the figure. So the arithmetic is done in code and the model is never asked.
 *
 * Counting rules, chosen to match how a Secretariat clerk counts a question paper:
 * - the leading asterisk of a starred question is a Rule 71(2) marker, not a word;
 * - the lettered part markers "(a)", "(b)" … are structure, not words;
 * - "NA-127", "Rs. 2,500" and "district-wise" are each one word — hyphens and commas
 *   inside a token do not split it;
 * - Urdu text splits on whitespace exactly as English does.
 */
export function countQuestionWords(text: string): number {
  const cleaned = text
    // Strip the Rule 71(2) asterisk at the head of a starred question.
    .replace(/^\s*\*+/, ' ')
    // Strip lettered/numbered part markers: (a) (b) (i) (1) at a line or clause start.
    .replace(/(^|\n)\s*\(?[a-z0-9ivx]{1,4}\)\s*/gi, '$1 ')
    // Em/en dashes separate words; hyphens inside a token do not.
    .replace(/[‒-―−]/g, ' ')
    .trim();

  if (!cleaned) return 0;

  return cleaned
    .split(/\s+/)
    .filter((tok) => /[\p{L}\p{N}]/u.test(tok))
    .length;
}

/**
 * Compose the stamp that sits beside a generated draft:
 *   "Rule 71 · 15 clear days' notice · 2 per member per sitting"
 * Returned as parts so the page can wrap each rule number in <Ltr>.
 */
export function ruleStampParts(
  instrument: Instrument,
  locale: 'en' | 'ur'
): string[] {
  const parts: string[] = [];
  if (instrument.ruleCitation) parts.push(instrument.ruleCitation);

  if (instrument.noticeDays !== null) {
    if (instrument.noticeDays === 0) {
      parts.push(
        locale === 'ur' ? 'مختصر نوٹس — وجوہات لازمی' : 'short notice — reasons required'
      );
    } else if (locale === 'ur') {
      parts.push(
        `${instrument.noticeDays} ${instrument.clearDays ? 'صاف دن' : 'دن'} کا نوٹس`
      );
    } else {
      parts.push(
        `${instrument.noticeDays} ${instrument.clearDays ? 'clear days' : 'days'}’ notice`
      );
    }
  }

  if (instrument.perSittingLimit !== null) {
    const n = instrument.perSittingLimit;
    if (instrument.id === 'resolution') {
      parts.push(
        locale === 'ur'
          ? `فی سیشن ${n} فی رکن`
          : `${n} per private member per session`
      );
    } else {
      parts.push(
        locale === 'ur'
          ? `فی اجلاس ${n} فی رکن`
          : `${n} per member per sitting`
      );
    }
  }

  if (instrument.wordLimit) {
    parts.push(
      locale === 'ur'
        ? `${instrument.wordLimit} الفاظ کی حد`
        : `${instrument.wordLimit}-word limit`
    );
  }

  return parts;
}
