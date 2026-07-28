/**
 * Constituent casework taxonomy for Pakistan.
 *
 * Deliberately the same JSON shape as `lib/casecompass.ts` — `{metadata, data}` with
 * `label_id / name / tier / description / children` — so the classify route is a mirror
 * of the US one rather than a second architecture. Two fields are added, and both of
 * them carry weight:
 *
 *   `jurisdiction`  'federal' | 'provincial' | 'shared'
 *   `escalation`    where the case actually gets filed
 *
 * ── Why jurisdiction is not cosmetic ────────────────────────────────────────────────
 * After the Eighteenth Amendment abolished the Concurrent Legislative List in 2010,
 * police, land records, school education, local government and health service delivery
 * are provincial subjects. A Member of the **National** Assembly has no formal locus on
 * any of them. An MNA who writes to a District Police Officer about an FIR is writing as
 * a private citizen with influence, not as a legislator with a remit — and the honest
 * thing for this product to do is say so and point at the MPA or the provincial
 * ombudsman. A casework tool that quietly accepts an FIR case and produces a letter is
 * teaching the office a bad habit.
 *
 * ── Why the tier-1 ordering is what it is ───────────────────────────────────────────
 * The order is not alphabetical and not a guess. It follows complaint volumes in the
 * **Wafaqi Mohtasib (Federal Ombudsman) Annual Report 2024**, Table-5 "Volume of
 * Complaints Against Key Agencies", which recorded 226,372
 * complaints. The agency ranking used here is:
 *
 *   LESCO 39,520 · MEPCO 20,241 · BISP 20,264 · SSGCL 16,564 · K-Electric 14,966
 *   HESCO 9,689 · PESCO 9,568 · SNGPL 6,625 · SEPCO 6,237 · NADRA 5,839
 *   FESCO 706 · IESCO 568 · CDA 556 · Immigration & Passports 530 · NADRA 442
 *   EOBI 398 · BISP 327 · Pakistan Railways 294
 *
 * Six of the top eight are electricity distribution companies. Electricity is therefore
 * the first tier-1 node and the deepest branch, gas is second, and the rest follow the
 * ranking. A taxonomy that opened with "Immigration" — the shape a US-derived product
 * would default to — would be wrong about what a Pakistani constituency office actually
 * spends its week on.
 *
 * ⚠️ NEEDS RECONCILIATION BEFORE THE DEMO. A second reading of the same 2024 report
 * (Table-5, "complaints received") produces figures roughly twice these — LESCO 39,520,
 * MEPCO 20,241, K-Electric 14,966, HESCO 9,689, PESCO 9,568, SSGCL 16,564, SNGPL 6,625,
 * BISP 20,264, NADRA 5,839 — with Power 109,578, Gas 23,189 and Others 58,314. The two
 * series differ by roughly a factor of two, which suggests one is "received" and the
 * other "admitted", "disposed" or a part-year figure. The figures below are the ones
 * supplied with this brief and are what the UI prints.
 *
 * The product decision does NOT turn on which series is right: electricity dominates
 * under both, and the tier-1 ordering is stable either way. Only the printed numbers
 * are at risk, so check them against the published report before the numbers appear in
 * front of a Member.
 */

import taxonomyData from './casework-taxonomy.json';

export type PkJurisdiction = 'federal' | 'provincial' | 'shared';

/** Forums a constituent case can be escalated to. */
export type PkEscalationId =
  | 'citizen-portal'
  | 'wafaqi-mohtasib'
  | 'provincial-ombudsman'
  | 'federal-tax-ombudsman'
  | 'nepra'
  | 'ogra'
  | 'pta'
  | 'banking-mohtasib';

export interface PkTaxonomyNode {
  label_id: string;
  name: string;
  nameUr?: string;
  tier: number;
  description?: string;
  abbreviation?: string;
  jurisdiction?: PkJurisdiction;
  /** Escalation forums, most specific first. Inherited from the nearest ancestor. */
  escalation?: PkEscalationId[];
  /** Federal ministry or division the body sits under. */
  ministry?: string;
  children?: PkTaxonomyNode[];
}

export interface PkTaxonomyMetadata {
  title: string;
  description: string;
  version: string;
  modified: string;
  publisher: string;
  source: string;
  sourceUrl: string;
  totalComplaints: number;
}

export interface PkFlattenedCategory {
  label_id: string;
  name: string;
  nameUr?: string;
  tier: number;
  description?: string;
  abbreviation?: string;
  /** Resolved: the node's own value, or the nearest ancestor's. Never undefined. */
  jurisdiction: PkJurisdiction;
  escalation: PkEscalationId[];
  ministry?: string;
  path: string[];
  pathIds: string[];
  parentId?: string;
  isLeaf: boolean;
}

const TAXONOMY_DATA = taxonomyData as unknown as {
  metadata: PkTaxonomyMetadata;
  data: PkTaxonomyNode[];
};

export const PK_CASEWORK_METADATA = TAXONOMY_DATA.metadata;
export const PK_CASEWORK_CATEGORIES: PkTaxonomyNode[] = TAXONOMY_DATA.data;
export const PK_TAXONOMY_VERSION = PK_CASEWORK_METADATA.version;

// ─────────────────────────────────────────────────────────────────────────────────────
// Escalation forums
// ─────────────────────────────────────────────────────────────────────────────────────

export interface PkEscalationForum {
  id: PkEscalationId;
  nameEn: string;
  nameUr: string;
  /** null where no working official site could be confirmed — see `offices`. */
  url: string | null;
  /** One line on when this forum is the right one. */
  scopeEn: string;
  scopeUr: string;
  /**
   * Per-province offices, for forums that are not a single national body.
   *
   * The provincial ombudsmen are four separate statutory offices, and their websites
   * are in poor repair: Balochistan's domain has lapsed entirely, Punjab's was
   * unreachable on checking, Sindh's certificate only matches the apex domain, and
   * Khyber Pakhtunkhwa's serves over http only. Printing one link for "the provincial
   * ombudsman" would send three constituents in four to a dead page, so each office is
   * listed with the state of its site recorded honestly.
   */
  offices?: Array<{
    provinceEn: string;
    provinceUr: string;
    nameEn: string;
    url: string | null;
    /** 'ok' | 'http-only' | 'unreachable' | 'no-site' */
    linkStatus: 'ok' | 'http-only' | 'unreachable' | 'no-site';
  }>;
}

/**
 * Where a case is actually filed.
 *
 * The Wafaqi Mohtasib's jurisdiction runs to **federal** agencies. It cannot take a
 * complaint against a provincial department, which is why `provincial-ombudsman` is a
 * separate forum and why the provincial warning on the page is a routing instruction
 * rather than a disclaimer. The Pakistan Citizen's Portal is the general-purpose front
 * door and does route to provincial as well as federal bodies, so it appears on almost
 * every branch.
 */
export const PK_ESCALATION_FORUMS: Record<PkEscalationId, PkEscalationForum> = {
  'citizen-portal': {
    id: 'citizen-portal',
    nameEn: "Pakistan Citizen's Portal",
    nameUr: 'پاکستان سٹیزن پورٹل',
    url: 'https://citizenportal.gov.pk',
    scopeEn:
      "Run by the Prime Minister's Performance Delivery Unit — \"Performance\" is part of the name. Routes to federal AND provincial bodies alike, and the usual first step because it produces a tracked reference number. Primarily a mobile app; the web front end is secondary.",
    scopeUr:
      'وزیراعظم پرفارمنس ڈیلیوری یونٹ کے زیرِ انتظام۔ وفاقی اور صوبائی دونوں اداروں کو شکایت بھیجتا ہے، اور عموماً پہلا قدم ہے کیونکہ اس سے قابلِ تعاقب حوالہ نمبر ملتا ہے۔ بنیادی طور پر موبائل ایپ ہے۔',
  },
  'wafaqi-mohtasib': {
    id: 'wafaqi-mohtasib',
    nameEn: "Wafaqi Mohtasib (Ombudsman)'s Secretariat",
    nameUr: 'وفاقی محتسب سیکرٹریٹ',
    url: 'https://mohtasib.gov.pk',
    scopeEn:
      'Maladministration by FEDERAL agencies only — P.O. No. 1 of 1983 defines "Agency" as a body of the Federal Government. It has no jurisdiction over a provincial department, however similar the complaint looks. No fee and no lawyer needed; complaints are to be disposed of within 60 days. Matters that are sub judice, and a civil servant\'s own service grievance, are excluded.',
    scopeUr:
      'صرف وفاقی اداروں کی بدانتظامی — صدارتی فرمان نمبر 1 برائے 1983 میں "ایجنسی" سے مراد وفاقی حکومت کا ادارہ ہے۔ کسی صوبائی محکمے پر اس کا دائرہ اختیار نہیں۔ کوئی فیس یا وکیل درکار نہیں؛ شکایت 60 دن میں نمٹائی جاتی ہے۔ زیرِ سماعت معاملات اور سرکاری ملازم کی اپنی سروس سے متعلق شکایت خارج ہیں۔',
  },
  'provincial-ombudsman': {
    id: 'provincial-ombudsman',
    nameEn: 'Provincial Ombudsman (Mohtasib)',
    nameUr: 'صوبائی محتسب',
    url: null,
    scopeEn:
      'Maladministration by provincial departments — police, revenue, school education, local government. Four separate statutory offices; the mirror rule applies, so a provincial ombudsman cannot take a federal complaint any more than the Wafaqi Mohtasib can take a provincial one.',
    scopeUr:
      'صوبائی محکموں کی بدانتظامی — پولیس، محکمہ مال، سکول ایجوکیشن، لوکل گورنمنٹ۔ چار الگ قانونی دفاتر ہیں؛ اور جس طرح وفاقی محتسب صوبائی شکایت نہیں لے سکتا، اسی طرح صوبائی محتسب وفاقی شکایت نہیں لے سکتا۔',
    offices: [
      {
        provinceEn: 'Punjab',
        provinceUr: 'پنجاب',
        nameEn: 'Provincial Ombudsman Punjab',
        url: 'https://ombudsmanpunjab.gov.pk',
        linkStatus: 'unreachable',
      },
      {
        provinceEn: 'Sindh',
        provinceUr: 'سندھ',
        nameEn: 'Provincial Ombudsman (Mohtasib) Sindh',
        // Apex domain only — the certificate does not match the www host.
        url: 'https://mohtasibsindh.gov.pk',
        linkStatus: 'ok',
      },
      {
        provinceEn: 'Khyber Pakhtunkhwa',
        provinceUr: 'خیبر پختونخوا',
        nameEn: 'Provincial Ombudsman Khyber Pakhtunkhwa',
        // Serves over http only; https is broken as at July 2026.
        url: 'http://ombudsmankp.gov.pk',
        linkStatus: 'http-only',
      },
      {
        provinceEn: 'Balochistan',
        provinceUr: 'بلوچستان',
        nameEn: 'Provincial Ombudsman Balochistan',
        // The domain has lapsed (NXDOMAIN). The office exists; the website does not.
        url: null,
        linkStatus: 'no-site',
      },
    ],
  },
  'federal-tax-ombudsman': {
    id: 'federal-tax-ombudsman',
    nameEn: 'Federal Tax Ombudsman',
    nameUr: 'وفاقی ٹیکس محتسب',
    url: 'https://fto.gov.pk',
    scopeEn:
      'Maladministration by the Federal Board of Revenue and its field formations. A separate institution from the Wafaqi Mohtasib, with its own statute.',
    scopeUr:
      'فیڈرل بورڈ آف ریونیو اور اس کے دفاتر کی بدانتظامی۔ یہ وفاقی محتسب سے الگ ادارہ ہے جس کا اپنا قانون ہے۔',
  },
  nepra: {
    id: 'nepra',
    nameEn: 'NEPRA — National Electric Power Regulatory Authority',
    nameUr: 'نیپرا — نیشنل الیکٹرک پاور ریگولیٹری اتھارٹی',
    url: 'https://nepra.org.pk',
    scopeEn:
      'The electricity regulator. Consumer complaints against a distribution company go first to the DISCO’s own Consumer Complaint Office, then to NEPRA.',
    scopeUr:
      'بجلی کا ریگولیٹر۔ ڈسٹری بیوشن کمپنی کے خلاف صارف کی شکایت پہلے کمپنی کے اپنے شکایتی دفتر، پھر نیپرا کو جاتی ہے۔',
  },
  ogra: {
    id: 'ogra',
    nameEn: 'OGRA — Oil and Gas Regulatory Authority',
    nameUr: 'اوگرا — آئل اینڈ گیس ریگولیٹری اتھارٹی',
    url: 'https://ogra.org.pk',
    scopeEn:
      'The gas regulator. Complaints against SNGPL or SSGC go first to the company, then to OGRA.',
    scopeUr:
      'گیس کا ریگولیٹر۔ ایس این جی پی ایل یا ایس ایس جی سی کے خلاف شکایت پہلے کمپنی، پھر اوگرا کو۔',
  },
  pta: {
    id: 'pta',
    nameEn: 'PTA — Pakistan Telecommunication Authority',
    nameUr: 'پی ٹی اے — پاکستان ٹیلی کمیونیکیشن اتھارٹی',
    url: 'https://complaint.pta.gov.pk',
    scopeEn:
      'Telecom consumer complaints, after the operator has been given the chance to resolve them.',
    scopeUr: 'ٹیلی کام صارفین کی شکایات، بشرطیکہ آپریٹر کو پہلے موقع دیا جا چکا ہو۔',
  },
  'banking-mohtasib': {
    id: 'banking-mohtasib',
    nameEn: 'Banking Mohtasib Pakistan',
    nameUr: 'بینکنگ محتسب پاکستان',
    url: 'https://bankingmohtasib.gov.pk',
    scopeEn:
      'Complaints against banks, including the disbursement of government payments through a bank or branchless-banking agent. Constituted under Part IVA of the Banking Companies Ordinance 1962; the Mohtasib is appointed by the Ministry of Law and Justice, not by the State Bank. Free of cost.',
    scopeUr:
      'بینکوں کے خلاف شکایات، بشمول بینک یا برانچ لیس بینکنگ ایجنٹ کے ذریعے سرکاری ادائیگیوں کی تقسیم۔ بینکنگ کمپنیز آرڈیننس 1962 کے باب چہارم-الف کے تحت قائم؛ محتسب کا تقرر وزارتِ قانون و انصاف کرتی ہے، اسٹیٹ بینک نہیں۔ کوئی فیس نہیں۔',
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────
// Electricity distribution companies — geographic routing
// ─────────────────────────────────────────────────────────────────────────────────────

export interface PkUtility {
  id: string;
  nameEn: string;
  nameUr: string;
  abbreviation: string;
  /** Districts and cities served, lower-cased, used for routing. */
  territory: string[];
  territoryLabelEn: string;
  ministry: string;
  /**
   * Complaints RECEIVED against this body in 2024, from Table-5 of the Wafaqi
   * Mohtasib annual report ("Volume of Complaints Against Key Agencies").
   *
   * Not Table-1, which reports "Net Implementable / Implemented" — findings the
   * Mohtasib issued and the agency then acted on. The two differ by roughly a
   * factor of two and reorder the agencies, so quoting Table-1 under a
   * "complaints received" label would misstate the figure and the ranking. The
   * Table-5 receipts sum to the 226,372 total the report states.
   */
  mohtasib2024?: number;
  note?: string;
}

/**
 * The eleven electricity distribution companies, plus K-Electric.
 *
 * ELEVEN, not ten. The Power Division's own list includes **HAZECO** (Hazara Electric
 * Supply Company), carved out of PESCO's territory for the Hazara division. It is easy
 * to miss because it records almost no ombudsman complaints, and a list of ten DISCOs
 * that a Member from Abbottabad or Mansehra reads would be visibly wrong.
 *
 * A complaint about a burnt transformer is not routed by the nature of the complaint —
 * it is routed by where the constituent lives. Modelling the DISCOs as a lookup keyed on
 * district rather than as branches of the tree means "my constituent in Multan has no
 * power" resolves to MEPCO without the classifier having to choose from eleven
 * near-identical nodes, and it means the routing still works for a district nobody
 * thought to enumerate in the taxonomy.
 *
 * K-Electric is the odd one out and the distinction matters in front of an official:
 * it is a **privatised vertically-integrated utility**, not a DISCO under the Power
 * Division, so escalation runs through NEPRA rather than through the Ministry of Energy.
 */
export const PK_UTILITIES: PkUtility[] = [
  {
    id: 'lesco',
    nameEn: 'Lahore Electric Supply Company',
    nameUr: 'لاہور الیکٹرک سپلائی کمپنی',
    abbreviation: 'LESCO',
    territory: ['lahore', 'kasur', 'sheikhupura', 'nankana sahib', 'okara'],
    territoryLabelEn: 'Lahore, Kasur, Sheikhupura, Nankana Sahib, Okara',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 39520,
  },
  {
    id: 'mepco',
    nameEn: 'Multan Electric Power Company',
    nameUr: 'ملتان الیکٹرک پاور کمپنی',
    abbreviation: 'MEPCO',
    territory: [
      'multan', 'khanewal', 'vehari', 'sahiwal', 'pakpattan', 'lodhran',
      'bahawalpur', 'bahawalnagar', 'rahim yar khan', 'dera ghazi khan',
      'muzaffargarh', 'layyah', 'rajanpur', 'south punjab',
    ],
    territoryLabelEn: 'Multan and southern Punjab',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 20241,
  },
  {
    id: 'pesco',
    nameEn: 'Peshawar Electric Supply Company',
    nameUr: 'پشاور الیکٹرک سپلائی کمپنی',
    abbreviation: 'PESCO',
    territory: [
      'peshawar', 'mardan', 'swat', 'nowshera', 'charsadda', 'kohat', 'bannu',
      'dera ismail khan', 'swabi', 'khyber pakhtunkhwa',
    ],
    // Hazara division is HAZECO's, not PESCO's — see below.
    territoryLabelEn: 'Khyber Pakhtunkhwa, except Hazara division',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 9568,
  },
  {
    id: 'k-electric',
    nameEn: 'K-Electric Limited',
    nameUr: 'کے الیکٹرک لمیٹڈ',
    abbreviation: 'KE',
    territory: ['karachi', 'dhabeji', 'gharo', 'hub', 'uthal', 'bela', 'vinder'],
    territoryLabelEn: 'Karachi, plus Dhabeji, Gharo, Hub, Uthal, Bela and Vinder',
    ministry: 'Privatised — regulated by NEPRA, not a Power Division DISCO',
    mohtasib2024: 14966,
    note: 'Privatised and vertically integrated: it generates, transmits and distributes. It is NOT a DISCO under the Power Division, so escalation runs through NEPRA. Its licence area is not Sindh-only — Hub, Uthal, Bela and Vinder are in Balochistan, so a constituent there may be a K-Electric consumer rather than a QESCO one.',
  },
  {
    id: 'hesco',
    nameEn: 'Hyderabad Electric Supply Company',
    nameUr: 'حیدرآباد الیکٹرک سپلائی کمپنی',
    abbreviation: 'HESCO',
    territory: [
      'hyderabad', 'badin', 'thatta', 'tharparkar', 'mirpurkhas', 'sanghar',
      'matiari', 'tando allahyar', 'tando muhammad khan', 'jamshoro', 'umerkot',
    ],
    territoryLabelEn: 'Hyderabad and southern Sindh',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 9689,
  },
  {
    id: 'sepco',
    nameEn: 'Sukkur Electric Power Company',
    nameUr: 'سکھر الیکٹرک پاور کمپنی',
    abbreviation: 'SEPCO',
    territory: [
      'sukkur', 'larkana', 'shikarpur', 'jacobabad', 'khairpur', 'ghotki',
      'kashmore', 'qambar shahdadkot', 'naushahro feroze',
    ],
    territoryLabelEn: 'Sukkur and northern Sindh',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 6237,
  },
  {
    id: 'gepco',
    nameEn: 'Gujranwala Electric Power Company',
    nameUr: 'گوجرانوالہ الیکٹرک پاور کمپنی',
    abbreviation: 'GEPCO',
    territory: ['gujranwala', 'gujrat', 'sialkot', 'narowal', 'hafizabad', 'mandi bahauddin'],
    territoryLabelEn: 'Gujranwala, Gujrat, Sialkot, Narowal, Hafizabad, Mandi Bahauddin',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 3030,
  },
  {
    id: 'fesco',
    nameEn: 'Faisalabad Electric Supply Company',
    nameUr: 'فیصل آباد الیکٹرک سپلائی کمپنی',
    abbreviation: 'FESCO',
    territory: ['faisalabad', 'jhang', 'toba tek singh', 'chiniot', 'bhakkar', 'mianwali', 'sargodha', 'khushab'],
    territoryLabelEn: 'Faisalabad, Sargodha, Jhang, Mianwali and adjoining districts',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 3103,
  },
  {
    id: 'iesco',
    nameEn: 'Islamabad Electric Supply Company',
    nameUr: 'اسلام آباد الیکٹرک سپلائی کمپنی',
    abbreviation: 'IESCO',
    territory: [
      'islamabad', 'rawalpindi', 'attock', 'jhelum', 'chakwal', 'murree', 'talagang',
    ],
    territoryLabelEn: 'Islamabad, Rawalpindi, Attock, Jhelum, Chakwal',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 1507,
  },
  {
    id: 'qesco',
    // Power Division writes "Corporation"; the Wafaqi Mohtasib writes "Company".
    // NEEDS LOCAL REVIEW — confirm against QESCO's own letterhead.
    nameEn: 'Quetta Electric Supply Company',
    nameUr: 'کوئٹہ الیکٹرک سپلائی کمپنی',
    abbreviation: 'QESCO',
    territory: ['quetta', 'balochistan', 'gwadar', 'khuzdar', 'sibi', 'zhob', 'loralai', 'chaman'],
    territoryLabelEn: 'Balochistan, except the K-Electric licence area around Hub',
    ministry: 'Power Division, Ministry of Energy',
    mohtasib2024: 1717,
  },
  {
    id: 'hazeco',
    nameEn: 'Hazara Electric Supply Company',
    nameUr: 'ہزارہ الیکٹرک سپلائی کمپنی',
    abbreviation: 'HAZECO',
    territory: [
      'abbottabad', 'mansehra', 'haripur', 'battagram', 'torghar', 'kohistan',
      'hazara',
    ],
    territoryLabelEn: 'Hazara division, Khyber Pakhtunkhwa',
    ministry: 'Power Division, Ministry of Energy',
    note: 'Carved out of PESCO. It records negligible ombudsman volume, so it is missing from most published DISCO lists — but it is the correct company for Abbottabad, Mansehra and Haripur.',
  },
  {
    id: 'tesco',
    nameEn: 'Tribal Areas Electric Supply Company',
    nameUr: 'ٹرائبل ایریاز الیکٹرک سپلائی کمپنی',
    abbreviation: 'TESCO',
    territory: ['khyber', 'kurram', 'bajaur', 'mohmand', 'orakzai', 'north waziristan', 'south waziristan', 'merged districts'],
    territoryLabelEn: 'Merged districts of Khyber Pakhtunkhwa (former FATA)',
    ministry: 'Power Division, Ministry of Energy',
  },
];

/** SNGPL serves the north (Punjab, KP, Islamabad); SSGC the south (Sindh, Balochistan). */
export const PK_GAS_UTILITIES: PkUtility[] = [
  {
    id: 'sngpl',
    nameEn: 'Sui Northern Gas Pipelines Limited',
    nameUr: 'سوئی ناردرن گیس پائپ لائنز لمیٹڈ',
    abbreviation: 'SNGPL',
    territory: ['punjab', 'khyber pakhtunkhwa', 'islamabad', 'lahore', 'rawalpindi', 'peshawar', 'faisalabad', 'multan', 'gujranwala'],
    territoryLabelEn: 'Punjab, Khyber Pakhtunkhwa and Islamabad',
    ministry: 'Petroleum Division, Ministry of Energy',
    mohtasib2024: 6625,
  },
  {
    id: 'ssgc',
    nameEn: 'Sui Southern Gas Company Limited',
    nameUr: 'سوئی سدرن گیس کمپنی لمیٹڈ',
    // The company uses "SSGC" and "SSGCL" interchangeably on its own site; federal
    // publications, including the Wafaqi Mohtasib's tables, use SSGCL. Follow the
    // federal form, since that is what a notice or a complaint reference will carry.
    abbreviation: 'SSGCL',
    territory: ['sindh', 'balochistan', 'karachi', 'hyderabad', 'quetta', 'sukkur', 'gwadar'],
    territoryLabelEn: 'Sindh and Balochistan',
    ministry: 'Petroleum Division, Ministry of Energy',
    mohtasib2024: 16564,
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Route a case to the electricity distributor serving a district or city.
 *
 * Matches on whole words so that "Hub" in Balochistan does not match inside "Lahore",
 * and prefers the longest territory string that matches so "rahim yar khan" beats a
 * stray "khan".
 */
export function utilityForPlace(
  place: string | null | undefined,
  pool: PkUtility[] = PK_UTILITIES
): PkUtility | null {
  if (!place?.trim()) return null;
  const hay = ` ${norm(place)} `;

  let best: { u: PkUtility; len: number } | null = null;
  for (const u of pool) {
    for (const territory of u.territory) {
      if (hay.includes(` ${territory} `) && (!best || territory.length > best.len)) {
        best = { u, len: territory.length };
      }
    }
  }
  return best?.u ?? null;
}

/** SNGPL vs SSGC for a district or province. */
export function gasUtilityForPlace(place: string | null | undefined): PkUtility | null {
  return utilityForPlace(place, PK_GAS_UTILITIES);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Tree operations — same surface as lib/casecompass.ts
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Flatten the tree, resolving `jurisdiction` and `escalation` by inheritance.
 *
 * Inheritance is the point: `pk.elec` is marked `shared` once, and every billing,
 * metering and outage leaf beneath it inherits that without the JSON repeating itself
 * ninety times. A child may still override — `pk.social.bisp.agent-deduction` is a
 * federal programme but the remedy runs through the Banking Mohtasib, so that leaf
 * carries its own escalation list.
 */
export function flattenTaxonomy(
  nodes: PkTaxonomyNode[],
  path: string[] = [],
  pathIds: string[] = [],
  parentId?: string,
  inheritedJurisdiction: PkJurisdiction = 'federal',
  inheritedEscalation: PkEscalationId[] = ['citizen-portal'],
  inheritedMinistry?: string
): PkFlattenedCategory[] {
  const result: PkFlattenedCategory[] = [];

  for (const node of nodes) {
    const currentPath = [...path, node.abbreviation || node.name];
    const currentPathIds = [...pathIds, node.label_id];
    const jurisdiction = node.jurisdiction ?? inheritedJurisdiction;
    const escalation = node.escalation ?? inheritedEscalation;
    const ministry = node.ministry ?? inheritedMinistry;

    result.push({
      label_id: node.label_id,
      name: node.name,
      nameUr: node.nameUr,
      tier: node.tier,
      description: node.description,
      abbreviation: node.abbreviation,
      jurisdiction,
      escalation,
      ministry,
      path: currentPath,
      pathIds: currentPathIds,
      parentId,
      isLeaf: !node.children?.length,
    });

    if (node.children?.length) {
      result.push(
        ...flattenTaxonomy(
          node.children,
          currentPath,
          currentPathIds,
          node.label_id,
          jurisdiction,
          escalation,
          ministry
        )
      );
    }
  }

  return result;
}

export const PK_FLATTENED_CATEGORIES = flattenTaxonomy(PK_CASEWORK_CATEGORIES);

const flatById = new Map(PK_FLATTENED_CATEGORIES.map((c) => [c.label_id, c]));

export function findNode(
  labelId: string,
  nodes: PkTaxonomyNode[] = PK_CASEWORK_CATEGORIES
): PkTaxonomyNode | undefined {
  for (const node of nodes) {
    if (node.label_id === labelId) return node;
    if (node.children) {
      const found = findNode(labelId, node.children);
      if (found) return found;
    }
  }
  return undefined;
}

/** The flattened record, which carries the *resolved* jurisdiction and escalation. */
export function findCategory(labelId: string): PkFlattenedCategory | undefined {
  return flatById.get(labelId);
}

export function isValidLabelId(labelId: string): boolean {
  return flatById.has(labelId);
}

export function getTier1Agencies(): PkTaxonomyNode[] {
  return PK_CASEWORK_CATEGORIES;
}

export function getLabelIdsByTier(tier: number): string[] {
  return PK_FLATTENED_CATEGORIES.filter((c) => c.tier === tier).map((c) => c.label_id);
}

export function getAllLabelIds(): string[] {
  return PK_FLATTENED_CATEGORIES.map((c) => c.label_id);
}

export const PK_LEAF_COUNT = PK_FLATTENED_CATEGORIES.filter((c) => c.isLeaf).length;
export const PK_NODE_COUNT = PK_FLATTENED_CATEGORIES.length;
export const PK_MAX_TIER = PK_FLATTENED_CATEGORIES.reduce((m, c) => Math.max(m, c.tier), 0);

/**
 * The taxonomy rendered for the classifier prompt.
 *
 * Jurisdiction is stamped on every line rather than left implicit, because the single
 * most consequential thing the classifier can get wrong is telling an MNA's office that
 * an FIR is theirs to chase.
 */
export function generateTaxonomyContext(): string {
  const lines: string[] = [
    `Pakistan constituent casework taxonomy v${PK_TAXONOMY_VERSION}`,
    `Tier-1 ordering follows complaint volumes in the ${PK_CASEWORK_METADATA.source}.`,
    '',
    'You MUST use the exact label_id values from this list. Do NOT invent label_ids.',
    'Each line is: [label_id] Name (jurisdiction) - description',
    '',
  ];

  const walk = (nodes: PkTaxonomyNode[], depth: number, inherited: PkJurisdiction) => {
    for (const node of nodes) {
      const j = node.jurisdiction ?? inherited;
      const indent = '  '.repeat(depth);
      const abbrev = node.abbreviation ? ` (${node.abbreviation})` : '';
      const desc = node.description ? ` - ${node.description}` : '';
      lines.push(`${indent}[${node.label_id}] ${node.name}${abbrev} <${j}>${desc}`);
      if (node.children?.length) walk(node.children, depth + 1, j);
    }
  };

  walk(PK_CASEWORK_CATEGORIES, 0, 'federal');
  return lines.join('\n');
}
