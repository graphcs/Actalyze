"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Home, MapPin, Map, TrendingUp, FileText, Inbox, MessageSquare, Library,
  ChevronsLeft, Languages,
} from "lucide-react";
import { useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import type { MessageKey } from "../i18n/dictionary";

/**
 * A fork of the US sidebar rather than a parameterisation of it.
 *
 * The original is 461 lines carrying a hardcoded 50-state table, per-item copy-pasted
 * active-state ternaries, and ~15 literal `router.push` calls. Forking it costs less
 * than surgery on a file both apps would then share, and it lets this one be written
 * right-to-left from the start — logical properties (`ms-`, `start-`, `-end-`)
 * throughout rather than physical ones.
 */

const NAV: Array<{ href: string; labelKey: MessageKey; Icon: typeof Home }> = [
  { href: "/pk", labelKey: "nav.home", Icon: Home },
  { href: "/pk/trending", labelKey: "nav.trending", Icon: TrendingUp },
  { href: "/pk/constituency/na-123", labelKey: "nav.constituencies", Icon: MapPin },
  { href: "/pk/province/pb", labelKey: "nav.provinces", Icon: Map },
  { href: "/pk/instruments", labelKey: "nav.instruments", Icon: FileText },
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

export function PkSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, toggle, locale } = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed start-0 top-0 h-full z-40 flex flex-col border-e border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-green-700 text-white grid place-items-center font-bold shrink-0">
          ع
        </div>
        {!collapsed && (
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {t("nav.brand")}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map(({ href, labelKey, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              title={collapsed ? t(labelKey) : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-start transition ${
                active
                  ? "bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 font-medium border-e-2 border-green-700"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{t(labelKey)}</span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-1">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
          title={t("nav.language")}
        >
          <Languages className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{locale === "ur" ? "English" : "اردو"}</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
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
  );
}
