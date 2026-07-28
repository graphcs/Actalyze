"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { useLocale } from "../i18n/LocaleProvider";
import { Ltr } from "./Ltr";
import {
  indicator as getIndicator,
  indicatorLabel,
  indicatorSource,
  formatValue,
  type IndicatorId,
} from "@/lib/pk/indicators";

/**
 * The district league table.
 *
 * This is the object a Chief Minister actually uses: ranked districts tell them which
 * Deputy Commissioner to call. Everything else on the board is context for it.
 *
 * ── Three deliberate refusals ────────────────────────────────────────────────────
 *
 * 1. **One indicator at a time, named in the header.** There is no composite score. A
 *    "district performance index" would embed a judgement about how much density is
 *    worth against literacy and print it in the typography of a measurement.
 *
 * 2. **No default worst-first ordering on indicators that have no bad end.** Sorting
 *    ascending by population would present Pakistan's smallest districts as its worst.
 *    `concern: 'none'` in the indicator registry means the table sorts high-to-low and
 *    calls itself a ranking, not a league.
 *
 * 3. **Districts with no figure sort to the bottom under their own heading**, never
 *    into the ranking as zeroes. A missing number is not a small number.
 */

export interface DistrictRow {
  name: string;
  value: number | null;
  absentReason?: string;
  seats?: number;
}

export function PkDistrictTable({
  rows,
  indicatorId,
  selected,
  onSelect,
  limit = 12,
}: {
  rows: DistrictRow[];
  indicatorId: IndicatorId;
  selected: string | null;
  onSelect: (name: string | null) => void;
  limit?: number;
}) {
  const { t, locale } = useLocale();
  const ind = getIndicator(indicatorId);
  const [ascending, setAscending] = useState(ind.concern === "low");
  const [showAll, setShowAll] = useState(false);

  const { ranked, absent } = useMemo(() => {
    const withValue = rows.filter((r) => typeof r.value === "number");
    const without = rows.filter((r) => typeof r.value !== "number");
    withValue.sort((a, b) => (ascending ? a.value! - b.value! : b.value! - a.value!));
    return { ranked: withValue, absent: without };
  }, [rows, ascending]);

  const visible = showAll ? ranked : ranked.slice(0, limit);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h3 className="pk-eyebrow" style={{ color: "var(--pk-text-muted)" }}>
          {t("board.districtsBy")} {indicatorLabel(ind, locale)}
        </h3>
        <button
          onClick={() => setAscending((v) => !v)}
          className="pk-focus inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1"
          style={{ color: "var(--pk-accent)" }}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {ascending ? t("board.lowestFirst") : t("board.highestFirst")}
        </button>
      </div>

      <ol className="space-y-1">
        {visible.map((r, i) => {
          const isSelected = selected === r.name;
          const rank = ascending ? i + 1 : ranked.length - i;
          return (
            <li key={r.name}>
              <button
                onClick={() => onSelect(isSelected ? null : r.name)}
                className="pk-focus w-full flex items-center gap-3 rounded-lg px-3 py-2 text-start transition"
                style={{
                  background: isSelected ? "var(--pk-accent-soft)" : "transparent",
                  border: `1px solid ${isSelected ? "var(--pk-accent-line)" : "transparent"}`,
                }}
              >
                <span
                  className="pk-figure text-xs w-6 shrink-0 text-end"
                  style={{ color: "var(--pk-text-faint)" }}
                >
                  <Ltr>{rank}</Ltr>
                </span>
                <span className="flex-1 min-w-0 text-sm truncate">
                  <Ltr>{r.name}</Ltr>
                </span>
                {r.seats != null && (
                  <span className="text-xs shrink-0" style={{ color: "var(--pk-text-faint)" }}>
                    <Ltr>{r.seats}</Ltr> {t("board.seatsShort")}
                  </span>
                )}
                <span className="pk-figure text-sm font-semibold shrink-0 tabular-nums">
                  <Ltr>{formatValue(r.value, ind)}</Ltr>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {ranked.length > limit && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="pk-focus mt-2 text-xs font-medium"
          style={{ color: "var(--pk-accent)" }}
        >
          {showAll ? t("board.showFewer") : `${t("board.showAll")} (${ranked.length})`}
        </button>
      )}

      {/* Absences, under their own heading with their own reasons. A district with no
          figure is a fact about the census, not a low score. */}
      {absent.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--pk-border)" }}>
          <h4 className="text-xs font-semibold mb-2" style={{ color: "var(--pk-text-muted)" }}>
            {t("board.noFigureHeading")}
          </h4>
          <ul className="space-y-1">
            {absent.map((r) => (
              <li key={r.name} className="flex items-baseline gap-2 text-xs px-3">
                <button
                  onClick={() => onSelect(selected === r.name ? null : r.name)}
                  className="pk-focus shrink-0 font-medium"
                  style={{ color: "var(--pk-text)" }}
                >
                  <Ltr>{r.name}</Ltr>
                </button>
                <span style={{ color: "var(--pk-text-faint)" }}>{r.absentReason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
        {indicatorSource(ind, locale)}
      </p>
    </div>
  );
}
