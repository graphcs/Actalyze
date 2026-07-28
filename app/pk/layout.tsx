import type { Metadata } from "next";
import { urduUi, urduProse } from "./fonts";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { PkDirection } from "./components/PkDirection";
import "./pk.css";

export const metadata: Metadata = {
  title: "Actalyze Pakistan — National Assembly Intelligence",
  description:
    "Constituency insight, constituent casework and parliamentary drafting for members and staff of the National Assembly of Pakistan.",
};

/**
 * The Pakistan subtree gets its own layout rather than the root one being made
 * locale-aware.
 *
 * Tailwind v4's `rtl:` variant compiles to `:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)`
 * — the descendant clause means a wrapper element carrying `dir="rtl"` is enough to
 * activate every RTL utility beneath it. The root `app/layout.tsx` keeps its
 * `lang="en"` and the US app is untouched, which is the point: the working product
 * carries no regression risk from this build.
 */
export default function PkLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider defaultLocale="ur">
      <PkDirection className={`${urduUi.variable} ${urduProse.variable}`}>
        {children}
      </PkDirection>
    </LocaleProvider>
  );
}
