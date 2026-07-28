"use client";

import { useLocale } from "../i18n/LocaleProvider";

/**
 * Carries the `dir` attribute that every RTL utility beneath it keys off.
 *
 * This has to be a client component because the direction follows the locale, which
 * lives in client state so that toggling is instant and needs no navigation — a
 * detail that matters when someone is demoing the language switch live.
 */
export function PkDirection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { dir, locale } = useLocale();

  return (
    <div
      dir={dir}
      lang={locale}
      className={`pk-root min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
