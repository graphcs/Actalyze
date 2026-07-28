/**
 * Constituent casework classifier for Pakistan.
 *
 * Structurally a mirror of `app/api/casework/classify/route.ts` — same taxonomy shape,
 * same validate-the-model's-label_ids discipline — with two additions that matter in
 * Pakistan and have no US analogue:
 *
 * 1. **Jurisdiction.** Every node carries `federal | provincial | shared`, resolved by
 *    inheritance in `lib/pk/casework.ts`. When the case lands on a provincial subject —
 *    an FIR, a land record, a school — the response says so, and the page refuses to
 *    pretend a Member of the National Assembly can chase it. That is not a disclaimer;
 *    it is the correct routing, to the MPA or the provincial ombudsman.
 *
 * 2. **Geographic utility routing.** An electricity or gas case is answered by the
 *    company serving the constituent's district, not by the nature of the complaint. The
 *    model extracts a place; `utilityForPlace()` resolves it to LESCO, MEPCO, K-Electric
 *    and so on. Six of the eight most-complained-of bodies in the country are DISCOs, so
 *    getting this right is most of the value of the screen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chatCompletions } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  generateTaxonomyContext,
  findNode,
  findCategory,
  isValidLabelId,
  utilityForPlace,
  gasUtilityForPlace,
  PK_ESCALATION_FORUMS,
  PK_FLATTENED_CATEGORIES,
  PK_CASEWORK_METADATA,
  PK_TAXONOMY_VERSION,
  PK_LEAF_COUNT,
  PK_NODE_COUNT,
  type PkEscalationId,
  type PkJurisdiction,
  type PkUtility,
} from '@/lib/pk/casework';
import { getConstituency } from '@/lib/pk/constituencies';

export const maxDuration = 60;

const TAXONOMY_CONTEXT = generateTaxonomyContext();

const SYSTEM_PROMPT = `You are an experienced caseworker in the constituency office of a Member of the National Assembly of Pakistan. You classify constituent problems against the office taxonomy below and identify the responsible body.

${TAXONOMY_CONTEXT}

## Classification rules

1. Use ONLY label_ids that appear above. Never invent one. If no node fits a tier, return null for that tier.
2. Classify to the deepest tier that genuinely fits. Tier 3 is usually reachable.
3. Each tier must be a child of the one above it.
4. JURISDICTION IS THE MOST CONSEQUENTIAL FIELD. A Member of the NATIONAL Assembly has no formal locus on a provincial subject. After the Eighteenth Amendment abolished the Concurrent Legislative List in 2010, these are PROVINCIAL: police and FIR registration, criminal investigation, land records and mutation, school education, local government, municipal water and sanitation outside Islamabad, and provincial health facilities. Classify those under pk.prov — do NOT force them into a federal branch because a federal-sounding word appears in the text.
5. Extract the district, city or province if the constituent's location is stated or clearly implied. This routes electricity and gas cases to the right company. Return null if no place is given — do not guess.

## Response format

Return ONLY valid JSON:
{
  "tier1_id": "exact label_id or null",
  "tier2_id": "exact label_id or null",
  "tier3_id": "exact label_id or null",
  "confidence": 0-100,
  "reasoning": "Two sentences. Name the responsible body and say why this tier was chosen.",
  "place": "district, city or province mentioned, or null",
  "suggestedActions": ["3 to 5 concrete next steps for the caseworker, in order"],
  "documentsNeeded": ["documents to obtain from the constituent"],
  "estimatedTimeline": "realistic time to a substantive reply"
}

Suggested actions must be things a Pakistani constituency office actually does: obtain the CNIC number and a copy, get the consumer reference number off the bill, lodge on the Pakistan Citizen's Portal and record the reference, write to the named officer, set a follow-up date. Do not suggest a US procedure such as a privacy release form.`;

/**
 * Language directive for the free-text fields.
 *
 * Category names, jurisdiction and escalation forums are all translated in the taxonomy
 * and never come from the model — only `reasoning`, `suggestedActions`,
 * `documentsNeeded` and `estimatedTimeline` are generated, so only those need this.
 */
const URDU_DIRECTIVE = `\n\nWrite "reasoning", every entry in "suggestedActions" and "documentsNeeded", and "estimatedTimeline" in Urdu (اردو), in the register a Pakistani constituency office actually uses. Keep the label_ids, "place", agency acronyms (NADRA, CNIC, BISP, LESCO) and any reference numbers in Latin script.`;

interface ClassifyRequest {
  description?: string;
  subject?: string;
  constituency?: string;
  locale?: 'en' | 'ur';
}

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(request, 'pk-casework-classify', {
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = (await request.json()) as ClassifyRequest;
    const { description, subject, constituency } = body;
    const locale = body.locale === 'ur' ? 'ur' : 'en';
    const caseText = [subject, description].filter(Boolean).join('\n').trim();

    if (!caseText) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    const provider = chatCompletions();
    if (!provider) {
      return NextResponse.json({ error: 'No LLM provider is configured' }, { status: 500 });
    }

    // The seat, if given, is a better source of geography than anything the model can
    // infer from prose — it is a lookup against the real National Assembly roster.
    const seat = constituency ? getConstituency(constituency) : null;

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
            content: [
              `Case: ${caseText}`,
              seat
                ? `Constituency: ${seat.code}${seat.name ? ` (${seat.name})` : ''}, district ${seat.districts.join(' and ')}${seat.provinceNameEn ? `, ${seat.provinceNameEn}` : ''}`
                : constituency
                  ? `Constituency: ${constituency}`
                  : '',
              'Respond with JSON only.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
        ...(provider.provider === 'openai'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`PK casework classify failed: ${response.status} ${detail.slice(0, 300)}`);
      return NextResponse.json({ error: 'Classification failed' }, { status: 502 });
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';
    const cleaned = raw.replace(/^\s*```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('PK casework: unparseable model response', cleaned.slice(0, 300));
      return NextResponse.json({ error: 'Invalid classification response' }, { status: 502 });
    }

    // Only label_ids that actually exist survive. A hallucinated id becomes null rather
    // than a category name nobody can look up.
    const pick = (key: string): string | null => {
      const v = parsed[key];
      return typeof v === 'string' && isValidLabelId(v) ? v : null;
    };
    const tier1_id = pick('tier1_id');
    const tier2_id = pick('tier2_id');
    const tier3_id = pick('tier3_id');

    for (const key of ['tier1_id', 'tier2_id', 'tier3_id'] as const) {
      if (parsed[key] && !pick(key)) {
        console.warn(`PK casework: invalid ${key}: ${String(parsed[key])}`);
      }
    }

    const tier1 = tier1_id ? findNode(tier1_id) : null;
    const tier2 = tier2_id ? findNode(tier2_id) : null;
    const tier3 = tier3_id ? findNode(tier3_id) : null;

    // Jurisdiction and escalation come from the deepest node classified, resolved
    // through the inheritance chain rather than read off the leaf.
    const deepestId = tier3_id ?? tier2_id ?? tier1_id;
    const deepest = deepestId ? findCategory(deepestId) : undefined;
    const jurisdiction: PkJurisdiction = deepest?.jurisdiction ?? 'federal';
    const escalationIds: PkEscalationId[] = deepest?.escalation ?? ['citizen-portal'];

    // ── Geographic routing ───────────────────────────────────────────────────────
    const modelPlace = typeof parsed.place === 'string' ? parsed.place : null;
    const place =
      modelPlace ||
      (seat ? [...seat.districts, seat.provinceNameEn].filter(Boolean).join(' ') : null);

    let routedUtility: PkUtility | null = null;
    if (tier1_id === 'pk.elec') routedUtility = utilityForPlace(place);
    else if (tier1_id === 'pk.gas') routedUtility = gasUtilityForPlace(place);

    const pathParts: string[] = [];
    const pathIds: string[] = [];
    for (const n of [tier1, tier2, tier3]) {
      if (!n) continue;
      pathParts.push(n.abbreviation || n.name);
      pathIds.push(n.label_id);
    }

    const asArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

    return NextResponse.json({
      tier1: tier1
        ? {
            label_id: tier1.label_id,
            name: tier1.name,
            nameUr: tier1.nameUr,
            abbreviation: tier1.abbreviation,
          }
        : null,
      tier2: tier2
        ? { label_id: tier2.label_id, name: tier2.name, nameUr: tier2.nameUr }
        : null,
      tier3: tier3
        ? {
            label_id: tier3.label_id,
            name: tier3.name,
            nameUr: tier3.nameUr,
            description: tier3.description,
          }
        : null,

      categoryPath: pathParts.join(' › '),
      categoryIds: pathIds,

      jurisdiction,
      /** The flag the page keys the provincial warning off. */
      isProvincial: jurisdiction === 'provincial',
      ministry: deepest?.ministry ?? null,

      escalation: escalationIds
        .map((id) => PK_ESCALATION_FORUMS[id])
        .filter(Boolean),

      routedUtility: routedUtility
        ? {
            id: routedUtility.id,
            nameEn: routedUtility.nameEn,
            nameUr: routedUtility.nameUr,
            abbreviation: routedUtility.abbreviation,
            territoryLabelEn: routedUtility.territoryLabelEn,
            ministry: routedUtility.ministry,
            mohtasib2024: routedUtility.mohtasib2024 ?? null,
            note: routedUtility.note ?? null,
          }
        : null,
      place,

      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(100, Math.round(parsed.confidence)))
          : 70,
      reasoning:
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : locale === 'ur'
            ? 'کیس کے موضوع کی بنیاد پر درجہ بندی کی گئی۔'
            : 'Classified on the subject matter of the case.',
      suggestedActions: asArray(parsed.suggestedActions),
      documentsNeeded: asArray(parsed.documentsNeeded),
      estimatedTimeline:
        typeof parsed.estimatedTimeline === 'string' ? parsed.estimatedTimeline : null,

      taxonomyVersion: PK_TAXONOMY_VERSION,
      taxonomySource: PK_CASEWORK_METADATA.source,
      provider: provider.provider,
    });
  } catch (error) {
    console.error('PK casework classification error:', error);
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 });
  }
}

/** The taxonomy itself, for the browser and for anyone auditing the categories. */
export async function GET() {
  return NextResponse.json({
    metadata: PK_CASEWORK_METADATA,
    categories: PK_FLATTENED_CATEGORIES,
    leafCount: PK_LEAF_COUNT,
    nodeCount: PK_NODE_COUNT,
    escalationForums: Object.values(PK_ESCALATION_FORUMS),
  });
}
