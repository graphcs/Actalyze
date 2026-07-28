"use client";

import { useLocale } from "../i18n/LocaleProvider";

/**
 * Switches the whole subtree between Urdu (RTL) and English (LTR).
 *
 * Deliberately instant and navigation-free: the dictionary is client-side, so the
 * layout mirrors in place. Watching an interface flip direction in one click is a
 * far better demonstration of the bilingual capability than a page reload.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-xs"
      role="group"
      aria-label="Language"
    >
      <button
        onClick={() => setLocale("ur")}
        aria-pressed={locale === "ur"}
        className={`px-3 py-1.5 rounded-md transition ${
          locale === "ur"
            ? "bg-green-700 text-white font-medium"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
      >
        اردو
      </button>
      <button
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`px-3 py-1.5 rounded-md transition ${
          locale === "en"
            ? "bg-green-700 text-white font-medium"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
      >
        English
      </button>
    </div>
  );
}
