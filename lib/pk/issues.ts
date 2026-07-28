/**
 * What the province is talking about, and who has to answer for it.
 *
 * ── Counted, not inferred ─────────────────────────────────────────────────────────
 *
 * The issue list and its patterns come from `app/api/pk/province-news/route.ts`, which
 * already settled this question for the province page: a model asked "what are the
 * issues" produces a plausible list that is not a count of anything and that a reader
 * cannot check. So an issue's weight is the number of retrieved headlines and posts that
 * actually match it, and every issue carries the items it was counted from.
 *
 * This file adds the half that a Chief Minister's office needs and a news page does not:
 * **who owns it**. An issue with no department attached is a talking point. An issue
 * routed to the Energy Department, with the note that electricity is a shared subject
 * and the distribution companies are federal, is an instruction.
 *
 * ── Why the jurisdiction flag is load-bearing ─────────────────────────────────────
 *
 * The casework taxonomy already carries `jurisdiction: federal | provincial | shared` on
 * every node, because a Member has no locus on a provincial subject and a provincial
 * government has none on a federal one. The same is true here in reverse: the loudest
 * issue in a Punjab feed is routinely electricity, and electricity distribution is
 * federal. A radar that put load-shedding on the Chief Minister's desk as though it were
 * his to fix would be wrong in a way his own staff would catch in the first minute.
 */

import taxonomy from './casework-taxonomy.json';

export type Jurisdiction = 'federal' | 'provincial' | 'shared';

interface TaxonomyNode {
  label_id: string;
  name: string;
  nameUr: string;
  tier: number;
  description?: string;
  jurisdiction?: Jurisdiction;
  /** The taxonomy stores escalation as a list of routes, not one line. */
  escalation?: string[];
  children?: TaxonomyNode[];
}

// Through `unknown`: the JSON's inferred literal types are narrower than the interface
// (`jurisdiction` infers as `string`), and a direct assertion is rejected.
const NODES = (taxonomy as unknown as { data: TaxonomyNode[] }).data;

function nodeById(id: string): TaxonomyNode | null {
  const walk = (ns: TaxonomyNode[]): TaxonomyNode | null => {
    for (const n of ns) {
      if (n.label_id === id) return n;
      const hit = n.children ? walk(n.children) : null;
      if (hit) return hit;
    }
    return null;
  };
  return walk(NODES);
}

/**
 * Issue id -> the taxonomy node that owns it, and the provincial department that would
 * actually receive the file.
 *
 * The department names are the Punjab Secretariat's own. `taxonomyId` is null where the
 * issue has no casework analogue — security and the economy generate a great deal of
 * comment and very little constituent casework — and that null is rendered rather than
 * hidden, because "nobody in this building owns this" is a real and useful answer.
 */
const OWNERSHIP: Record<
  string,
  { taxonomyId: string | null; departmentEn: string | null; departmentUr: string | null }
> = {
  energy: { taxonomyId: 'pk.elec', departmentEn: 'Energy Department', departmentUr: 'محکمہ توانائی' },
  gas: { taxonomyId: 'pk.gas', departmentEn: null, departmentUr: null },
  economy: { taxonomyId: 'pk.tax', departmentEn: 'Finance Department', departmentUr: 'محکمہ خزانہ' },
  security: { taxonomyId: 'pk.prov', departmentEn: 'Home Department', departmentUr: 'محکمہ داخلہ' },
  water: { taxonomyId: 'pk.prov', departmentEn: 'Irrigation Department', departmentUr: 'محکمہ آبپاشی' },
  floods: {
    taxonomyId: 'pk.prov',
    departmentEn: 'Provincial Disaster Management Authority',
    departmentUr: 'صوبائی ادارہ انسدادِ آفات',
  },
  health: { taxonomyId: 'pk.health', departmentEn: 'Health Department', departmentUr: 'محکمہ صحت' },
  education: {
    taxonomyId: 'pk.edu',
    departmentEn: 'School Education Department',
    departmentUr: 'محکمہ تعلیمِ اسکول',
  },
  agriculture: {
    taxonomyId: 'pk.prov',
    departmentEn: 'Agriculture Department',
    departmentUr: 'محکمہ زراعت',
  },
  // Social protection is federal — BISP is a federal programme, and a provincial
  // government pressed on it is being asked about somebody else's cheque.
  welfare: {
    taxonomyId: 'pk.social',
    departmentEn: 'Social Welfare Department',
    departmentUr: 'محکمہ سماجی بہبود',
  },
  governance: {
    taxonomyId: 'pk.nadra',
    departmentEn: 'Services & General Administration Department',
    departmentUr: 'محکمہ خدمات و عمومی انتظامیہ',
  },
};

/**
 * Every `taxonomyId` above must resolve, or the jurisdiction caveat silently never
 * fires and a federal subject lands on the Chief Minister's desk looking like his.
 * Exported so a test can assert it rather than trusting the map to stay in step with
 * the taxonomy.
 */
export function unresolvedOwnershipIds(): string[] {
  return Object.values(OWNERSHIP)
    .map((o) => o.taxonomyId)
    .filter((id): id is string => Boolean(id))
    .filter((id) => !nodeById(id));
}

export interface IssueOwner {
  departmentEn: string | null;
  departmentUr: string | null;
  jurisdiction: Jurisdiction | null;
  /** The taxonomy node's own escalation routes, where it has any. */
  escalation: string[];
  /** Set where the subject is not the province's to fix alone. */
  caveatEn: string | null;
  caveatUr: string | null;
}

const CAVEAT = {
  federal: {
    en: 'A federal subject. The province can press it, but the file does not sit here.',
    ur: 'یہ وفاقی معاملہ ہے۔ صوبہ اس پر زور دے سکتا ہے، مگر فائل یہاں نہیں ہے۔',
  },
  shared: {
    en: 'A shared subject: the province delivers, but the regulator and the distribution companies are federal.',
    ur: 'مشترکہ معاملہ: عمل درآمد صوبہ کرتا ہے، مگر ریگولیٹر اور تقسیم کار کمپنیاں وفاقی ہیں۔',
  },
} as const;

export function ownerFor(issueId: string): IssueOwner {
  const o = OWNERSHIP[issueId];
  if (!o) {
    return {
      departmentEn: null, departmentUr: null, jurisdiction: null,
      escalation: [], caveatEn: null, caveatUr: null,
    };
  }
  const node = o.taxonomyId ? nodeById(o.taxonomyId) : null;
  const jurisdiction = node?.jurisdiction ?? null;
  const caveat = jurisdiction && jurisdiction !== 'provincial' ? CAVEAT[jurisdiction] : null;
  return {
    departmentEn: o.departmentEn,
    departmentUr: o.departmentUr,
    jurisdiction,
    escalation: node?.escalation ?? [],
    caveatEn: caveat?.en ?? null,
    caveatUr: caveat?.ur ?? null,
  };
}

/**
 * Rank issues by how much of the retrieved coverage mentions them.
 *
 * `share` is of matched items, not of all items: an item mentioning neither electricity
 * nor education is not evidence about the balance between them. Items matching two
 * issues count in both, because they are genuinely about both and splitting them would
 * invent a precision the counting does not have.
 */
export interface RankedIssue {
  id: string;
  label: string;
  labelUr: string;
  count: number;
  share: number;
  owner: IssueOwner;
  samples: Array<{ title: string; url: string; source: string; date?: string }>;
}

export function rankIssues(
  items: Array<{ title: string; url: string; source: string; date?: string }>,
  issues: Array<{ id: string; label: string; labelUr: string; patterns: RegExp }>
): RankedIssue[] {
  const matchedTotal = items.filter((i) => issues.some((s) => s.patterns.test(i.title))).length;

  return issues
    .map(({ id, label, labelUr, patterns }) => {
      const hits = items.filter((i) => patterns.test(i.title));
      return {
        id,
        label,
        labelUr,
        count: hits.length,
        share: matchedTotal ? Math.round((hits.length / matchedTotal) * 1000) / 10 : 0,
        owner: ownerFor(id),
        samples: hits.slice(0, 4),
      };
    })
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** The issue list, exported so the radar and the province page cannot drift apart. */
export const PK_ISSUES: Array<{ id: string; label: string; labelUr: string; patterns: RegExp }> = [
  { id: 'energy', label: 'Electricity and load-shedding', labelUr: 'بجلی اور لوڈ شیڈنگ',
    patterns: /\b(electricity|load[- ]?shedding|power (?:outage|tariff|sector)|k-?electric|wapda|iesco|lesco|mepco|grid|circular debt)\b/i },
  { id: 'gas', label: 'Gas and fuel', labelUr: 'گیس اور ایندھن',
    patterns: /\b(sui gas|gas (?:load|tariff|supply|shortage)|lng|petrol(?:eum)? price|diesel)\b/i },
  { id: 'economy', label: 'Economy and prices', labelUr: 'معیشت اور مہنگائی',
    patterns: /\b(imf|inflation|rupee|budget|tax(?:ation)?|fbr|economic|debt|world bank|adb|revenue|price hike)\b/i },
  { id: 'security', label: 'Security and policing', labelUr: 'سلامتی اور پولیس',
    patterns: /\b(terror(?:ism|ist)?|militant|ttp|blast|attack|security forces|operation|check ?post|police|crime)\b/i },
  { id: 'water', label: 'Water and irrigation', labelUr: 'پانی اور آبپاشی',
    patterns: /\b(water (?:crisis|shortage|supply|scarcity)|irsa|canal|irrigation|indus|dam|drought|clean drinking water)\b/i },
  { id: 'floods', label: 'Floods and climate', labelUr: 'سیلاب اور موسمیاتی تبدیلی',
    patterns: /\b(flood(?:ing|s)?|monsoon|rain(?:fall|s)|ndma|pdma|climate|heatwave|smog|air quality)\b/i },
  { id: 'health', label: 'Health', labelUr: 'صحت',
    patterns: /\b(health|hospital|polio|dengue|vaccin|doctors?|clinic|drug regulatory|sehat card)\b/i },
  { id: 'education', label: 'Education', labelUr: 'تعلیم',
    patterns: /\b(education|school(?:s|ing)?|universit|student|teacher|hec|matric|curriculum)\b/i },
  { id: 'agriculture', label: 'Agriculture and wheat', labelUr: 'زراعت اور گندم',
    patterns: /\b(wheat|farmer|agricultur|crop|fertilis|fertiliz|sugarcane|cotton|support price)\b/i },
  { id: 'welfare', label: 'Social protection', labelUr: 'سماجی تحفظ',
    patterns: /\b(bisp|benazir income|ehsaas|zakat|pension|social protection|ration)\b/i },
  { id: 'governance', label: 'Governance and services', labelUr: 'طرزِ حکمرانی اور خدمات',
    patterns: /\b(nadra|passport|corruption|ombudsman|mohtasib|citizen portal|e-?governance|transfer(?:s|red)? posting)\b/i },
];
