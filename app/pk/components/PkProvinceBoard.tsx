"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../i18n/LocaleProvider";
import { Ltr } from "./Ltr";
import { PkDrillMap } from "./PkDrillMap";
import { PkDistrictTable, type DistrictRow } from "./PkDistrictTable";
import { PkIndicatorPicker } from "./PkIndicatorPicker";
import { PkKpiCard } from "./PkKpiCard";
import { PkSectionHeading } from "./PkSectionHeading";
import {
  indicator as getIndicator,
  formatValue,
  DEFAULT_INDICATOR,
  type IndicatorId,
} from "@/lib/pk/indicators";
import {
  seatsByDistrict,
  partyCountsInProvince,
  vacantCount,
  provenanceFor,
  approximatedDistricts,
} from "@/lib/pk/provincial-seats";
import { assemblyForProvince, provinceName, type ProvinceCode } from "@/lib/pk/provinces";
import { party, needsPatternFill, hatchAngle } from "@/lib/pk/parties";

/**
 * The Chief Minister's view of a province.
 *
 * A Chief Minister is an executive, not a legislator: they run departments through
 * districts, and the question they arrive with is "where is my province failing, and
 * who owns it". So this leads with the districts and the map, and carries the assembly
 * underneath as the political context that decides what the executive can actually do.
 *
 * The map and the league table share one selection, in both directions — clicking a
 * district on the map highlights its row, clicking a row zooms the map. The selection
 * lives in the URL so a demo can open straight on Lahore instead of clicking to it.
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
  pop_total: number | null;
  density: number | null;
  urban_share: number | null;
  sex_ratio: number | null;
  pop_absent?: string;
}

export function PkProvinceBoard({ provinceCode }: { provinceCode: ProvinceCode }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const slug = GEO_SLUG[provinceCode];
  const assembly = assemblyForProvince(provinceCode);

  const [indicatorId, setIndicatorId] = useState<IndicatorId>(DEFAULT_INDICATOR);
  const [districts, setDistricts] = useState<DistrictProps[] | null>(null);

  // Selection lives in the URL. `replace` rather than `push` so a demo's back button
  // leaves the page rather than unwinding twelve district clicks.
  const selected = params.get("district");
  const setSelected = (name: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (name) next.set("district", name);
    else next.delete("district");
    router.replace(next.toString() ? `?${next}` : "?", { scroll: false });
  };

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`/pk/geo/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j) => !cancelled && setDistricts(j.features.map((f: { properties: DistrictProps }) => f.properties)))
      .catch(() => !cancelled && setDistricts([]));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const codabNames = useMemo(
    () => new Set((districts ?? []).map((d) => d.adm2_name)),
    [districts]
  );

  const seatCounts = useMemo(
    () => (codabNames.size ? seatsByDistrict(provinceCode, codabNames) : {}),
    [provinceCode, codabNames]
  );

  const ind = getIndicator(indicatorId);

  const rows: DistrictRow[] = useMemo(
    () =>
      (districts ?? []).map((d) => ({
        name: d.adm2_name,
        value: (d as unknown as Record<string, number | null>)[ind.field] ?? null,
        absentReason: d.pop_absent,
        seats: seatCounts[d.adm2_name],
      })),
    [districts, ind.field, seatCounts]
  );

  const parties = useMemo(() => partyCountsInProvince(provinceCode), [provinceCode]);
  const vacant = vacantCount(provinceCode);
  const provenance = provenanceFor(provinceCode);
  const approximated = useMemo(
    () => (codabNames.size ? approximatedDistricts(provinceCode, codabNames) : []),
    [provinceCode, codabNames]
  );

  const provincePopulation = useMemo(
    () => (districts ?? []).reduce((sum, d) => sum + (d.pop_total ?? 0), 0),
    [districts]
  );
  const largest = useMemo(
    () =>
      (districts ?? [])
        .filter((d) => typeof d.pop_total === "number")
        .sort((a, b) => (b.pop_total ?? 0) - (a.pop_total ?? 0))[0] ?? null,
    [districts]
  );

  const totalFilled = parties.reduce((s, p) => s + p.seats, 0);

  if (!slug) return null;

  return (
    <section className="space-y-8">
      <PkSectionHeading
        title={`${provinceName(provinceCode, locale)} — ${t("board.title")}`}
        note={t("board.subtitle")}
      />

      {/* Headline figures. Every one carries its source and year on the card. */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <PkKpiCard
          label={t("board.districts")}
          value={String(districts?.length ?? "—")}
          source="OCHA COD-AB"
          year="2026"
        />
        <PkKpiCard
          label={t("board.provinceTotal")}
          value={provincePopulation ? formatValue(provincePopulation, getIndicator("population")) : "—"}
          source={getIndicator("population").source}
          year="2017"
          note={
            // The sum is honest only if it says what it excludes.
            rows.some((r) => r.value == null)
              ? t("board.noFigureHeading")
              : undefined
          }
        />
        {largest && (
          <PkKpiCard
            label={t("board.largestDistrict")}
            value={largest.adm2_name}
            source={getIndicator("population").source}
            year="2017"
          />
        )}
        {assembly && (
          <PkKpiCard
            label={t("board.assemblySeats")}
            value={String(assembly.generalSeats)}
            unit={vacant ? `(${vacant} ${t("board.vacant")})` : undefined}
            source={assembly.nameEn}
            year="2024–2029"
            note={t("board.generalSeatsNote")}
          />
        )}
      </div>

      <PkIndicatorPicker value={indicatorId} onChange={setIndicatorId} />

      {/* Map and table share one selection, driven from either side. */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PkDrillMap
            slug={slug}
            indicatorId={indicatorId}
            selected={selected}
            onSelect={setSelected}
            seatsByDistrict={seatCounts}
          />
          {/* Once a district is selected the drill-down has somewhere to go. Rendered
              beside the map rather than inside it: PkDrillMap knows nothing about
              routing and should not have to. */}
          {selected && (
            <a
              href={`/pk/province/${String(provinceCode).toLowerCase()}/district/${selected
                .toLowerCase()
                .replace(/[.'’]/g, "")
                .replace(/\s+/g, "-")}`}
              className="pk-focus inline-block mt-3 text-sm font-medium"
              style={{ color: "var(--pk-accent)" }}
            >
              {t("district.open")}: <Ltr>{selected}</Ltr> →
            </a>
          )}
        </div>
        <div className="lg:col-span-2">
          <PkDistrictTable
            rows={rows}
            indicatorId={indicatorId}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      </div>

      {/* Which districts are drawn inside a parent, and why. Not a footnote: a Punjabi
          official knows Talagang stopped being part of Chakwal in 2022, and a map that
          quietly draws it there without saying so looks like it does not know. */}
      {approximated.length > 0 && (
        <div
          className="rounded-lg p-4 text-xs leading-relaxed"
          style={{ background: "var(--pk-surface-sunk)", border: "1px solid var(--pk-border)" }}
        >
          <div className="font-semibold mb-1">{t("board.approximateHeading")}</div>
          <p style={{ color: "var(--pk-text-muted)" }}>{t("board.approximateNote")}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" style={{ color: "var(--pk-text-muted)" }}>
            {approximated.map((a) => (
              <li key={a.name}>
                <Ltr>{a.name}</Ltr> → <Ltr>{a.parent}</Ltr>
                {a.since && (
                  <>
                    {" "}
                    (<Ltr>{a.since}</Ltr>)
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The provincial assembly. Party colour is allowed here — this is a data mark
          about parties, which is the one place pk.css permits it. */}
      {assembly ? (
        <div>
          <PkSectionHeading
            title={locale === "ur" ? assembly.nameUr : assembly.nameEn}
            note={t("board.composition")}
          />

          <div
            className="mt-4 flex h-3 w-full overflow-hidden rounded-full"
            style={{ border: "1px solid var(--pk-border)" }}
            role="img"
            aria-label={t("board.composition")}
          >
            {parties.map((p) => {
              const meta = party(p.party);
              const pct = (p.seats / Math.max(totalFilled, 1)) * 100;
              return (
                <span
                  key={p.party}
                  title={`${meta.commonName} — ${p.seats}`}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: meta.color,
                    // Six parties in these houses are shades of green; hue alone fails
                    // for them and for one reader in twelve. Angle differs per party so
                    // two hatched neighbours do not merge into one block.
                    backgroundImage: needsPatternFill(p.party)
                      ? `repeating-linear-gradient(${hatchAngle(p.party)}deg, rgba(255,255,255,0.45) 0 3px, rgba(255,255,255,0) 3px 7px)`
                      : undefined,
                  }}
                />
              );
            })}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {parties.map((p) => {
              const meta = party(p.party);
              return (
                <li key={p.party} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-sm shrink-0"
                    style={{
                      backgroundColor: meta.color,
                      backgroundImage: needsPatternFill(p.party)
                        ? `repeating-linear-gradient(${hatchAngle(p.party)}deg, rgba(255,255,255,0.45) 0 3px, rgba(255,255,255,0) 3px 7px)`
                        : undefined,
                    }}
                  />
                  <span>{locale === "ur" ? meta.nameUr : meta.commonName}</span>
                  <span className="pk-figure font-semibold">
                    <Ltr>{p.seats}</Ltr>
                  </span>
                </li>
              );
            })}
          </ul>

          <a
            href={`/pk/province/${String(provinceCode).toLowerCase()}/assembly`}
            className="pk-focus inline-block mt-4 text-sm font-medium"
            style={{ color: "var(--pk-accent)" }}
          >
            {t("assembly.view")} →
          </a>

          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
            {t("board.generalSeatsNote")}
          </p>

          {/* Where the roster came from. Punjab's House does not publish a reachable
              one, and a government buyer is entitled to know that rather than discover
              it. */}
          {provenance && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
              {t("board.rosterProvenance")}: {provenance.source}. {provenance.crossCheck}.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--pk-text-muted)" }}>
          {t("board.noAssembly")}
        </p>
      )}
    </section>
  );
}
