/**
 * Which LLM provider the API routes talk to.
 *
 * Routes across this app construct their OpenAI client as
 *   apiKey: OPENROUTER_KEY || process.env.OPENAI_API_KEY
 *   baseURL: OPENROUTER_KEY ? 'https://openrouter.ai/api/v1' : undefined
 * so a *present* OpenRouter key silently takes precedence over OpenAI. That is a
 * problem when the OpenRouter key is set but no longer valid: every AI route fails
 * even though a working OPENAI_API_KEY is configured.
 *
 * Policy: OpenAI is primary whenever OPENAI_API_KEY is set. OpenRouter is used only
 * when OpenAI is not configured, or when explicitly forced with USE_OPENROUTER=true
 * (set that once the OpenRouter key is healthy again — it routes to perplexity/sonar,
 * which can search the web, unlike the plain OpenAI models).
 */

const forceOpenRouter = process.env.USE_OPENROUTER === 'true';

export const OPENROUTER_KEY: string | undefined = forceOpenRouter
  ? process.env.OPENROUTER_API_KEY
  : process.env.OPENAI_API_KEY
    ? undefined
    : process.env.OPENROUTER_API_KEY;

/**
 * Endpoint details for routes that call /chat/completions with raw `fetch`
 * rather than the OpenAI SDK. Both providers accept the same request schema,
 * so only the URL, auth header and model name differ.
 *
 * `webSearchModel` picks a Perplexity model on OpenRouter (it can search the
 * web); on OpenAI it falls back to a plain chat model, which cannot. Callers
 * that depend on live web access should tolerate a more general answer.
 *
 * Returns null when neither provider is configured.
 */
export function chatCompletions(opts?: { webSearch?: boolean }): {
  url: string;
  headers: Record<string, string>;
  model: string;
  provider: 'openrouter' | 'openai';
} | null {
  if (OPENROUTER_KEY) {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
        'X-Title': 'Actalyze',
      },
      model: opts?.webSearch ? 'perplexity/sonar-pro' : 'perplexity/sonar',
      provider: 'openrouter',
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  return {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    model: 'gpt-4o',
    provider: 'openai',
  };
}
