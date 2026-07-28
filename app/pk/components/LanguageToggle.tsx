"use client";

import { useLocale } from "../i18n/LocaleProvider";

/**
 * Switches the whole subtree between Urdu (RTL) and English (LTR).
 *
 * Deliberately instant and navigation-free: the dictionary is client-side, so the
 * layout mirrors in place. Watching an interface flip direction in one click is a
 * far better demonstration of the bilingual capability than a page reload.
 *
 * The control is a segmented switch rather than a dropdown so both languages are
 * visible at rest — in a bilingual institution, showing that Urdu is a first-class
 * option is part of the point, and a language hidden behind a menu does not say that.
 * The selected segment takes the institutional green, which is the only place a
 * filled colour appears in the chrome.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  const seg = (active: boolean) =>
    ({
      backgroundColor: active ? "var(--pk-band)" : "transparent",
      color: active ? "var(--pk-on-band)" : "var(--pk-text-muted)",
    }) as const;

  return (
    <div
      className="inline-flex items-center rounded-md p-0.5 text-xs"
      style={{
        border: "1px solid var(--pk-border)",
        backgroundColor: "var(--pk-surface)",
      }}
      role="group"
      aria-label="Language"
    >
      <button
        onClick={() => setLocale("ur")}
        aria-pressed={locale === "ur"}
        className="pk-focus px-3 py-1.5 rounded transition font-medium"
        style={seg(locale === "ur")}
      >
        اردو
      </button>
      <button
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className="pk-focus px-3 py-1.5 rounded transition font-medium"
        style={seg(locale === "en")}
      >
        English
      </button>
    </div>
  );
}
