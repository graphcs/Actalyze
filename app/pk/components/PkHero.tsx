"use client";

import { useLocale } from "../i18n/LocaleProvider";
import { identity } from "./pk-identity-copy";
import { PkConstituencySearch } from "./PkConstituencySearch";
import { PkGirih, PkSeal } from "./PkCrest";

/**
 * The masthead band.
 *
 * ── What carries the "Pakistani, institutional" reading ───────────────────────────
 *
 * Three things, and nothing else: the deep flag green as a full-bleed field; a
 * self-authored crescent-and-star roundel, once, large, quiet; and an eight-fold
 * khatam lattice at 5% behind it all. No flag, no monuments, no slogan.
 *
 * The slogan question is worth stating outright. "Pakistan Zindabad" is a fine and
 * widely-used patriotic line, but on a parliamentary tool sold by a foreign vendor it
 * reads as pandering, and it is exactly the sort of thing an official notices. In its
 * place the band carries the Constitution's own name for Parliament, Majlis-e-Shoora,
 * which is the institution's own language rather than borrowed sentiment.
 *
 * The eyebrow names the National Assembly as the *audience*, and the footer says in
 * both languages that this is not an official publication. A foreign vendor implying
 * an endorsement it does not have is a much larger risk than an under-decorated page.
 */
export function PkHero() {
  const { t, locale } = useLocale();

  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: "var(--pk-band)",
        color: "var(--pk-on-band)",
        // A slow vertical deepening rather than a flat fill: the band is tall, and a
        // flat 100% of any colour this saturated reads as a banner ad.
        backgroundImage:
          "linear-gradient(180deg, var(--pk-band) 0%, var(--pk-band-deep) 100%)",
      }}
    >
      <PkGirih className="absolute inset-0 opacity-[0.07] text-white" />

      {/*
        The seal sits fully inside the band, never clipped by its edge. A crescent and
        star running off the side of a green field would start to look like a badly
        cropped flag, which is precisely what the Flag Code exists to prevent.
      */}
      <PkSeal className="hidden md:block absolute end-10 top-1/2 -translate-y-1/2 w-56 h-56 lg:w-72 lg:h-72 opacity-[0.09] text-white pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-14 md:pt-20 md:pb-20">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-5">
            <span
              className="block w-8 h-px shrink-0"
              style={{ backgroundColor: "var(--pk-brass)" }}
            />
            <span className="pk-eyebrow" style={{ color: "var(--pk-on-band-muted)" }}>
              {identity(locale, "eyebrow")}
            </span>
          </div>

          <h1 className="pk-display text-[2.125rem] sm:text-5xl lg:text-[3.5rem]">
            {t("home.title")}
          </h1>

          <p
            className="urdu-prose mt-5 max-w-2xl text-[0.9375rem] sm:text-base"
            style={{ color: "var(--pk-on-band-muted)" }}
          >
            {t("home.subtitle")}
          </p>

          <div className="mt-9">
            <div
              className="pk-eyebrow mb-2.5"
              style={{ color: "var(--pk-on-band-muted)" }}
            >
              {identity(locale, "findSeat")}
            </div>
            <PkConstituencySearch tone="band" />
            <p
              className="text-xs mt-2.5"
              style={{ color: "color-mix(in srgb, var(--pk-on-band-muted) 78%, transparent)" }}
            >
              {identity(locale, "findSeatHelp")}
            </p>
          </div>
        </div>
      </div>

      {/* A hairline in brass along the foot of the band — parliamentary stationery,
          used at 1px and nowhere else. */}
      <div
        className="h-px w-full"
        style={{ backgroundColor: "var(--pk-brass)", opacity: 0.55 }}
      />
    </section>
  );
}
