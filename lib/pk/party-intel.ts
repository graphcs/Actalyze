/**
 * Public-discourse classification for Pakistani constituencies.
 *
 * ── Why this is a fork of `lib/ai-intel.ts` rather than a parameterisation ──────────
 *
 * The US module encodes a two-party contest in its *type system*, not just its
 * constants: `political_leaning: 'D' | 'R' | 'I'`, a single signed scalar `margin`
 * where the sign IS the party, and a `'Safe D' … 'Safe R'` ladder that is literally
 * an axis with a party at each end. A 14-party National Assembly has no such axis and
 * no such sign. Threading a country flag through those types would leave every
 * function still shaped like a two-horse race, so the shapes are replaced:
 *
 *     signed margin      ->  shares: Array<{ party, share }>
 *     'Safe D'…'Safe R'  ->  { leader, runnerUp, leadPoints, competitiveness }
 *
 * ── What is deliberately KEPT from the original ────────────────────────────────────
 *
 * The statistics. Every guard below exists because the US version shipped without it
 * and emitted "D+100" from a handful of posts:
 *
 *   1. `location_confidence × lean_confidence` weighting — an off-topic post from a
 *      confidently-identified partisan should not count the same as an on-topic one.
 *   2. `MIN_PARTISAN_POSTS = 6` — a gate on the COUNT of posts carrying a party
 *      signal, not on the weighted sum. Weights are products of two sub-1
 *      confidences, so gating on the sum would reject perfectly reportable samples.
 *   3. `n / (n + 25)` shrinkage toward the prior, applied to the LEAD over the
 *      runner-up. The observed share split is reported as observed; the *inference*
 *      drawn from it is shrunk, because the split of a small self-selected set of
 *      public posts is not an electoral margin.
 *   4. A plausible-lead clamp, so a seat where every retrieved post says one thing
 *      cannot claim a lead no real Pakistani seat produces.
 *
 * ── The naming trap that matters most ──────────────────────────────────────────────
 *
 * `IND_PTI` is a first-class party id. PTI candidates contested the 2024 general
 * election as independents after losing their electoral symbol, and 79 seats in the
 * roster sit under "Independent". Labelling those posts "PTI" overstates a party that
 * formally holds almost no general seats; labelling them plain "Independent" erases
 * the single most important fact about the current Assembly. Both errors are obvious
 * to any Pakistani reader within one second of looking at the chart.
 */

import { chatCompletions } from "@/lib/ai-provider";
import { PK_PARTIES, party, type PkPartyId } from "./parties";

// ── Types ───────────────────────────────────────────────────────────────────────────

export interface PkPost {
  id: string;
  text: string;
  author: string;
  username: string;
  url: string;
  created_at: string;
  user_location?: string;
  user_bio?: string;
}

export interface PkPostClassification {
  /** 0..1 — how likely this post is about, or from, the target constituency. */
  location_confidence: number;
  /** Which party's position the post expresses sympathy for. */
  party: PkPartyId | "unknown";
  /** 0..1 — confidence in the party attribution. */
  lean_confidence: number;
  topics: string[];
  topic_sentiments: Record<string, number>;
  key_insight: string;
}

export interface PkPartyShare {
  party: PkPartyId;
  /** Percentage of weighted discussion, 0..100. Shares sum to 100. */
  share: number;
}

export type PkCompetitiveness = "Safe" | "Likely" | "Lean" | "Toss-up";

export interface PkSeatOutlook {
  leader: PkPartyId | null;
  runnerUp: PkPartyId | null;
  /** Shrunk and clamped lead of leader over runner-up, in points. */
  leadPoints: number;
  competitiveness: PkCompetitiveness;
  confidence: number;
  keyFactors: string[];
}

export interface PkTopicSummary {
  name: string;
  post_count: number;
  /** -1..1 */
  sentiment: number;
}

export interface PkIntelResponse {
  constituency: string;
  constituency_name: string | null;
  timestamp: string;
  /** Posts that cleared the location filter. 0 means: show nothing at all. */
  sample_size: number;
  /** Posts that carried an attributable party signal. */
  partisan_posts: number;
  /** Empty when the sample is too thin to report a split. */
  shares: PkPartyShare[];
  outlook: PkSeatOutlook;
  topics: PkTopicSummary[];
  insights: { text: string; type: "pattern" | "shift" | "emerging"; timestamp: string }[];
}

// ── Tuning constants (see the header for why each exists) ───────────────────────────

/** Below this, a post is not treated as being about the constituency. */
const MIN_LOCATION_CONFIDENCE = 0.3;

/** A handful of posts is not a sample worth reporting a split from. */
const MIN_PARTISAN_POSTS = 6;

/** Prior strength for the n/(n+k) shrinkage. Same value as the US module. */
const PRIOR_STRENGTH = 25;

/**
 * No Pakistani National Assembly seat is a 40-point runaway in live public
 * discourse, so anything above this is an artefact of the sample, not a finding.
 */
const MAX_PLAUSIBLE_LEAD = 40;

/**
 * Competitiveness ladder.
 *
 * Set lower than the US 2-party equivalents on purpose: in a contest where four or
 * five parties draw meaningful shares, a 15-point lead over the runner-up is a
 * commanding position, whereas in a 2-party race it is merely comfortable.
 */
const LADDER: Array<{ min: number; rating: PkCompetitiveness }> = [
  { min: 25, rating: "Safe" },
  { min: 12, rating: "Likely" },
  { min: 5, rating: "Lean" },
  { min: 0, rating: "Toss-up" },
];

/** Parties below this share are folded into OTHER so the bar stays readable. */
const MIN_SHARE_TO_NAME = 1.5;

// ── Prompt ──────────────────────────────────────────────────────────────────────────

/** The party menu handed to the classifier, built from the single source of truth. */
const PARTY_MENU: PkPartyId[] = [
  "PMLN",
  "PPP",
  "PTI",
  "IND_PTI",
  "IND",
  "MQMP",
  "JUIF",
  "PMLQ",
  "IPP",
  "SIC",
  "JI",
  "ANP",
  "BNPM",
  "PKMAP",
  "MWM",
  "BAP",
  "NP",
  "OTHER",
];

export function buildPkClassificationPrompt(
  post: PkPost,
  context: {
    code: string;
    seatName: string | null;
    districts: string[];
    province: string | null;
    memberName: string | null;
    memberParty: PkPartyId | null;
  }
): string {
  const where = [
    context.seatName ? `${context.code} (${context.seatName})` : context.code,
    context.districts.length ? `district: ${context.districts.join(", ")}` : null,
    context.province ? `province: ${context.province}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const options = PARTY_MENU.map((id) => `  "${id}" — ${PK_PARTIES[id].commonName}`).join(
    "\n"
  );

  return `Classify this public social media post for political intelligence about Pakistan National Assembly constituency ${where}.${
    context.memberName
      ? `\nThe sitting member is ${context.memberName} (${party(context.memberParty).commonName}).`
      : "\nThis seat is currently vacant."
  }

Account bio: "${post.user_bio || "Not provided"}"
Account location: "${post.user_location || "Not provided"}"
Post: "${post.text}"

Return a JSON object with exactly these fields:

1. location_confidence: 0.0-1.0 — how likely this post is about, or written from, this constituency or its district. A post about national Pakistani politics with no local connection scores below 0.3. A post naming the constituency, its member, or its district scores high.

2. party: which party's position the post expresses sympathy for, from this list:
${options}
   or "unknown" if the post carries no party signal.

   CRITICAL — the Pakistani distinction that matters most:
   - Use "IND_PTI" for a post supporting a candidate or member who contested the
     2024 general election as an INDEPENDENT with PTI backing. PTI lost its
     electoral symbol before the 2024 election, so its candidates ran as
     independents. This is the correct label for most pro-Imran-Khan / pro-PTI
     sentiment attached to a sitting member.
   - Use "PTI" only where the post refers to the party organisation itself.
   - Use "IND" only for an independent with no PTI alignment.

3. lean_confidence: 0.0-1.0 — confidence in that party attribution. Be conservative:
   criticism of the government is not automatically support for a specific opposition
   party.

4. topics: array of the political issues discussed. Use Pakistani terms where they
   apply, e.g. "load shedding", "inflation", "IMF programme", "water", "gas",
   "law and order", "development funds", "health", "education", "employment",
   "roads", "sewerage", "flood relief", "judiciary", "elections".

5. topic_sentiments: object mapping each topic to a sentiment from -1.0 to 1.0.

6. key_insight: one sentence, in English, on what this reveals about opinion in the
   constituency. Empty string if it reveals nothing.

Return ONLY valid JSON.`;
}

export function parsePkClassification(response: string): PkPostClassification | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const rawParty = typeof parsed.party === "string" ? parsed.party : "unknown";

    // Anything the model invents outside the menu becomes "unknown" rather than
    // OTHER: a hallucinated party id must not silently accrue share.
    const partyId: PkPartyId | "unknown" = (PARTY_MENU as string[]).includes(rawParty)
      ? (rawParty as PkPartyId)
      : "unknown";

    return {
      location_confidence: clamp01(parsed.location_confidence),
      party: partyId,
      lean_confidence: clamp01(parsed.lean_confidence),
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter((t: unknown): t is string => typeof t === "string")
        : [],
      topic_sentiments:
        parsed.topic_sentiments && typeof parsed.topic_sentiments === "object"
          ? parsed.topic_sentiments
          : {},
      key_insight: typeof parsed.key_insight === "string" ? parsed.key_insight : "",
    };
  } catch (error) {
    console.error("Failed to parse PK classification:", error);
    return null;
  }
}

function clamp01(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ── Classification worker pool ──────────────────────────────────────────────────────
//
// Copied from `lib/ai-intel.ts` rather than extracted into a shared helper: it is
// ~40 lines, it is the one part of that module with no US-specific assumptions, and
// refactoring the US file to share it would put a working production route at risk
// for no benefit to either side.

const CLASSIFY_CONCURRENCY = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function classifyOne(
  post: PkPost,
  context: Parameters<typeof buildPkClassificationPrompt>[1],
  provider: NonNullable<ReturnType<typeof chatCompletions>>,
  model: string
): Promise<PkPostClassification | null> {
  const prompt = buildPkClassificationPrompt(post, context);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: provider.headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
          await sleep(400);
          continue;
        }
        console.error(`LLM API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) return null;

      return parsePkClassification(content);
    } catch (error) {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
      console.error("Error classifying post:", error);
      return null;
    }
  }

  return null;
}

export async function classifyPkPosts(
  posts: PkPost[],
  context: Parameters<typeof buildPkClassificationPrompt>[1],
  concurrency: number = CLASSIFY_CONCURRENCY
): Promise<PkPostClassification[]> {
  if (posts.length === 0) return [];

  const provider = chatCompletions();
  if (!provider) {
    console.error("No LLM provider configured; cannot classify posts");
    return [];
  }

  const model = provider.provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini";

  const results: (PkPostClassification | null)[] = new Array(posts.length).fill(null);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= posts.length) return;
      results[i] = await classifyOne(posts[i], context, provider!, model);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, posts.length) }, () => worker())
  );

  return results.filter((r): r is PkPostClassification => r !== null);
}

// ── Aggregation ─────────────────────────────────────────────────────────────────────

function emptyOutlook(): PkSeatOutlook {
  return {
    leader: null,
    runnerUp: null,
    leadPoints: 0,
    competitiveness: "Toss-up",
    confidence: 0,
    keyFactors: [],
  };
}

/**
 * Weighted share of discussion per party.
 *
 * These are reported AS OBSERVED — they are the split of the retrieved posts, not an
 * estimate of the vote. The inference drawn from them (`leadPoints`) is what gets
 * shrunk; see `buildOutlook`.
 */
function computeShares(classifications: PkPostClassification[]): {
  shares: PkPartyShare[];
  rawShares: Map<PkPartyId, number>;
  partisanPosts: number;
  totalWeight: number;
} {
  const weightByParty = new Map<PkPartyId, number>();
  let totalWeight = 0;
  let partisanPosts = 0;

  for (const c of classifications) {
    if (c.party === "unknown") continue;

    // The kept discipline: an off-topic post from a confident partisan and an
    // on-topic post from an ambiguous account both get discounted.
    const weight = c.location_confidence * c.lean_confidence;
    if (weight <= 0) continue;

    weightByParty.set(c.party, (weightByParty.get(c.party) ?? 0) + weight);
    totalWeight += weight;
    partisanPosts++;
  }

  if (totalWeight === 0 || partisanPosts < MIN_PARTISAN_POSTS) {
    return { shares: [], rawShares: new Map(), partisanPosts, totalWeight };
  }

  const rawShares = new Map<PkPartyId, number>();
  for (const [id, w] of weightByParty) {
    rawShares.set(id, (w / totalWeight) * 100);
  }

  // Fold the long tail into OTHER so six 0.4% slivers do not make the bar unreadable.
  let otherShare = 0;
  const named: PkPartyShare[] = [];
  for (const [id, share] of rawShares) {
    if (id === "OTHER" || share < MIN_SHARE_TO_NAME) {
      otherShare += share;
    } else {
      named.push({ party: id, share });
    }
  }
  named.sort((a, b) => b.share - a.share);
  if (otherShare >= 0.5) named.push({ party: "OTHER", share: otherShare });

  const shares = named.map((s) => ({ ...s, share: round1(s.share) }));

  return { shares, rawShares, partisanPosts, totalWeight };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Leader, runner-up and how confidently they can be separated.
 *
 * The lead is shrunk toward the prior by n/(n+25) and then clamped. Worked examples,
 * because the numbers are the point:
 *
 *   6 partisan posts, all one party  -> raw 100 -> 100 × 6/31  = 19.4 -> "Likely"
 *  40 partisan posts, all one party  -> raw 100 -> 100 × 40/65 = 61.5 -> clamped 40 -> "Safe"
 *  40 posts, 55/25 split             -> raw  30 ->  30 × 40/65 = 18.5 -> "Likely"
 *  10 posts, 45/40 split             -> raw   5 ->   5 × 10/35 =  1.4 -> "Toss-up"
 *
 * The first line is the one that matters: six unanimous posts must NOT read as a
 * safe seat. Without shrinkage it reads as 100.
 */
function buildOutlook(
  rawShares: Map<PkPartyId, number>,
  partisanPosts: number,
  totalWeight: number,
  topics: PkTopicSummary[]
): PkSeatOutlook {
  const ranked = [...rawShares.entries()]
    .filter(([id]) => id !== "OTHER" && id !== "UNKNOWN")
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) return emptyOutlook();

  const [leader, leaderShare] = ranked[0];
  const runnerUpEntry = ranked[1];
  const runnerUp = runnerUpEntry ? runnerUpEntry[0] : null;
  const runnerUpShare = runnerUpEntry ? runnerUpEntry[1] : 0;

  const rawLead = leaderShare - runnerUpShare;
  const shrunk = rawLead * (partisanPosts / (partisanPosts + PRIOR_STRENGTH));
  const leadPoints = round1(Math.min(MAX_PLAUSIBLE_LEAD, Math.max(0, shrunk)));

  const competitiveness =
    LADDER.find((rung) => leadPoints >= rung.min)?.rating ?? "Toss-up";

  // Confidence from sample size, on the same logarithmic curve as the US module,
  // plus a small bonus when the split is concentrated rather than diffuse.
  const sampleConfidence = Math.min(0.9, Math.log10(totalWeight + 1) / Math.log10(50));
  const concentration = Math.min(1, leadPoints / MAX_PLAUSIBLE_LEAD);
  const confidence = Math.min(0.95, sampleConfidence + concentration * 0.1);

  const keyFactors: string[] = [];
  for (const topic of topics.slice(0, 3)) {
    if (topic.sentiment > 0.3) keyFactors.push(`Positive sentiment on ${topic.name}`);
    else if (topic.sentiment < -0.3) keyFactors.push(`Negative sentiment on ${topic.name}`);
    else keyFactors.push(`${topic.name} is a live issue`);
  }
  if (keyFactors.length === 0) keyFactors.push("No dominant issue in the retrieved posts");

  return {
    leader,
    runnerUp,
    leadPoints,
    competitiveness,
    confidence: Math.round(confidence * 100) / 100,
    keyFactors,
  };
}

function aggregateTopics(classifications: PkPostClassification[]): PkTopicSummary[] {
  const data: Record<string, { count: number; sentimentSum: number }> = {};

  for (const c of classifications) {
    for (const topic of c.topics) {
      const name = topic.trim().toLowerCase();
      if (!name) continue;
      if (!data[name]) data[name] = { count: 0, sentimentSum: 0 };
      data[name].count++;
      const s = c.topic_sentiments[topic] ?? c.topic_sentiments[name];
      data[name].sentimentSum += typeof s === "number" ? s : 0;
    }
  }

  return Object.entries(data)
    .map(([name, d]) => ({
      name,
      post_count: d.count,
      sentiment: d.count > 0 ? d.sentimentSum / d.count : 0,
    }))
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, 6);
}

function extractInsights(
  classifications: PkPostClassification[]
): PkIntelResponse["insights"] {
  const now = new Date().toISOString();
  const unique = new Set<string>();

  for (const c of classifications) {
    if (c.key_insight && c.key_insight.length > 15 && c.lean_confidence > 0.5) {
      unique.add(c.key_insight.trim());
    }
  }

  return [...unique].slice(0, 3).map((text) => ({
    text,
    type: "pattern" as const,
    timestamp: now,
  }));
}

/**
 * Turn classified posts into the payload the constituency page renders.
 *
 * `sample_size === 0` is the signal for the UI to render nothing at all — not an
 * empty chart, not a zeroed gauge. `shares === []` means there were local posts but
 * too few carrying a party signal to report a split.
 */
export function aggregatePkClassifications(
  classifications: PkPostClassification[],
  code: string,
  constituencyName: string | null
): PkIntelResponse {
  const now = new Date().toISOString();

  const local = classifications.filter(
    (c) => c.location_confidence >= MIN_LOCATION_CONFIDENCE
  );

  if (local.length === 0) {
    return {
      constituency: code,
      constituency_name: constituencyName,
      timestamp: now,
      sample_size: 0,
      partisan_posts: 0,
      shares: [],
      outlook: emptyOutlook(),
      topics: [],
      insights: [],
    };
  }

  const topics = aggregateTopics(local);
  const { shares, rawShares, partisanPosts, totalWeight } = computeShares(local);
  const outlook =
    shares.length > 0
      ? buildOutlook(rawShares, partisanPosts, totalWeight, topics)
      : emptyOutlook();

  return {
    constituency: code,
    constituency_name: constituencyName,
    timestamp: now,
    sample_size: local.length,
    partisan_posts: partisanPosts,
    shares,
    outlook,
    topics,
    insights: extractInsights(local),
  };
}
