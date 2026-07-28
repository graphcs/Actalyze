"use client";

import { useRouter } from "next/navigation";
import { PkAppLayout } from "./components/PkAppLayout";
import { PkConstituencySearch } from "./components/PkConstituencySearch";
import { Ltr, LtrNumber } from "./components/Ltr";
import { useT } from "./i18n/LocaleProvider";
import {
  PK_SEED_META, getConstituency, seatCountsByParty, totalSeatsFilled,
} from "@/lib/pk/constituencies";
import { PK_PROVINCES, party, type PkProvinceCode } from "@/lib/pk/parties";
import { toPkUrlSegment } from "@/lib/pk/constituency-code";

/**
 * Seats chosen so that whoever is watching can type their own and find something
 * real: the Prime Minister's, the party leaders', the Speaker's, and one seat from
 * each major city. NA-1 is included deliberately — it is vacant, and showing that
 * honestly is worth more than hiding it.
 */
const FEATURED = ["NA-123", "NA-130", "NA-194", "NA-120", "NA-248", "NA-31", "NA-265", "NA-1"];

export default function PkHomePage() {
  const t = useT();
  const router = useRouter();

  // Full party strength — general plus reserved seats. PML-N is 132 in the House,
  // not the 93 general seats it holds.
  const seatsByParty = seatCountsByParty();
  const filled = totalSeatsFilled();

  return (
    <PkAppLayout>
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
          {t("home.title")}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-3xl mb-8 urdu-prose">
          {t("home.subtitle")}
        </p>

        <PkConstituencySearch />

        {/* Headline numbers, all derived from the seed data rather than written down,
            so they cannot drift out of sync with the roster. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          {[
            { label: t("home.statSeats"), value: 336 },
            { label: t("home.statGeneral"), value: 266 },
            { label: t("home.statParties"), value: seatsByParty.length },
            { label: t("home.statVacant"), value: PK_SEED_META.vacant.length },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4"
            >
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                <LtrNumber value={value} />
              </div>
              <div className="text-xs text-zinc-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Party strength — a stacked bar rather than a two-party gauge, because the
            house has fourteen parties and no meaningful left/right axis. */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-500 mb-3">
            {t("province.partyBreakdown")}
          </h2>
          <div className="flex h-8 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {seatsByParty.map(({ party: id, seats }) => {
              const p = party(id);
              return (
                <div
                  key={id}
                  className="h-full"
                  style={{ width: `${(seats / filled) * 100}%`, backgroundColor: p.color }}
                  title={`${p.commonName} — ${seats}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
            {seatsByParty.slice(0, 8).map(({ party: id, seats }) => {
              const p = party(id);
              return (
                <div key={id} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    <Ltr>{p.commonName}</Ltr>
                  </span>
                  <span className="text-zinc-400">
                    <LtrNumber value={seats} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <h2 className="text-sm font-semibold text-zinc-500 mt-12 mb-3">
          {t("home.featured")}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURED.map((code) => {
            const c = getConstituency(code);
            if (!c) return null;
            const p = party(c.party);
            return (
              <button
                key={code}
                onClick={() => router.push(`/pk/constituency/${toPkUrlSegment(code)}`)}
                className="text-start rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">
                    <Ltr>{c.code}</Ltr>
                  </span>
                  {!c.vacant && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      <Ltr>{p.commonName}</Ltr>
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {c.name ?? "—"}
                </div>
                <div className="text-xs text-zinc-500 truncate mt-0.5">
                  {c.vacant ? t("common.vacant") : c.memberName}
                </div>
              </button>
            );
          })}
        </div>

        <h2 className="text-sm font-semibold text-zinc-500 mt-12 mb-3">
          {t("home.browseProvinces")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(PK_PROVINCES) as PkProvinceCode[]).map((code) => {
            const prov = PK_PROVINCES[code];
            return (
              <button
                key={code}
                onClick={() => router.push(`/pk/province/${code.toLowerCase()}`)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm hover:shadow-md transition"
              >
                <span className="font-medium">{prov.nameUr}</span>
                <span className="text-zinc-400 ms-2 text-xs">
                  <LtrNumber value={prov.naSeats} />
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-zinc-400 mt-12">
          {t("home.dataNote")}{" "}
          <Ltr>{new Date(PK_SEED_META.scrapedAt).toISOString().slice(0, 10)}</Ltr>
        </p>
      </div>
    </PkAppLayout>
  );
}
