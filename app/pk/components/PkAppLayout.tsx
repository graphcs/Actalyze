"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { PkSidebar } from "./PkSidebar";
import { LanguageToggle } from "./LanguageToggle";
import { PkCrest } from "./PkCrest";
import { useLocale } from "../i18n/LocaleProvider";
import { identity } from "./pk-identity-copy";

/**
 * Page shell for the Pakistan subtree.
 *
 * The US equivalent offsets content with `ml-64` against a `fixed left-0` sidebar —
 * two physical values in two files. Here both are logical (`ms-64`, `start-0`), so
 * the whole shell mirrors when the locale flips without any conditional logic.
 *
 * ── Why the rail's state lives here ───────────────────────────────────────────────
 *
 * Both the collapsed width and the drawer belong to the *shell*, not the rail: the
 * content offset has to move with them. Previously the sidebar owned `collapsed`
 * privately while the layout hard-coded `ms-64`, so collapsing the rail left a
 * 256px gutter of nothing. Lifting it fixes that and gives the mobile drawer
 * somewhere to live.
 *
 * ── Mobile ────────────────────────────────────────────────────────────────────────
 *
 * Below `lg` the rail goes off-canvas and the content takes the full width. Without
 * this the fixed 256px rail left 134px of usable width at 390px and every page
 * scrolled sideways.
 */
export function PkAppLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { t, locale } = useLocale();

  // Close the drawer on navigation, or it stays open over the page it just opened.
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <>
      <PkSidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <div className={`transition-[margin] duration-300 ${collapsed ? "lg:ms-16" : "lg:ms-64"}`}>
        <header
          className="sticky top-0 z-30 backdrop-blur no-print"
          style={{
            backgroundColor: "color-mix(in srgb, var(--pk-paper) 86%, transparent)",
            borderBottom: "1px solid var(--pk-border)",
          }}
        >
          <div className="px-4 sm:px-6 py-2.5 flex items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="pk-focus lg:hidden -ms-1 rounded-md p-1.5 transition"
              style={{ color: "var(--pk-text-muted)" }}
              aria-label={identity(locale, "menu")}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* On mobile the rail is hidden, so the masthead has to appear here or the
                build loses its identity on the screen most people will actually see. */}
            <span className="lg:hidden flex items-center gap-2 min-w-0">
              <PkCrest className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold truncate">{t("nav.brand")}</span>
            </span>

            {/* Nothing here on desktop. The rail already carries the masthead and the
                landing page carries the eyebrow; a third copy of "National Assembly of
                Pakistan" in the same viewport is the kind of repetition that starts to
                look like insistence rather than identity. */}

            <div className="ms-auto shrink-0">
              <LanguageToggle />
            </div>
          </div>
        </header>

        <main style={{ color: "var(--pk-text)" }}>{children}</main>
      </div>
    </>
  );
}
