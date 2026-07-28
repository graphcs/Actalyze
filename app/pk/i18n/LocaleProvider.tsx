"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICTIONARIES, en, type Locale, type MessageKey } from "./dictionary";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
  /** Translate. Falls back to English, then to the key — never to a blank. */
  t: (key: MessageKey) => string;
  dir: "rtl" | "ltr";
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "actalyze_pk_locale";

export function LocaleProvider({
  children,
  defaultLocale = "ur",
}: {
  children: React.ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // Read the stored preference after mount rather than during render: the server
  // renders the default, so reading localStorage in a useState initialiser would
  // produce a hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "ur" || stored === "en") setLocaleState(stored);
    } catch {
      // Private browsing or blocked storage — the default is fine.
    }
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* non-fatal */
    }
  };

  const value = useMemo<LocaleContextValue>(() => {
    const dict = DICTIONARIES[locale];
    return {
      locale,
      setLocale,
      toggle: () => setLocale(locale === "ur" ? "en" : "ur"),
      t: (key) => dict[key] ?? en[key] ?? key,
      dir: locale === "ur" ? "rtl" : "ltr",
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside a LocaleProvider");
  return ctx;
}

/** Convenience for the common case of only needing the translate function. */
export function useT(): (key: MessageKey) => string {
  return useLocale().t;
}
