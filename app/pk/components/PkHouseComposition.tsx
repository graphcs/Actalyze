"use client";

import {
  PK_SEED_META,
  seatCountsByParty,
  totalSeatsFilled,
} from "@/lib/pk/constituencies";
import { party, needsPatternFill, hatchAngle, type PkPartyId } from "@/lib/pk/parties";
import { useLocale } from "../i18n/LocaleProvider";
import { identity } from "./pk-identity-copy";
import { Ltr, LtrNumber } from "./Ltr";
import { PkSectionHeading } from "./PkSectionHeading";

/**
 * The House at a glance: the headline counts, then party strength as a stacked bar.
 *
 * ── Where party colour is allowed to appear ───────────────────────────────────────
 *
 * Here, and in the small seat dots on the featured cards. Nowhere else in the build.
 * The reason is specific to this House: six parties are some shade of green — PML-N
 * `#228B22`, PML-Q `#5CB85C`, JUI-F `#003800`, IPP `#67BA27`, PML-Z `#00A877`, MWM
 * `#0B9A51` — and the national green is a seventh. If the product's chrome were any
 * of those mid-greens, the largest party in the House would appear to be the house
 * style. Confining party hues to data marks, and taking the institutional colour to
 * `#01411C` where no party sits, keeps the two readings apart.
 *
 * The hatch is the same convention `PartyShareBar` uses and comes from the same
 * `hatchAngle()` table, so a party is textured identically wherever it appears. It
 * earns its keep twice over: it separates the six greens from each other, and it
 * makes every party segment visibly a *data* fill rather than a flat brand colour.
 */

function fillStyle(id: PkPartyId, color: string): React.CSSProperties {
  if (!needsPatternFill(id)) return { backgroundColor: color };
  return {
    backgroundColor: color,
    backgroundImage: `repeating-linear-gradient(${hatchAngle(
      id
    )}deg, rgba(255,255,255,0.42) 0 3px, rgba(255,255,255,0) 3px 8px)`,
  };
}

export function PkHouseComposition() {
  const { t, locale } = useLocale();

  // Full party strength — general plus reserved seats. PML-N is 132 in the House,
  // not the 93 general seats it holds.
  const seatsByParty = seatCountsByParty();
  const filled = totalSeatsFilled();

  const stats = [
    { label: t("home.statSeats"), value: 336 },
    { label: t("home.statGeneral"), value: 266 },
    { label: t("home.statParties"), value: seatsByParty.length },
    { label: t("home.statVacant"), value: PK_SEED_META.vacant.length },
  ];

  return (
    <section>
      <PkSectionHeading
        title={identity(locale, "houseHeading")}
        note={identity(locale, "houseSub")}
      />

      {/* Headline numbers, all derived from the seed data rather than written down,
          so they cannot drift out of sync with the roster. */}
      {/* Hairline rules between tiles come from the grid gap showing the container
          colour through — one border, no doubling at the seams. */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded"
        style={{
          backgroundColor: "var(--pk-border)",
          border: "1px solid var(--pk-border)",
        }}
      >
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="px-5 py-6"
            style={{ backgroundColor: "var(--pk-surface)" }}
          >
            <div
              className="pk-figure text-4xl lg:text-5xl font-semibold"
              style={{ color: "var(--pk-accent)" }}
            >
              <LtrNumber value={value} />
            </div>
            <div
              className="text-xs mt-2.5 leading-snug"
              style={{ color: "var(--pk-text-muted)" }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Party strength — a stacked bar rather than a two-party gauge, because the
          house has fourteen parties and no meaningful left/right axis. */}
      <div className="mt-10">
        <h3
          className="pk-eyebrow mb-3"
          style={{ color: "var(--pk-text-muted)" }}
        >
          {t("province.partyBreakdown")}
        </h3>

        {/*
          The bar is pinned left-to-right in both languages, matching the contract the
          rest of the build follows for charts: Pakistani print media runs series
          left-to-right, and a bar that mirrors while its legend does not stops being
          readable at a glance.
        */}
        <div
          dir="ltr"
          className="ltr-island flex h-10 w-full overflow-hidden rounded"
          style={{ border: "1px solid var(--pk-border-strong)" }}
        >
          {seatsByParty.map(({ party: id, seats }, i) => {
            const p = party(id);
            return (
              <div
                key={id}
                className="h-full"
                style={{
                  width: `${(seats / filled) * 100}%`,
                  ...fillStyle(id, p.color),
                  ...(i < seatsByParty.length - 1
                    ? { boxShadow: "inset -1px 0 0 rgba(255,255,255,0.6)" }
                    : {}),
                }}
                title={`${p.commonName} — ${seats}`}
              />
            );
          })}
        </div>

        <ul dir="ltr" className="ltr-island flex flex-wrap gap-x-5 gap-y-2 mt-3.5">
          {seatsByParty.slice(0, 8).map(({ party: id, seats }) => {
            const p = party(id);
            return (
              <li key={id} className="flex items-center gap-2 text-xs">
                <span
                  className="w-3 h-3 rounded-[2px] shrink-0"
                  // PPP's colour is near-black by convention; on a dark background the
                  // swatch would otherwise disappear entirely, so the outline is a
                  // theme token rather than a fixed black.
                  style={{ ...fillStyle(id, p.color), border: "1px solid var(--pk-border-strong)" }}
                />
                <span style={{ color: "var(--pk-text)" }}>
                  <Ltr>{p.commonName}</Ltr>
                </span>
                <span className="pk-figure" style={{ color: "var(--pk-text-faint)" }}>
                  <LtrNumber value={seats} />
                </span>
              </li>
            );
          })}
        </ul>

        {/* Says out loud that six of these parties are shades of green and that the
            hatch, not the hue, is what distinguishes them. */}
        <p className="text-xs mt-4 max-w-2xl" style={{ color: "var(--pk-text-faint)" }}>
          {t("province.hatchNote")}
        </p>
      </div>
    </section>
  );
}
