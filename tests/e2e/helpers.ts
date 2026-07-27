import { expect, type Page, type BrowserContext, type Response } from "@playwright/test";

/**
 * Console/page-error messages that are considered acceptable noise and are not
 * treated as test failures. Everything else that arrives as a console message of
 * type "error", or as an uncaught page error, fails the test.
 */
const ALLOWED_ERROR_PATTERNS: RegExp[] = [
  // favicon 404s
  /favicon/i,
  // third-party embed / widget noise
  /platform\.twitter\.com/i,
  /syndication\.twitter\.com/i,
  /\bwidgets\.js\b/i,
  /twitter/i,
  /\breddit\b/i,
  /redditmedia/i,
  // benign observer warnings
  /ResizeObserver/i,
  // hydration warnings caused by browser extensions
  /hydrat\w*[\s\S]*extension/i,
  /extension[\s\S]*hydrat\w*/i,
];

/**
 * Failures loading remote (non-localhost) sub-resources — news thumbnails from
 * external CDNs, expiring signed image URLs, etc. These are third-party asset
 * availability problems rather than app defects, so they are recorded and
 * printed but do not fail the page render tests.
 */
const REMOTE_ASSET_FAILURE =
  /Failed to load resource|net::ERR_|ERR_NAME_NOT_RESOLVED|the server responded with a status of/i;

/**
 * Endpoints that return 5xx purely because an optional third-party API key is
 * not configured in this environment, AND whose failure the UI already handles
 * with a graceful fallback message.
 *
 * /api/district/ai-intel returns 503 {"error":"AI service unavailable"} for
 * EVERY district when OPENROUTER_API_KEY is unset (it is absent from
 * .env.local); the district page then renders "AI intelligence unavailable for
 * this district". This is an environment/config gap, not an app defect, so it
 * is reported separately instead of failing the render tests.
 */
const ENV_CONFIG_FAILURES = [/\/api\/district\/ai-intel\b[\s\S]*\b503\b|\b503\b[\s\S]*\/api\/district\/ai-intel\b/i];

function isLocalhostUrl(text: string): boolean {
  return /localhost:3000|127\.0\.0\.1:3000/.test(text);
}

export function isAllowedError(text: string): boolean {
  return ALLOWED_ERROR_PATTERNS.some((re) => re.test(text));
}

export interface PageErrors {
  fatal: string[];
  remoteAssets: string[];
  envConfig: string[];
  allowed: string[];
}

function newErrors(): PageErrors {
  return { fatal: [], remoteAssets: [], envConfig: [], allowed: [] };
}

/**
 * Attaches console + pageerror listeners. Returns a mutable bucket of errors and
 * a `reset()` used when we re-navigate after enabling guest mode.
 */
export function collectErrors(page: Page): { errors: PageErrors; reset: () => void } {
  const errors = newErrors();

  const classify = (text: string) => {
    if (isAllowedError(text)) {
      errors.allowed.push(text);
    } else if (ENV_CONFIG_FAILURES.some((re) => re.test(text))) {
      errors.envConfig.push(text);
    } else if (REMOTE_ASSET_FAILURE.test(text) && !isLocalhostUrl(text)) {
      errors.remoteAssets.push(text);
    } else {
      errors.fatal.push(text);
    }
  };

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const loc = msg.location();
    classify(`[console.error] ${msg.text()} @ ${loc.url}:${loc.lineNumber}`);
  });

  page.on("pageerror", (err) => {
    // Uncaught exceptions are always fatal unless explicitly allowlisted.
    const text = `[pageerror] ${err.name}: ${err.message}`;
    if (isAllowedError(text)) errors.allowed.push(text);
    else errors.fatal.push(text);
  });

  return {
    errors,
    reset: () => {
      errors.fatal.length = 0;
      errors.remoteAssets.length = 0;
      errors.envConfig.length = 0;
      errors.allowed.length = 0;
    },
  };
}

export type AuthMode = "public" | "guest";

export interface NavResult {
  response: Response | null;
  mode: AuthMode;
  finalUrl: string;
}

const GUEST_COOKIE = {
  name: "guest_mode_enabled",
  value: "true",
  domain: "localhost",
  path: "/",
};

/**
 * Navigate to `path`. If the app redirects us away from the target (the legacy
 * auth gate bouncing anonymous users to "/"), set the guest_mode_enabled cookie
 * and retry exactly once, reporting which mode was required.
 */
export async function gotoWithAuthFallback(
  page: Page,
  context: BrowserContext,
  path: string,
  reset: () => void
): Promise<NavResult> {
  let response = await page.goto(path, { waitUntil: "domcontentloaded" });
  let mode: AuthMode = "public";

  const redirectedAway = () => {
    const url = new URL(page.url());
    return url.pathname !== path;
  };

  if (redirectedAway()) {
    await context.addCookies([GUEST_COOKIE]);
    reset(); // discard errors produced by the page we were bounced to
    response = await page.goto(path, { waitUntil: "domcontentloaded" });
    mode = "guest";
  }

  // eslint-disable-next-line no-console
  console.log(`[AUTHMODE] ${path} = ${mode}`);
  return { response, mode, finalUrl: page.url() };
}

/**
 * Fails if the Next.js dev error overlay is showing. The overlay lives in a
 * <nextjs-portal> shadow root; Playwright text selectors pierce shadow DOM.
 */
export async function assertNoNextErrorOverlay(page: Page, path: string) {
  const overlaySignals = [
    "Unhandled Runtime Error",
    "Runtime Error",
    "Build Error",
    "Failed to compile",
    "Application error: a client-side exception",
    "This page could not be found",
  ];

  for (const signal of overlaySignals) {
    const count = await page.getByText(signal, { exact: false }).count();
    if (count > 0) {
      const detail = await page
        .getByText(signal, { exact: false })
        .first()
        .textContent()
        .catch(() => null);
      throw new Error(
        `Next.js error overlay / error page detected on ${path}: "${signal}" — ${detail?.slice(0, 400) ?? ""}`
      );
    }
  }
}

/**
 * Asserts the page actually rendered content: a visible heading (or an
 * equivalent large title element) and a non-trivial amount of body text.
 */
export async function assertHasVisibleContent(page: Page, path: string) {
  const main = page.locator("main, [role='main']").first();
  const heading = page.locator("h1, h2, [role='heading']").first();

  // Give client-rendered pages a moment to paint their heading.
  await expect
    .poll(
      async () => {
        if (await heading.count()) {
          try {
            if (await heading.isVisible()) return true;
          } catch {
            /* element detached mid-render */
          }
        }
        return false;
      },
      {
        timeout: 20_000,
        message: `No visible heading (h1/h2/[role=heading]) rendered on ${path}`,
      }
    )
    .toBe(true);

  const scope = (await main.count()) ? main : page.locator("body");
  const text = ((await scope.innerText().catch(() => "")) || "").trim();
  expect(
    text.length,
    `${path} rendered almost no visible text (${text.length} chars) — page appears blank`
  ).toBeGreaterThan(50);
}

export function screenshotName(path: string): string {
  if (path === "/") return "home";
  return path.replace(/^\//, "").replace(/\//g, "-");
}
