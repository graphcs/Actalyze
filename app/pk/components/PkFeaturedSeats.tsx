"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getConstituency } from "@/lib/pk/constituencies";
import { party } from "@/lib/pk/parties";
import { toPkUrlSegment } from "@/lib/pk/constituency-code";
import { useLocale } from "../i18n/LocaleProvider";
import { identity } from "./pk-identity-copy";
import { Ltr } from "./Ltr";
import { PkSectionHeading } from "./PkSectionHeading";

/**
 * Seats chosen so that whoever is watching can type their own and find something
 * real: the Prime Minister's, the party leaders', the Speaker's, and one seat from
 * each major city. NA-1 is included deliberately — it is vacant, and showing that
 * honestly is worth more than hiding it.
 */
const FEATURED = ["NA-123", "NA-130", "NA-194", "NA-120", "NA-248", "NA-31", "NA-265", "NA-1"];

/**
 * The party marker on each card is a 8px dot plus the abbreviation in ordinary text,
 * not a filled pill. A grid of eight cards each capped with a saturated party colour
 * turns the page into a party-colour swatch board, and in a House this evenly split
 * that is the first thing a partisan eye picks up. The dot carries exactly the same
 * information at a fraction of the visual weight.
 */
export function PkFeaturedSeats() {
  const router = useRouter();
  const { t, locale } = useLocale();

  return (
    <section>
      <PkSectionHeading title={t("home.featured")} />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {FEATURED.map((code) => {
          const c = getConstituency(code);
          if (!c) return null;
          const p = party(c.party);
          return (
            <button
              key={code}
              onClick={() => router.push(`/pk/constituency/${toPkUrlSegment(code)}`)}
              aria-label={`${identity(locale, "seatDetail")} ${c.code}`}
              className="pk-focus group text-start rounded p-4 transition hover:-translate-y-0.5"
              style={{
                backgroundColor: "var(--pk-surface)",
                border: "1px solid var(--pk-border)",
                boxShadow: "0 1px 2px rgba(0,0,0,.04)",
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span
                  className="pk-figure text-sm font-semibold px-2 py-1 rounded-sm"
                  style={{
                    color: "var(--pk-accent)",
                    backgroundColor: "var(--pk-accent-soft)",
                  }}
                >
                  <Ltr>{c.code}</Ltr>
                </span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 rtl:-scale-x-100 opacity-0 group-hover:opacity-100 transition"
                  style={{ color: "var(--pk-text-faint)" }}
                />
              </div>

              <div className="text-sm font-medium truncate">{c.name ?? "—"}</div>
              <div
                className="text-xs truncate mt-1"
                style={{ color: "var(--pk-text-muted)" }}
              >
                {c.vacant ? t("common.vacant") : c.memberName}
              </div>

              {!c.vacant && (
                <div
                  className="flex items-center gap-2 mt-3 pt-3 text-xs"
                  style={{
                    borderTop: "1px solid var(--pk-border)",
                    color: "var(--pk-text-muted)",
                  }}
                >
                  {/* PPP is near-black and JUI-F is `#003800`; both vanish against a
                      dark background, so the dot carries a hairline ring in the
                      surface's own border colour rather than a fixed one. */}
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: p.color,
                      boxShadow: "0 0 0 1px var(--pk-border-strong)",
                    }}
                  />
                  <Ltr>{p.commonName}</Ltr>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
