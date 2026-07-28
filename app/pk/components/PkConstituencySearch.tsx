"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchConstituencies } from "@/lib/pk/constituencies";
import { toPkUrlSegment } from "@/lib/pk/constituency-code";
import { party } from "@/lib/pk/parties";
import { useT } from "../i18n/LocaleProvider";
import { Ltr } from "./Ltr";

/**
 * Constituency picker. Searches code, seat name, member name and district, so both
 * "NA-123" and "Shehbaz" and "Lahore" all land somewhere sensible — a demo audience
 * will type their own seat, or their own name.
 */
export function PkConstituencySearch() {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchConstituencies(query, 8), [query]);

  const go = (code: string) => router.push(`/pk/constituency/${toPkUrlSegment(code)}`);

  return (
    <div className="relative w-full max-w-2xl">
      <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].code);
        }}
        placeholder={t("home.searchPlaceholder")}
        className="w-full ps-12 pe-4 py-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-green-600"
      />

      {query && results.length > 0 && (
        <ul className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
          {results.map((c) => {
            const p = party(c.party);
            return (
              <li key={c.code}>
                <button
                  onClick={() => go(c.code)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  <span
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: c.vacant ? "#D1D5DB" : p.color }}
                  />
                  <span className="font-medium text-sm w-20 shrink-0">
                    <Ltr>{c.code}</Ltr>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{c.name ?? "—"}</span>
                    <span className="block text-xs text-zinc-500 truncate">
                      {c.vacant ? t("common.vacant") : c.memberName}
                    </span>
                  </span>
                  {!c.vacant && (
                    <span className="text-xs text-zinc-500 shrink-0">
                      <Ltr>{p.commonName}</Ltr>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
