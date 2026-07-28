"use client";

import { Ltr } from "./Ltr";

/**
 * A headline figure with its provenance attached.
 *
 * The `source` and `year` props are **required**, and they render on the card rather
 * than in a tooltip. That is the whole design of this component: a Chief Minister
 * reading a number needs to know whether it predates their government, and a figure
 * without a date is a claim rather than a measurement.
 *
 * The sparkline is optional and takes a series only where one genuinely exists. It is
 * never synthesised from a single value to make a card look livelier — a fabricated
 * trend line is a lie told in a shape that reads as evidence.
 */
export function PkKpiCard({
  label,
  value,
  unit,
  source,
  year,
  series,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  source: string;
  year: string;
  series?: number[];
  note?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}
    >
      <div className="text-xs font-medium" style={{ color: "var(--pk-text-muted)" }}>
        {label}
      </div>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="pk-figure text-2xl font-semibold leading-none">
          <Ltr>{value}</Ltr>
        </span>
        {unit && (
          <span className="text-xs" style={{ color: "var(--pk-text-muted)" }}>
            {unit}
          </span>
        )}
      </div>

      {series && series.length > 1 && <Sparkline points={series} />}

      {note && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--pk-text-muted)" }}>
          {note}
        </p>
      )}

      <p
        className="mt-auto pt-2 text-[11px] leading-snug"
        style={{ color: "var(--pk-text-faint)" }}
      >
        {source} · <Ltr>{year}</Ltr>
      </p>
    </div>
  );
}

/** Minimal inline sparkline. No axes, no tooltip — it is a shape, not a chart. */
function Sparkline({ points }: { points: number[] }) {
  const w = 100;
  const h = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 w-full h-5"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--pk-accent)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
