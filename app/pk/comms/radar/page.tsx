"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, Building2, AlertTriangle } from "lucide-react";
import { PkAppLayout } from "../../components/PkAppLayout";
import { PkSectionHeading } from "../../components/PkSectionHeading";
import { Ltr } from "../../components/Ltr";
import { useLocale } from "../../i18n/LocaleProvider";
import { formatAllocation } from "@/lib/pk/schemes";

/**
 * The issue radar.
 *
 * Three things on one row, which is the whole design: what is being said, who owns it,
 * and what is being done about it. A monitoring dashboard that stops at the first is a
 * dashboard; adding the second and third makes it an instruction.
 *
 * Counts are counts. The bar is the share of matched coverage, and every issue can be
 * expanded to the headlines it was counted from, so nothing here is a number the reader
 * has to take on trust.
 */

interface Scheme {
  id: string; adpNumber: string; titleEn: string; titleUr: string;
  department: string; departmentUr: string; allocationPkr: number;
  unit: string; unitUr: string; target: number; delivered: number;
  districts: string[]; status: string;
}

interface Issue {
  id: string; label: string; labelUr: string; count: number; share: number;
  owner: {
    departmentEn: string | null; departmentUr: string | null;
    jurisdiction: string | null; escalation: string[];
    caveatEn: string | null; caveatUr: string | null;
  };
  samples: Array<{ title: string; url: string; source: string; date?: string }>;
  schemes: Scheme[];
}

interface Radar {
  province: string; provinceName: string; itemsRetrieved: number;
  window: string; issues: Issue[]; generatedAt: string; cached: boolean;
}

const PROVINCES = [
  { code: "PB", en: "Punjab", ur: "پنجاب" },
  { code: "SD", en: "Sindh", ur: "سندھ" },
  { code: "KP", en: "Khyber Pakhtunkhwa", ur: "خیبر پختونخوا" },
  { code: "BA", en: "Balochistan", ur: "بلوچستان" },
];

export default function PkRadarPage() {
  const { t, locale } = useLocale();
  const [province, setProvince] = useState("PB");
  const [data, setData] = useState<Radar | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/pk/comms/radar?province=${province}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [province]);

  const max = Math.max(1, ...(data?.issues ?? []).map((i) => i.count));

  return (
    <PkAppLayout>
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">
        <PkSectionHeading title={t("radar.title")} note={t("radar.subtitle")} />

        <div className="flex flex-wrap gap-1.5 mt-5 mb-6">
          {PROVINCES.map((p) => (
            <button
              key={p.code}
              onClick={() => setProvince(p.code)}
              className="pk-focus rounded-md px-3 py-1.5 text-xs font-medium"
              style={
                province === p.code
                  ? { background: "var(--pk-band)", color: "var(--pk-on-band)" }
                  : { border: "1px solid var(--pk-border)", color: "var(--pk-text-muted)" }
              }
            >
              {locale === "ur" ? p.ur : p.en}
            </button>
          ))}
        </div>

        {loading && (
          <div className="py-16 text-center" style={{ color: "var(--pk-text-muted)" }}>
            <Loader2 className="w-5 h-5 mx-auto animate-spin" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* A thin week must read as a thin week, not as a quiet province. */}
            <p className="text-xs mb-5" style={{ color: "var(--pk-text-faint)" }}>
              {t("radar.countedFrom")} <Ltr>{data.itemsRetrieved}</Ltr> {t("radar.itemsWindow")}
            </p>

            {data.issues.length === 0 && (
              <p className="text-sm" style={{ color: "var(--pk-text-muted)" }}>
                {t("radar.nothing")}
              </p>
            )}

            <ul className="space-y-3">
              {data.issues.map((issue) => {
                const isOpen = open === issue.id;
                const caveat = locale === "ur" ? issue.owner.caveatUr : issue.owner.caveatEn;
                const dept = locale === "ur" ? issue.owner.departmentUr : issue.owner.departmentEn;
                return (
                  <li key={issue.id} className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid var(--pk-border)" }}>
                    <button
                      onClick={() => setOpen(isOpen ? null : issue.id)}
                      className="pk-focus w-full text-start px-4 py-3"
                      style={{ background: "var(--pk-surface)" }}
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="flex-1 font-semibold text-sm">
                          {locale === "ur" ? issue.labelUr : issue.label}
                        </span>
                        <span className="pk-figure text-xs" style={{ color: "var(--pk-text-muted)" }}>
                          <Ltr>{issue.count}</Ltr> · <Ltr>{issue.share}%</Ltr>
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                           style={{ background: "var(--pk-surface-sunk)" }}>
                        <div style={{
                          width: `${(issue.count / max) * 100}%`,
                          height: "100%",
                          background: "var(--pk-band)",
                        }} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {dept && (
                          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--pk-text-muted)" }}>
                            <Building2 className="w-3.5 h-3.5" />
                            {dept}
                          </span>
                        )}
                        {issue.schemes.length > 0 && (
                          <span style={{ color: "var(--pk-accent)" }}>
                            <Ltr>{issue.schemes.length}</Ltr> {t("radar.schemesMatched")}
                          </span>
                        )}
                      </div>

                      {/* The jurisdiction caveat. Electricity is the loudest issue in a
                          Punjab feed and distribution is federal; a radar that hid that
                          would put somebody else's problem on the CM's desk. */}
                      {caveat && (
                        <div className="mt-2 flex gap-2 text-xs" style={{ color: "var(--pk-text-faint)" }}>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{caveat}</span>
                        </div>
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-4"
                           style={{ background: "var(--pk-surface-sunk)", borderTop: "1px solid var(--pk-border)" }}>
                        {issue.schemes.length > 0 && (
                          <div>
                            <div className="pk-eyebrow mb-2 mt-3" style={{ color: "var(--pk-text-muted)" }}>
                              {t("radar.whatIsBeingDone")}
                            </div>
                            <ul className="space-y-2">
                              {issue.schemes.map((s) => {
                                const left = Math.max(0, s.target - s.delivered);
                                return (
                                  <li key={s.id} className="rounded-lg px-3 py-2"
                                      style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}>
                                    <div className="text-sm font-medium">
                                      {locale === "ur" ? s.titleUr : s.titleEn}
                                    </div>
                                    <div className="mt-1 text-xs" style={{ color: "var(--pk-text-muted)" }}>
                                      {locale === "ur" ? s.departmentUr : s.department} ·{" "}
                                      <Ltr>{formatAllocation(s.allocationPkr, locale === "ur" ? "ur" : "en")}</Ltr> ·{" "}
                                      {t("radar.adp")} <Ltr>{s.adpNumber}</Ltr>
                                    </div>
                                    {/* The shortfall is never omitted. */}
                                    <div className="mt-1.5 text-xs font-medium">
                                      <Ltr>{s.delivered}</Ltr> {t("radar.of")} <Ltr>{s.target}</Ltr>{" "}
                                      {locale === "ur" ? s.unitUr : s.unit}
                                      {left > 0 && (
                                        <span style={{ color: "var(--pk-text-faint)" }}>
                                          {" "}· <Ltr>{left}</Ltr> {t("radar.outstanding")}
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        <div>
                          <div className="pk-eyebrow mb-2" style={{ color: "var(--pk-text-muted)" }}>
                            {t("radar.countedFromThese")}
                          </div>
                          <ul className="space-y-1.5">
                            {issue.samples.map((s) => (
                              <li key={s.url} className="text-xs">
                                <a href={s.url} target="_blank" rel="noopener noreferrer"
                                   className="pk-focus inline-flex items-start gap-1.5"
                                   style={{ color: "var(--pk-accent)" }}>
                                  <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                                  <span>{s.title}</span>
                                </a>
                                <span style={{ color: "var(--pk-text-faint)" }}> — {s.source}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
              {t("radar.method")}{" "}
              <Link href="/pk/comms/claims" className="pk-focus" style={{ color: "var(--pk-accent)" }}>
                {t("claims.title")} →
              </Link>
            </p>
          </>
        )}
      </div>
    </PkAppLayout>
  );
}
