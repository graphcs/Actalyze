"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PkAppLayout } from "../../../../components/PkAppLayout";
import { PkSectionHeading } from "../../../../components/PkSectionHeading";
import { PkKpiCard } from "../../../../components/PkKpiCard";
import { Ltr } from "../../../../components/Ltr";
import { useLocale } from "../../../../i18n/LocaleProvider";
import { asProvinceCode, provinceName, assemblyForProvince } from "@/lib/pk/provinces";
import { seatsForDistrict } from "@/lib/pk/provincial-seats";
import { districtSlug } from "@/lib/pk/districts";
import { indicator as getIndicator, formatValue } from "@/lib/pk/indicators";
import { party, needsPatternFill } from "@/lib/pk/parties";
import { toPkUrlSegment } from "@/lib/pk/constituency-code";

/**
 * One district: what the census says about it, and who represents it.
 *
 * Reached by drilling into the province map, and addressable directly — the slug is
 * the COD-AB district name lowercased with spaces hyphenated, so `/district/lahore`
 * and `/district/dera-ghazi-khan` both work and can be typed during a demo.
 *
 * Where the census has no figure for a district the page says which of the three
 * reasons applies rather than showing a blank or a zero; see `pop_absent` in
 * `scripts/pk/build-province-geo.mjs`.
 */

const GEO_SLUG: Record<string, string> = {
  PB: "punjab",
  SD: "sindh",
  KP: "kp",
  BA: "balochistan",
  ICT: "ict",
};

interface DistrictProps {
  adm2_name: string;
  area_sqkm: number;
  pop_total: number | null;
  density: number | null;
  urban_share: number | null;
  sex_ratio: number | null;
  pop_absent?: string;
}


export default function PkDistrictPage({
  params,
}: {
  params: Promise<{ code: string; slug: string }>;
}) {
  const { code: rawCode, slug } = use(params);
  const { t, locale } = useLocale();

  const provinceCode = asProvinceCode(rawCode);
  const geoSlug = provinceCode ? GEO_SLUG[provinceCode] : null;
  const [districts, setDistricts] = useState<DistrictProps[] | null>(null);

  useEffect(() => {
    if (!geoSlug) return;
    let cancelled = false;
    fetch(`/pk/geo/${geoSlug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(
        (j) =>
          !cancelled &&
          setDistricts(j.features.map((f: { properties: DistrictProps }) => f.properties))
      )
      .catch(() => !cancelled && setDistricts([]));
    return () => {
      cancelled = true;
    };
  }, [geoSlug]);

  const district = useMemo(
    () => (districts ?? []).find((d) => districtSlug(d.adm2_name) === slug.toLowerCase()) ?? null,
    [districts, slug]
  );

  const codabNames = useMemo(
    () => new Set((districts ?? []).map((d) => d.adm2_name)),
    [districts]
  );

  const seats = useMemo(
    () =>
      provinceCode && district && codabNames.size
        ? seatsForDistrict(provinceCode, district.adm2_name, codabNames)
        : [],
    [provinceCode, district, codabNames]
  );

  if (!provinceCode) {
    return (
      <PkAppLayout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold">{t("board.notFound")}</h1>
        </div>
      </PkAppLayout>
    );
  }

  if (districts && !district) {
    return (
      <PkAppLayout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t("district.notFound")}</h1>
          <Link
            href={`/pk/province/${toPkUrlSegment(provinceCode)}`}
            className="pk-focus text-sm"
            style={{ color: "var(--pk-accent)" }}
          >
            ← {provinceName(provinceCode, locale)}
          </Link>
        </div>
      </PkAppLayout>
    );
  }

  const assembly = assemblyForProvince(provinceCode);
  const pop = getIndicator("population");

  return (
    <PkAppLayout>
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-8">
          <Link
            href={`/pk/province/${toPkUrlSegment(provinceCode)}?district=${encodeURIComponent(district?.adm2_name ?? "")}`}
            className="pk-focus text-xs"
            style={{ color: "var(--pk-accent)" }}
          >
            ← {provinceName(provinceCode, locale)}
          </Link>
          <h1 className="pk-display mt-2 text-3xl md:text-4xl">
            <Ltr>{district?.adm2_name ?? "…"}</Ltr>
          </h1>
        </header>

        {district && (
          <>
            {district.pop_absent ? (
              <div
                className="mb-8 rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--pk-surface-sunk)", border: "1px solid var(--pk-border)" }}
              >
                {t("district.noFigures")} — {district.pop_absent}.
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-10">
                <PkKpiCard
                  label={getIndicator("population").labelEn === "Population" && locale === "ur" ? pop.labelUr : pop.labelEn}
                  value={formatValue(district.pop_total, pop)}
                  source={pop.source}
                  year={pop.year}
                />
                {(["density", "urban_share", "sex_ratio"] as const).map((id) => {
                  const ind = getIndicator(id);
                  return (
                    <PkKpiCard
                      key={id}
                      label={locale === "ur" ? ind.labelUr : ind.labelEn}
                      value={formatValue(district[ind.field as keyof DistrictProps] as number, ind)}
                      unit={locale === "ur" ? ind.unitUr : ind.unitEn}
                      source={ind.source}
                      year={ind.year}
                    />
                  );
                })}
              </div>
            )}

            <p className="mb-10 text-xs" style={{ color: "var(--pk-text-faint)" }}>
              {t("district.area")}: <Ltr>{Math.round(district.area_sqkm).toLocaleString("en-US")}</Ltr>{" "}
              km² · OCHA COD-AB
            </p>
          </>
        )}

        <PkSectionHeading
          title={t("board.seatsInDistrict")}
          note={assembly ? (locale === "ur" ? assembly.nameUr : assembly.nameEn) : undefined}
        />

        {seats.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pk-text-muted)" }}>
            {t("district.noSeats")}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {seats.map((s) => {
              const meta = s.party ? party(s.party) : null;
              return (
                <li key={s.code}>
                  <Link
                    href={`/pk/constituency/${toPkUrlSegment(s.code)}`}
                    className="pk-focus flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    style={{ border: "1px solid var(--pk-border)" }}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: meta ? meta.color : "transparent",
                        border: meta ? undefined : "1px solid var(--pk-border-strong)",
                        backgroundImage:
                          s.party && needsPatternFill(s.party)
                            ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 2px, rgba(255,255,255,0) 2px 5px)"
                            : undefined,
                      }}
                    />
                    <span className="pk-figure text-xs w-16 shrink-0" style={{ color: "var(--pk-text-muted)" }}>
                      <Ltr>{s.code}</Ltr>
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">
                      {s.memberName ?? (
                        <em style={{ color: "var(--pk-text-faint)" }}>{t("board.vacant")}</em>
                      )}
                    </span>
                    {meta && (
                      <span className="text-xs shrink-0" style={{ color: "var(--pk-text-muted)" }}>
                        {locale === "ur" ? meta.nameUr : meta.commonName}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PkAppLayout>
  );
}
