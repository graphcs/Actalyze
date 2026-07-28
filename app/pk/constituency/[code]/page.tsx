"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  MapPin,
  Newspaper,
  FileText,
  ExternalLink,
  MessageCircle,
  Lightbulb,
  UserX,
  BarChart3,
} from "lucide-react";
import { PkAppLayout } from "../../components/PkAppLayout";
import { PkConstituencySearch } from "../../components/PkConstituencySearch";
import { Ltr, LtrNumber } from "../../components/Ltr";
import { PartyShareBar } from "../../components/PartyShareBar";
import { SeatOutlook } from "../../components/SeatOutlook";
import { useT, useLocale } from "../../i18n/LocaleProvider";
import { normalizePkCode, toPkUrlSegment } from "@/lib/pk/constituency-code";
import { getConstituency } from "@/lib/pk/constituencies";
import { PK_PROVINCES, party } from "@/lib/pk/parties";
import type { PkIntelResponse } from "@/lib/pk/party-intel";
import { fetchWithCache } from "@/src/lib/fetchWithCache";
import Link from "next/link";
import { provincialSeat } from "@/lib/pk/provincial-seats";
import { asProvinceCode, assemblyForProvince, provinceName } from "@/lib/pk/provinces";

/**
 * The constituency page — the screen a Pakistani government audience spends the most
 * time on.
 *
 * ── Written right-to-left first, not mirrored afterwards ───────────────────────────
 *
 * Every horizontal utility here is logical: `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`,
 * `text-start`. Nothing says `ml-` or `left-`. The US page it is modelled on uses
 * physical properties throughout, which is fine for a single-direction product and
 * unfixable once the layout depends on them.
 *
 * ── <Ltr> on every mixed-script run ────────────────────────────────────────────────
 *
 * The Unicode bidirectional algorithm reorders Latin runs inside RTL paragraphs, so
 * "NA-123" renders as "123-NA", "PML-N 45%" as "45% PML-N", and "n = 32" as "32 = n".
 * This is invisible to anyone reading the English build and instantly disqualifying
 * to a native reader. Every constituency code, percentage, party abbreviation, sample
 * size and date below is wrapped in `<Ltr>` (a `<bdi dir="ltr">`).
 */

const PkMap = dynamic(() => import("../../components/PkMap").then((m) => m.PkMap), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] w-full rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
  ),
});

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  thumbnail?: string;
}

interface SummaryPayload {
  summary: string;
  grounded?: boolean;
  headline_count?: number;
  sources?: Array<{ title: string; url: string; source: string }>;
}

// ── Local presentation primitives ──────────────────────────────────────────────────
// Small enough to keep beside the page, and RTL-correct by construction.

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function CardHead({
  icon: Icon,
  title,
  sub,
  aside,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <Icon className="w-4 h-4 shrink-0 text-green-700 dark:text-green-500" />
          <span className="truncate">{title}</span>
        </h2>
        {sub && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 urdu-prose">
            {sub}
          </p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
      {label}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────────

export default function PkConstituencyPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();

  // `normalizePkCode` returns null for a malformed or out-of-range code, which is the
  // whole bad-code path: no fetches fire, no spinner spins, the not-found card renders
  // immediately.
  const code = normalizePkCode(
    Array.isArray(params.code) ? params.code[0] : (params.code as string | undefined)
  );
  const constituency = code ? getConstituency(code) : null;

  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [intel, setIntel] = useState<PkIntelResponse | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);

  const vacant = constituency?.vacant ?? false;

  // News + briefing. A vacant seat still gets these — a by-election is genuinely
  // newsworthy, and the roster gives us the code even where it gives us no member.
  useEffect(() => {
    if (!constituency) return;
    let cancelled = false;

    setNewsLoading(true);
    fetchWithCache(`/api/pk/news?code=${encodeURIComponent(constituency.code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setHeadlines(d.headlines ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setNewsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [constituency]);

  // The briefing is regenerated when the language changes: it is prose, and a
  // translated-at-render-time briefing would be a machine translation of a machine
  // summary. Cached per language on the server, so the flip is cheap after the first.
  useEffect(() => {
    if (!constituency) return;
    let cancelled = false;

    setSummaryLoading(true);
    fetchWithCache(
      `/api/pk/summary?code=${encodeURIComponent(constituency.code)}&lang=${locale}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSummary(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [constituency, locale]);

  // Discourse signal. Skipped for a vacant seat: there is no member, no seat contest
  // in the roster, and every query spends from a shared SerpAPI quota.
  useEffect(() => {
    if (!constituency || constituency.vacant) {
      setIntelLoading(false);
      return;
    }
    let cancelled = false;

    setIntelLoading(true);
    fetchWithCache(
      `/api/pk/ai-intel?code=${encodeURIComponent(constituency.code)}&lang=${locale}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && !d.error) setIntel(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIntelLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `locale` matters: topic labels and insights are rendered per language, so
    // toggling has to refetch or the section keeps the previous language's text.
  }, [constituency, locale]);

  /**
   * ── Provincial seat ───────────────────────────────────────────────────────────
   *
   * `normalizePkCode` accepts PP/PS/PK/PB, but everything above this point is built on
   * the National Assembly seed and the `/api/pk/*` intelligence routes, which take an
   * NA code. Rather than let a provincial seat fall through to "not found" — it is a
   * real seat and we hold a real record for it — it gets its own compact panel.
   *
   * It deliberately does not fake the NA page. No briefing, no sentiment, no news:
   * those routes have not been given provincial constituencies and a page that showed
   * empty versions of them would look broken rather than scoped.
   */
  if (code && !constituency) {
    const seat = provincialSeat(code);
    if (seat) {
      const meta = seat.party ? party(seat.party) : null;
      const prov = asProvinceCode(seat.province);
      const assembly = prov ? assemblyForProvince(prov) : null;
      return (
        <PkAppLayout>
          <div className="max-w-3xl mx-auto px-4 pt-10 pb-16">
            {prov && (
              <Link
                href={`/pk/province/${toPkUrlSegment(prov)}`}
                className="pk-focus text-xs"
                style={{ color: "var(--pk-accent)" }}
              >
                ← {provinceName(prov, locale)}
              </Link>
            )}
            <h1 className="pk-display mt-2 text-3xl md:text-4xl">
              <Ltr>{seat.code}</Ltr>
              {seat.name && <> · <Ltr>{seat.name}</Ltr></>}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--pk-text-muted)" }}>
              {t("seat.provincial")}
              {assembly && <> — {locale === "ur" ? assembly.nameUr : assembly.nameEn}</>}
            </p>

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs" style={{ color: "var(--pk-text-muted)" }}>
                  {t("seat.member")}
                </dt>
                <dd className="mt-0.5 text-base font-semibold">
                  {seat.memberName ?? (
                    <em style={{ color: "var(--pk-text-faint)" }}>{t("board.vacant")}</em>
                  )}
                </dd>
                {meta && (
                  <dd className="mt-1 flex items-center gap-2 text-sm">
                    <span
                      className="inline-block w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    {locale === "ur" ? meta.nameUr : meta.commonName}
                  </dd>
                )}
              </div>
              {seat.districts.length > 0 && prov && (
                <div>
                  <dt className="text-xs" style={{ color: "var(--pk-text-muted)" }}>
                    {t("seat.districtLabel")}
                  </dt>
                  <dd className="mt-0.5 flex flex-wrap gap-x-3">
                    {seat.districts.map((d) => (
                      <Link
                        key={d}
                        href={`/pk/province/${toPkUrlSegment(prov)}/district/${d
                          .toLowerCase()
                          .replace(/[.'’]/g, "")
                          .replace(/\s+/g, "-")}`}
                        className="pk-focus text-base font-semibold"
                        style={{ color: "var(--pk-accent)" }}
                      >
                        <Ltr>{d}</Ltr>
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {prov && (
              <Link
                href={`/pk/province/${toPkUrlSegment(prov)}/assembly`}
                className="pk-focus inline-block mt-8 text-sm font-medium"
                style={{ color: "var(--pk-accent)" }}
              >
                {t("assembly.view")} →
              </Link>
            )}
          </div>
        </PkAppLayout>
      );
    }
  }

  // ── Bad code ─────────────────────────────────────────────────────────────────────
  if (!code || !constituency) {
    return (
      <PkAppLayout>
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Card>
            <CardBody className="pt-8 text-center">
              <MapPin className="w-8 h-8 mx-auto mb-4 text-zinc-300" />
              <h1 className="text-xl font-bold mb-2">{t("constituency.notFound")}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 urdu-prose mb-6">
                {t("constituency.notFoundBody")}
              </p>
              <div className="flex justify-center">
                <PkConstituencySearch />
              </div>
            </CardBody>
          </Card>
        </div>
      </PkAppLayout>
    );
  }

  const p = party(constituency.party);
  const province = constituency.province ? PK_PROVINCES[constituency.province] : null;

  return (
    <PkAppLayout>
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-16">
        {/* ── Header ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
          <button
            onClick={() => router.push("/pk")}
            className="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
          >
            {/* The glyph encodes a direction, so it mirrors with the layout. */}
            <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
            {t("constituency.backHome")}
          </button>
          <span className="text-zinc-300">/</span>
          <span>{t("constituency.title")}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            <Ltr>{constituency.code}</Ltr>
            {constituency.name && (
              <span className="text-zinc-400 font-bold ms-3 text-xl md:text-2xl">
                <Ltr>{constituency.name}</Ltr>
              </span>
            )}
          </h1>

          {vacant ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 text-xs font-medium">
              <UserX className="w-3 h-3" />
              {t("common.vacant")}
            </span>
          ) : (
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: p.color }}
            >
              <Ltr>{p.commonName}</Ltr>
            </span>
          )}

          {province && (
            <span className="text-sm text-zinc-500">
              {locale === "ur" ? province.nameUr : province.nameEn}
            </span>
          )}
        </div>

        {!vacant && constituency.memberName && (
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            <span className="text-xs uppercase tracking-wide text-zinc-400 me-2">
              {t("constituency.member")}
            </span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              <Ltr>{constituency.memberName}</Ltr>
            </span>
          </p>
        )}

        {/* ── Vacant state ─────────────────────────────────────────────────────── */}
        {vacant && (
          <div className="mb-8 rounded-2xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-5 py-4">
            <div className="flex items-start gap-3">
              <UserX className="w-5 h-5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-500" />
              <div>
                <h2 className="font-semibold text-amber-900 dark:text-amber-200">
                  {t("constituency.vacantTitle")}
                </h2>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300 urdu-prose">
                  {t("constituency.vacantBody")}
                </p>
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 urdu-prose">
                  {t("constituency.mapUnavailableVacant")}{" "}
                  {t("constituency.signalUnavailableVacant")}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <PkConstituencySearch />
        </div>

        {/* ── Map + local news ─────────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {!vacant && (
            <Card>
              <CardHead
                icon={MapPin}
                title={t("constituency.map")}
                aside={
                  <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
                    <Ltr>{constituency.code}</Ltr>
                  </span>
                }
              />
              <CardBody>
                <PkMap
                  code={constituency.code}
                  districts={constituency.districts}
                  province={constituency.province}
                  color={p.color}
                  label={constituency.name ?? ""}
                />
              </CardBody>
            </Card>
          )}

          <Card className={vacant ? "md:col-span-2" : ""}>
            <CardHead
              icon={Newspaper}
              title={t("constituency.news")}
              aside={
                <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1">
                  {t("trending.headlines")}
                </span>
              }
            />
            <CardBody>
              {newsLoading ? (
                <Skeleton label={t("constituency.newsLoading")} />
              ) : headlines.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500 urdu-prose">
                  {t("constituency.newsEmpty")}
                </p>
              ) : (
                <ul className="space-y-4">
                  {headlines.slice(0, 6).map((h, i) => (
                    <li key={`${h.url}-${i}`}>
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex gap-3"
                      >
                        {h.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.thumbnail}
                            alt=""
                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          {/* Headlines are English; isolate them so they do not
                              reorder against the Urdu chrome around them. */}
                          <Ltr className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-green-700 dark:group-hover:text-green-500 transition-colors line-clamp-2">
                            {h.title}
                          </Ltr>
                          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                            <Ltr>{h.source}</Ltr>
                            {h.date && (
                              <>
                                <span>·</span>
                                <Ltr>{h.date}</Ltr>
                              </>
                            )}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Briefing ─────────────────────────────────────────────────────────── */}
        <Card className="mb-5">
          <CardHead
            icon={FileText}
            title={t("constituency.summary")}
            sub={
              summary?.grounded && summary.headline_count
                ? undefined
                : t("constituency.groundedNote")
            }
            aside={
              summary?.grounded && summary.headline_count ? (
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  <LtrNumber value={summary.headline_count} />{" "}
                  {t("constituency.groundedHeadlines")}
                </span>
              ) : undefined
            }
          />
          <CardBody>
            {summaryLoading ? (
              <Skeleton label={t("constituency.summaryLoading")} />
            ) : summary?.summary ? (
              <>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 urdu-prose whitespace-pre-line">
                  {summary.summary}
                </p>
                {summary.sources && summary.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs text-zinc-400 mb-1.5">
                      {t("common.sources")}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {summary.sources.map((s, i) => (
                        <a
                          key={`${s.url}-${i}`}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-700 dark:text-green-500 hover:underline"
                        >
                          <Ltr>{s.source}</Ltr>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500 urdu-prose">
                {t("constituency.summaryEmpty")}
              </p>
            )}
          </CardBody>
        </Card>

        {/* ── Public discourse signal ──────────────────────────────────────────── */}
        {!vacant && (
          <>
            {/* `items-start`: the outlook card is much taller than the share bar, and
                a stretched sibling leaves a large void inside the shorter card. */}
            <div className="grid md:grid-cols-2 gap-5 mb-5 items-start">
              <Card>
                <CardHead
                  icon={BarChart3}
                  title={t("constituency.sentiment")}
                  sub={t("constituency.sentimentSub")}
                />
                <CardBody>
                  {intelLoading ? (
                    <Skeleton label={t("constituency.signalLoading")} />
                  ) : (
                    <PartyShareBar
                      shares={intel?.shares ?? []}
                      sampleSize={intel?.sample_size ?? 0}
                    />
                  )}
                  {!intelLoading && (intel?.sample_size ?? 0) > 0 && (
                    <p className="mt-4 text-xs text-zinc-400">
                      <LtrNumber value={intel!.sample_size} />{" "}
                      {t("constituency.postsAnalysed")}
                    </p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHead
                  icon={BarChart3}
                  title={t("constituency.outlook")}
                  sub={t("constituency.outlookSub")}
                />
                <CardBody>
                  {intelLoading ? (
                    <Skeleton label={t("constituency.signalLoading")} />
                  ) : (
                    <SeatOutlook
                      leader={intel?.outlook.leader ?? null}
                      runnerUp={intel?.outlook.runnerUp ?? null}
                      leadPoints={intel?.outlook.leadPoints ?? 0}
                      competitiveness={intel?.outlook.competitiveness ?? "Toss-up"}
                      confidence={intel?.outlook.confidence ?? 0}
                      keyFactors={intel?.outlook.keyFactors ?? []}
                      sampleSize={intel?.sample_size ?? 0}
                    />
                  )}
                </CardBody>
              </Card>
            </div>

            {/* ── Topics + insights ─────────────────────────────────────────────── */}
            <div className="grid md:grid-cols-2 gap-5 items-start">
              <Card>
                <CardHead icon={MessageCircle} title={t("constituency.topics")} />
                <CardBody>
                  {intelLoading ? (
                    <Skeleton label={t("constituency.signalLoading")} />
                  ) : intel && intel.topics.length > 0 ? (
                    <ul className="space-y-3">
                      {intel.topics.map((topic) => {
                        const positive = topic.sentiment > 0.15;
                        const negative = topic.sentiment < -0.15;
                        return (
                          <li
                            key={topic.name}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-sm text-zinc-800 dark:text-zinc-200 min-w-0 truncate">
                              <Ltr>{topic.name}</Ltr>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full ${
                                  positive
                                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                                    : negative
                                      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                }`}
                              >
                                <Ltr>{topic.sentiment.toFixed(2)}</Ltr>
                              </span>
                              <span className="text-xs text-zinc-400 tabular-nums">
                                <LtrNumber value={topic.post_count} />
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-sm text-zinc-500 urdu-prose">
                      {t("constituency.topicsEmpty")}
                    </p>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHead icon={Lightbulb} title={t("constituency.insights")} />
                <CardBody>
                  {intelLoading ? (
                    <Skeleton label={t("constituency.signalLoading")} />
                  ) : intel && intel.insights.length > 0 ? (
                    <ul className="space-y-3">
                      {intel.insights.map((insight, i) => (
                        <li
                          key={i}
                          className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-4 py-3"
                        >
                          {/* Classifier output is English prose. */}
                          <Ltr className="block text-sm text-zinc-700 dark:text-zinc-300 text-start">
                            {insight.text}
                          </Ltr>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-6 text-center text-sm text-zinc-500 urdu-prose">
                      {t("constituency.insightsEmpty")}
                    </p>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <span>{t("constituency.sourceRoster")}</span>
          <button
            onClick={() =>
              router.push(`/pk/constituency/${toPkUrlSegment(constituency.code)}`)
            }
            className="hover:text-zinc-600 dark:hover:text-zinc-300 transition"
          >
            <Ltr>{constituency.code}</Ltr>
          </button>
        </footer>
      </div>
    </PkAppLayout>
  );
}
