"use client";

/**
 * Constituent casework for a Member of the National Assembly.
 *
 * The screen answers three questions in the order a caseworker asks them: what kind of
 * case is this, who is responsible for it, and where does it actually get filed.
 *
 * The third question is the one a generic product gets wrong. A Member of the NATIONAL
 * Assembly has no formal locus on a provincial subject — police, FIR, land records,
 * school education — because the Eighteenth Amendment abolished the Concurrent
 * Legislative List in 2010. When the classifier lands on one of those, this page says so
 * prominently and points at the MPA or the provincial ombudsman rather than producing a
 * letter the member has no standing to send.
 *
 * RTL-first throughout: logical properties (`ms-`, `ps-`, `border-s`, `text-start`) and
 * <Ltr> around every code, acronym, percentage and figure that would otherwise be
 * reordered by the bidi algorithm inside Urdu prose.
 */

import { useMemo, useState } from "react";
import {
  Inbox, Loader2, AlertTriangle, Building2, ExternalLink, MapPin,
  ListChecks, FileCheck2, Clock, Landmark, Zap,
} from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr, LtrNumber } from "../components/Ltr";
import { useLocale } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";
import {
  PK_CASEWORK_CATEGORIES,
  PK_CASEWORK_METADATA,
  PK_LEAF_COUNT,
  PK_UTILITIES,
  type PkJurisdiction,
} from "@/lib/pk/casework";
import { searchConstituencies, getConstituency } from "@/lib/pk/constituencies";

/** Fill `{name}` placeholders, wrapping each substituted value in <Ltr>. */
function fill(template: string, values: Record<string, string | number>): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(template))) {
    if (m.index > last) out.push(template.slice(last, m.index));
    const v = values[m[1]];
    out.push(v === undefined ? m[0] : <Ltr key={`v${k++}`}>{String(v)}</Ltr>);
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

interface Forum {
  id: string;
  nameEn: string;
  nameUr: string;
  url: string | null;
  scopeEn: string;
  scopeUr: string;
  offices?: Array<{
    provinceEn: string;
    provinceUr: string;
    nameEn: string;
    url: string | null;
    linkStatus: 'ok' | 'http-only' | 'unreachable' | 'no-site';
  }>;
}

interface Tier {
  label_id: string;
  name: string;
  nameUr?: string;
  abbreviation?: string;
  description?: string;
}

interface Classification {
  tier1: Tier | null;
  tier2: Tier | null;
  tier3: Tier | null;
  categoryPath: string;
  categoryIds: string[];
  jurisdiction: PkJurisdiction;
  isProvincial: boolean;
  ministry: string | null;
  escalation: Forum[];
  routedUtility: {
    id: string;
    nameEn: string;
    nameUr: string;
    abbreviation: string;
    territoryLabelEn: string;
    ministry: string;
    mohtasib2024: number | null;
    note: string | null;
  } | null;
  place: string | null;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  documentsNeeded: string[];
  estimatedTimeline: string | null;
  taxonomyVersion: string;
}

const JURISDICTION_KEY: Record<PkJurisdiction, MessageKey> = {
  federal: "casework.federal",
  provincial: "casework.provincial",
  shared: "casework.shared",
};

const JURISDICTION_STYLE: Record<PkJurisdiction, string> = {
  federal:
    "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  provincial:
    "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-800",
  shared:
    "bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800",
};

/** Cases chosen so the two extremes are one click away: a clean federal case, and a
 *  provincial one where the honest answer is "not yours". */
const EXAMPLES: Array<{ key: MessageKey; text: string }> = [
  {
    key: "casework.example1",
    text: "Constituent's CNIC application has been pending with NADRA for four months. Token issued, card never delivered.",
  },
  {
    key: "casework.example2",
    text: "Constituent cannot register an FIR at the local police station. The station house officer has refused twice.",
  },
  {
    key: "casework.example3",
    text: "Benazir Kafaalat payment not received for two quarters; biometric verification fails at the campsite.",
  },
  {
    key: "casework.example4",
    text: "Transformer serving our mohalla in Multan burnt out eleven days ago and has not been replaced.",
  },
];

export default function PkCaseworkPage() {
  const { t, locale } = useLocale();
  const ur = locale === "ur";

  const [description, setDescription] = useState("");
  const [constituency, setConstituency] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Classification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seat = useMemo(() => getConstituency(constituency), [constituency]);
  const seatSuggestions = useMemo(() => {
    if (!constituency.trim() || seat) return [];
    return searchConstituencies(constituency, 4);
  }, [constituency, seat]);

  async function classify(text?: string) {
    const body = (text ?? description).trim();
    if (!body || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/pk/casework/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: body,
          constituency: constituency || undefined,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setResult(data);
    } catch {
      setError(t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  const tiers = result ? [result.tier1, result.tier2, result.tier3].filter(Boolean) as Tier[] : [];

  return (
    <PkAppLayout>
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          {t("casework.title")}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-3xl mb-8 urdu-prose">
          {t("casework.subtitle")}
        </p>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] gap-8">
          {/* ── Input ─────────────────────────────────────────────────────────── */}
          <div className="space-y-4 min-w-0">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("casework.describe")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={t("casework.describePlaceholder")}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-3 text-sm text-start leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-600/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t("casework.constituency")}
              </label>
              <input
                value={constituency}
                onChange={(e) => setConstituency(e.target.value)}
                placeholder="NA-127"
                dir="ltr"
                className="w-full max-w-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600/40"
              />
              <p className="text-[11px] text-zinc-500 mt-1 urdu-prose">
                {t("casework.constituencyHelp")}
              </p>
              {seat && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  <Ltr>{seat.code}</Ltr>
                  {seat.name && <> — {seat.name}</>}
                  {seat.districts.length > 0 && <> · {seat.districts.join(", ")}</>}
                </p>
              )}
              {seatSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {seatSuggestions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => setConstituency(s.code)}
                      className="text-[11px] rounded border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <Ltr>{s.code}</Ltr>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => classify()}
              disabled={!description.trim() || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("casework.classifying")}
                </>
              ) : (
                <>
                  <Inbox className="w-4 h-4" />
                  {t("casework.classify")}
                </>
              )}
            </button>

            {/* Examples */}
            <div className="pt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                {t("casework.examples")}
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.key}
                    onClick={() => {
                      setDescription(ex.text);
                      classify(ex.text);
                    }}
                    className="text-xs rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-start text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    {t(ex.key)}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Taxonomy provenance — the tier-1 ordering is evidence, not opinion. */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mt-6">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-semibold">{t("casework.taxonomyTitle")}</span>
              </div>
              <p className="text-xs text-zinc-500 mb-3 urdu-prose">
                {fill(t("casework.taxonomySize"), {
                  leaves: PK_LEAF_COUNT,
                  tier1: PK_CASEWORK_CATEGORIES.length,
                })}
              </p>
              <ol className="space-y-1">
                {PK_CASEWORK_CATEGORIES.map((n, i) => (
                  <li key={n.label_id} className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="text-zinc-400 tabular-nums w-4 shrink-0 text-end">
                      <LtrNumber value={i + 1} />
                    </span>
                    <span>{ur && n.nameUr ? n.nameUr : n.name}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-zinc-400 mt-3 urdu-prose">
                {t("casework.taxonomyNote")}{" "}
                {fill(t("casework.taxonomySource"), {
                  n: PK_CASEWORK_METADATA.totalComplaints.toLocaleString("en-US"),
                })}
              </p>
            </div>
          </div>

          {/* ── Result ────────────────────────────────────────────────────────── */}
          <div className="min-w-0">
            {!result && !loading && (
              <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-5 py-10 text-center text-sm text-zinc-500 urdu-prose">
                {t("casework.empty")}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* THE provincial warning. Rendered first and loudest, because it is
                    the answer that changes what the office does next. */}
                {result.isProvincial && (
                  <div className="rounded-xl border-2 border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 p-5">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-900 dark:text-amber-200 mb-1">
                          {t("casework.provincial")}
                        </div>
                        <p className="text-sm text-amber-900 dark:text-amber-200 urdu-prose">
                          {t("casework.provincialWarning")}
                        </p>
                        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-2 urdu-prose">
                          {t("casework.eighteenthAmendment")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Classification */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide rounded-full border px-2.5 py-0.5 ${
                          JURISDICTION_STYLE[result.jurisdiction]
                        }`}
                      >
                        {t(JURISDICTION_KEY[result.jurisdiction])}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        <Ltr>{`${result.confidence}%`}</Ltr> {t("casework.confidence")}
                      </span>
                    </div>

                    {/* Tier path, rendered as steps rather than a slashed string so it
                        reads correctly in both directions. */}
                    <ol className="space-y-1">
                      {tiers.map((tier, i) => (
                        <li
                          key={tier.label_id}
                          className="flex items-baseline gap-2"
                          style={{ marginInlineStart: `${i * 12}px` }}
                        >
                          <span className="text-[10px] uppercase tracking-wide text-zinc-400 shrink-0">
                            {t(
                              (["casework.agency", "casework.category", "casework.issue"] as MessageKey[])[i] ??
                                "casework.issue"
                            )}
                          </span>
                          <span
                            className={
                              i === tiers.length - 1
                                ? "text-sm font-semibold"
                                : "text-sm text-zinc-700 dark:text-zinc-300"
                            }
                          >
                            {ur && tier.nameUr ? tier.nameUr : tier.name}
                          </span>
                        </li>
                      ))}
                    </ol>

                    {result.tier3?.description && (
                      <p className="text-xs text-zinc-500 mt-2 urdu-prose">
                        {result.tier3.description}
                      </p>
                    )}
                    <p className="text-[10px] font-mono text-zinc-400 mt-2">
                      <Ltr>{result.categoryIds.join(" › ")}</Ltr>
                    </p>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    {result.ministry && (
                      <div className="flex gap-2 text-sm">
                        <Building2 className="w-4 h-4 shrink-0 text-zinc-400 mt-0.5" />
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                            {t("casework.ministry")}
                          </div>
                          <div className="text-zinc-800 dark:text-zinc-200">
                            {result.ministry}
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-zinc-600 dark:text-zinc-400 urdu-prose">
                      {result.reasoning}
                    </p>

                    {result.estimatedTimeline && (
                      <div className="flex gap-2 text-sm">
                        <Clock className="w-4 h-4 shrink-0 text-zinc-400 mt-0.5" />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {result.estimatedTimeline}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Geographic routing — the DISCO or gas company serving the place. */}
                {result.routedUtility && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t("casework.routedUtility")}
                      </span>
                    </div>
                    <div className="font-semibold">
                      {ur ? result.routedUtility.nameUr : result.routedUtility.nameEn}{" "}
                      <span className="text-zinc-500 font-normal">
                        (<Ltr>{result.routedUtility.abbreviation}</Ltr>)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{result.routedUtility.territoryLabelEn}</span>
                      {result.place && (
                        <>
                          <span className="text-zinc-300">·</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {result.place}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{result.routedUtility.ministry}</div>
                    {result.routedUtility.note && (
                      <p className="text-xs text-sky-800 dark:text-sky-300 mt-2 urdu-prose border-s-2 border-sky-300 dark:border-sky-800 ps-2">
                        {result.routedUtility.note}
                      </p>
                    )}
                    {result.routedUtility.mohtasib2024 !== null && (
                      <p className="text-[11px] text-zinc-400 mt-2 urdu-prose">
                        {fill(t("casework.mohtasibVolume"), {
                          n: result.routedUtility.mohtasib2024.toLocaleString("en-US"),
                        })}
                      </p>
                    )}
                  </div>
                )}

                {/* Where to file */}
                {result.escalation.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                      {t("casework.escalation")}
                    </div>
                    <ol className="space-y-3">
                      {result.escalation.map((f, i) => (
                        <li key={f.id} className="flex gap-2.5">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 grid place-items-center text-[11px] font-semibold text-zinc-500">
                            <LtrNumber value={i + 1} />
                          </span>
                          <div className="min-w-0">
                            {f.url ? (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-medium text-green-800 dark:text-green-300 hover:underline"
                              >
                                {ur ? f.nameUr : f.nameEn}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-sm font-medium">
                                {ur ? f.nameUr : f.nameEn}
                              </span>
                            )}
                            <p className="text-xs text-zinc-500 mt-0.5 urdu-prose">
                              {ur ? f.scopeUr : f.scopeEn}
                            </p>

                            {/* The provincial ombudsmen are four separate offices with
                                websites in varying states of repair. Listing each with
                                its real link status beats one link that is dead for
                                three constituents in four. */}
                            {f.offices && (
                              <ul className="mt-2 space-y-1 border-s-2 border-zinc-200 dark:border-zinc-700 ps-2.5">
                                {f.offices.map((o) => (
                                  <li key={o.provinceEn} className="text-xs">
                                    <span className="text-zinc-500">
                                      {ur ? o.provinceUr : o.provinceEn}
                                    </span>
                                    {" — "}
                                    {o.url ? (
                                      <a
                                        href={o.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-green-800 dark:text-green-300 hover:underline"
                                      >
                                        {o.nameEn}
                                      </a>
                                    ) : (
                                      <span className="text-zinc-600 dark:text-zinc-400">
                                        {o.nameEn}
                                      </span>
                                    )}
                                    {o.linkStatus !== "ok" && (
                                      <span className="ms-1.5 text-[10px] rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 px-1 py-0.5">
                                        {t(
                                          o.linkStatus === "no-site"
                                            ? "casework.linkNoSite"
                                            : o.linkStatus === "http-only"
                                              ? "casework.linkHttpOnly"
                                              : "casework.linkUnreachable"
                                        )}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Next steps */}
                {result.suggestedActions.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <ListChecks className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t("casework.actions")}
                      </span>
                    </div>
                    <ol className="space-y-2">
                      {result.suggestedActions.map((a, i) => (
                        <li key={a} className="flex gap-2.5 text-sm">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-green-100 dark:bg-green-950 grid place-items-center text-[11px] font-semibold text-green-800 dark:text-green-300">
                            <LtrNumber value={i + 1} />
                          </span>
                          <span className="text-zinc-700 dark:text-zinc-300 urdu-prose">{a}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {result.documentsNeeded.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <FileCheck2 className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t("casework.documents")}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {result.documentsNeeded.map((d) => (
                        <li
                          key={d}
                          className="text-sm text-zinc-700 dark:text-zinc-300 flex gap-2 urdu-prose"
                        >
                          <span className="text-zinc-300 shrink-0">—</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* The DISCO map, always visible: it is the single most Pakistani fact on
                the screen and it explains why electricity is the first tier-1 node. */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                {t("casework.discoTitle")}
              </div>
              <ul className="space-y-1.5">
                {PK_UTILITIES.map((u) => (
                  <li key={u.id} className="flex items-baseline gap-2 text-xs">
                    <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 w-16 shrink-0">
                      <Ltr>{u.abbreviation}</Ltr>
                    </span>
                    <span className="text-zinc-500 min-w-0">{u.territoryLabelEn}</span>
                    {u.mohtasib2024 !== undefined && (
                      <span className="ms-auto shrink-0 tabular-nums text-zinc-400">
                        <LtrNumber value={u.mohtasib2024} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-400 mt-3 urdu-prose">
                {t("casework.discoNote")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </PkAppLayout>
  );
}
