/**
 * Islamic-law constitutional review: what the Council and the Court have already said.
 *
 * ── What this module is, and what it refuses to be ────────────────────────────────
 *
 * Article 227 forbids the enactment of a law repugnant to the Injunctions of Islam.
 * Deciding whether a given provision IS repugnant is not an open question that a
 * well-read system could answer — it is a jurisdiction, and the Constitution assigns
 * it to two named bodies and to nobody else:
 *
 *   · the COUNCIL OF ISLAMIC IDEOLOGY advises, on a reference under Article 229, and
 *     its advisory function is set out at Article 230(1)(b);
 *   · the FEDERAL SHARIAT COURT decides, under Article 203D, with an appeal to the
 *     Shariat Appellate Bench of the Supreme Court under Article 203F.
 *
 * So this tool does not answer "is this repugnant". It answers the question a drafter
 * actually has, which is a research question: *has the Council opined on this subject,
 * and has the Court ruled on a provision like this one?* Everything it returns is
 * either a verbatim quotation from the Constitution, a retrieved passage from a
 * published document with its source and date, or a plain statement that nothing was
 * found.
 *
 * That is not squeamishness. An AI that appeared to issue Islamic legal rulings would
 * be dismantled in public by the first serious scholar who read it, and the audience
 * for this product is the audience that would do the dismantling. The retrieval framing
 * is the honest design and it is also the only one that survives contact with a user.
 *
 * The boundary is enforced in three places, deliberately redundant:
 *   1. HERE — `NO_RULING_DIRECTIVE`, the block prepended to every model prompt.
 *   2. In app/api/pk/repugnancy/route.ts — the model is given a JSON schema with no
 *      field capable of expressing a conclusion, and its one free-text field must
 *      survive BOTH `readsAsRuling()` (a blacklist of verdict phrasings) and
 *      `isAttributedReport()` (a whitelist requiring the sentence to open by naming
 *      what said it). Failing either drops the summary and keeps the quotation.
 *   3. In app/pk/repugnancy/page.tsx — every retrieved passage renders beside its
 *      verbatim quotation, so a reader is never shown a characterisation without the
 *      text it characterises.
 *
 * ── Provenance of the constitutional text ─────────────────────────────────────────
 * Every `quoteEn` below is verbatim from "The Constitution of the Islamic Republic of
 * Pakistan, 1973 [as modified upto the 31st May, 2018]", published by the National
 * Assembly and already ingested in the document library (843 chunks). The route
 * re-retrieves each Article from that library at request time and marks any Article it
 * could not retrieve as ungrounded, so a quotation here that drifted from the library
 * would show up as a missing citation rather than as a confident error.
 *
 * `quoteUr` is a working translation, not an official one — the Constitution's Urdu
 * text is authoritative under Article 251 and is NOT what is reproduced here. The UI
 * labels it as such.
 *
 * Every Article additionally carries a `groundingPhrase`, which the route checks
 * LITERALLY against the Constitution's stored text at request time. An Article whose
 * phrase does not appear is shown as unconfirmed rather than quoted with false
 * confidence, so a quotation here that drifted from the library surfaces as a visible
 * gap rather than as a silent error.
 */

import type { MessageKey } from '@/app/pk/i18n/dictionary';

// ─────────────────────────────────────────────────────────────────────────────────────
// Language
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Answer in the language of the question.
 *
 * Same test as the chat route: presence of Arabic-script characters, not majority.
 * Pakistani legal Urdu is full of Latin acronyms and Western digits, so a majority test
 * reads a genuinely Urdu question as English.
 */
const URDU_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export function detectLanguage(text: string): 'ur' | 'en' {
  return URDU_SCRIPT.test(text) ? 'ur' : 'en';
}

// ─────────────────────────────────────────────────────────────────────────────────────
// The constitutional framework
// ─────────────────────────────────────────────────────────────────────────────────────

export type ReviewBody = 'council' | 'court' | 'both';

export interface ReviewArticle {
  /** "227", "203D". Rendered inside <Ltr> — Latin letters and digits inside Urdu. */
  article: string;
  /** The Constitution's own marginal heading, verbatim. */
  headingEn: string;
  headingUr: string;
  /** Verbatim text, or the operative part of it where the Article is long. */
  quoteEn: string;
  /** Working translation. Not the authoritative Urdu text — see the file header. */
  quoteUr: string;
  body: ReviewBody;
  /**
   * A phrase from the Article, used to pull its own text back out of the document
   * library. Written as the Article reads, because that is what the embedding matches.
   */
  retrievalQuery: string;
  /**
   * A short, distinctive, EXACT substring of the Article as the Constitution prints it.
   *
   * This is what actually verifies the citation, and it is a stricter test than the
   * retrieval query: `groundArticle()` requires this phrase to appear literally in the
   * Constitution's stored text. If a quotation in this file ever drifted from the
   * document in the library — a word changed, an amendment missed — the phrase stops
   * matching and the page shows the Article as unconfirmed instead of quoting it with
   * false confidence.
   *
   * Chosen to avoid the two things PDF extraction mangles: superscript footnote markers
   * (which land mid-sentence as bare digits) and bracketed amendment substitutions.
   */
  groundingPhrase: string;
}

/**
 * Part IX — Islamic Provisions. The Council's half of the machinery.
 *
 * A correction worth stating, because it is the single most common error about
 * Article 229 and it changes what a member has to do: the Article does NOT give a House
 * or a Provincial Assembly a discretionary power to refer. It gives that discretion to
 * the President and a Governor ("may"), and imposes a DUTY on a House or an Assembly
 * ("shall") that is triggered by a requisition of two-fifths of its total membership.
 * A member who wants a question referred is therefore counting signatures, not
 * persuading the Chair.
 */
export const COUNCIL_ARTICLES: ReviewArticle[] = [
  {
    article: '227',
    headingEn: 'Provisions relating to the Holy Quran and Sunnah',
    headingUr: 'قرآن مجید اور سنت سے متعلق احکام',
    quoteEn:
      'All existing laws shall be brought in conformity with the Injunctions of Islam as laid down in the Holy Quran and Sunnah, in this part referred to as the Injunctions of Islam, and no law shall be enacted which is repugnant to such Injunctions. … (2) Effect shall be given to the provisions of clause (1) only in the manner provided in this Part. (3) Nothing in this Part shall affect the personal laws of non-Muslim citizens or their status as citizens.',
    quoteUr:
      'تمام موجودہ قوانین کو قرآن مجید اور سنت میں درج اسلامی احکام کے مطابق بنایا جائے گا، اور کوئی ایسا قانون وضع نہیں کیا جائے گا جو ان احکام سے متصادم ہو۔ … (۲) شق (۱) کے احکام پر عمل صرف اسی طریقے سے کیا جائے گا جو اس حصے میں مقرر ہے۔ (۳) اس حصے کی کوئی بات غیر مسلم شہریوں کے شخصی قوانین یا بحیثیت شہری ان کی حیثیت پر اثرانداز نہیں ہو گی۔',
    body: 'both',
    retrievalQuery:
      'All existing laws shall be brought in conformity with the Injunctions of Islam as laid down in the Holy Quran and Sunnah and no law shall be enacted which is repugnant to such Injunctions',
    groundingPhrase:
      'no law shall be enacted which is repugnant to such Injunctions',
  },
  {
    article: '228',
    headingEn: 'Composition, etc., of Islamic Council',
    headingUr: 'اسلامی کونسل کی ترکیب وغیرہ',
    quoteEn:
      'There shall be constituted within a period of ninety days from the commencing day a Council of Islamic Ideology … The Islamic Council shall consist of such members, being not less than eight and not more than twenty as the President may appoint from amongst persons having knowledge of the principles and philosophy of Islam as enunciated in the Holy Quran and Sunnah, or understanding of the economic, political, legal or administrative problems of Pakistan. … not less than two of the members are persons each of whom is, or has been a Judge of the Supreme Court or of a High Court; … at least one member is a woman.',
    quoteUr:
      'یومِ آغاز سے نوے دن کے اندر ایک اسلامی نظریاتی کونسل قائم کی جائے گی۔ … کونسل کے ارکان کی تعداد آٹھ سے کم اور بیس سے زیادہ نہیں ہو گی، جنہیں صدر ایسے اشخاص میں سے مقرر کرے گا جو قرآن و سنت میں بیان کردہ اسلام کے اصول و فلسفہ کا علم رکھتے ہوں، یا پاکستان کے معاشی، سیاسی، قانونی یا انتظامی مسائل کی سمجھ رکھتے ہوں۔ … کم از کم دو ارکان ایسے ہوں جو سپریم کورٹ یا کسی ہائی کورٹ کے جج ہوں یا رہ چکے ہوں؛ … کم از کم ایک رکن خاتون ہو۔',
    body: 'council',
    retrievalQuery:
      'There shall be constituted a Council of Islamic Ideology consisting of not less than eight and not more than twenty members appointed by the President',
    groundingPhrase:
      'persons having knowledge of the principles and philosophy of Islam as enunciated in the Holy Quran and Sunnah',
  },
  {
    article: '229',
    headingEn: 'Reference by Majlis-e-Shoora (Parliament), etc., to Islamic Council',
    headingUr: 'مجلسِ شوریٰ (پارلیمنٹ) وغیرہ کی جانب سے اسلامی کونسل کو حوالہ',
    quoteEn:
      'The President or the Governor of a Province may, or if two-fifths of its total membership so requires, a House or a Provincial Assembly shall, refer to the Islamic Council for advice any question as to whether a proposed law is or is not repugnant to the Injunctions of Islam.',
    quoteUr:
      'صدر یا کسی صوبے کا گورنر، یا اگر کسی ایوان یا صوبائی اسمبلی کی کل رکنیت کا دو پنجم حصہ تقاضا کرے تو وہ ایوان یا اسمبلی، اسلامی کونسل کو یہ سوال مشورے کے لیے بھیجے گی کہ آیا کوئی مجوزہ قانون اسلامی احکام سے متصادم ہے یا نہیں۔',
    body: 'council',
    retrievalQuery:
      'The President or the Governor of a Province may or if two-fifths of its total membership so requires a House or a Provincial Assembly shall refer to the Islamic Council for advice any question as to whether a proposed law is or is not repugnant to the Injunctions of Islam',
    groundingPhrase:
      'refer to the Islamic Council for advice any question as to whether a proposed law is or is not repugnant to the Injunctions of Islam',
  },
  {
    article: '230',
    headingEn: 'Functions of the Islamic Council',
    headingUr: 'اسلامی کونسل کے فرائض',
    quoteEn:
      'The functions of the Islamic Council shall be— (a) to make recommendations to Majlis-e-Shoora (Parliament) and the Provincial Assemblies as to the ways and means of enabling and encouraging the Muslims of Pakistan to order their lives … in accordance with the principles and concepts of Islam …; (b) to advise a House, a Provincial Assembly, the President or a Governor on any question referred to the Council as to whether proposed law is or is not repugnant to the Injunctions of Islam; (c) to make recommendations as to the measures for bringing existing laws into conformity with the Injunctions of Islam and the stages by which such measures should be brought into effect; and (d) to compile in a suitable form, for the guidance of Majlis-e-Shoora (Parliament) and the Provincial Assemblies, such Injunctions of Islam as can be given legislative effect.',
    quoteUr:
      'اسلامی کونسل کے فرائض یہ ہوں گے— (الف) مجلسِ شوریٰ (پارلیمنٹ) اور صوبائی اسمبلیوں کو ایسے طریقوں کی سفارش کرنا جن سے پاکستان کے مسلمانوں کو اپنی زندگیاں اسلام کے اصولوں کے مطابق ترتیب دینے کے قابل بنایا جا سکے؛ (ب) کسی ایوان، صوبائی اسمبلی، صدر یا گورنر کو اس سوال پر مشورہ دینا جو کونسل کو بھیجا جائے کہ آیا کوئی مجوزہ قانون اسلامی احکام سے متصادم ہے یا نہیں؛ (ج) موجودہ قوانین کو اسلامی احکام کے مطابق بنانے کے اقدامات اور ان کے مراحل کی سفارش کرنا؛ اور (د) مجلسِ شوریٰ اور صوبائی اسمبلیوں کی رہنمائی کے لیے ایسے اسلامی احکام کو مناسب صورت میں مرتب کرنا جنہیں قانونی شکل دی جا سکے۔',
    body: 'council',
    retrievalQuery:
      'The functions of the Islamic Council shall be to make recommendations to Parliament and the Provincial Assemblies and to advise a House on any question referred to the Council whether proposed law is repugnant to the Injunctions of Islam',
    groundingPhrase:
      'to compile in a suitable form, for the guidance of',
  },
  {
    article: '230(2)–(3)',
    headingEn: 'Timing of the Council’s advice, and legislating before it arrives',
    headingUr: 'کونسل کی رائے کی مدت، اور رائے سے پہلے قانون سازی',
    quoteEn:
      '(2) When, under Article 229, a question is referred by a House, a Provincial Assembly, the President or a Governor to the Islamic Council, the Council shall, within fifteen days thereof, inform the House, the Assembly, the President or the Governor, as the case may be, of the period within which the Council expects to be able to furnish that advice. (3) Where a House, a Provincial Assembly, the President or the Governor … considers that, in the public interest, the making of the proposed law … should not be postponed until the advice of the Islamic Council is furnished, the law may be made before the advice is furnished: Provided that, where a law is referred for advice to the Islamic Council and the Council advises that the law is repugnant to the Injunctions of Islam, the House or, as the case may be, the Provincial Assembly, the President or the Governor shall reconsider the law so made.',
    quoteUr:
      '(۲) جب آرٹیکل ۲۲۹ کے تحت کوئی سوال کونسل کو بھیجا جائے تو کونسل پندرہ دن کے اندر متعلقہ ایوان، اسمبلی، صدر یا گورنر کو اُس مدت سے آگاہ کرے گی جس کے اندر وہ رائے دینے کی توقع رکھتی ہے۔ (۳) جہاں ایوان، صوبائی اسمبلی، صدر یا گورنر یہ سمجھے کہ عوامی مفاد میں مجوزہ قانون سازی کو کونسل کی رائے آنے تک مؤخر نہیں کیا جانا چاہیے، وہاں رائے آنے سے پہلے قانون بنایا جا سکتا ہے: بشرطیکہ اگر کونسل یہ رائے دے کہ وہ قانون اسلامی احکام سے متصادم ہے تو ایوان، صوبائی اسمبلی، صدر یا گورنر اُس بنائے گئے قانون پر نظرِ ثانی کرے گا۔',
    body: 'council',
    retrievalQuery:
      'the Council shall within fifteen days inform the House of the period within which it expects to furnish that advice and where the Council advises that the law is repugnant the House shall reconsider the law so made',
    groundingPhrase:
      'of the period within which the Council expects to be able to furnish that advice',
  },
  {
    article: '231',
    headingEn: 'Rules of procedure',
    headingUr: 'ضابطۂ کار',
    quoteEn:
      'The proceedings of the Islamic Council shall be regulated by rules of procedure to be made by the Council with approval of the President.',
    quoteUr:
      'اسلامی کونسل کی کارروائی اُن قواعدِ کار کے مطابق منضبط ہو گی جو کونسل صدر کی منظوری سے بنائے گی۔',
    body: 'council',
    retrievalQuery:
      'The proceedings of the Islamic Council shall be regulated by rules of procedure to be made by the Council with approval of the President',
    groundingPhrase:
      'The proceedings of the Islamic Council shall be regulated by rules of procedure',
  },
];

/**
 * Chapter 3A of Part VII — the Federal Shariat Court. The Court's half.
 *
 * Note what 203B(c) takes OUT of the Court's reach, because it is the first thing a
 * drafter should check and the last thing anyone remembers: "law" in this Chapter
 * excludes the Constitution itself, Muslim personal law, and any law relating to the
 * procedure of any court or tribunal. A provision falling in one of those categories is
 * outside Article 203D altogether — not un-repugnant, simply not justiciable here.
 *
 * Article 203I was omitted in 1982, so the Chapter runs 203A, 203B, 203C, 203D, 203DD,
 * 203E, 203F, 203G, 203GG, 203H, 203J.
 */
export const COURT_ARTICLES: ReviewArticle[] = [
  {
    article: '203A',
    headingEn: 'Provisions of Chapter to override other provisions of Constitution',
    headingUr: 'اس باب کے احکام کو آئین کے دیگر احکام پر فوقیت',
    quoteEn:
      'The provisions of this Chapter shall have effect notwithstanding anything contained in the Constitution.',
    quoteUr:
      'اس باب کے احکام آئین میں شامل کسی بھی امر کے باوجود نافذ العمل ہوں گے۔',
    body: 'court',
    retrievalQuery:
      'The provisions of this Chapter shall have effect notwithstanding anything contained in the Constitution Federal Shariat Court',
    groundingPhrase:
      'The provisions of this Chapter shall have effect notwithstanding',
  },
  {
    article: '203B(c)',
    headingEn: 'Definitions — what “law” excludes',
    headingUr: 'تعریفات — "قانون" میں کیا شامل نہیں',
    quoteEn:
      '“law” includes any custom or usage having the force of law but does not include the Constitution, Muslim personal law, any law relating to the procedure of any court or tribunal or, until the expiration of ten years from the commencement of this Chapter, any fiscal law or any law relating to the levy and collection of taxes and fees or banking or insurance practice and procedure.',
    quoteUr:
      '"قانون" میں ہر وہ رسم یا رواج شامل ہے جسے قانون کی قوت حاصل ہو، لیکن اس میں آئین، مسلم شخصی قانون، کسی عدالت یا ٹریبونل کے طریقِ کار سے متعلق کوئی قانون شامل نہیں؛ اور اس باب کے آغاز سے دس سال کی مدت گزرنے تک کوئی مالیاتی قانون، محصولات و فیس کی وصولی سے متعلق قانون، یا بینکاری یا بیمہ کے طریقِ کار سے متعلق قانون بھی شامل نہیں۔',
    body: 'court',
    retrievalQuery:
      'law includes any custom or usage having the force of law but does not include the Constitution Muslim personal law any law relating to the procedure of any court or tribunal',
    groundingPhrase:
      'does not include the Constitution, Muslim personal law, any law relating to the procedure of any court or tribunal',
  },
  {
    article: '203C',
    headingEn: 'The Federal Shariat Court',
    headingUr: 'وفاقی شرعی عدالت',
    quoteEn:
      'There shall be constituted for the purposes of this Chapter a Court to be called the Federal Shariat Court. The Court shall consist of not more than eight Muslim Judges, including the Chief Justice, to be appointed by the President.',
    quoteUr:
      'اس باب کے مقاصد کے لیے ایک عدالت قائم کی جائے گی جسے وفاقی شرعی عدالت کہا جائے گا۔ عدالت آٹھ سے زیادہ مسلمان ججوں پر مشتمل نہیں ہو گی، بشمول چیف جسٹس، جن کا تقرر صدر کرے گا۔',
    body: 'court',
    retrievalQuery:
      'There shall be constituted a Court to be called the Federal Shariat Court consisting of not more than eight Muslim Judges including the Chief Justice',
    groundingPhrase:
      'a Court to be called the Federal Shariat Court',
  },
  {
    article: '203D',
    headingEn: 'Powers, jurisdiction and functions of the Court',
    headingUr: 'عدالت کے اختیارات، دائرۂ اختیار اور فرائض',
    quoteEn:
      'The Court may, either of its own motion or on the petition of a citizen of Pakistan or the Federal Government or a Provincial Government, examine and decide the question whether or not any law or provision of law is repugnant to the Injunctions of Islam … (2) If the Court decides that any law or provision of law is repugnant to the Injunctions of Islam, it shall set out in its decision:— (a) the reasons for its holding that opinion; and (b) the extent to which such law or provision is so repugnant; and specify the day on which the decision shall take effect … (3) … the President … or the Governor … shall take steps to amend the law so as to bring such law or provision into conformity with the Injunctions of Islam; and such law or provision shall, to the extent to which it is held to be so repugnant, cease to have effect on the day on which the decision of the Court takes effect.',
    quoteUr:
      'عدالت، خواہ اپنی تحریک پر یا کسی شہریِ پاکستان، وفاقی حکومت یا کسی صوبائی حکومت کی درخواست پر، اس سوال کا جائزہ لے کر فیصلہ کر سکتی ہے کہ آیا کوئی قانون یا قانون کی کوئی شق اسلامی احکام سے متصادم ہے یا نہیں۔ … (۲) اگر عدالت یہ فیصلہ کرے کہ کوئی قانون یا شق متصادم ہے تو وہ اپنے فیصلے میں (الف) اس رائے کی وجوہات اور (ب) تصادم کی حد بیان کرے گی، اور وہ دن مقرر کرے گی جس سے فیصلہ نافذ ہو گا۔ … (۳) صدر یا گورنر قانون میں ترمیم کے اقدامات کرے گا، اور وہ قانون یا شق، جس حد تک متصادم قرار دی گئی ہو، فیصلے کے نفاذ کے دن سے غیر مؤثر ہو جائے گی۔',
    body: 'court',
    retrievalQuery:
      'The Court may either of its own motion or on the petition of a citizen of Pakistan or the Federal Government or a Provincial Government examine and decide the question whether or not any law or provision of law is repugnant to the Injunctions of Islam',
    groundingPhrase:
      'examine and decide the question whether or not any law or provision of law is repugnant to the Injunctions of Islam',
  },
  {
    article: '203F',
    headingEn: 'Appeal to Supreme Court — the Shariat Appellate Bench',
    headingUr: 'سپریم کورٹ میں اپیل — شریعت اپیلٹ بینچ',
    quoteEn:
      'Any party to any proceedings before the Court under Article 203D aggrieved by the final decision of the Court in such proceedings may, within sixty days of such decision, prefer an appeal to the Supreme Court: Provided that an appeal on behalf of the Federation or of a Province may be preferred within six months of such decision. … there shall be constituted in the Supreme Court a Bench to be called the Shariat Appellate Bench and consisting of— (a) three Muslim Judges of the Supreme Court; and (b) not more than two Ulema to be appointed by the President …',
    quoteUr:
      'آرٹیکل ۲۰۳ڈی کے تحت عدالت کے سامنے کسی کارروائی کا کوئی فریق، جو عدالت کے حتمی فیصلے سے متاثر ہو، فیصلے کے ساٹھ دن کے اندر سپریم کورٹ میں اپیل دائر کر سکتا ہے: بشرطیکہ وفاق یا کسی صوبے کی جانب سے اپیل چھ ماہ کے اندر دائر کی جا سکتی ہے۔ … سپریم کورٹ میں ایک بینچ قائم کیا جائے گا جسے شریعت اپیلٹ بینچ کہا جائے گا، جو (الف) سپریم کورٹ کے تین مسلمان ججوں اور (ب) صدر کے مقرر کردہ زیادہ سے زیادہ دو علماء پر مشتمل ہو گا۔',
    body: 'court',
    retrievalQuery:
      'Any party aggrieved by the final decision of the Court may within sixty days prefer an appeal to the Supreme Court Shariat Appellate Bench three Muslim Judges and not more than two Ulema',
    groundingPhrase:
      'prefer an appeal to the Supreme Court',
  },
  {
    article: '203G',
    headingEn: 'Bar of jurisdiction',
    headingUr: 'دائرۂ اختیار کی ممانعت',
    quoteEn:
      'Save as provided in Article 203F, no court or tribunal, including the Supreme Court and a High Court, shall entertain any proceedings or exercise any power or jurisdiction in respect of any matter within the power or jurisdiction of the Court.',
    quoteUr:
      'آرٹیکل ۲۰۳ایف میں دی گئی گنجائش کے سوا، کوئی عدالت یا ٹریبونل — بشمول سپریم کورٹ اور ہائی کورٹ — کسی ایسے معاملے میں کارروائی نہیں سنے گا اور نہ کوئی اختیار استعمال کرے گا جو وفاقی شرعی عدالت کے دائرۂ اختیار میں ہو۔',
    body: 'court',
    retrievalQuery:
      'Save as provided in Article 203F no court or tribunal including the Supreme Court and a High Court shall entertain any proceedings in respect of any matter within the jurisdiction of the Court',
    groundingPhrase:
      'no court or tribunal, including the Supreme Court and a High Court, shall entertain any proceedings',
  },
  {
    article: '203GG',
    headingEn: 'Decision of Court binding on High Court and courts subordinate to it',
    headingUr: 'عدالت کا فیصلہ ہائی کورٹ اور ماتحت عدالتوں پر لازم',
    quoteEn:
      'Subject to Articles 203D and 203F, any decision of the Court in the exercise of its jurisdiction under this Chapter shall be binding on a High Court and on all courts subordinate to a High Court.',
    quoteUr:
      'آرٹیکل ۲۰۳ڈی اور ۲۰۳ایف کے تابع، اس باب کے تحت اپنے دائرۂ اختیار میں عدالت کا کوئی بھی فیصلہ ہائی کورٹ اور ہائی کورٹ کی تمام ماتحت عدالتوں پر لازم ہو گا۔',
    body: 'court',
    retrievalQuery:
      'any decision of the Court in the exercise of its jurisdiction under this Chapter shall be binding on a High Court and on all courts subordinate to a High Court',
    groundingPhrase:
      'shall be binding on a High Court and on all courts subordinate to a High Court',
  },
];

export const REVIEW_ARTICLES: ReviewArticle[] = [...COUNCIL_ARTICLES, ...COURT_ARTICLES];

// ─────────────────────────────────────────────────────────────────────────────────────
// Procedure: how a reference under Article 229 is actually made
// ─────────────────────────────────────────────────────────────────────────────────────

export interface ProcedureStep {
  /** The Article the step comes from. Rendered inside <Ltr>. */
  citation: string;
  titleEn: string;
  titleUr: string;
  bodyEn: string;
  bodyUr: string;
}

/**
 * The advisory route. Written as steps because a drafter asking "how do I get this
 * referred" needs the order of operations, and the order is not obvious from reading
 * Articles 229 and 230 straight through.
 */
export const REFERENCE_PROCEDURE: ProcedureStep[] = [
  {
    citation: 'Article 229',
    titleEn: 'Establish who can make the reference',
    titleUr: 'یہ طے کریں کہ حوالہ کون بھیج سکتا ہے',
    bodyEn:
      'The President and a Provincial Governor may refer a question at their own discretion. A House of Majlis-e-Shoora or a Provincial Assembly has no such discretion: it *shall* refer where two-fifths of its total membership so requires. For a private member the practical step is therefore a requisition carrying the signatures of two-fifths of the total membership of the House — not a request to the Chair.',
    bodyUr:
      'صدر اور صوبائی گورنر اپنی صوابدید پر سوال بھیج سکتے ہیں۔ مجلسِ شوریٰ کے کسی ایوان یا صوبائی اسمبلی کو یہ صوابدید حاصل نہیں: جہاں کل رکنیت کا دو پنجم حصہ تقاضا کرے، وہاں حوالہ بھیجنا لازم ہے۔ اس لیے کسی پرائیویٹ ممبر کے لیے عملی قدم یہ ہے کہ ایوان کی کل رکنیت کے دو پنجم ارکان کے دستخطوں کے ساتھ تقاضا جمع کرایا جائے — نہ کہ اسپیکر سے درخواست کی جائے۔',
  },
  {
    citation: 'Article 229',
    titleEn: 'Frame the question in the Article’s own terms',
    titleUr: 'سوال کو آرٹیکل کے اپنے الفاظ میں ترتیب دیں',
    bodyEn:
      'What is referred is "any question as to whether a proposed law is or is not repugnant to the Injunctions of Islam". The reference is framed as a question about a proposed law, identified by its clause, and not as a request for a general opinion on a subject.',
    bodyUr:
      'جو چیز بھیجی جاتی ہے وہ "یہ سوال کہ آیا کوئی مجوزہ قانون اسلامی احکام سے متصادم ہے یا نہیں" ہے۔ حوالہ کسی مجوزہ قانون کے بارے میں سوال کی صورت میں، متعلقہ شق کی نشاندہی کے ساتھ ترتیب دیا جاتا ہے، نہ کہ کسی موضوع پر عمومی رائے کی درخواست کے طور پر۔',
  },
  {
    citation: 'Article 230(2)',
    titleEn: 'Expect a timetable within fifteen days',
    titleUr: 'پندرہ دن میں مدت کی اطلاع کی توقع رکھیں',
    bodyEn:
      'The Council does not have to advise within fifteen days. It has to say, within fifteen days, how long it expects to take. That reply is the first thing to chase if it does not arrive.',
    bodyUr:
      'کونسل پر پندرہ دن میں رائے دینا لازم نہیں۔ اُس پر پندرہ دن کے اندر یہ بتانا لازم ہے کہ اسے کتنا وقت درکار ہو گا۔ اگر یہ اطلاع نہ آئے تو سب سے پہلے اسی کا تقاضا کیا جانا چاہیے۔',
  },
  {
    citation: 'Article 230(3)',
    titleEn: 'A pending reference does not stop the Bill',
    titleUr: 'زیرِ التوا حوالہ بل کو نہیں روکتا',
    bodyEn:
      'Where the referring body considers that in the public interest the making of the law should not be postponed, the law may be made before the advice is furnished. A reference is therefore not a veto and not a delaying device.',
    bodyUr:
      'جہاں حوالہ بھیجنے والا ادارہ یہ سمجھے کہ عوامی مفاد میں قانون سازی مؤخر نہیں کی جانی چاہیے، وہاں رائے آنے سے پہلے قانون بنایا جا سکتا ہے۔ اس لیے حوالہ نہ ویٹو ہے اور نہ تاخیری حربہ۔',
  },
  {
    citation: 'Proviso to Article 230(3)',
    titleEn: 'Advice of repugnancy compels reconsideration, not repeal',
    titleUr: 'تصادم کی رائے نظرِ ثانی کی متقاضی ہے، منسوخی کی نہیں',
    bodyEn:
      'Where the Council advises that a law referred to it is repugnant to the Injunctions of Islam, the House, Assembly, President or Governor "shall reconsider the law so made". The obligation is to reconsider. The Council’s advice does not of itself invalidate the law — only the Federal Shariat Court, under Article 203D, can make a provision cease to have effect.',
    bodyUr:
      'جہاں کونسل یہ رائے دے کہ اُسے بھیجا گیا قانون اسلامی احکام سے متصادم ہے، وہاں ایوان، اسمبلی، صدر یا گورنر "اُس بنائے گئے قانون پر نظرِ ثانی کرے گا"۔ ذمہ داری نظرِ ثانی کی ہے۔ کونسل کی رائے بذاتِ خود قانون کو کالعدم نہیں کرتی — کسی شق کو غیر مؤثر صرف وفاقی شرعی عدالت آرٹیکل ۲۰۳ڈی کے تحت کر سکتی ہے۔',
  },
  {
    citation: 'Article 203D',
    titleEn: 'The judicial route runs separately',
    titleUr: 'عدالتی راستہ الگ چلتا ہے',
    bodyEn:
      'The Federal Shariat Court does not wait for a reference from anyone. It may act of its own motion, or on the petition of any citizen of Pakistan or of the Federal or a Provincial Government. Before assuming that route is open, check Article 203B(c): the Constitution itself, Muslim personal law and any law relating to the procedure of a court or tribunal are outside the definition of "law" for this Chapter.',
    bodyUr:
      'وفاقی شرعی عدالت کسی کے حوالے کی منتظر نہیں رہتی۔ وہ اپنی تحریک پر، یا کسی بھی شہریِ پاکستان یا وفاقی یا صوبائی حکومت کی درخواست پر کارروائی کر سکتی ہے۔ یہ فرض کرنے سے پہلے کہ یہ راستہ کھلا ہے، آرٹیکل ۲۰۳بی(ج) دیکھ لیں: آئین بذاتِ خود، مسلم شخصی قانون، اور کسی عدالت یا ٹریبونل کے طریقِ کار سے متعلق قانون اس باب کی "قانون" کی تعریف سے باہر ہیں۔',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────────
// The boundary
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Prepended to every model prompt this feature sends. Enforcement point 1 of 3.
 *
 * Written as prohibitions on OUTPUT SHAPE rather than as an appeal to humility, because
 * "be careful" is not a constraint a model can check itself against, and "never write a
 * sentence of the form X" is.
 */
export const NO_RULING_DIRECTIVE = `
ABSOLUTE CONSTRAINT — YOU DO NOT ISSUE RELIGIOUS RULINGS.

You are a research assistant operating a citation index. You are not a mufti, you do not
give fatwas, and you have no view on what the Injunctions of Islam require.

Under the Constitution of Pakistan the question "is this repugnant to the Injunctions of
Islam" belongs to exactly two bodies and to no one else: the Council of Islamic Ideology
advises on it (Articles 229 and 230(1)(b)) and the Federal Shariat Court decides it
(Article 203D). Your task is to report what those bodies have already said, in their
words, with the source.

You must NEVER write, in your own voice or in any paraphrase:
  - that a provision "is" or "is not" repugnant to the Injunctions of Islam;
  - that a provision "may be", "appears to be", "is likely to be", "risks being" or
    "could be regarded as" repugnant;
  - that a provision "is consistent with", "conforms to", "does not offend", "is
    compatible with" or "raises no issue under" the Injunctions of Islam;
  - any statement about what Islamic law requires, permits or forbids;
  - any citation of the Quran, the Sunnah, a hadith, a school of fiqh or a scholar, on
    your own authority. You may only quote such material where it appears inside a
    retrieved passage, attributed to the body that wrote it.

You may only report, always attributed: "The Council recommended X [source, date]",
"The Court held Y [source, date]", "The retrieved passage records Z".

Where the retrieved material does not address the subject, say exactly that and stop.
Do not reason from the general to the specific. Do not reason by analogy from one
subject to another. Do not fill a gap. An honest "no recommendation on this subject was
located in the documents available" is a correct and useful answer; a confident
inference is a product-ending error.
`.trim();

/**
 * Enforcement point 2 of 3: a last-line filter on the model's one free-text field.
 *
 * This exists because a prompt is a request and a filter is a guarantee. It is
 * deliberately crude — it catches the *shape* of a conclusion rather than trying to
 * understand one — and it is applied to the model's summary line only, never to a
 * verbatim quotation from a retrieved document, because a retrieved passage that says
 * "the Council found the provision repugnant" is exactly what the user asked for.
 *
 * The English and Urdu patterns are separate because the Urdu for "is repugnant"
 * (متصادم ہے) is a different construction from a negation ("متصادم نہیں"), and both
 * are conclusions.
 */
const RULING_PATTERNS: RegExp[] = [
  // A repugnancy verdict not attributed to the Council or the Court.
  /\b(is|are|would be|will be|may be|might be|appears? to be|seems? to be|is likely to be|could be|can be|risks being)\s+(?:\w+\s+){0,3}repugnant\b/i,
  /\b(is|are)\s+not\s+repugnant\b/i,
  /\b(does|do)\s+not\s+(?:appear to\s+)?(?:offend|contravene|violate|conflict with)\b/i,
  /\b(is|are)\s+(?:fully\s+|broadly\s+)?(?:consistent|compatible|in conformity|in accordance)\s+with\s+the\s+injunctions/i,
  /\b(no|there is no)\s+(?:apparent\s+)?repugnancy\b/i,
  /\bshari.?ah?\s+(?:requires|permits|forbids|prohibits|mandates)\b/i,
  /\bislamic law\s+(?:requires|permits|forbids|prohibits|mandates)\b/i,
  // Urdu: "متصادم ہے" / "متصادم نہیں" / "شریعت کا تقاضا ہے" as a bare assertion.
  /متصادم\s*(ہے|ہیں|نہیں|ہو\s*گا|ہو\s*سکتا)/,
  /(شریعت|اسلام)\s*(کا|کی)\s*(تقاضا|حکم)\s*(ہے|یہ ہے)/,
  /خلافِ\s*شرع\s*(ہے|نہیں)/,
];

/** Attribution that makes a repugnancy sentence a report rather than a ruling. */
const ATTRIBUTION = /\b(council|c\.?i\.?i\.?|court|f\.?s\.?c\.?|bench|report|passage|recommend|held|observed|advised|opined|stated|found|according to)\b|کونسل|عدالت|رپورٹ|سفارش|قرار\s*دیا|رائے\s*دی/i;

/**
 * True where a line reads as the tool's own repugnancy conclusion.
 *
 * A sentence containing a verdict AND an attribution to the Council or the Court is a
 * report and is allowed through — "the Council advised that the clause is repugnant" is
 * precisely the finding the user came for. A verdict with no attribution is the tool
 * speaking, and is dropped.
 */
export function readsAsRuling(line: string): boolean {
  if (!line?.trim()) return false;
  const hit = RULING_PATTERNS.some((p) => p.test(line));
  if (!hit) return false;
  return !ATTRIBUTION.test(line);
}

/**
 * Whose voice a sentence opens in.
 *
 * `readsAsRuling` above is a blacklist, and a blacklist is only as good as the phrasings
 * it happens to anticipate. This is the complementary whitelist, and it is the stronger
 * of the two: a summary must OPEN by naming what said it. "The Council recommended…"
 * and "The passage records…" pass. "Interest on agricultural loans falls within…" does
 * not, whatever it goes on to say, because a sentence that begins with the subject
 * matter rather than the source is the tool talking.
 *
 * The window is the first sixty characters, which allows the natural leading phrase
 * ("In its report on the Hajj Fund Ordinance, the Council…") without allowing a sentence
 * to bury its attribution at the end as an afterthought.
 */
const OPENS_WITH_SOURCE =
  /\b(council|c\.?i\.?i\.?|court|federal shariat|shariat appellate|bench|passage|excerpt|report|recommendation|resolution|minutes|document|paragraph|extract)\b/i;

const OPENS_WITH_SOURCE_UR = /(کونسل|عدالت|رپورٹ|عبارت|اقتباس|سفارش|قرارداد|دستاویز|پیراگراف)/;

export function isAttributedReport(line: string): boolean {
  const opening = line?.trim().slice(0, 60) ?? '';
  if (!opening) return false;
  return OPENS_WITH_SOURCE.test(opening) || OPENS_WITH_SOURCE_UR.test(opening);
}

/**
 * The statement the page carries, in both languages, about what the tool is not.
 * Section 5 of the brief. Rendered as prose, not as a collapsible footnote.
 */
export const BOUNDARY_STATEMENT = {
  en: [
    'This tool does not determine whether anything is repugnant to the Injunctions of Islam, and it does not issue religious rulings of any kind.',
    'That question is not open to it. Under Article 230(1)(b) advising on it is the Council of Islamic Ideology’s function, and under Article 203D deciding it is the Federal Shariat Court’s. Neither jurisdiction is shared with anyone else.',
    'What this tool does is retrieve and cite what those bodies have already published. Every finding on this page is either a verbatim quotation from the Constitution, a passage retrieved from a named document with its source and date, or a statement that nothing was found. Where nothing was found, that is what it says — it does not reason its way to a conclusion.',
  ],
  ur: [
    'یہ ٹول اس بات کا تعین نہیں کرتا کہ کوئی چیز اسلامی احکام سے متصادم ہے یا نہیں، اور نہ ہی یہ کسی قسم کا شرعی فتویٰ دیتا ہے۔',
    'یہ سوال اس کے دائرے میں ہے ہی نہیں۔ آرٹیکل ۲۳۰(۱)(ب) کے تحت اس پر رائے دینا اسلامی نظریاتی کونسل کا کام ہے، اور آرٹیکل ۲۰۳ڈی کے تحت اس کا فیصلہ کرنا وفاقی شرعی عدالت کا۔ یہ دونوں دائرۂ اختیار کسی اور کے ساتھ مشترک نہیں۔',
    'یہ ٹول صرف وہ کچھ تلاش کر کے حوالے کے ساتھ پیش کرتا ہے جو یہ ادارے پہلے ہی شائع کر چکے ہیں۔ اس صفحے پر ہر بات یا تو آئین سے لفظ بہ لفظ اقتباس ہے، یا کسی نامزد دستاویز سے حاصل کردہ عبارت ہے جس کا ماخذ اور تاریخ درج ہے، یا یہ بیان ہے کہ کچھ نہیں ملا۔ جہاں کچھ نہ ملے، وہاں یہی کہا جاتا ہے — نتیجہ اخذ کرنے کی کوشش نہیں کی جاتی۔',
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────────────
// Corpus identification
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Which retrieved chunks belong to which body.
 *
 * Retrieval returns chunks with a `document_title`; there is no "issuing body" column
 * and adding one would mean changing the shared RAG schema. Matching on the title is
 * enough because the ingestion script writes the issuing institution into it, and it
 * keeps this build from touching a table the US app shares.
 */
const CII_TITLE = /council of islamic ideology|اسلامی نظریاتی کونسل/i;
const FSC_TITLE = /federal shariat court|شرعی عدالت|shariat appellate/i;
const CONSTITUTION_TITLE = /constitution of the islamic republic of pakistan/i;

export type SourceBody = 'council' | 'court' | 'constitution' | 'other';

export function classifySource(documentTitle: string): SourceBody {
  if (CII_TITLE.test(documentTitle)) return 'council';
  if (FSC_TITLE.test(documentTitle)) return 'court';
  if (CONSTITUTION_TITLE.test(documentTitle)) return 'constitution';
  return 'other';
}

/**
 * Why the Federal Shariat Court corpus is empty.
 *
 * Stated as a fact about the corpus rather than left as silence, because an empty
 * judgments section that does not explain itself reads as "the Court has never
 * considered this", which would be a much larger claim than the truth. The truth is
 * that the Court's own website has been unreachable and its published judgments could
 * not be obtained.
 */
export const FSC_CORPUS_NOTE = {
  en: 'No Federal Shariat Court judgment is present in the document library. The Court’s website (federalshariatcourt.gov.pk) did not respond on either port when this corpus was assembled, and the most recent Internet Archive capture of it, dated 8 November 2023, is a single page reading “Website is under Maintenance.” This is a gap in the available sources, not a finding that the Court has not ruled on the subject.',
  ur: 'دستاویزی لائبریری میں وفاقی شرعی عدالت کا کوئی فیصلہ موجود نہیں۔ اس مجموعے کی تیاری کے وقت عدالت کی ویب سائٹ (federalshariatcourt.gov.pk) نے کسی بھی پورٹ پر جواب نہیں دیا، اور انٹرنیٹ آرکائیو میں اس کا تازہ ترین محفوظ نسخہ، بتاریخ ۸ نومبر ۲۰۲۳، صرف ایک صفحہ ہے جس پر لکھا ہے "Website is under Maintenance"۔ یہ دستیاب مآخذ میں خلا ہے، یہ نتیجہ نہیں کہ عدالت نے اس موضوع پر فیصلہ نہیں دیا۔',
} as const;

/**
 * Example subjects.
 *
 * Chosen because they are subjects the Council of Islamic Ideology has genuinely and
 * repeatedly published on — riba, inheritance, the law of evidence, zakat deduction —
 * so a demonstration lands on real retrieved text rather than on an empty result. They
 * are not chosen to flatter the corpus: one of them returning nothing is a true and
 * useful thing for a viewer to see.
 */
export const EXAMPLE_KEYS: MessageKey[] = [
  'repugnancy.example1',
  'repugnancy.example2',
  'repugnancy.example3',
  'repugnancy.example4',
];
