"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { PkAppLayout } from "../../../components/PkAppLayout";
import { PkHemicycle } from "../../../components/PkHemicycle";
import { PkSectionHeading } from "../../../components/PkSectionHeading";
import { Ltr } from "../../../components/Ltr";
import { useLocale } from "../../../i18n/LocaleProvider";
import { asProvinceCode, assemblyForProvince, provinceName } from "@/lib/pk/provinces";
import { seatsInProvince, provenanceFor } from "@/lib/pk/provincial-seats";
import { party, needsPatternFill } from "@/lib/pk/parties";
import { toPkUrlSegment } from "@/lib/pk/constituency-code";

/**
 * A provincial assembly: the chamber, then the roster.
 *
 * The hemicycle is deliberately above the searchable list. A member arriving at this
 * page already knows the arithmetic; what they want first is the picture of the room,
 * and what they want second is to find one seat. The order reflects that.
 */
export default function PkAssemblyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const { t, locale } = useLocale();
  const [filter, setFilter] = useState("");

  const provinceCode = asProvinceCode(rawCode);
  const assembly = provinceCode ? assemblyForProvince(provinceCode) : null;
  const seats = useMemo(
    () => (provinceCode ? seatsInProvince(provinceCode) : []),
    [provinceCode]
  );
  const provenance = provinceCode ? provenanceFor(provinceCode) : null;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return seats;
    return seats.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.memberName ?? "").toLowerCase().includes(q) ||
        s.districts.some((d) => d.toLowerCase().includes(q))
    );
  }, [seats, filter]);

  // Islamabad has no provincial assembly, and saying so is more useful than a 404.
  if (!provinceCode || !assembly) {
    return (
      <PkAppLayout>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t("assembly.none")}</h1>
          <p style={{ color: "var(--pk-text-muted)" }}>
            {provinceCode ? t("board.noAssembly") : t("board.notFound")}
          </p>
        </div>
      </PkAppLayout>
    );
  }

  return (
    <PkAppLayout>
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-16">
        <header className="mb-8">
          <Link
            href={`/pk/province/${toPkUrlSegment(provinceCode)}`}
            className="pk-focus text-xs"
            style={{ color: "var(--pk-accent)" }}
          >
            ← {provinceName(provinceCode, locale)}
          </Link>
          <h1 className="pk-display mt-2 text-3xl md:text-4xl">
            {locale === "ur" ? assembly.nameUr : assembly.nameEn}
          </h1>
        </header>

        <PkHemicycle seats={seats} totalSeats={assembly.totalSeats} className="mb-10" />

        <PkSectionHeading title={t("assembly.members")} note={t("board.generalSeatsNote")} />

        <div className="relative mb-4 max-w-md">
          <Search
            className="w-4 h-4 absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ insetInlineStart: "0.75rem", color: "var(--pk-text-faint)" }}
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("assembly.searchPlaceholder")}
            className="pk-focus w-full rounded-lg py-2 ps-9 pe-3 text-sm"
            style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}
          />
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {filtered.map((s) => {
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
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">
                      {s.memberName ?? <em style={{ color: "var(--pk-text-faint)" }}>{t("board.vacant")}</em>}
                    </span>
                    {s.name && (
                      <span className="block text-xs truncate" style={{ color: "var(--pk-text-faint)" }}>
                        <Ltr>{s.name}</Ltr>
                      </span>
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

        {provenance && (
          <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
            {t("board.rosterProvenance")}: {provenance.source}. {provenance.crossCheck}.
          </p>
        )}
      </div>
    </PkAppLayout>
  );
}
