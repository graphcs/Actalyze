"use client";

import { useRouter } from "next/navigation";
import { PK_PROVINCES, type PkProvinceCode } from "@/lib/pk/parties";
import { useLocale } from "../i18n/LocaleProvider";
import { identity } from "./pk-identity-copy";
import { LtrNumber } from "./Ltr";
import { PkSectionHeading } from "./PkSectionHeading";

/**
 * The five federating units the National Assembly returns members from.
 *
 * Names are shown in Urdu in both locales because that is how they are written on the
 * Assembly's own roster, with the English name beneath in the English build only.
 * Islamabad Capital Territory is included and is not a province — the province page
 * says so; nothing is claimed about it here beyond its three seats.
 */
export function PkProvinceRail() {
  const router = useRouter();
  const { t, locale } = useLocale();

  return (
    <section>
      <PkSectionHeading title={t("home.browseProvinces")} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(PK_PROVINCES) as PkProvinceCode[]).map((code) => {
          const prov = PK_PROVINCES[code];
          return (
            <button
              key={code}
              onClick={() => router.push(`/pk/province/${code.toLowerCase()}`)}
              className="pk-focus text-start rounded px-4 py-3.5 transition hover:shadow-md"
              style={{
                backgroundColor: "var(--pk-surface)",
                border: "1px solid var(--pk-border)",
              }}
            >
              <div className="text-sm font-semibold truncate">{prov.nameUr}</div>
              {locale === "en" && (
                <div
                  className="text-[11px] truncate mt-0.5"
                  style={{ color: "var(--pk-text-faint)" }}
                >
                  {prov.nameEn}
                </div>
              )}
              <div className="text-xs mt-2" style={{ color: "var(--pk-text-muted)" }}>
                <LtrNumber value={prov.naSeats} className="pk-figure" />
                <span className="ms-1.5">{identity(locale, "seatsLabel")}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
