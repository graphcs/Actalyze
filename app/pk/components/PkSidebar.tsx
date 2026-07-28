"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Home, MapPin, Map, TrendingUp, FileText, Inbox, MessageSquare, Library,
  HelpCircle, ChevronsLeft, Languages, X,
} from "lucide-react";
import { useLocale } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";
import { identity } from "./pk-identity-copy";
import { PkCrest } from "./PkCrest";

/**
 * A fork of the US sidebar rather than a parameterisation of it.
 *
 * The original is 461 lines carrying a hardcoded 50-state table, per-item copy-pasted
 * active-state ternaries, and ~15 literal `router.push` calls. Forking it costs less
 * than surgery on a file both apps would then share, and it lets this one be written
 * right-to-left from the start — logical properties (`ms-`, `start-`, `-end-`)
 * throughout rather than physical ones.
 *
 * ── The rail as identity ───────────────────────────────────────────────────────────
 *
 * The rail carries the deep flag green, `#01411C`. Doing it here rather than on the
 * landing page means every screen in the build — casework, drafting, the assistant —
 * is framed the same way, which is what makes it read as one institution's tool
 * rather than a themed home page bolted onto a generic product. The green is the
 * national one and dark enough not to be read as a party shade; see `pk.css` for why
 * that distinction is load-bearing here.
 */

/**
 * Navigation. One row per entry — add a route by adding a line, nothing else.
 * `MessageKey` keeps a label honest: a key with no Urdu translation fails the build.
 */
const NAV: Array<{ href: string; labelKey: MessageKey; Icon: typeof Home }> = [
  { href: "/pk", labelKey: "nav.home", Icon: Home },
  { href: "/pk/trending", labelKey: "nav.trending", Icon: TrendingUp },
  { href: "/pk/constituency/na-123", labelKey: "nav.constituencies", Icon: MapPin },
  { href: "/pk/province/pb", labelKey: "nav.provinces", Icon: Map },
  { href: "/pk/instruments", labelKey: "nav.instruments", Icon: FileText },
  // Sits next to drafting deliberately: Rule 78(j) bars a question already answered
  // in the current session or the two before it, so "has this been asked" is the
  // step immediately before filing, not a separate research errand.
  { href: "/pk/questions", labelKey: "questions.nav", Icon: HelpCircle },
  { href: "/pk/casework", labelKey: "nav.casework", Icon: Inbox },
  { href: "/pk/chat", labelKey: "nav.chat", Icon: MessageSquare },
  { href: "/pk/documents", labelKey: "nav.documents", Icon: Library },
];

/** `/pk` matches only itself; every other entry matches its subtree. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/pk") return pathname === "/pk";
  const section = href.split("/").slice(0, 3).join("/");
  return pathname.startsWith(section);
}

export function PkSidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
}: {
  /** Drawer state below `lg`. Above it the rail is always in place. */
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, toggle, locale } = useLocale();

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <>
      {/* Scrim, mobile only. Clicking it closes the drawer. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/45 lg:hidden transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        aria-label={t("nav.brand")}
        className={`pk-rail ${
          open ? "pk-rail-open" : ""
        } fixed start-0 top-0 h-full z-50 flex flex-col transition-[transform,width] duration-300 ${
          collapsed ? "lg:w-16" : "lg:w-64"
        } w-72`}
        style={{ backgroundColor: "var(--pk-band)", color: "var(--pk-on-band)" }}
      >
        {/* Masthead. The crest sits on the green at ivory, which is the one place a
            crescent-and-star is unambiguous and unmistakably not a flag. */}
        <div
          className="flex items-center gap-3 px-4 py-5"
          style={{ borderBottom: "1px solid var(--pk-on-band-line)" }}
        >
          <PkCrest className="w-8 h-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate leading-tight">{t("nav.brand")}</div>
              <div
                className="text-[11px] truncate leading-tight mt-0.5"
                style={{ color: "var(--pk-on-band-muted)" }}
              >
                {identity(locale, "eyebrow")}
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="lg:hidden pk-focus shrink-0 rounded-md p-1 hover:bg-white/10 transition"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map(({ href, labelKey, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <button
                key={href}
                onClick={() => go(href)}
                title={collapsed ? t(labelKey) : undefined}
                aria-current={active ? "page" : undefined}
                className={`pk-focus w-full flex items-center gap-3 px-4 py-2.5 text-sm text-start transition ${
                  active
                    ? "pk-nav-active font-semibold"
                    : "hover:bg-white/[0.07]"
                }`}
                style={
                  active
                    ? undefined
                    : { color: "var(--pk-on-band-muted)", borderInlineStart: "3px solid transparent" }
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{t(labelKey)}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 space-y-1" style={{ borderTop: "1px solid var(--pk-on-band-line)" }}>
          <button
            onClick={toggle}
            className="pk-focus w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm hover:bg-white/[0.07] transition"
            style={{ color: "var(--pk-on-band-muted)" }}
            title={t("nav.language")}
          >
            <Languages className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{locale === "ur" ? "English" : "اردو"}</span>}
          </button>
          <button
            onClick={onToggleCollapsed}
            className="pk-focus w-full hidden lg:flex items-center gap-3 px-2 py-2 rounded-lg text-sm hover:bg-white/[0.07] transition"
            style={{ color: "var(--pk-on-band-muted)" }}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            {/* Mirrored in RTL: the glyph encodes a direction, so flipping it is correct. */}
            <ChevronsLeft
              className={`w-4 h-4 shrink-0 rtl:-scale-x-100 transition-transform ${
                collapsed ? "rotate-180" : ""
              }`}
            />
            {!collapsed && <span>{t("nav.collapse")}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
