"use client";

import { party, needsPatternFill, type PkPartyId } from "@/lib/pk/parties";
import { useT } from "../i18n/LocaleProvider";
import { Ltr } from "./Ltr";

/**
 * Share of public discussion by party, as a stacked bar.
 *
 * ── Why not `AIPollingGauge` ───────────────────────────────────────────────────────
 *
 * That component's entire visual grammar is a bipolar blue↔red axis with a needle
 * that swings from one party at the left end to the other party at the right end.
 * There is no such axis in Pakistani politics: PML-N, PPP, PTI-backed independents,
 * MQM-P and JUI-F do not sit on a line, and blue and red carry no national meaning
 * (blue is JI's colour; red is PTI's). A stacked bar makes no claim about ordering
 * beyond size, which is the only claim this data supports.
 *
 * ── The hatch ──────────────────────────────────────────────────────────────────────
 *
 * Seven parties in this house are some shade of green — PML-N #228B22, PML-Q #5CB85C,
 * JUI-F #003800, IPP #67BA27, PML-Z #00A877, MWM #0B9A51, BAP #6B8E23. Adjacent in a
 * stacked bar they are indistinguishable, and colour-blind readers lose them
 * entirely. `needsPatternFill()` flags them and they get a diagonal hatch, so the
 * segments differ in texture as well as hue. The same hatch is repeated in the legend
 * swatch so the mapping is learnable.
 *
 * ── Never the word "poll" ──────────────────────────────────────────────────────────
 *
 * No voter was surveyed. This is the split of a few dozen retrieved public posts. The
 * heading is `constituency.sentiment` — "public discourse signal" — and the subtitle
 * says so outright.
 */

export interface PartyShare {
  party: PkPartyId;
  share: number;
}

/** Diagonal hatch laid over the party colour. */
function fillStyle(id: PkPartyId, color: string): React.CSSProperties {
  if (!needsPatternFill(id)) return { backgroundColor: color };
  return {
    backgroundColor: color,
    backgroundImage:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.42) 0 3px, rgba(255,255,255,0) 3px 8px)",
  };
}

export function PartyShareBar({
  shares,
  sampleSize,
}: {
  shares: PartyShare[];
  sampleSize: number;
}) {
  const t = useT();

  // No sample means no figure. Not a zeroed bar, not a placeholder — nothing.
  if (sampleSize === 0 || shares.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 urdu-prose">
        {t("constituency.sentimentEmpty")}
      </p>
    );
  }

  const total = shares.reduce((sum, s) => sum + s.share, 0) || 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-xs font-medium text-zinc-500">
          {t("constituency.seatShare")}
        </span>
        <span className="text-xs text-zinc-400">
          <Ltr>{`n = ${sampleSize}`}</Ltr>
        </span>
      </div>

      {/*
        The bar itself stays left-to-right even in Urdu. `pk.css` sets this contract
        for charts: Pakistani print media renders series left-to-right, and keeping
        the bar and its legend in the same order matters more than mirroring.
      */}
      <div
        dir="ltr"
        className="ltr-island flex h-9 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
      >
        {shares.map(({ party: id, share }, i) => {
          const p = party(id);
          const width = (share / total) * 100;
          return (
            <div
              key={id}
              className="h-full flex items-center justify-center"
              style={{
                width: `${width}%`,
                ...fillStyle(id, p.color),
                // The hatch separates the green family, but MQM-P #BE1212 and PTI
                // #E70A0A are both red and read as one block when adjacent. A 1px
                // inset divider keeps every boundary visible whatever the hues.
                ...(i < shares.length - 1
                  ? { boxShadow: "inset -1px 0 0 rgba(255,255,255,0.65)" }
                  : {}),
              }}
              title={`${p.commonName} — ${share.toFixed(1)}%`}
            >
              {width >= 12 && (
                <span className="text-[11px] font-semibold text-white drop-shadow-sm px-1 truncate">
                  {share.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/*
        The legend inherits the bar's direction, not the page's. With the bar pinned
        LTR and the legend flowing RTL, the largest segment sits at the far left of
        the bar and its swatch at the far right of the legend — the mapping stops
        being learnable at a glance. Every token here is Latin anyway.
      */}
      <ul dir="ltr" className="ltr-island mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {shares.map(({ party: id, share }) => {
          const p = party(id);
          return (
            <li key={id} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-3 h-3 rounded-sm shrink-0 border border-black/10"
                style={fillStyle(id, p.color)}
              />
              <span className="text-zinc-700 dark:text-zinc-300">
                {/* "Other" is a translated word, so it must NOT be forced LTR;
                    party abbreviations are Latin and must be. */}
                {id === "OTHER" ? (
                  <span dir="auto">{t("constituency.otherParties")}</span>
                ) : (
                  <Ltr>{p.commonName}</Ltr>
                )}
              </span>
              <span className="text-zinc-400">
                <Ltr>{`${share.toFixed(1)}%`}</Ltr>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PartyShareBar;
