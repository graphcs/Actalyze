import { Noto_Naskh_Arabic, Noto_Nastaliq_Urdu } from "next/font/google";

/**
 * Two Urdu faces, deliberately.
 *
 * Nastaliq is the script Urdu readers prefer, but it needs a line-height of roughly
 * 2.0–2.4 and has deep descenders that overlap at anything tighter. Applied to UI
 * chrome it destroys every fixed-height element in this app — badges, sidebar rows,
 * the sentiment bars, gauge tracks. It is also a multi-megabyte download.
 *
 * So: Naskh for interface text at normal leading, which is what Pakistani web
 * products and Google's own Urdu interfaces do, and Nastaliq reserved for long-form
 * prose (briefings, generated drafts, insight text) behind `.urdu-prose`.
 */

export const urduUi = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urdu",
  display: "swap",
});

export const urduProse = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-urdu-prose",
  display: "swap",
});
