"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, MessageCircle, HelpCircle, Copy, Check } from "lucide-react";
import { PkAppLayout } from "../../components/PkAppLayout";
import { PkSectionHeading } from "../../components/PkSectionHeading";
import { Ltr } from "../../components/Ltr";
import { useLocale } from "../../i18n/LocaleProvider";
import { BUCKET_LABEL, BUCKET_ORDER, type ClaimBucket } from "@/lib/pk/claims";

/**
 * Three buckets, and only one of them produces a reply.
 *
 * The counts sit at the top, all three of them, at equal weight. A day where criticism
 * is the largest bucket is the normal case and the page must show that plainly — an
 * interface that made the correctable count look like the score would quietly turn a
 * monitoring tool into a pressure to find things to rebut.
 *
 * `criticism` renders with no reply box at all, rather than a disabled one. There is no
 * affordance to argue with an opinion, because the absence is the feature.
 */

interface Claim {
  id: string;
  text: string;
  source?: string;
  url?: string;
  bucket: ClaimBucket;
  rationale: string;
  citation: { title: string; locator?: string; excerpt: string; url?: string } | null;
  reply: { en: string | null; ur: string | null };
}

interface Result {
  claims: Claim[];
  counts: Record<ClaimBucket, number>;
  meta: { provider: string | null; statementsReceived: number };
}

const SAMPLE = [
  "The Punjab government has abolished net metering entirely.",
  "This government has done nothing for South Punjab and should resign.",
  "Only 12 of the promised filtration plants in Rajanpur were ever built.",
  "Solar panel subsidies were withdrawn last month without any announcement.",
  "Why is the Chief Minister travelling abroad while Lahore chokes on smog?",
].join("\n");

const ICON = { correctable: ShieldCheck, criticism: MessageCircle, unverifiable: HelpCircle };

export default function PkClaimsPage() {
  const { t, locale } = useLocale();
  const [input, setInput] = useState(SAMPLE);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const run = async () => {
    const statements = input.split("\n").map((s) => s.trim()).filter(Boolean).map((text) => ({ text }));
    if (!statements.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pk/comms/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ statements }),
      });
      setResult(res.ok ? await res.json() : null);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
  };

  return (
    <PkAppLayout>
      <div className="max-w-4xl mx-auto px-4 pt-10 pb-16">
        <PkSectionHeading title={t("claims.title")} note={t("claims.subtitle")} />

        <div className="mt-5">
          <label className="block text-sm font-medium mb-2">{t("claims.input")}</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            className="pk-focus w-full rounded-xl px-4 py-3 text-sm font-mono"
            style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}
          />
          <button
            onClick={run}
            disabled={loading}
            className="pk-focus mt-2 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--pk-band)", color: "var(--pk-on-band)" }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("claims.sort")}
          </button>
        </div>

        {result && (
          <>
            {/* All three counts, equal weight. Criticism being largest is normal. */}
            <div className="grid grid-cols-3 gap-3 mt-8">
              {BUCKET_ORDER.map((b) => {
                const Icon = ICON[b];
                return (
                  <div key={b} className="rounded-xl px-3 py-3"
                       style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}>
                    <Icon className="w-4 h-4 mb-1.5" style={{ color: "var(--pk-accent)" }} />
                    <div className="pk-figure text-2xl font-semibold leading-none">
                      <Ltr>{result.counts[b]}</Ltr>
                    </div>
                    <div className="mt-1 text-xs font-medium">
                      {locale === "ur" ? BUCKET_LABEL[b].ur : BUCKET_LABEL[b].en}
                    </div>
                  </div>
                );
              })}
            </div>

            {BUCKET_ORDER.map((bucket) => {
              const items = result.claims.filter((c) => c.bucket === bucket);
              if (!items.length) return null;
              return (
                <section key={bucket} className="mt-8">
                  <h2 className="pk-eyebrow" style={{ color: "var(--pk-text-muted)" }}>
                    {locale === "ur" ? BUCKET_LABEL[bucket].ur : BUCKET_LABEL[bucket].en}
                  </h2>
                  <p className="mt-1 mb-3 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
                    {locale === "ur" ? BUCKET_LABEL[bucket].noteUr : BUCKET_LABEL[bucket].noteEn}
                  </p>

                  <ul className="space-y-3">
                    {items.map((c) => {
                      const reply = locale === "ur" ? c.reply.ur : c.reply.en;
                      return (
                        <li key={c.id} className="rounded-xl px-4 py-3"
                            style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}>
                          <p className="text-sm">{c.text}</p>
                          <p className="mt-1.5 text-xs" style={{ color: "var(--pk-text-muted)" }}>
                            {c.rationale}
                          </p>

                          {c.citation && (
                            <div className="mt-3 rounded-lg px-3 py-2 text-xs"
                                 style={{ background: "var(--pk-surface-sunk)", border: "1px solid var(--pk-border)" }}>
                              <div className="font-semibold">
                                {c.citation.title}
                                {c.citation.locator && <> · {c.citation.locator}</>}
                              </div>
                              <p className="mt-1 leading-relaxed" style={{ color: "var(--pk-text-muted)" }}>
                                “{c.citation.excerpt}”
                              </p>
                            </div>
                          )}

                          {/* Only ever present for `correctable`. There is no disabled
                              reply box on a criticism — the absence is the point. */}
                          {reply && (
                            <div className="mt-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="pk-eyebrow" style={{ color: "var(--pk-text-muted)" }}>
                                  {t("claims.draftedReply")}
                                </span>
                                <button
                                  onClick={() => copy(c.id, reply)}
                                  className="pk-focus inline-flex items-center gap-1 text-xs"
                                  style={{ color: "var(--pk-accent)" }}
                                >
                                  {copied === c.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <pre className="whitespace-pre-wrap text-xs leading-relaxed m-0 rounded-lg px-3 py-2"
                                   style={{ background: "var(--pk-accent-soft)", border: "1px solid var(--pk-accent-line)" }}>
                                {reply}
                              </pre>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            <p className="mt-8 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
              {t("claims.boundary")}
            </p>
          </>
        )}
      </div>
    </PkAppLayout>
  );
}
