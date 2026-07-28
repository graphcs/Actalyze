"use client";

import { useLocale } from "../i18n/LocaleProvider";
import { allIndicators, indicatorLabel, type IndicatorId } from "@/lib/pk/indicators";

/**
 * Chooses what the map and the league table are showing.
 *
 * The selected indicator's own note renders underneath, permanently rather than on
 * hover, because several of these numbers mean something other than what their name
 * suggests — a sex ratio well above 100 in a Balochistan district is male labour
 * migration, not a demographic collapse, and a reader who does not know that will draw
 * the wrong conclusion confidently.
 */
export function PkIndicatorPicker({
  value,
  onChange,
}: {
  value: IndicatorId;
  onChange: (id: IndicatorId) => void;
}) {
  const { locale } = useLocale();
  const items = allIndicators();
  const current = items.find((i) => i.id === value) ?? items[0];

  return (
    <div>
      <div
        className="inline-flex flex-wrap gap-1 rounded-lg p-1"
        style={{ background: "var(--pk-surface-sunk)", border: "1px solid var(--pk-border)" }}
        role="group"
      >
        {items.map((i) => {
          const active = i.id === value;
          return (
            <button
              key={i.id}
              onClick={() => onChange(i.id)}
              aria-pressed={active}
              className="pk-focus rounded-md px-3 py-1.5 text-xs font-medium transition"
              style={
                active
                  ? { background: "var(--pk-band)", color: "var(--pk-on-band)" }
                  : { color: "var(--pk-text-muted)" }
              }
            >
              {indicatorLabel(i, locale)}
            </button>
          );
        })}
      </div>

      <p
        className="mt-2 text-xs leading-relaxed max-w-2xl"
        style={{ color: "var(--pk-text-muted)" }}
      >
        {locale === "ur" ? current.noteUr : current.noteEn}
      </p>
    </div>
  );
}
