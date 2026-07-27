import { test, expect } from "@playwright/test";

/** AI-backed routes call OpenAI and can legitimately take 30-60s. */
const AI_TIMEOUT = 180_000;

test.describe("GET API routes", () => {
  test("GET /api/trending returns a non-empty array of topics", async ({ request }) => {
    const res = await request.get("/api/trending", { timeout: 60_000 });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body), "/api/trending should return an array").toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const first = body[0];
    expect(typeof first.id, "topic.id should be a string").toBe("string");
    expect(first.id.length).toBeGreaterThan(0);
    expect(typeof first.title, "topic.title should be a string").toBe("string");
    expect(first.title.length).toBeGreaterThan(0);
  });

  test("GET /api/congress returns a non-empty array of bills", async ({ request }) => {
    const res = await request.get("/api/congress", { timeout: 60_000 });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body), "/api/congress should return an array").toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(typeof body[0].title).toBe("string");
    expect(body[0].title.length).toBeGreaterThan(0);
  });

  test("GET /api/admin/settings returns auth settings", async ({ request }) => {
    const res = await request.get("/api/admin/settings", { timeout: 30_000 });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(typeof body).toBe("object");
    expect(body).not.toBeNull();
    expect(
      ["restricted", "public", "guest"],
      `unexpected auth mode: ${body.mode}`
    ).toContain(body.mode);
    // The email allowlists must NOT be exposed to an anonymous caller. This
    // endpoint stays publicly readable because the home page needs `mode`, but
    // leaking adminEmails/authorizedEmails would hand out the allowlist.
    expect(body.adminEmails, "adminEmails must not be exposed anonymously").toBeUndefined();
    expect(
      body.authorizedEmails,
      "authorizedEmails must not be exposed anonymously"
    ).toBeUndefined();
  });

  test("POST /api/admin/settings is rejected without a session", async ({ request }) => {
    const res = await request.post("/api/admin/settings", {
      data: {
        mode: "restricted",
        authorizedEmails: ["attacker@example.com"],
        adminEmails: ["attacker@example.com"],
      },
    });
    expect(
      [401, 403],
      `anonymous write must be rejected, got ${res.status()}`
    ).toContain(res.status());

    // And the stored mode must be unchanged.
    const after = await request.get("/api/admin/settings");
    expect((await after.json()).mode).toBe("public");
  });

  test("DELETE /api/documents/delete is rejected without a session", async ({ request }) => {
    const res = await request.delete(
      "/api/documents/delete?id=00000000-0000-0000-0000-000000000001"
    );
    expect(res.status(), "anonymous delete must be rejected").toBe(401);
  });

  test("removed diagnostic endpoints are gone", async ({ request }) => {
    for (const path of ["/api/debug/twitter", "/api/admin/alerts/debug"]) {
      const res = await request.get(path);
      expect(res.status(), `${path} should no longer exist`).toBe(404);
    }
  });

  test("GET /api/state/news?state=CA returns headlines", async ({ request }) => {
    const res = await request.get("/api/state/news?state=CA", { timeout: 60_000 });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.headlines), "expected a `headlines` array").toBe(true);
    expect(body.headlines.length, "no headlines returned for CA").toBeGreaterThan(0);

    const first = body.headlines[0];
    expect(typeof first.title).toBe("string");
    expect(first.title.length).toBeGreaterThan(0);
    expect(typeof first.url).toBe("string");
    expect(first.url).toMatch(/^https?:\/\//);
  });

  test("GET /api/tweets/search returns tweets", async ({ request }) => {
    const res = await request.get("/api/tweets/search?query=congress&limit=4", {
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.tweets), "expected a `tweets` array").toBe(true);
    expect(body.tweets.length, "no tweets returned").toBeGreaterThan(0);
    expect(body.tweets.length, "limit=4 should not be exceeded").toBeLessThanOrEqual(4);

    const first = body.tweets[0];
    expect(typeof first.id).toBe("string");
    expect(typeof first.text).toBe("string");
    expect(first.text.length).toBeGreaterThan(0);
  });
});

test.describe("POST API routes (AI-backed)", () => {
  test("POST /api/ethics/ask answers a gift-rule question", async ({ request }) => {
    test.setTimeout(AI_TIMEOUT + 30_000);

    const res = await request.post("/api/ethics/ask", {
      data: { question: "What is the gift rule limit?" },
      timeout: AI_TIMEOUT,
    });
    expect(res.status(), `body: ${await res.text()}`).toBe(200);

    const body = await res.json();
    expect(typeof body.answer, "expected an `answer` string").toBe("string");
    expect(body.answer.trim().length, "`answer` was empty").toBeGreaterThan(20);
    expect(body.answer).not.toMatch(/Unable to generate response/i);
  });

  test("POST /api/casework/classify returns a tier1..tier4 classification", async ({
    request,
  }) => {
    test.setTimeout(AI_TIMEOUT + 30_000);

    const res = await request.post("/api/casework/classify", {
      data: {
        description:
          "Constituent has not received VA disability benefits for three months",
      },
      timeout: AI_TIMEOUT,
    });
    expect(res.status(), `body: ${await res.text()}`).toBe(200);

    const body = await res.json();
    for (const tier of ["tier1", "tier2", "tier3", "tier4"] as const) {
      expect(body, `response is missing \`${tier}\``).toHaveProperty(tier);
    }

    // tier1 must actually classify a clear VA case; deeper tiers may be null.
    expect(body.tier1, "tier1 should not be null for an unambiguous VA case").not.toBeNull();
    expect(typeof body.tier1.label_id).toBe("string");
    expect(typeof body.tier1.name).toBe("string");
    expect(body.tier1.name.length).toBeGreaterThan(0);
  });

  test("POST /api/draft-memo/generate returns a press release memo", async ({ request }) => {
    test.setTimeout(AI_TIMEOUT + 30_000);

    const res = await request.post("/api/draft-memo/generate", {
      data: {
        type: "press-release",
        topic: "housing affordability",
        perspective: "neutral",
      },
      timeout: AI_TIMEOUT,
    });
    expect(res.status(), `body: ${await res.text()}`).toBe(200);

    const body = await res.json();
    expect(typeof body.memo, "expected a `memo` string").toBe("string");
    expect(body.memo.trim().length, "`memo` was empty").toBeGreaterThan(100);
  });
});
