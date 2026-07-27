// AI Political Intelligence Library
// Based on concepts from "Artificially Intelligent Opinion Polling" (Cerina & Duch, 2023)

import { chatCompletions } from "@/lib/ai-provider";

export interface Tweet {
  id: string;
  text: string;
  author: string;
  username: string;
  url: string;
  created_at: string;
  user_location?: string;
  user_bio?: string;
}

export interface PostClassification {
  location_confidence: number;
  political_leaning: 'D' | 'R' | 'I' | 'unknown';
  leaning_confidence: number;
  topics: string[];
  topic_sentiments: Record<string, number>;
  key_insight: string;
}

export interface TopicSummary {
  name: string;
  post_count: number;
  sentiment: number;
  trending_direction: 'up' | 'down' | 'stable';
}

export interface AIIntelResponse {
  district: string;
  district_name: string;
  timestamp: string;
  sample_size: number;

  polling: {
    estimate: string;
    margin: number;
    confidence: number;
    vs_traditional?: string;
    ai_only_estimate?: string;
    ai_only_margin?: number;
    traditional_margin?: number;
    blend_weight?: number;
  };

  topics: TopicSummary[];

  election_outlook: {
    rating: 'Safe D' | 'Likely D' | 'Lean D' | 'Toss-up' | 'Lean R' | 'Likely R' | 'Safe R';
    confidence: number;
    key_factors: string[];
  };

  insights: {
    text: string;
    type: 'pattern' | 'shift' | 'emerging';
    timestamp: string;
  }[];
}

// State names mapping
export const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// Demographic weights to correct for Twitter's sampling bias
// Twitter over-represents urban, young, and educated users
// Note: These are placeholder weights for future demographic weighting implementation
export const PLATFORM_BIAS_WEIGHTS = {
  twitter: {
    urban: 0.7,
    suburban: 1.0,
    rural: 1.5,
  }
};

/**
 * Build the prompt for classifying a social media post
 */
export function buildClassificationPrompt(
  tweet: Tweet,
  districtCode: string,
  districtName: string
): string {
  return `Analyze this Twitter post for political intelligence about Congressional District ${districtCode} (${districtName}).

User Bio: "${tweet.user_bio || 'Not provided'}"
User Location: "${tweet.user_location || 'Not provided'}"
Tweet: "${tweet.text}"

Based on the content, return a JSON object with:
1. location_confidence: 0.0-1.0 (how likely this user lives in or near ${districtCode})
2. political_leaning: "D" (Democrat), "R" (Republican), "I" (Independent), or "unknown"
3. leaning_confidence: 0.0-1.0 (confidence in political classification)
4. topics: array of relevant political topics discussed (e.g., "economy", "immigration", "healthcare", "education", "crime", "housing", "environment", "taxes")
5. topic_sentiments: object mapping each topic to sentiment from -1.0 (very negative) to 1.0 (very positive)
6. key_insight: one sentence summarizing what this reveals about district sentiment

Return ONLY valid JSON, no explanation:`;
}

/**
 * Parse the LLM response into a PostClassification
 */
export function parseClassificationResponse(response: string): PostClassification | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', response);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize the response
    return {
      location_confidence: Math.max(0, Math.min(1, parsed.location_confidence || 0)),
      political_leaning: ['D', 'R', 'I', 'unknown'].includes(parsed.political_leaning)
        ? parsed.political_leaning
        : 'unknown',
      leaning_confidence: Math.max(0, Math.min(1, parsed.leaning_confidence || 0)),
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      topic_sentiments: typeof parsed.topic_sentiments === 'object' ? parsed.topic_sentiments : {},
      key_insight: parsed.key_insight || '',
    };
  } catch (error) {
    console.error('Failed to parse classification response:', error);
    return null;
  }
}

/**
 * How many classification requests may be in flight at once.
 *
 * This used to run as fixed batches of 5 with a 200ms sleep between them, so 50
 * posts meant 10 strictly sequential rounds — measured at 29.5s, by far the
 * largest slice of the route's 52s cold path. A worker pool keeps `CONCURRENCY`
 * requests busy continuously, so one slow response no longer stalls a whole
 * round, and there is no artificial delay between them.
 */
const CLASSIFY_CONCURRENCY = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Classify a single post. Returns null when the model could not be reached or
 * its answer was unparseable — callers drop nulls rather than substituting a
 * guess, so an unclassifiable post simply does not enter the sample.
 *
 * One retry on 429/5xx: dropped classifications shrink `sample_size`, and a
 * transient rate-limit blip is exactly the case worth paying 400ms to avoid.
 */
async function classifyOne(
  tweet: Tweet,
  districtCode: string,
  districtName: string,
  provider: NonNullable<ReturnType<typeof chatCompletions>>,
  model: string
): Promise<PostClassification | null> {
  const prompt = buildClassificationPrompt(tweet, districtCode, districtName);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
          // The prompt already demands bare JSON; constraining the format too
          // removes the occasional prose preamble that made parsing fail.
          response_format: { type: 'json_object' },
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

      return parseClassificationResponse(content);
    } catch (error) {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
      console.error('Error classifying tweet:', error);
      return null;
    }
  }

  return null;
}

/**
 * Call the LLM to classify a batch of tweets
 */
export async function classifyTweets(
  tweets: Tweet[],
  districtCode: string,
  districtName: string,
  apiKey: string,
  concurrency: number = CLASSIFY_CONCURRENCY
): Promise<PostClassification[]> {
  if (tweets.length === 0) return [];

  const provider = chatCompletions();
  if (!provider) {
    console.error('No LLM provider configured; cannot classify posts');
    return [];
  }

  // Classification is cheap and high-volume; use the small model on whichever
  // provider is active.
  const model = provider.provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';

  const results: (PostClassification | null)[] = new Array(tweets.length).fill(null);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= tweets.length) return;
      results[i] = await classifyOne(tweets[i], districtCode, districtName, provider!, model);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tweets.length) }, () => worker())
  );

  return results.filter((r): r is PostClassification => r !== null);
}

/**
 * Parse a polling trend string (e.g., "R+55.52%", "D+5", "Tied") into a numeric margin
 * Positive = R advantage, Negative = D advantage
 */
export function parsePollingTrend(trend: string | null): number | null {
  if (!trend) return null;

  const cleanTrend = trend.trim().toUpperCase();

  // Handle "Tied", "Even", "Toss-up"
  if (cleanTrend.includes('TIED') || cleanTrend.includes('EVEN') || cleanTrend.includes('TOSS')) {
    return 0;
  }

  // Match patterns like "R+55.52%", "D+5", "R+10", "D+3.5"
  const match = cleanTrend.match(/([DR])\+?(\d+(?:\.\d+)?)/);
  if (match) {
    const party = match[1];
    const margin = parseFloat(match[2]);
    return party === 'R' ? margin : -margin;
  }

  // Handle "Likely R", "Likely D", "Lean R", "Lean D", "Safe R", "Safe D"
  if (cleanTrend.includes('SAFE R')) return 15;
  if (cleanTrend.includes('LIKELY R')) return 8;
  if (cleanTrend.includes('LEAN R')) return 3;
  if (cleanTrend.includes('SAFE D')) return -15;
  if (cleanTrend.includes('LIKELY D')) return -8;
  if (cleanTrend.includes('LEAN D')) return -3;

  return null;
}

/**
 * Blend AI polling estimate with traditional polling
 * Traditional polls are weighted more heavily as they're more reliable
 */
export function blendPollingEstimates(
  aiMargin: number,
  aiConfidence: number,
  traditionalMargin: number | null,
  aiSampleSize: number
): { margin: number; confidence: number; blendWeight: number } {
  // If no traditional polling, use AI only
  if (traditionalMargin === null) {
    return { margin: aiMargin, confidence: aiConfidence, blendWeight: 0 };
  }

  // Weight traditional polling more heavily (70-90% depending on AI sample size)
  // More AI samples = slightly more AI weight, but traditional still dominates
  const aiWeight = Math.min(0.3, 0.1 + (aiSampleSize / 200) * 0.2);
  const traditionalWeight = 1 - aiWeight;

  const blendedMargin = Math.round(
    traditionalMargin * traditionalWeight + aiMargin * aiWeight
  );

  // Confidence is higher when AI and traditional agree
  const agreement = 1 - Math.abs(aiMargin - traditionalMargin) / 30;
  const blendedConfidence = Math.min(0.95, aiConfidence * 0.3 + 0.5 + agreement * 0.2);

  return {
    margin: blendedMargin,
    confidence: blendedConfidence,
    blendWeight: traditionalWeight,
  };
}

/**
 * Aggregate classifications into district-level intelligence
 */
export function aggregateClassifications(
  classifications: PostClassification[],
  districtCode: string,
  districtName: string,
  traditionalPollingTrend?: string | null
): AIIntelResponse {
  const now = new Date().toISOString();

  if (classifications.length === 0) {
    // Even with no tweet data, we can still use traditional polling if available
    const traditionalMargin = traditionalPollingTrend
      ? parsePollingTrend(traditionalPollingTrend)
      : null;

    if (traditionalMargin !== null) {
      // Use traditional polling as the estimate
      let estimate: string;
      if (Math.abs(traditionalMargin) < 2) {
        estimate = 'Tied';
      } else if (traditionalMargin < 0) {
        estimate = `D+${Math.abs(Math.round(traditionalMargin))}`;
      } else {
        estimate = `R+${Math.round(traditionalMargin)}`;
      }

      // Same provenance caveat as below: this is a model-derived district lean,
      // not an aggregate of published polls.
      let vsTraditional: string;
      if (traditionalMargin === 0) {
        vsTraditional = 'Baseline estimate: Tied';
      } else if (traditionalMargin < 0) {
        vsTraditional = `Baseline estimate: D+${Math.abs(Math.round(traditionalMargin))}`;
      } else {
        vsTraditional = `Baseline estimate: R+${Math.round(traditionalMargin)}`;
      }

      const outlook = determineElectionOutlook(traditionalMargin, 0.6, []);

      return {
        district: districtCode,
        district_name: districtName,
        timestamp: now,
        sample_size: 0,
        polling: {
          estimate,
          margin: Math.round(traditionalMargin),
          confidence: 0.6,
          vs_traditional: vsTraditional,
          ai_only_estimate: 'No data',
          ai_only_margin: 0,
          traditional_margin: traditionalMargin,
          blend_weight: 1.0,
        },
        topics: [],
        election_outlook: outlook,
        insights: [{
          type: 'pattern' as const,
          text: 'No social media posts were available for this area, so no social signal contributed. The figure shown is a model-derived baseline estimate, not a poll.',
          timestamp: now,
        }],
      };
    }

    return {
      district: districtCode,
      district_name: districtName,
      timestamp: now,
      sample_size: 0,
      polling: {
        estimate: 'Unknown',
        margin: 0,
        confidence: 0,
      },
      topics: [],
      election_outlook: {
        rating: 'Toss-up',
        confidence: 0,
        key_factors: ['Insufficient data'],
      },
      insights: [],
    };
  }

  // Filter to users likely in the district
  const localUsers = classifications.filter(c => c.location_confidence >= 0.3);
  const sampleSize = localUsers.length;

  // Calculate AI-only polling estimate
  const aiPolling = calculatePollingEstimate(localUsers);

  // Parse traditional polling if provided
  const traditionalMargin = traditionalPollingTrend
    ? parsePollingTrend(traditionalPollingTrend)
    : null;

  // Blend AI and traditional polling estimates
  const blended = blendPollingEstimates(
    aiPolling.margin,
    aiPolling.confidence,
    traditionalMargin,
    sampleSize
  );

  // Format the final estimate string
  let estimate: string;
  if (Math.abs(blended.margin) < 2) {
    estimate = 'Tied';
  } else if (blended.margin < 0) {
    estimate = `D+${Math.abs(blended.margin)}`;
  } else {
    estimate = `R+${blended.margin}`;
  }

  // Aggregate topics
  const topics = aggregateTopics(localUsers);

  // Determine election outlook based on blended margin
  const election_outlook = determineElectionOutlook(blended.margin, blended.confidence, topics);

  // Extract key insights
  const insights = extractInsights(localUsers);

  // Comparison baseline. This margin comes from /api/district/polling, which is a
  // model-derived estimate of district lean — NOT an aggregate of published polls.
  // Label it accordingly; calling it "Traditional polls" claims a provenance the
  // number does not have.
  let vsTraditional: string | undefined;
  if (traditionalMargin !== null) {
    if (traditionalMargin === 0) {
      vsTraditional = 'Baseline estimate: Tied';
    } else if (traditionalMargin < 0) {
      vsTraditional = `Baseline estimate: D+${Math.abs(Math.round(traditionalMargin))}`;
    } else {
      vsTraditional = `Baseline estimate: R+${Math.round(traditionalMargin)}`;
    }
  }

  return {
    district: districtCode,
    district_name: districtName,
    timestamp: now,
    sample_size: sampleSize,
    polling: {
      estimate,
      margin: blended.margin,
      confidence: blended.confidence,
      vs_traditional: vsTraditional,
      ai_only_estimate: aiPolling.estimate,
      ai_only_margin: aiPolling.margin,
      traditional_margin: traditionalMargin ?? undefined,
      blend_weight: blended.blendWeight,
    },
    topics,
    election_outlook,
    insights,
  };
}

/**
 * Calculate weighted polling estimate from classifications
 */
function calculatePollingEstimate(
  classifications: PostClassification[]
): { estimate: string; margin: number; confidence: number } {
  if (classifications.length === 0) {
    return { estimate: 'Unknown', margin: 0, confidence: 0 };
  }

  let demWeight = 0;
  let repWeight = 0;
  let totalWeight = 0;
  // Count of posts that actually carried a D or R signal. Weights are products of
  // two confidences so they run well below 1 each; gating on the weighted sum would
  // reject samples that are perfectly reportable.
  let partisanPosts = 0;

  for (const c of classifications) {
    if (c.political_leaning === 'unknown') continue;

    // Weight by location confidence and leaning confidence
    const weight = c.location_confidence * c.leaning_confidence;

    if (c.political_leaning === 'D') {
      demWeight += weight;
      partisanPosts++;
    } else if (c.political_leaning === 'R') {
      repWeight += weight;
      partisanPosts++;
    }
    // Independents don't count toward either side

    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { estimate: 'Unknown', margin: 0, confidence: 0 };
  }

  // A handful of posts is not a sample worth reporting a margin from.
  const MIN_PARTISAN_POSTS = 6;
  if (partisanPosts < MIN_PARTISAN_POSTS) {
    return { estimate: 'Unknown', margin: 0, confidence: 0 };
  }

  const demShare = demWeight / totalWeight;
  const repShare = repWeight / totalWeight;

  // The raw share difference is NOT an electoral margin. It is the split of a small,
  // self-selected set of public posts, so a district where every retrieved post leans
  // one way produces ±100 - a figure that is both meaningless and embarrassing next to
  // a real margin. Shrink toward zero as a function of sample size (a standard
  // small-sample prior: with n posts and prior strength k, keep n/(n+k) of the signal),
  // then clamp to a range real congressional margins actually occupy.
  const PRIOR_STRENGTH = 25;
  const rawMargin = (repShare - demShare) * 100;
  const shrunk = rawMargin * (partisanPosts / (partisanPosts + PRIOR_STRENGTH));
  const MAX_PLAUSIBLE_MARGIN = 40;
  const margin = Math.round(
    Math.max(-MAX_PLAUSIBLE_MARGIN, Math.min(MAX_PLAUSIBLE_MARGIN, shrunk))
  );

  // Calculate confidence based on sample size
  // Use logarithmic scale: need ~30 weighted samples for 70% confidence, ~50 for 80%
  const sampleConfidence = Math.min(0.9, Math.log10(totalWeight + 1) / Math.log10(50));

  // Also factor in consistency (how polarized vs mixed the results are)
  const polarization = Math.abs(demShare - repShare); // 0 = perfectly split, 1 = all one side
  const consistencyBonus = polarization * 0.1; // Up to 10% bonus for consistent results

  const confidence = Math.min(0.95, sampleConfidence + consistencyBonus);

  // Format estimate string
  let estimate: string;
  if (Math.abs(margin) < 2) {
    estimate = 'Tied';
  } else if (margin < 0) {
    estimate = `D+${Math.abs(margin)}`;
  } else {
    estimate = `R+${margin}`;
  }

  return { estimate, margin, confidence };
}

/**
 * Aggregate topic mentions and sentiments
 */
function aggregateTopics(classifications: PostClassification[]): TopicSummary[] {
  const topicData: Record<string, { count: number; sentimentSum: number }> = {};

  for (const c of classifications) {
    for (const topic of c.topics) {
      const normalizedTopic = topic.toLowerCase();
      if (!topicData[normalizedTopic]) {
        topicData[normalizedTopic] = { count: 0, sentimentSum: 0 };
      }
      topicData[normalizedTopic].count++;
      topicData[normalizedTopic].sentimentSum += c.topic_sentiments[topic] || 0;
    }
  }

  // Convert to array and sort by count
  const topics: TopicSummary[] = Object.entries(topicData)
    .map(([name, data]) => ({
      name,
      post_count: data.count,
      sentiment: data.count > 0 ? data.sentimentSum / data.count : 0,
      trending_direction: 'stable' as const, // Would need historical data to determine
    }))
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, 5); // Top 5 topics

  return topics;
}

/**
 * Determine election outlook based on polling and topics
 */
function determineElectionOutlook(
  margin: number,
  confidence: number,
  topics: TopicSummary[]
): AIIntelResponse['election_outlook'] {
  // Determine rating based on margin
  let rating: AIIntelResponse['election_outlook']['rating'];

  if (margin <= -10) {
    rating = 'Safe D';
  } else if (margin <= -5) {
    rating = 'Likely D';
  } else if (margin <= -2) {
    rating = 'Lean D';
  } else if (margin >= 10) {
    rating = 'Safe R';
  } else if (margin >= 5) {
    rating = 'Likely R';
  } else if (margin >= 2) {
    rating = 'Lean R';
  } else {
    rating = 'Toss-up';
  }

  // Extract key factors from top topics
  const key_factors: string[] = [];

  for (const topic of topics.slice(0, 3)) {
    if (topic.sentiment > 0.3) {
      key_factors.push(`Positive sentiment on ${topic.name}`);
    } else if (topic.sentiment < -0.3) {
      key_factors.push(`Negative sentiment on ${topic.name}`);
    } else {
      key_factors.push(`${topic.name} is a key issue`);
    }
  }

  if (key_factors.length === 0) {
    key_factors.push('Limited data available');
  }

  return {
    rating,
    confidence: Math.min(0.95, confidence),
    key_factors,
  };
}

/**
 * Extract notable insights from classifications
 */
function extractInsights(classifications: PostClassification[]): AIIntelResponse['insights'] {
  const insights: AIIntelResponse['insights'] = [];
  const now = new Date().toISOString();

  // Collect unique insights
  const uniqueInsights = new Set<string>();

  for (const c of classifications) {
    if (c.key_insight && c.key_insight.length > 10 && c.leaning_confidence > 0.5) {
      uniqueInsights.add(c.key_insight);
    }
  }

  // Take top 3 most interesting insights
  let count = 0;
  for (const text of uniqueInsights) {
    if (count >= 3) break;
    insights.push({
      text,
      type: 'pattern',
      timestamp: now,
    });
    count++;
  }

  return insights;
}
