"use client";

import { PkAppLayout } from "./components/PkAppLayout";
import { PkHero } from "./components/PkHero";
import { PkHouseComposition } from "./components/PkHouseComposition";
import { PkFeaturedSeats } from "./components/PkFeaturedSeats";
import { PkProvinceRail } from "./components/PkProvinceRail";
import { PkCrest } from "./components/PkCrest";
import { Ltr } from "./components/Ltr";
import { useLocale } from "./i18n/LocaleProvider";
import { identity } from "./components/pk-identity-copy";
import { PK_SEED_META } from "@/lib/pk/constituencies";

/**
 * Landing page for the Pakistan build.
 *
 * The page is assembled from named sections rather than written inline, because each
 * one carries a different judgement — where party colour is allowed, how the Nastaliq
 * face is contained, what the flag rules permit — and those judgements are written
 * down next to the markup they govern. See `pk.css` for the palette and the reasoning
 * behind the specific green, `PkCrest.tsx` for what the crescent-and-star is and is
 * not, and `PkHouseComposition.tsx` for the party-colour containment rule.
 *
 * Every capability the previous version had is still here: the constituency search
 * (now inside the masthead, where a demo audience will actually find it), the live
 * counts, the party strength bar, the featured seats and the province links.
 */
export default function PkHomePage() {
  const { t, locale } = useLocale();

  return (
    <PkAppLayout>
      <PkHero />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16 space-y-14 md:space-y-16">
        <PkHouseComposition />
        <PkFeaturedSeats />
        <PkProvinceRail />

        {/*
          Colophon.

          Two things an institutional reader looks for and a vendor usually forgets:
          where the numbers came from, and whether the thing on screen is claiming to
          be official. The first is the scrape date against the Assembly's own roster.
          The second is the disclaimer — this build is sold to the Assembly, not
          issued by it, and saying so plainly is worth more than any amount of
          decoration.
        */}
        <footer
          className="pt-8 flex flex-col sm:flex-row sm:items-start gap-5"
          style={{ borderTop: "1px solid var(--pk-border)" }}
        >
          <PkCrest
            className="w-9 h-9 shrink-0 opacity-70"
            // The mark takes the ink colour here, not the green: at this size and in
            // this position it is a colophon device, not a badge.
          />
          <div className="space-y-2 text-xs leading-relaxed">
            <p style={{ color: "var(--pk-text-muted)" }}>
              {identity(locale, "formalState")}
            </p>
            <p style={{ color: "var(--pk-text-faint)" }}>
              {t("home.dataNote")}{" "}
              <Ltr>{new Date(PK_SEED_META.scrapedAt).toISOString().slice(0, 10)}</Ltr>
            </p>
            <p style={{ color: "var(--pk-text-faint)" }}>{identity(locale, "independence")}</p>
          </div>
        </footer>
      </div>
    </PkAppLayout>
  );
}
