"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "../i18n/LocaleProvider";
import { Ltr } from "./Ltr";
import { party, needsPatternFill, type PkPartyId } from "@/lib/pk/parties";
import type { ProvincialSeat } from "@/lib/pk/provincial-seats";

/**
 * The chamber, drawn as it is arranged.
 *
 * A stacked bar tells you the arithmetic; a hemicycle tells you what the room looks
 * like from the Speaker's chair, which is the thing a member already has a mental
 * picture of. It is also the one visual on this build with no data risk at all — every
 * seat is a seat we hold a record for, and nothing is inferred.
 *
 * ── The seat layout ──────────────────────────────────────────────────────────────
 *
 * Seats are laid out in concentric rows across a half-annulus, with each row holding a
 * number of seats proportional to its radius so the spacing between neighbours is
 * roughly constant — the standard parliamentary-diagram construction. Rows are computed
 * from the seat count rather than fixed, because these four houses range from 51 seats
 * to 297 and a layout tuned for Balochistan looks sparse in Punjab.
 *
 * Seats are filled by party in descending size, so each party occupies a contiguous
 * block, which is how these charts are read.
 *
 * ── Colour ───────────────────────────────────────────────────────────────────────
 *
 * Party colour is allowed here: this is a data mark about parties, which is the one
 * exception `pk.css` carves out. Six parties in these houses are shades of green, so
 * hatching is applied per `needsPatternFill`, at a per-party angle — two hatched
 * neighbours at the same angle merge into one block, which is the defect the angles in
 * `hatchAngle` exist to prevent.
 */

interface Seat {
  x: number;
  y: number;
  party: PkPartyId | null;
  code: string;
  member: string | null;
  name: string | null;
}

/** Rows sized so seats-per-row scales with radius, giving even spacing. */
function layout(count: number, rows: number) {
  const R_OUTER = 1;
  const R_INNER = 0.42;
  const step = rows > 1 ? (R_OUTER - R_INNER) / (rows - 1) : 0;

  // Distribute seats across rows in proportion to each row's arc length.
  const radii = Array.from({ length: rows }, (_, i) => R_INNER + i * step);
  const weight = radii.reduce((s, r) => s + r, 0);
  const perRow = radii.map((r) => Math.max(1, Math.round((count * r) / weight)));

  // Rounding drifts; settle the difference on the outermost row, which has the most
  // room to absorb it without visibly changing spacing.
  let drift = count - perRow.reduce((s, n) => s + n, 0);
  for (let i = perRow.length - 1; drift !== 0 && i >= 0; i--) {
    const adjust = drift > 0 ? 1 : -1;
    if (perRow[i] + adjust >= 1) {
      perRow[i] += adjust;
      drift -= adjust;
    }
  }

  const points: Array<{ x: number; y: number }> = [];
  radii.forEach((r, ri) => {
    const n = perRow[ri];
    for (let i = 0; i < n; i++) {
      // Half-turn from π (left) to 0 (right); +0.5 centres seats within their slot.
      const theta = Math.PI * (1 - (i + 0.5) / n);
      points.push({ x: Math.cos(theta) * r, y: -Math.sin(theta) * r });
    }
  });

  // Sort left-to-right then front-to-back so party blocks read as contiguous wedges.
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  return points.slice(0, count);
}

export function PkHemicycle({
  seats,
  totalSeats,
  className = "",
}: {
  seats: ProvincialSeat[];
  /** The House's full size including reserved seats, for the caption. */
  totalSeats: number;
  className?: string;
}) {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [hover, setHover] = useState<Seat | null>(null);

  const { placed, order } = useMemo(() => {
    const counts = new Map<PkPartyId, ProvincialSeat[]>();
    const vacants: ProvincialSeat[] = [];
    for (const s of seats) {
      if (s.vacant || !s.party) {
        vacants.push(s);
        continue;
      }
      const list = counts.get(s.party) ?? [];
      list.push(s);
      counts.set(s.party, list);
    }

    const ordered = [...counts.entries()].sort((a, b) => b[1].length - a[1].length);
    // Vacancies last, drawn as an empty outline rather than a colour.
    const sequence: ProvincialSeat[] = [...ordered.flatMap(([, list]) => list), ...vacants];

    const rows = Math.max(4, Math.round(Math.sqrt(sequence.length) / 1.4));
    const points = layout(sequence.length, rows);

    return {
      placed: points.map((p, i) => ({
        ...p,
        party: sequence[i]?.party ?? null,
        code: sequence[i]?.code ?? "",
        member: sequence[i]?.memberName ?? null,
        name: sequence[i]?.name ?? null,
      })) as Seat[],
      order: ordered.map(([id, list]) => ({ id, seats: list.length })),
    };
  }, [seats]);

  const filled = order.reduce((s, o) => s + o.seats, 0);
  // A seat radius that scales with the count keeps large and small houses legible.
  const r = Math.max(0.012, 0.055 - placed.length * 0.00009);

  return (
    <div className={className}>
      <div className="relative">
        <svg viewBox="-1.08 -1.12 2.16 1.2" className="w-full h-auto block" role="img"
             aria-label={t("assembly.hemicycleAria")}>
          {placed.map((s, i) => {
            const meta = s.party ? party(s.party) : null;
            const hatched = s.party ? needsPatternFill(s.party) : false;
            return (
              <motion.circle
                key={`${s.code || "seat"}-${i}`}
                cx={s.x}
                cy={s.y}
                r={r}
                fill={meta ? meta.color : "var(--pk-surface)"}
                stroke={meta ? "none" : "var(--pk-border-strong)"}
                strokeWidth={0.006}
                // Seats settle into place on load. Staggered by index so the chamber
                // fills rather than appearing — the one piece of motion here that is
                // decoration, kept short and disabled under reduced-motion.
                initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.35, delay: Math.min(i * 0.0016, 0.6), ease: "easeOut" }
                }
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                className="cursor-default"
                style={
                  hatched && meta
                    ? {
                        /**
                         * A diagonal hatch is what the stacked bars use, but a pattern
                         * inside a circle this small is invisible, and a dashed ring —
                         * which was the first attempt — turns each seat into a cogwheel
                         * and makes the largest party's block look like noise.
                         *
                         * A thin solid ring is enough here: on a hemicycle each party
                         * already occupies a contiguous wedge, so the ring only has to
                         * mark a seat as belonging to the green family rather than
                         * separate two adjacent greens the way a bar segment must.
                         */
                        stroke: "rgba(255,255,255,0.9)",
                        strokeWidth: r * 0.22,
                      }
                    : undefined
                }
              />
            );
          })}
        </svg>

        <div
          className="absolute inset-x-0 bottom-0 text-center pointer-events-none"
          style={{ opacity: hover ? 1 : 0, transition: "opacity 120ms" }}
        >
          {hover && (
            <div className="inline-block rounded-lg px-3 py-1.5 text-xs"
                 style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}>
              <span className="font-semibold"><Ltr>{hover.code}</Ltr></span>
              {hover.name && <> · <Ltr>{hover.name}</Ltr></>}
              {hover.member ? (
                <> · {hover.member}</>
              ) : (
                <> · {t("board.vacant")}</>
              )}
              {hover.party && <> · {locale === "ur" ? party(hover.party).nameUr : party(hover.party).commonName}</>}
            </div>
          )}
        </div>
      </div>

      <ul className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
        {order.map((o) => {
          const meta = party(o.id);
          return (
            <li key={o.id} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: meta.color,
                  boxShadow: needsPatternFill(o.id) ? "inset 0 0 0 1.5px rgba(255,255,255,0.9)" : undefined,
                }}
              />
              <span>{locale === "ur" ? meta.nameUr : meta.commonName}</span>
              <span className="pk-figure font-semibold"><Ltr>{o.seats}</Ltr></span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-center" style={{ color: "var(--pk-text-faint)" }}>
        {t("assembly.hemicycleNote")
          .replace("{filled}", String(filled))
          .replace("{general}", String(placed.length))
          .replace("{total}", String(totalSeats))}
      </p>
    </div>
  );
}
