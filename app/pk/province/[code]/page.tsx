"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Newspaper } from "lucide-react";
import { PkAppLayout } from "../../components/PkAppLayout";
import { Ltr, LtrNumber } from "../../components/Ltr";
import { useLocale } from "../../i18n/LocaleProvider";
import {
  constituenciesInProvince,
  seatCountsByParty,
  type PkConstituency,
} from "@/lib/pk/constituencies";
import {
  PK_PROVINCES,
  party,
  needsPatternFill,
  type PkPartyId,
  type PkProvinceCode,
} from "@/lib/pk/parties";
import { toPkUrlSegment } from "@/lib/pk/constituency-code";

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
}

interface Issue {
  id: string;
  label: string;
  labelUr: string;
  count: number;
  headlines: Headline[];
}

/**
 * Province rollup.
 *
 * The stacked bar is the reason this page needed care. Six parties in this House are
 * shades of green — PML-N, PML-Q, JUI-F, IPP, PML-Z, MWM, and BAP's olive makes seven
 * once they sit adjacent — so in Punjab the PML-N block can touch PML-Q and IPP with
 * nothing but a hue shift between them. `needsPatternFill()` marks those, and they get
 * a diagonal hatch. Hue alone would also fail for the roughly one reader in twelve with
 * a colour vision deficiency, so this is not only a Pakistan problem.
 *
 * Seat counts come from `constituenciesInProvince`, which means **general seats only**.
 * That is the honest number for a province page: the 60 women-reserved and 10
 * minority-reserved seats are allocated from party lists nationally and have no
 * geography, so attributing them to a province would be an invention. The page says so.
 */

const CODE_MAP: Record<string, PkProvinceCode> = {
  pb: "PB",
  sd: "SD",
  kp: "KP",
  ba: "BA",
  ict: "ICT",
};

/** Diagonal hatch, tinted to the party colour. Rendered as a CSS gradient so it needs
 *  no SVG defs and survives being a flex child of arbitrary width. */
function hatchStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    backgroundImage:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 3px, rgba(255,255,255,0) 3px 7px)",
  };
}

function SeatSwatch({ id, className = "" }: { id: PkPartyId; className?: string }) {
  const p = party(id);
  return (
    <span
      className={`inline-block rounded-sm shrink-0 ${className}`}
      style={needsPatternFill(id) ? hatchStyle(p.color) : { backgroundColor: p.color }}
    />
  );
}

export default function PkProvincePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const { t, locale } = useLocale();
  const provinceCode = CODE_MAP[rawCode?.toLowerCase() ?? ""] ?? null;

  const [news, setNews] = useState<{ headlines: Headline[]; issues: Issue[] } | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!provinceCode) return;
    let cancelled = false;
    fetch(`/api/pk/province-news?province=${provinceCode}`)
      .then((r) => (r.ok ? r.json() : { headlines: [], issues: [] }))
      .then((d) => {
        if (!cancelled) setNews({ headlines: d.headlines ?? [], issues: d.issues ?? [] });
      })
      .catch(() => {
        if (!cancelled) setNews({ headlines: [], issues: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  const seats = useMemo<PkConstituency[]>(
    () => (provinceCode ? constituenciesInProvince(provinceCode) : []),
    [provinceCode]
  );

  const breakdown = useMemo(() => {
    if (!provinceCode) return [];
    // Province-scoped counts. `seatCountsByParty({ generalOnly: true })` gives the
    // national general-seat totals; the same rule is applied here to this province's
    // seats so the two numbers are computed identically and cannot disagree.
    const counts = new Map<PkPartyId, number>();
    for (const seat of seats) {
      if (seat.vacant || !seat.party) continue;
      counts.set(seat.party, (counts.get(seat.party) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }, [provinceCode, seats]);

  const filled = breakdown.reduce((sum, b) => sum + b.count, 0);
  const vacant = seats.filter((s) => s.vacant).length;
  const nationalGeneral = useMemo(
    () => seatCountsByParty({ generalOnly: true }).reduce((sum, p) => sum + p.seats, 0),
    []
  );

  const filteredSeats = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return seats;
    return seats.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.memberName ?? "").toLowerCase().includes(q) ||
        s.districts.some((d) => d.toLowerCase().includes(q))
    );
  }, [seats, filter]);

  if (!provinceCode) {
    return (
      <PkAppLayout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t("province.notFound")}</h1>
          <p className="text-zinc-500">{t("province.notFoundBody")}</p>
        </div>
      </PkAppLayout>
    );
  }

  const province = PK_PROVINCES[provinceCode];
  const name = locale === "ur" ? province.nameUr : province.nameEn;
  const share = nationalGeneral > 0 ? (seats.length / nationalGeneral) * 100 : 0;

  return (
    <PkAppLayout>
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">
            {t("province.title")}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{name}</h1>
          {locale === "ur" && (
            <p className="text-zinc-400 text-sm mt-1">
              <Ltr>{province.nameEn}</Ltr>
            </p>
          )}
        </header>

        {provinceCode === "ICT" && (
          <div className="mb-8 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 urdu-prose">
            {t("province.ictNote")}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: t("province.seats"), value: province.naSeats },
            { label: t("province.generalSeats"), value: seats.length },
            { label: t("province.vacantSeats"), value: vacant },
            { label: t("home.statParties"), value: breakdown.length },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4"
            >
              <div className="text-2xl font-bold">
                <LtrNumber value={value} />
              </div>
              <div className="text-xs text-zinc-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* ── party breakdown ──────────────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-zinc-500">
              {t("province.partyBreakdown")}
            </h2>
            <span className="text-xs text-zinc-400">
              {t("province.shareOfHouse")}{" "}
              <Ltr className="font-medium text-zinc-600 dark:text-zinc-300">
                {`${share.toFixed(1)}%`}
              </Ltr>
            </span>
          </div>

          {filled > 0 ? (
            <>
              {/* This bar deliberately does NOT get the `ltr-island` treatment the rest
                  of the app applies to charts. That rule exists for time series, where
                  the axis runs left-to-right even in Urdu print. A composition bar has
                  no axis and no time: it is read from the reading edge inward, and
                  pinning it to LTR put the largest party at the edge an Urdu reader
                  reaches last while the legend beside it started with the largest party
                  first. Letting it mirror keeps bar and legend in the same order. */}
              <div className="flex h-9 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                {breakdown.map(({ id, count }) => {
                  const p = party(id);
                  return (
                    <div
                      key={id}
                      className="h-full"
                      style={{
                        width: `${(count / filled) * 100}%`,
                        ...(needsPatternFill(id) ? hatchStyle(p.color) : { backgroundColor: p.color }),
                      }}
                      title={`${p.commonName} — ${count}`}
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
                {breakdown.map(({ id, count }) => {
                  const p = party(id);
                  const pct = ((count / filled) * 100).toFixed(1);
                  return (
                    <div key={id} className="flex items-center gap-2 text-xs">
                      <SeatSwatch id={id} className="w-3 h-3" />
                      <span className="text-zinc-700 dark:text-zinc-300">
                        <Ltr>{p.commonName}</Ltr>
                      </span>
                      <span className="text-zinc-500">
                        <LtrNumber value={count} />
                      </span>
                      <span className="text-zinc-400">
                        <Ltr>{`${pct}%`}</Ltr>
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-zinc-400 mt-4 max-w-3xl urdu-prose">
                {t("province.seatsCounted")} {t("province.hatchNote")}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">{t("common.noData")}</p>
          )}
        </section>

        {/* ── issues in the news ───────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold text-zinc-500 mb-3">
            {t("province.issues")}
          </h2>

          {news === null ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-32 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : news.issues.length === 0 ? (
            <p className="text-sm text-zinc-500 urdu-prose">{t("province.issuesEmpty")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {news.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ps-3 pe-2 py-1.5"
                    title={issue.headlines.map((h) => h.title).join("\n")}
                  >
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      {locale === "ur" ? issue.labelUr : issue.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      <LtrNumber value={issue.count} />
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-3">
                <LtrNumber value={news.headlines.length} />{" "}
                {t("province.headlineCount")}
              </p>
            </>
          )}
        </section>

        {/* ── provincial coverage ──────────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-sm font-semibold text-zinc-500 mb-3">{t("province.news")}</h2>

          {news === null ? (
            <div className="grid md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : news.headlines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-5 py-8 text-center">
              <Newspaper className="w-6 h-6 mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500 urdu-prose">{t("province.newsEmpty")}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {news.headlines.slice(0, 10).map((h) => (
                <a
                  key={h.url}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-green-600 transition"
                >
                  <div className="text-sm text-zinc-800 dark:text-zinc-200 text-start">
                    <Ltr>{h.title}</Ltr>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1.5">
                    <Ltr>{h.source}</Ltr>
                    {/* Held on one line: a wrapped date is re-ordered by the bidi
                        algorithm and renders as fragments either side of the source. */}
                    {h.date && (
                      <>
                        <span>·</span>
                        <Ltr className="whitespace-nowrap">{h.date}</Ltr>
                      </>
                    )}
                    <ExternalLink className="w-3 h-3 ms-auto opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* ── constituencies ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-zinc-500">
              {t("province.constituencies")}{" "}
              <span className="text-zinc-400 font-normal">
                <LtrNumber value={filteredSeats.length} />
                {filteredSeats.length !== seats.length && (
                  <>
                    {" "}
                    {t("common.of")} <LtrNumber value={seats.length} />
                  </>
                )}
              </span>
            </h2>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("province.searchSeat")}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-start w-64 focus:outline-none focus:ring-2 focus:ring-green-600/40"
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredSeats.map((seat) => {
              const p = party(seat.party);
              return (
                <Link
                  key={seat.code}
                  href={`/pk/constituency/${toPkUrlSegment(seat.code)}`}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 hover:border-green-600 transition"
                >
                  {seat.vacant ? (
                    <span className="w-3 h-3 rounded-sm shrink-0 border border-dashed border-zinc-400" />
                  ) : (
                    <SeatSwatch id={seat.party as PkPartyId} className="w-3 h-3" />
                  )}
                  <span className="font-semibold text-sm shrink-0">
                    <Ltr>{seat.code}</Ltr>
                  </span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                    {seat.name ?? "—"}
                  </span>
                  <span className="text-[10px] text-zinc-400 ms-auto shrink-0">
                    {seat.vacant ? t("common.vacant") : <Ltr>{p.commonName}</Ltr>}
                  </span>
                </Link>
              );
            })}
          </div>

          {filteredSeats.length === 0 && (
            <p className="text-sm text-zinc-500 mt-4">{t("common.noData")}</p>
          )}
        </section>
      </div>
    </PkAppLayout>
  );
}
