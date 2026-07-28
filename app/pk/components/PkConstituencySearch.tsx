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
 *
 * The party colour appears here as a 3px rule at the leading edge of each row and
 * nowhere else. It is a data mark: it says which party holds the seat. It is
 * deliberately not a filled badge, because a filled PML-N green or PTI red repeated
 * down a list starts to look like the product's own colour scheme rather than the
 * data's, and this House is split enough that the distinction is worth the restraint.
 */
export function PkConstituencySearch({ tone = "light" }: { tone?: "light" | "band" }) {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchConstituencies(query, 8), [query]);

  const go = (code: string) => router.push(`/pk/constituency/${toPkUrlSegment(code)}`);

  return (
    <div className="relative w-full max-w-2xl">
      <Search
        className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
        style={{ color: "var(--pk-text-faint)" }}
      />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].code);
        }}
        placeholder={t("home.searchPlaceholder")}
        aria-label={t("common.search")}
        className="pk-focus w-full ps-12 pe-4 py-4 rounded-lg text-base"
        style={{
          backgroundColor: "var(--pk-surface)",
          color: "var(--pk-text)",
          border: "1px solid var(--pk-border-strong)",
          // Sitting on the green band, the field needs to read as a raised object
          // rather than a hole punched in the panel.
          boxShadow: tone === "band" ? "0 12px 28px -18px rgba(0,0,0,.55)" : "none",
        }}
      />

      {query && results.length > 0 && (
        <ul
          className="absolute z-20 mt-2 w-full rounded-lg overflow-hidden shadow-xl"
          style={{
            backgroundColor: "var(--pk-surface)",
            border: "1px solid var(--pk-border)",
            // Set explicitly, not inherited. This popover renders inside the masthead
            // band, whose colour is ivory-on-green; without this the seat code and the
            // seat name come out white on a white panel and only the two spans that
            // happen to carry their own colour survive.
            color: "var(--pk-text)",
          }}
        >
          {results.map((c) => {
            const p = party(c.party);
            return (
              <li key={c.code}>
                <button
                  onClick={() => go(c.code)}
                  className="pk-focus w-full flex items-center gap-3 px-4 py-3 text-start transition hover:bg-[var(--pk-surface-sunk)]"
                  style={{ borderInlineStart: `3px solid ${c.vacant ? "var(--pk-border-strong)" : p.color}` }}
                >
                  <span className="font-semibold text-sm w-20 shrink-0 pk-figure">
                    <Ltr>{c.code}</Ltr>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{c.name ?? "—"}</span>
                    <span
                      className="block text-xs truncate"
                      style={{ color: "var(--pk-text-muted)" }}
                    >
                      {c.vacant ? t("common.vacant") : c.memberName}
                    </span>
                  </span>
                  {!c.vacant && (
                    <span
                      className="text-xs shrink-0"
                      style={{ color: "var(--pk-text-muted)" }}
                    >
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
