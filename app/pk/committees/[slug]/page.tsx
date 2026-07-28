"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BookOpenCheck,
  CalendarClock,
  ChevronLeft,
  ExternalLink,
  FileText,
  Gavel,
  HelpCircle,
  Mail,
  MapPin,
  Newspaper,
  Phone,
  Printer,
  Scale,
  UserX,
  Users,
} from "lucide-react";
import { PkAppLayout } from "../../components/PkAppLayout";
import { Ltr, LtrNumber } from "../../components/Ltr";
import { useLocale } from "../../i18n/LocaleProvider";
import {
  PK_COMMITTEE_META,
  blocBreakdown,
  getCommittee,
  partyBreakdown,
  type PkCommittee,
  type PkCommitteeMember,
} from "@/lib/pk/committees";
import { hatchAngle, needsPatternFill, party, type PkPartyId } from "@/lib/pk/parties";
import { toPkUrlSegment } from "@/lib/pk/constituency-code";

/**
 * The oversight pack for one committee — the thing a committee secretary opens the
 * night before a meeting, and prints.
 *
 * ── Two halves with different failure modes, and the page keeps them apart ─────────
 *
 * Composition, sittings and reports are LOCAL: `data/pk/committees.json`, scraped from
 * na.gov.pk and joined to the member roster. They render immediately and cannot fail.
 * Rules, coverage and suggested questions come from `/api/pk/committees/brief`, which
 * needs the document library, SerpAPI and a model. When that call fails the page says
 * so in one line and still prints a complete member list — which is the half a
 * secretary cannot walk into a room without.
 *
 * ── Nothing on this page is asserted ───────────────────────────────────────────────
 *
 * The rules section is verbatim retrieved text with the rule number the document
 * itself carries; if retrieval comes back empty it says so rather than describing what
 * the rules "generally" provide. The member list is scraped and never inferred — a
 * member the Secretariat lists who is not on the current roster is shown, marked, and
 * given no constituency link, because that link would resolve to whoever holds the
 * seat now. And the questions are labelled as suggestions in three places: the section
 * heading, a badge, and the sentence under it.
 *
 * ── Print ──────────────────────────────────────────────────────────────────────────
 *
 * `window.print()` and a `@media print` block, no PDF library. The three in
 * package.json are dead imports, and none of them shapes Urdu — jsPDF has no Arabic
 * font, and html2canvas rasterises the page into an image with no text layer. The
 * browser's own shaper renders Nastaliq correctly and keeps the text selectable, so
 * the printed pack is a real document rather than a picture of one.
 */

// ── Types shared with /api/pk/committees/brief ────────────────────────────────────

interface RuleCitation {
  rule: string | null;
  heading: string | null;
  excerpt: string;
  documentTitle: string;
  documentYear: number | null;
  isRemit?: boolean;
}

interface Headline {
  title: string;
  url: string;
  source: string;
  date?: string;
  snippet?: string;
}

interface SuggestedQuestion {
  question: string;
  basis: string;
  sourceIndex: number | null;
}

interface BriefPayload {
  rules: { citations: RuleCitation[]; documentTitle: string | null; retrieved: boolean };
  news: { headlines: Headline[]; searches: number; reason: string | null };
  questions: { items: SuggestedQuestion[]; suggested: boolean; grounded: boolean };
}

// ── Print stylesheet ───────────────────────────────────────────────────────────────

/**
 * Scoped to `.pk-pack` so it cannot reach the rest of the app, and written for A4
 * because that is what Parliament House prints on.
 *
 * `.no-print` is already handled by `app/pk/pk.css` (sidebar, language toggle). What
 * is here is the pack's own paper layout: card chrome flattened to rules, colour
 * dropped to ink, sections kept off page breaks, and every link's destination printed
 * after it — a printed pack with invisible URLs is a dead end for whoever reads it on
 * paper. `direction` is inherited, so an Urdu pack prints right-to-left.
 */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm 12mm; }

  /* The shell's sidebar has no print rule of its own, so it prints as a nav column
     down the page and the content keeps its 16rem offset. Both are fixed from here
     rather than in the shell: this stylesheet is mounted only while the pack is on
     screen, so the rule cannot reach any other page, and PkSidebar.tsx is being
     restructured in parallel and must not be edited.
     (Nothing in this string may contain a literal style tag: Next escapes it during
     serialisation and the escaped form does not match on hydration.) */
  .pk-root aside { display: none !important; }
  .pk-root .ms-64 { margin-inline-start: 0 !important; }

  .pk-pack { font-size: 10.5pt; color: #000; background: #fff; }
  .pk-pack .pack-card {
    border: 0;
    border-top: 1pt solid #000;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    padding: 6pt 0 0;
    margin: 0 0 10pt;
    break-inside: avoid;
  }
  .pk-pack .pack-section { break-inside: avoid-page; }
  .pk-pack h1 { font-size: 16pt; }
  .pk-pack h2 { font-size: 12pt; }
  .pk-pack .pack-hide-print { display: none !important; }
  .pk-pack .pack-quote { border-inline-start: 2pt solid #000; background: #fff; }
  .pk-pack a { color: #000; text-decoration: none; }
  .pk-pack a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 7.5pt;
    word-break: break-all;
  }
  .pk-pack .pack-strip { display: none; }
  .pk-pack table { break-inside: auto; }
  .pk-pack tr { break-inside: avoid; }
  .pk-pack thead { display: table-header-group; }
  .pk-pack .pack-footer { break-before: auto; font-size: 8.5pt; }
}
`;

// ── Local presentation primitives ──────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`pack-card pack-section bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function CardHead({
  icon: Icon,
  title,
  sub,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="px-5 pt-5 pb-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 shrink-0 text-green-700 dark:text-green-500" />
          <span>{title}</span>
        </h2>
        {badge}
      </div>
      {sub && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 urdu-prose">{sub}</p>
      )}
    </div>
  );
}

function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>;
}

/**
 * "Standing Committee on X" in English; "قائمہ کمیٹی برائے X" in Urdu, with the name
 * itself left in Latin script and bidi-isolated.
 *
 * The same ten lines as on the index. A `page.tsx` may only export `default` and the
 * route options, so one route file cannot share a component with another, and a new
 * component file is outside this feature's scope.
 */
function CommitteeTitle({
  committee,
  className,
}: {
  committee: Pick<PkCommittee, "name" | "kind">;
  className?: string;
}) {
  const { t } = useLocale();
  const prefix =
    committee.kind === "standing"
      ? t("committees.standingCommitteeOn")
      : t("committees.committeeOn");
  return (
    <span className={className}>
      <span className="text-zinc-500 dark:text-zinc-400 font-normal">{prefix} </span>
      <Ltr>{committee.name}</Ltr>
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400 urdu-prose leading-relaxed">
      {children}
    </p>
  );
}

/**
 * A block of English inside an Urdu page.
 *
 * `<Ltr>` is a `<bdi>`: it fixes the ORDER of a mixed-script run, which is what a
 * constituency code or a date needs. It does not change alignment, so a full paragraph
 * of English rule text sitting in an RTL page still sets flush right with a ragged
 * left edge — legible, but visibly wrong to anyone who reads English, and this page is
 * full of English: the Rules of Procedure, committee names, report titles, headlines.
 *
 * Everything that is a multi-line English *block* — as opposed to a short run embedded
 * in an Urdu sentence — goes in here instead. `.ltr-island` is the existing convention
 * in `app/pk/pk.css`. In the English build this is a no-op.
 */
function EnBlock({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "p" | "li" | "span";
}) {
  return (
    <Tag dir="ltr" className={`ltr-island text-start ${className}`}>
      {children}
    </Tag>
  );
}

function fillStyle(id: PkPartyId, color: string): React.CSSProperties {
  if (!needsPatternFill(id)) return { backgroundColor: color };
  return {
    backgroundColor: color,
    backgroundImage: `repeating-linear-gradient(${hatchAngle(
      id
    )}deg, rgba(255,255,255,0.42) 0 3px, rgba(255,255,255,0) 3px 8px)`,
  };
}

// ── Composition ────────────────────────────────────────────────────────────────────

function MemberRow({ m }: { m: PkCommitteeMember }) {
  const { t } = useLocale();
  const p = party(m.party);
  const linkable = m.rosterMatch !== false && m.constituency;

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800/70 align-top">
      <td className="py-2 pe-3">
        <span className="font-medium">
          <Ltr>{m.name}</Ltr>
        </span>
        {m.chairman && (
          <span className="ms-2 rounded px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
            {t("committees.chair")}
          </span>
        )}
        {m.rosterMatch === false && (
          <span className="block text-[11px] text-amber-700 dark:text-amber-500 urdu-prose">
            {t("committees.notOnRoster")}
          </span>
        )}
      </td>
      <td className="py-2 pe-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={fillStyle((m.party ?? "UNKNOWN") as PkPartyId, p.color)}
            aria-hidden
          />
          <Ltr>{p.commonName}</Ltr>
        </span>
      </td>
      <td className="py-2 whitespace-nowrap">
        {linkable ? (
          <Link
            href={`/pk/constituency/${toPkUrlSegment(m.constituency as string)}`}
            className="inline-flex items-center gap-1 text-green-700 dark:text-green-500 hover:underline"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0 pack-hide-print" />
            <Ltr>{m.constituency}</Ltr>
          </Link>
        ) : (
          <span className="text-zinc-500">
            {m.constituency ? (
              <Ltr>{m.constituency}</Ltr>
            ) : (
              <Ltr>{m.seatLabel ?? t("committees.reservedSeat")}</Ltr>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

function Composition({ committee }: { committee: PkCommittee }) {
  const { t } = useLocale();
  const shares = partyBreakdown(committee);
  const total = shares.reduce((n, s) => n + s.seats, 0);
  const blocs = blocBreakdown(committee);

  return (
    <Card>
      <CardHead
        icon={Users}
        title={t("committees.compositionHeading")}
        sub={t("committees.compositionSub")}
      />
      <CardBody>
        {committee.compositionUnavailable || committee.members.length === 0 ? (
          <Empty>{t("committees.compositionEmpty")}</Empty>
        ) : (
          <>
            <div className="pack-strip flex h-2.5 rounded-full overflow-hidden mb-2">
              {shares.map((s) => {
                const p = party(s.party);
                return (
                  <div
                    key={s.party}
                    style={{ width: `${(s.seats / total) * 100}%`, ...fillStyle(s.party, p.color) }}
                    title={`${p.commonName} — ${s.seats}`}
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400 mb-1">
              {shares.map((s) => (
                <span key={s.party} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={fillStyle(s.party, party(s.party).color)}
                    aria-hidden
                  />
                  <Ltr>{party(s.party).commonName}</Ltr>
                  <LtrNumber value={s.seats} />
                </span>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mb-4 urdu-prose">
              {t("committees.government")} <LtrNumber value={blocs.government} /> ·{" "}
              {t("committees.opposition")} <LtrNumber value={blocs.opposition} /> ·{" "}
              {t("committees.neutral")} <LtrNumber value={blocs.neutral} /> —{" "}
              {t("committees.blocNote")}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="text-start font-medium pb-1">{t("committees.members")}</th>
                    <th className="text-start font-medium pb-1">{t("common.party")}</th>
                    <th className="text-start font-medium pb-1">{t("common.seat")}</th>
                  </tr>
                </thead>
                <tbody>
                  {committee.members.map((m) => (
                    <MemberRow key={`${m.uid ?? m.name}`} m={m} />
                  ))}
                </tbody>
              </table>
            </div>

            {committee.senators.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-semibold text-zinc-500 mb-1">
                  {t("committees.senators")}
                </h3>
                <p className="text-[11px] text-zinc-500 mb-2 urdu-prose">
                  {t("committees.senatorsNote")}
                </p>
                <ul className="text-sm space-y-1">
                  {committee.senators.map((s) => (
                    <li key={s.name}>
                      <Ltr>{s.name}</Ltr>
                      <span className="text-zinc-500">
                        {" — "}
                        <Ltr>{party(s.party).commonName}</Ltr>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {committee.exOfficio.length > 0 && (
              <p className="mt-4 text-xs text-zinc-500">
                {t("committees.exOfficio")}:{" "}
                {committee.exOfficio.map((e) => (
                  <Ltr key={e}>{e}</Ltr>
                ))}
              </p>
            )}

            {committee.secretary && (
              <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs">
                <span className="text-zinc-500">{t("committees.secretary")}: </span>
                <Ltr>{committee.secretary.name}</Ltr>
                {committee.secretary.phone && (
                  <span className="ms-3 inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 pack-hide-print" />
                    <Ltr>{committee.secretary.phone}</Ltr>
                  </span>
                )}
                {committee.secretary.email && (
                  <span className="ms-3 inline-flex items-center gap-1">
                    <Mail className="w-3 h-3 pack-hide-print" />
                    <Ltr>{committee.secretary.email}</Ltr>
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ── Business before the committee ──────────────────────────────────────────────────

function Business({ committee }: { committee: PkCommittee }) {
  const { t } = useLocale();
  const [showAll, setShowAll] = useState(false);
  const reports = showAll ? committee.reports : committee.reports.slice(0, 6);

  return (
    <Card>
      <CardHead icon={CalendarClock} title={t("committees.businessHeading")} />
      <CardBody className="space-y-5">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 mb-2">
            {t("committees.upcomingMeetings")}
          </h3>
          {committee.meetings.length === 0 ? (
            <Empty>{t("committees.meetingsEmpty")}</Empty>
          ) : (
            <ul className="space-y-3">
              {committee.meetings.map((m) => (
                <li
                  key={`${m.dateLabel}-${m.title}`}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <Ltr>{m.dateLabel}</Ltr>
                    {m.time && (
                      <span className="text-zinc-500">
                        <Ltr>{m.time}</Ltr>
                      </span>
                    )}
                    {m.subCommittee && (
                      <span className="rounded px-1.5 py-0.5 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {t("committees.subCommittee")}
                      </span>
                    )}
                  </div>
                  <EnBlock as="p" className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {m.title}
                  </EnBlock>
                  {m.venue && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("committees.venue")}: <Ltr>{m.venue}</Ltr>
                    </p>
                  )}
                  {m.noticeUrl && (
                    <a
                      href={m.noticeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-500 hover:underline"
                    >
                      <FileText className="w-3 h-3 pack-hide-print" />
                      {t("committees.meetingNotice")}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-zinc-500 mb-2">{t("committees.reports")}</h3>
          {committee.reports.length === 0 ? (
            <Empty>{t("committees.reportsEmpty")}</Empty>
          ) : (
            <>
              <ul className="space-y-2 text-sm">
                {reports.map((r) => (
                  <li key={r.title} className="flex gap-3">
                    <span className="text-xs text-zinc-500 shrink-0 w-28">
                      <Ltr>{r.dateLabel}</Ltr>
                    </span>
                    <EnBlock as="span" className="min-w-0 flex-1">
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-green-800 dark:text-green-400"
                        >
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                    </EnBlock>
                  </li>
                ))}
              </ul>
              {!showAll && committee.reports.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="pack-hide-print mt-3 text-xs text-green-700 dark:text-green-500 hover:underline"
                >
                  <LtrNumber value={committee.reports.length - 6} />{" "}
                  {t("committees.reportsMore")}
                </button>
              )}
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────────

export default function PkCommitteePackPage() {
  const params = useParams();
  const { t, locale } = useLocale();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const committee = getCommittee(slug);

  const [brief, setBrief] = useState<BriefPayload | null>(null);
  const [briefFailed, setBriefFailed] = useState(false);

  // The pack is regenerated when the interface language changes: the questions are
  // written in the reading language, and a secretary switching to Urdu expects the
  // Urdu pack, not English questions under Urdu headings.
  useEffect(() => {
    if (!committee) return;
    let cancelled = false;
    setBrief(null);
    setBriefFailed(false);

    fetch(`/api/pk/committees/brief?slug=${committee.slug}&lang=${locale}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: BriefPayload) => {
        if (!cancelled) setBrief(data);
      })
      .catch(() => {
        if (!cancelled) setBriefFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [committee, locale]);

  if (!committee) {
    return (
      <PkAppLayout>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-bold mb-2">{t("committees.notFound")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 urdu-prose mb-6">
            {t("committees.notFoundBody")}
          </p>
          <Link
            href="/pk/committees"
            className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-500 hover:underline"
          >
            <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
            {t("committees.backToList")}
          </Link>
        </div>
      </PkAppLayout>
    );
  }

  const prepared = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const remitCitation = brief?.rules.citations.find((c) => c.isRemit);

  return (
    <PkAppLayout>
      <style>{PRINT_CSS}</style>
      <div className="pk-pack max-w-4xl mx-auto px-4 pt-8 pb-16">
        <Link
          href="/pk/committees"
          className="pack-hide-print inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-green-700 mb-5"
        >
          <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
          {t("committees.backToList")}
        </Link>

        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-green-700 dark:text-green-500 font-semibold">
                {t("committees.packTitle")}
              </p>
              <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
                <CommitteeTitle committee={committee} />
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {committee.chairVacant ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-500">
                    <UserX className="w-4 h-4" />
                    {t("committees.chairVacant")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Gavel className="w-4 h-4 text-green-700 dark:text-green-500" />
                    {t("committees.chair")}: <Ltr>{committee.chairName ?? "—"}</Ltr>
                  </span>
                )}
                <span className="ms-4 text-zinc-500">
                  {t("committees.preparedOn")} <Ltr>{prepared}</Ltr>
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="pack-hide-print shrink-0 inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs hover:border-green-600 hover:text-green-700 transition"
            >
              <Printer className="w-4 h-4" />
              {t("committees.print")}
            </button>
          </div>
        </header>

        {briefFailed && (
          <p className="mb-5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-300 urdu-prose">
            {t("committees.packFailed")}
          </p>
        )}

        <div className="space-y-5">
          {/* 1 — Remit and governing rules. Verbatim, or nothing. */}
          <Card>
            <CardHead
              icon={Scale}
              title={t("committees.remitHeading")}
              sub={t("committees.remitSub")}
            />
            <CardBody>
              {!brief && !briefFailed && <Empty>{t("committees.loading")}</Empty>}
              {brief && !brief.rules.retrieved && <Empty>{t("committees.rulesEmpty")}</Empty>}
              {brief && brief.rules.retrieved && (
                <>
                  {!remitCitation && (
                    <p className="mb-3 text-xs text-zinc-500 urdu-prose">
                      {t("committees.rulesRemitMissing")}
                    </p>
                  )}
                  <div className="space-y-4">
                    {brief.rules.citations.map((c, i) => (
                      <blockquote
                        key={`${c.rule ?? "x"}-${i}`}
                        className={`pack-quote border-s-2 ps-4 ${
                          c.isRemit
                            ? "border-green-600 bg-green-50/60 dark:bg-green-950/20 py-2 rounded-e-lg"
                            : "border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        <div className="text-xs font-semibold text-zinc-500 mb-1">
                          {c.rule ? (
                            <>
                              {t("committees.rule")} <Ltr>{c.rule}</Ltr>
                            </>
                          ) : (
                            <Ltr>{c.documentTitle}</Ltr>
                          )}
                          {c.heading && (
                            <span className="font-normal">
                              {" — "}
                              <Ltr>{c.heading}</Ltr>
                            </span>
                          )}
                          {c.isRemit && (
                            <span className="ms-2 rounded px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                              {t("committees.remitRule")}
                            </span>
                          )}
                        </div>
                        <EnBlock
                          as="p"
                          className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
                        >
                          {c.excerpt}
                        </EnBlock>
                      </blockquote>
                    ))}
                  </div>
                  {brief.rules.documentTitle && (
                    <p className="mt-4 text-xs text-zinc-500">
                      {t("committees.rulesSource")}: <Ltr>{brief.rules.documentTitle}</Ltr>
                    </p>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {/* 2 — Composition. Local data; renders with or without the network. */}
          <Composition committee={committee} />

          {/* 3 — Business. Also local. */}
          <Business committee={committee} />

          {/* 4 — Subject-area coverage. */}
          <Card>
            <CardHead
              icon={Newspaper}
              title={t("committees.newsHeading")}
              sub={t("committees.newsSub")}
            />
            <CardBody>
              {!brief && !briefFailed && <Empty>{t("committees.loading")}</Empty>}
              {brief && brief.news.headlines.length === 0 && (
                <Empty>{t("committees.newsEmpty")}</Empty>
              )}
              {brief && brief.news.headlines.length > 0 && (
                <ol className="space-y-3">
                  {brief.news.headlines.map((h, i) => (
                    <li key={h.url} className="flex gap-3">
                      <span className="text-xs text-zinc-400 pt-0.5 shrink-0">
                        <Ltr>{`[${i + 1}]`}</Ltr>
                      </span>
                      <EnBlock className="min-w-0 flex-1">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline text-zinc-900 dark:text-zinc-100"
                        >
                          {h.title}
                        </a>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {h.source}
                          {h.date && ` · ${h.date}`}
                        </div>
                        {h.snippet && (
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {h.snippet}
                          </p>
                        )}
                      </EnBlock>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {/* 5 — Suggested questions. Labelled three times over. */}
          <Card>
            <CardHead
              icon={HelpCircle}
              title={t("committees.questionsHeading")}
              sub={t("committees.questionsSub")}
              badge={
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 urdu-prose">
                  {t("committees.questionsSuggested")}
                </span>
              }
            />
            <CardBody>
              {!brief && !briefFailed && <Empty>{t("committees.loading")}</Empty>}
              {brief && brief.questions.items.length === 0 && (
                <Empty>{t("committees.questionsEmpty")}</Empty>
              )}
              {brief && brief.questions.items.length > 0 && (
                <ol className="space-y-4">
                  {brief.questions.items.map((q, i) => (
                    <li key={`${i}-${q.question.slice(0, 24)}`} className="flex gap-3">
                      <span className="text-xs text-zinc-400 pt-1 shrink-0">
                        <LtrNumber value={i + 1} suffix="." />
                      </span>
                      {/* `flex-1` matters here and on every list below. A flex item
                          without it shrink-wraps to its content, so in RTL a short
                          headline hugs the right edge while a long one starts further
                          left — the column reads as staggered rather than aligned. */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed urdu-prose">{q.question}</p>
                        <div className="mt-1 flex gap-1.5 text-xs text-zinc-500">
                          <span className="shrink-0">{t("committees.basis")}:</span>
                          <EnBlock as="span" className="min-w-0 flex-1">
                            {q.sourceIndex && brief.news.headlines[q.sourceIndex - 1] ? (
                              <a
                                href={brief.news.headlines[q.sourceIndex - 1].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-green-700 dark:text-green-500"
                              >
                                {`[${q.sourceIndex}] ${brief.news.headlines[q.sourceIndex - 1].title}`}
                              </a>
                            ) : (
                              q.basis
                            )}
                          </EnBlock>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <footer className="pack-footer mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-5 text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
          <h2 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
            <BookOpenCheck className="w-3.5 h-3.5" />
            {t("committees.provenanceHeading")}
          </h2>
          <p className="urdu-prose leading-relaxed">{t("committees.provenanceBody")}</p>
          <p className="urdu-prose">{t("committees.namesEnglishNote")}</p>
          <p>
            {t("committees.scrapedAt")}:{" "}
            <Ltr>
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(PK_COMMITTEE_META.scrapedAt))}
            </Ltr>{" "}
            ·{" "}
            <a
              href={committee.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-700 inline-flex items-center gap-1"
            >
              {t("committees.viewOnNa")}
              <ExternalLink className="w-3 h-3 pack-hide-print" />
            </a>
          </p>
        </footer>
      </div>
    </PkAppLayout>
  );
}
