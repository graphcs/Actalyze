"use client";

import { PkSidebar } from "./PkSidebar";
import { LanguageToggle } from "./LanguageToggle";

/**
 * Page shell for the Pakistan subtree.
 *
 * The US equivalent offsets content with `ml-64` against a `fixed left-0` sidebar —
 * two physical values in two files. Here both are logical (`ms-64`, `start-0`), so
 * the whole shell mirrors when the locale flips without any conditional logic.
 */
export function PkAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PkSidebar />
      <div className="ms-64 transition-all duration-300">
        <div className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 no-print">
          <div className="px-6 py-3 flex items-center justify-end">
            <LanguageToggle />
          </div>
        </div>
        <main className="text-zinc-900 dark:text-zinc-100">{children}</main>
      </div>
    </>
  );
}
