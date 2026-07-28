"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, TrendingUp } from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr, LtrNumber } from "../components/Ltr";
import { useT } from "../i18n/LocaleProvider";

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
}

interface TrendingTopic {
  id: string;
  title: string;
  rawQuery: string;
  tags: string[];
  searchVolume?: number;
  increasePercentage?: number;
  categories: string[];
  color: string;
  headlines: Headline[];
}

/**
 * National trending.
 *
 * The bar next to each topic is scaled against the largest measured search volume in
 * this batch, not against a fixed ceiling — the whole feed can be a quiet day, and
 * pinning the scale would make a 200-volume topic look like a national event. Topics
 * with no measured volume (the ones recovered by clustering news rather than by Google
 * Trends) get no bar at all rather than a zero, because absent and zero are different
 * facts and a reader deserves to see which one this is.
 */
export default function PkTrendingPage() {
  const t = useT();
  const [topics, setTopics] = useState<TrendingTopic[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (bypassCache = false) => {
    setRefreshing(true);
    setFailed(false);
    try {
      const res = await fetch("/api/pk/trending", {
        headers: bypassCache ? { "x-use-cache": "false" } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTopics(Array.isArray(data) ? data : []);
    } catch {
      setFailed(true);
      setTopics([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const measured = (topics ?? []).filter((x) => typeof x.searchVolume === "number");
  const peak = measured.length > 0 ? Math.max(...measured.map((x) => x.searchVolume!)) : 0;

  return (
    <PkAppLayout>
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {t("trending.title")}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl urdu-prose">
              {t("trending.subtitle")}
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition no-print"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? t("trending.refreshing") : t("trending.refresh")}
          </button>
        </header>

        {topics === null && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        )}

        {topics !== null && topics.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 px-6 py-12 text-center">
            <TrendingUp className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <h2 className="font-semibold mb-1">{t("trending.empty")}</h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto urdu-prose">
              {failed ? t("common.error") : t("trending.emptyBody")}
            </p>
          </div>
        )}

        {topics !== null && topics.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
              <LtrNumber value={topics.length} />
              <span>{t("trending.topicCount")}</span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((topic) => {
                const share =
                  peak > 0 && typeof topic.searchVolume === "number"
                    ? Math.max(4, Math.round((topic.searchVolume / peak) * 100))
                    : null;

                return (
                  <article
                    key={topic.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span
                        className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: topic.color }}
                      />
                      <h2 className="font-semibold leading-snug text-start">
                        {/* Trend titles are English and full of Latin acronyms, so the
                            whole heading is isolated rather than picked apart. */}
                        <Ltr>{topic.title}</Ltr>
                      </h2>
                    </div>

                    {topic.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {topic.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                          >
                            <Ltr>{tag}</Ltr>
                          </span>
                        ))}
                      </div>
                    )}

                    {share !== null && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                          <span>{t("trending.momentum")}</span>
                          <span className="flex items-center gap-2">
                            <LtrNumber value={topic.searchVolume!} suffix="+" />
                            {typeof topic.increasePercentage === "number" && (
                              <Ltr className="text-green-700 dark:text-green-400">
                                {`+${topic.increasePercentage}%`}
                              </Ltr>
                            )}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${share}%`, backgroundColor: topic.color }}
                          />
                        </div>
                      </div>
                    )}

                    {topic.headlines.length > 0 && (
                      <div className="mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="text-[11px] uppercase tracking-wide text-zinc-400 mb-2">
                          {t("trending.headlines")}
                        </div>
                        <ul className="space-y-2">
                          {topic.headlines.map((h) => (
                            <li key={h.url}>
                              <a
                                href={h.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-start gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-green-700 dark:hover:text-green-400"
                              >
                                <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                                <span className="text-start">
                                  <Ltr>{h.title}</Ltr>
                                  {/* `whitespace-nowrap` on the date is not cosmetic:
                                      without it "29 Jun 2026" wrapped across a line
                                      break and the bidi algorithm reordered the pieces,
                                      rendering as "29 … Jun 2026" either side of the
                                      source name. */}
                                  <span className="block text-zinc-400 mt-0.5">
                                    <Ltr>{h.source}</Ltr>
                                    {h.date && (
                                      <>
                                        <span className="mx-1">·</span>
                                        <Ltr className="whitespace-nowrap">{h.date}</Ltr>
                                      </>
                                    )}
                                  </span>
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}

        <p className="text-xs text-zinc-400 mt-10 max-w-3xl urdu-prose">
          {t("trending.method")}
        </p>
      </div>
    </PkAppLayout>
  );
}
