"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, FileText, Gavel, Search, UserX, Users } from "lucide-react";
import { PkAppLayout } from "../components/PkAppLayout";
import { Ltr, LtrNumber } from "../components/Ltr";
import { useLocale } from "../i18n/LocaleProvider";
import {
  PK_COMMITTEE_META,
  listCommittees,
  partyBreakdown,
  type PkCommittee,
  type PkCommitteeKind,
} from "@/lib/pk/committees";
import { hatchAngle, needsPatternFill, party, type PkPartyId } from "@/lib/pk/parties";

/**
 * The committee index.
 *
 * Rendered entirely from `data/pk/committees.json` — no fetch, no loading state, no
 * failure mode. That is deliberate: this is the page a committee secretary opens to
 * find their committee, and it has to work on a hotel wifi the night before a meeting.
 * Everything that needs the network lives one click further in, on the pack itself.
 *
 * ── The committee names are in English on purpose ──────────────────────────────────
 *
 * na.gov.pk/ur/ returns 404 for every path: the Secretariat publishes committee names
 * in English only. Rather than machine-translate them and print the result as though
 * it were the committee's title, the Urdu build wraps the published English name in a
 * real Urdu descriptor — "قائمہ کمیٹی برائے <Ltr>Finance and Revenue</Ltr>" — and says
 * so in the footnote. An audience that sits on these committees would spot an invented
 * Urdu name immediately.
 */

const KIND_TABS: Array<{ kind: PkCommitteeKind | "all"; key: string }> = [
  { kind: "all", key: "committees.kindAll" },
  { kind: "standing", key: "committees.kindStanding" },
  { kind: "other", key: "committees.kindOther" },
  { kind: "parliamentary", key: "committees.kindParliamentary" },
  { kind: "special", key: "committees.kindSpecial" },
];

/** Party colour with the per-party hatch, for the green and red collision families. */
function fillStyle(id: PkPartyId, color: string): React.CSSProperties {
  if (!needsPatternFill(id)) return { backgroundColor: color };
  return {
    backgroundColor: color,
    backgroundImage: `repeating-linear-gradient(${hatchAngle(
      id
    )}deg, rgba(255,255,255,0.42) 0 3px, rgba(255,255,255,0) 3px 8px)`,
  };
}

function PartyStrip({ committee }: { committee: PkCommittee }) {
  const shares = partyBreakdown(committee);
  const total = shares.reduce((n, s) => n + s.seats, 0);
  if (!total) return null;
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
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
  );
}

/**
 * "Standing Committee on X" in English; "قائمہ کمیٹی برائے X" in Urdu, with X still in
 * Latin script and bidi-isolated so it does not reorder inside the Urdu sentence.
 *
 * Deliberately NOT exported and shared with the pack page. A `page.tsx` in the App
 * Router may only export `default` and a fixed set of route options — exporting a
 * component from one produces a build-time type error — and the two pages here are
 * both route files, so there is nowhere between them to put it. Ten lines duplicated
 * beats a component file that is not in this feature's scope.
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

function CommitteeCard({ committee }: { committee: PkCommittee }) {
  const { t } = useLocale();
  const next = committee.meetings[0];
  const latest = committee.reports[0];

  return (
    <Link
      href={`/pk/committees/${committee.slug}`}
      className="group block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 hover:border-green-600 dark:hover:border-green-600 transition shadow-sm"
    >
      <h3 className="font-semibold text-base leading-snug text-zinc-900 dark:text-zinc-100 group-hover:text-green-700 dark:group-hover:text-green-500">
        <CommitteeTitle committee={committee} />
      </h3>

      <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
        {committee.chairVacant ? (
          <>
            <UserX className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <span>{t("committees.chairVacant")}</span>
          </>
        ) : (
          <>
            <Gavel className="w-4 h-4 mt-0.5 shrink-0 text-green-700 dark:text-green-500" />
            <span>
              <span className="text-zinc-500">{t("committees.chair")}: </span>
              <Ltr>{committee.chairName ?? "—"}</Ltr>
            </span>
          </>
        )}
      </div>

      <div className="mt-4">
        <PartyStrip committee={committee} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <LtrNumber value={committee.members.length} /> {t("committees.members")}
        </span>
        {committee.senators.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <LtrNumber value={committee.senators.length} /> {t("committees.senators")}
          </span>
        )}
        {committee.reports.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <LtrNumber value={committee.reports.length} /> {t("committees.reports")}
          </span>
        )}
      </div>

      {next && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2 text-xs text-green-900 dark:text-green-300">
          <CalendarClock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            <Ltr>{next.dateLabel}</Ltr>
            {next.time && (
              <>
                {" · "}
                <Ltr>{next.time}</Ltr>
              </>
            )}
            {next.subCommittee && ` · ${t("committees.subCommittee")}`}
          </span>
        </div>
      )}

      {/* Report titles are long English sentences. In the Urdu build they need an LTR
          island, not just a <bdi>: a <bdi> fixes the order of the run but leaves the
          paragraph flush right with a ragged left edge, and line-clamp then trims the
          wrong end. */}
      {!next && latest && (
        <p
          dir="ltr"
          className="ltr-island text-start mt-3 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2"
        >
          {latest.dateLabel} — {latest.title}
        </p>
      )}
    </Link>
  );
}

export default function PkCommitteesPage() {
  const { t, locale } = useLocale();
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<PkCommitteeKind | "all">("all");

  const committees = useMemo(() => {
    const base = kind === "all" ? listCommittees() : listCommittees(kind);
    const q = filter.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.chairName ?? "").toLowerCase().includes(q) ||
        c.members.some((m) => m.name.toLowerCase().includes(q))
    );
  }, [filter, kind]);

  const scraped = new Intl.DateTimeFormat(locale === "ur" ? "en-GB" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(PK_COMMITTEE_META.scrapedAt));

  return (
    <PkAppLayout>
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {t("committees.title")}
          </h1>
          <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400 urdu-prose">
            {t("committees.subtitle")}
          </p>
        </header>

        {/* Counts, derived from the seed rather than written down, so they cannot
            drift out of step with the data the cards are rendered from. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: t("committees.statCommittees"), value: PK_COMMITTEE_META.committeeCount },
            { label: t("committees.kindStanding"), value: PK_COMMITTEE_META.byKind.standing ?? 0 },
            { label: t("committees.statSeats"), value: PK_COMMITTEE_META.memberSeats },
            { label: t("committees.statReports"), value: PK_COMMITTEE_META.reportsAttached },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3"
            >
              <div className="text-xl font-bold">
                <LtrNumber value={value} />
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-zinc-400 pointer-events-none" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("committees.search")}
            aria-label={t("committees.search")}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 ps-10 pe-4 py-2.5 text-sm outline-none focus:border-green-600"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              onClick={() => setKind(tab.kind)}
              className={`rounded-full px-3.5 py-1.5 text-xs border transition ${
                kind === tab.kind
                  ? "bg-green-700 border-green-700 text-white"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-green-600"
              }`}
            >
              {t(tab.key as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>

        {committees.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">{t("committees.noMatch")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {committees.map((c) => (
              <CommitteeCard key={c.slug} committee={c} />
            ))}
          </div>
        )}

        <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-5 text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
          <p className="urdu-prose">{t("committees.namesEnglishNote")}</p>
          <p>
            {t("committees.scrapedAt")}: <Ltr>{scraped}</Ltr> ·{" "}
            <Ltr>{PK_COMMITTEE_META.memberSeatsJoinedToRoster}</Ltr>/
            <Ltr>{PK_COMMITTEE_META.memberSeats}</Ltr> {t("committees.members")} ·{" "}
            <a
              href="https://na.gov.pk/en/cmen.php?type=1"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-700"
            >
              <Ltr>na.gov.pk</Ltr>
            </a>
          </p>
        </footer>
      </div>
    </PkAppLayout>
  );
}
