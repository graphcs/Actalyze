"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { motion, useReducedMotion } from "framer-motion";
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
 * Province → district drill-down.
 *
 * ── Why this is SVG and not Leaflet ───────────────────────────────────────────────
 *
 * `PkMap.tsx` uses Leaflet and stays as it is; this is a different component for a
 * different job. Three reasons it could not be the same one:
 *
 *  1. **The zoom is the point.** Leaflet's zoom is bound to tile loading, so an
 *     animated transition between two levels is at the mercy of a tile server on a
 *     conference-centre connection. Here the geometry is already in the document and
 *     the transition is a `viewBox` interpolation that cannot stall.
 *  2. **Direction.** `PkMap`'s own header documents Leaflet mis-computing pane
 *     transforms under a `dir="rtl"` ancestor, which is why it needs an `ltr-island`
 *     wrapper. An inline SVG has no such problem: it is laid out by its own coordinate
 *     system, which has no direction.
 *  3. **Projection.** A projector renders this at 1920 wide and a phone at 390. Vector
 *     paths are resolution-independent; raster tiles are not.
 *
 * ── The colour ramp ──────────────────────────────────────────────────────────────
 *
 * A single-hue sequential green interpolated from the institutional `--pk-band`.
 * Deliberately not a party palette — `pk.css` confines party colour to data marks about
 * parties, and a choropleth of census data is not one. Deliberately not a red-to-green
 * diverging scale either: it fails for roughly one reader in twelve, and in a chamber
 * split between government and opposition, red-for-bad over a district map invites a
 * reading nobody intends.
 *
 * ── What the map refuses to do ───────────────────────────────────────────────────
 *
 * A district with no figure is drawn in a flat neutral and reports why — see
 * `pop_absent`, set at build time. It is never interpolated, never averaged from its
 * neighbours, and never left to look like a low value.
 */

interface DistrictFeature {
  type: "Feature";
  properties: {
    adm2_name: string;
    adm2_pcode: string;
    area_sqkm: number;
    center_lat: number;
    center_lon: number;
    pop_total: number | null;
    density: number | null;
    urban_share: number | null;
    sex_ratio: number | null;
    pop_absent?: string;
    [k: string]: unknown;
  };
  geometry: GeoPermissibleObjects;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: DistrictFeature[];
}

/** Viewport the SVG is authored in. Everything else is derived from the projection. */
const W = 800;
const H = 600;
/** Breathing room so a selected district's stroke is not clipped by the frame. */
const PAD = 28;

export interface PkDrillMapProps {
  /** Province slug matching `public/pk/geo/<slug>.json`. */
  slug: string;
  indicatorId: IndicatorId;
  /** COD-AB name of the district to zoom to, or null for the whole province. */
  selected: string | null;
  onSelect: (districtName: string | null) => void;
  /** Seats per district, keyed by COD-AB name — shown in the tooltip. */
  seatsByDistrict?: Record<string, number>;
  className?: string;
}

export function PkDrillMap({
  slug,
  indicatorId,
  selected,
  onSelect,
  seatsByDistrict,
  className = "",
}: PkDrillMapProps) {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const ind = getIndicator(indicatorId);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    fetch(`/pk/geo/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  /**
   * Projection fitted to the province, computed once per province rather than per
   * render. `fitExtent` reads every coordinate in the collection, which for Balochistan
   * is a meaningful amount of work to repeat on a hover.
   */
  const { path, bounds } = useMemo(() => {
    if (!data) return { path: null, bounds: null };
    const projection = geoMercator().fitExtent(
      [
        [PAD, PAD],
        [W - PAD, H - PAD],
      ],
      data as unknown as GeoPermissibleObjects
    );
    const p = geoPath(projection);
    const b = new Map<string, [[number, number], [number, number]]>();
    for (const f of data.features) {
      b.set(f.properties.adm2_name, p.bounds(f as unknown as GeoPermissibleObjects));
    }
    return { path: p, bounds: b };
  }, [data]);

  /** Domain over districts that actually have a value; nulls never enter the scale. */
  const scale = useMemo(() => {
    if (!data) return null;
    const values = data.features
      .map((f) => f.properties[ind.field] as number | null)
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max, span: max - min || 1 };
  }, [data, ind.field]);

  /**
   * Density is the one indicator here whose distribution is savagely skewed — Lahore is
   * two orders of magnitude denser than Chagai — so a linear ramp paints 35 of 36
   * Punjab districts the same pale green. A log position is used for the *colour* only;
   * the number shown is always the real one.
   */
  const position = (v: number) => {
    if (!scale) return 0;
    if (ind.id === "density" && scale.min > 0) {
      const l = Math.log(v) - Math.log(scale.min);
      const s = Math.log(scale.max) - Math.log(scale.min) || 1;
      return Math.max(0, Math.min(1, l / s));
    }
    return Math.max(0, Math.min(1, (v - scale.min) / scale.span));
  };

  /** Interpolated from the institutional green. Light end stays readable on paper. */
  const fillFor = (f: DistrictFeature) => {
    const v = f.properties[ind.field] as number | null;
    if (typeof v !== "number" || Number.isNaN(v)) return "var(--pk-surface-sunk)";
    const p = position(v);
    // L*: 94% down to 26%, so even the darkest district takes white text legibly and
    // the lightest is still distinguishable from the no-data neutral.
    const l = 94 - p * 68;
    const c = 8 + p * 22;
    return `lch(${l}% ${c} 145)`;
  };

  /** viewBox for the current selection — this is what animates. */
  const viewBox = useMemo(() => {
    if (!selected || !bounds) return `0 0 ${W} ${H}`;
    const b = bounds.get(selected);
    if (!b) return `0 0 ${W} ${H}`;
    const [[x0, y0], [x1, y1]] = b;
    const w = Math.max(x1 - x0, 1);
    const h = Math.max(y1 - y0, 1);
    // Fit the district with margin, preserving the viewport ratio so nothing distorts.
    const m = Math.max(w, h) * 0.35;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const size = Math.max(w + m, (h + m) * (W / H));
    return `${cx - size / 2} ${cy - (size * H) / W / 2} ${size} ${(size * H) / W}`;
  }, [selected, bounds]);

  if (error) {
    return (
      <div
        className={`rounded-xl p-8 text-center text-sm ${className}`}
        style={{ border: "1px solid var(--pk-border)", color: "var(--pk-text-muted)" }}
      >
        {t("map.unavailable")}
      </div>
    );
  }

  if (!data || !path) {
    return (
      <div
        className={`rounded-xl animate-pulse ${className}`}
        style={{ background: "var(--pk-surface-sunk)", aspectRatio: `${W} / ${H}` }}
        aria-hidden="true"
      />
    );
  }

  const hovered = hover ? data.features.find((f) => f.properties.adm2_name === hover) : null;
  const active = hovered ?? (selected ? data.features.find((f) => f.properties.adm2_name === selected) : null);

  return (
    <div className={className}>
      <div className="relative">
        <motion.svg
          ref={svgRef}
          viewBox={viewBox}
          // The zoom. Framer interpolates the viewBox string component-wise, so the
          // camera moves rather than the geometry — no re-projection, no re-layout.
          animate={{ viewBox }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full h-auto block"
          style={{ aspectRatio: `${W} / ${H}`, touchAction: "manipulation" }}
          role="img"
          aria-label={t("map.ariaLabel")}
        >
          {data.features.map((f) => {
            const name = f.properties.adm2_name;
            const d = path(f as unknown as GeoPermissibleObjects) ?? undefined;
            const isSelected = selected === name;
            const isHover = hover === name;
            return (
              <path
                key={f.properties.adm2_pcode || name}
                d={d}
                fill={fillFor(f)}
                stroke={isSelected ? "var(--pk-band)" : "var(--pk-surface)"}
                // Stroke width is in user units, and the viewBox shrinks on zoom — so a
                // fixed width would balloon. `non-scaling-stroke` keeps hairlines
                // hairlines at every zoom level.
                vectorEffect="non-scaling-stroke"
                strokeWidth={isSelected ? 2.5 : isHover ? 1.6 : 0.6}
                className="cursor-pointer transition-[stroke-width] duration-150"
                onMouseEnter={() => setHover(name)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(isSelected ? null : name)}
                tabIndex={0}
                role="button"
                aria-label={name}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(isSelected ? null : name);
                  }
                }}
              />
            );
          })}
        </motion.svg>

        {/* Readout. Fixed position rather than a cursor-following tooltip: it must be
            legible from the back of a room and must not jump while someone is talking. */}
        <div
          className="absolute top-3 rounded-lg px-3 py-2 pointer-events-none min-w-[10rem]"
          style={{
            insetInlineStart: "0.75rem",
            background: "color-mix(in srgb, var(--pk-surface) 92%, transparent)",
            border: "1px solid var(--pk-border)",
            opacity: active ? 1 : 0,
            transition: "opacity 150ms",
          }}
        >
          <div className="text-sm font-semibold leading-tight">
            <Ltr>{active?.properties.adm2_name ?? ""}</Ltr>
          </div>
          {active && (
            <div className="mt-1 text-xs" style={{ color: "var(--pk-text-muted)" }}>
              {typeof active.properties[ind.field] === "number" ? (
                <>
                  <span className="pk-figure font-semibold" style={{ color: "var(--pk-text)" }}>
                    <Ltr>{formatValue(active.properties[ind.field] as number, ind)}</Ltr>
                  </span>{" "}
                  {locale === "ur" ? ind.unitUr : ind.unitEn}
                </>
              ) : (
                // The reason, not a blank. See `pop_absent` in build-province-geo.mjs.
                <span>{active.properties.pop_absent ?? t("map.noFigure")}</span>
              )}
              {seatsByDistrict?.[active.properties.adm2_name] != null && (
                <div className="mt-0.5">
                  <Ltr>{seatsByDistrict[active.properties.adm2_name]}</Ltr> {t("map.seats")}
                </div>
              )}
            </div>
          )}
        </div>

        {selected && (
          <button
            onClick={() => onSelect(null)}
            className="pk-focus absolute top-3 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{
              insetInlineEnd: "0.75rem",
              background: "var(--pk-surface)",
              border: "1px solid var(--pk-border)",
            }}
          >
            {t("map.backToProvince")}
          </button>
        )}
      </div>

      {/* Legend, then the provenance line. The second is not small print: it is the
          difference between a figure and a claim. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {scale && (
          <div className="flex items-center gap-2">
            <span className="pk-figure" style={{ color: "var(--pk-text-muted)" }}>
              <Ltr>{formatValue(scale.min, ind)}</Ltr>
            </span>
            <span
              className="inline-block h-2 w-24 rounded-full"
              style={{ background: "linear-gradient(to right, lch(94% 8 145), lch(26% 30 145))" }}
              aria-hidden="true"
            />
            <span className="pk-figure" style={{ color: "var(--pk-text-muted)" }}>
              <Ltr>{formatValue(scale.max, ind)}</Ltr>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5" style={{ color: "var(--pk-text-muted)" }}>
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: "var(--pk-surface-sunk)", border: "1px solid var(--pk-border)" }}
            aria-hidden="true"
          />
          {t("map.noFigureLegend")}
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
        {indicatorLabel(ind, locale)} — {indicatorSource(ind, locale)}. {t("map.boundarySource")}
      </p>
    </div>
  );
}
