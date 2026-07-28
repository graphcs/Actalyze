"use client";

import { party, needsPatternFill, type PkPartyId } from "@/lib/pk/parties";
import { useT } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";
import { Ltr } from "./Ltr";

/**
 * Leader, runner-up and how clearly they separate.
 *
 * ── Why not `ElectionOutlook` ──────────────────────────────────────────────────────
 *
 * The US component renders a seven-stop ladder from "Safe D" to "Safe R" along a
 * blue→red gradient. Every part of that is a two-party assumption: the endpoints are
 * parties, the midpoint is a tie between exactly two of them, and the colours encode
 * which. A seat where PML-N leads IND(PTI) with MQM-P third has no position on it.
 *
 * This card instead states the two facts the data supports — who leads, and by how
 * much after the sample-size adjustment — on a neutral four-rung ladder that names
 * the *separation*, not a party. The party identity is carried by the chip colour.
 *
 * ── Wording ────────────────────────────────────────────────────────────────────────
 *
 * The rungs are "clear lead / strong lead / narrow lead / no clear lead", not
 * "Safe / Likely / Lean / Toss-up" in the UI copy. Those English terms are Cook
 * Political Report house style; they carry a forecasting promise this signal cannot
 * make, and there is no established Urdu equivalent that a reader would recognise.
 */

export type Competitiveness = "Safe" | "Likely" | "Lean" | "Toss-up";

const RUNGS: Array<{ key: Competitiveness; labelKey: MessageKey }> = [
  { key: "Toss-up", labelKey: "constituency.compTossup" },
  { key: "Lean", labelKey: "constituency.compLean" },
  { key: "Likely", labelKey: "constituency.compLikely" },
  { key: "Safe", labelKey: "constituency.compSafe" },
];

function chipStyle(id: PkPartyId): React.CSSProperties {
  const color = party(id).color;
  if (!needsPatternFill(id)) return { backgroundColor: color };
  return {
    backgroundColor: color,
    backgroundImage:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.42) 0 3px, rgba(255,255,255,0) 3px 8px)",
  };
}

export function SeatOutlook({
  leader,
  runnerUp,
  leadPoints,
  competitiveness,
  confidence,
  keyFactors,
  sampleSize,
}: {
  leader: PkPartyId | null;
  runnerUp: PkPartyId | null;
  leadPoints: number;
  competitiveness: Competitiveness;
  confidence: number;
  keyFactors: string[];
  sampleSize: number;
}) {
  const t = useT();

  if (sampleSize === 0 || !leader) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 urdu-prose">
        {t("constituency.sentimentEmpty")}
      </p>
    );
  }

  const leaderParty = party(leader);
  const activeIndex = RUNGS.findIndex((r) => r.key === competitiveness);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className="text-xs text-zinc-500 mb-1.5">{t("constituency.leader")}</div>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white"
            style={chipStyle(leader)}
          >
            <Ltr>{leaderParty.commonName}</Ltr>
          </span>
        </div>

        {runnerUp && (
          <div>
            <div className="text-xs text-zinc-500 mb-1.5">
              {t("constituency.runnerUp")}
            </div>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white opacity-80"
              style={chipStyle(runnerUp)}
            >
              <Ltr>{party(runnerUp).commonName}</Ltr>
            </span>
          </div>
        )}

        <div>
          <div className="text-xs text-zinc-500 mb-1.5">{t("constituency.lead")}</div>
          <div className="text-2xl font-bold leading-none">
            <Ltr>{`+${leadPoints.toFixed(1)}`}</Ltr>
            <span className="text-xs font-normal text-zinc-400 ms-1.5">
              {t("constituency.leadPointsUnit")}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-zinc-500 mb-1.5">
            {t("constituency.confidence")}
          </div>
          <div className="text-2xl font-bold leading-none text-zinc-600 dark:text-zinc-300">
            <Ltr>{`${Math.round(confidence * 100)}%`}</Ltr>
          </div>
        </div>
      </div>

      {/* Separation ladder. Neutral rungs, filled in the leading party's colour —
          no bipolar axis, because there are not two poles. */}
      <div>
        <div className="text-xs text-zinc-500 mb-1.5">
          {t("constituency.competitiveness")}
        </div>
        <div className="flex gap-1.5">
          {RUNGS.map((rung, i) => {
            const active = i <= activeIndex;
            return (
              <div key={rung.key} className="flex-1">
                <div
                  className="h-2 rounded-full"
                  style={
                    active
                      ? chipStyle(leader)
                      : { backgroundColor: "rgb(228 228 231 / 1)" }
                  }
                />
                <div
                  className={`mt-1.5 text-[10px] text-center leading-tight ${
                    i === activeIndex
                      ? "font-semibold text-zinc-800 dark:text-zinc-200"
                      : "text-zinc-400"
                  }`}
                >
                  {t(rung.labelKey)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {keyFactors.length > 0 && (
        <ul className="space-y-1 pt-1">
          {keyFactors.map((factor, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
            >
              <span className="text-zinc-300 mt-0.5">•</span>
              <span className="min-w-0">{factor}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-zinc-400 urdu-prose border-t border-zinc-100 dark:border-zinc-800 pt-3">
        {t("constituency.shrinkNote")}
      </p>
    </div>
  );
}

export default SeatOutlook;
