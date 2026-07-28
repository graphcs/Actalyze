"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileText, Megaphone, MessageSquare, Smartphone, Image as ImageIcon,
  Printer, Copy, Check, Loader2, AlertTriangle, Download,
} from "lucide-react";
import { PkAppLayout } from "../../components/PkAppLayout";
import { PkSectionHeading } from "../../components/PkSectionHeading";
import { Ltr } from "../../components/Ltr";
import { useLocale } from "../../i18n/LocaleProvider";
import {
  COMMON_DISTRIBUTION, SMS_LIMIT, SOCIAL_LIMIT,
  type NoticeIntake, type RenderedNotice, type NoticeStage,
} from "@/lib/pk/notice";

/**
 * One instruction in, the whole apparatus out.
 *
 * The client's description of their current process was: several rounds of editing and
 * review, printing, signatures, and distribution through five to ten staff, with clerks
 * coming back for clarification. This page is that process compressed into one screen,
 * and it is deliberately laid out so a demo audience can watch it happen:
 *
 *   left   — the instruction, then the form the model filled in, which the officer corrects
 *   right  — all six artefacts, both languages, updating as the form changes
 *
 * The artefacts are not "generated" by a second button press. They are renderings of the
 * record, so there is no moment where the document and the SMS could disagree — which is
 * the failure the current process actually has.
 *
 * ── Printing ─────────────────────────────────────────────────────────────────────
 *
 * `window.print()` and a print stylesheet, following `app/pk/committees/[slug]/page.tsx`.
 * The three PDF libraries in package.json cannot shape Urdu: jsPDF has no Arabic font and
 * html2canvas rasterises the text away. The browser's own shaper renders Nastaliq
 * correctly and keeps the notification selectable, so what comes out is a document rather
 * than a picture of one — which matters when the thing being printed is signed.
 */

interface DraftResponse {
  intake: NoticeIntake;
  missing: string[];
  statutoryPowerFromModel: boolean;
  urduReviewed: boolean;
  reference: string;
  rendered: { en: RenderedNotice; ur: RenderedNotice };
  meta: { provider: string | null };
}

const EXAMPLES = [
  "Solar net metering application deadline extended to 31 March 2026",
  "All primary schools in Rajanpur district to remain closed on 14 August",
  "Motorcycle registration fee reduced from Rs 1,800 to Rs 1,200",
];

export default function PkNoticePage() {
  const { t, locale } = useLocale();
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<NoticeStage>("draft");
  const [copied, setCopied] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (overrides?: Partial<NoticeIntake>, text?: string) => {
      const instr = (text ?? instruction).trim();
      if (!instr) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/pk/comms/notice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction: instr, overrides }),
        });
        if (!res.ok) throw new Error(String(res.status));
        setDraft(await res.json());
      } catch {
        setError(t("notice.failed"));
      } finally {
        setLoading(false);
      }
    },
    [instruction, t]
  );

  /** Re-render from a corrected field. The officer's value always wins. */
  const patch = (field: keyof NoticeIntake, value: unknown) => {
    if (!draft) return;
    run({ ...draft.intake, [field]: value } as Partial<NoticeIntake>);
  };

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  };

  const r = draft?.rendered[locale === "ur" ? "ur" : "en"];

  return (
    <PkAppLayout>
      <div className="max-w-[1500px] mx-auto px-4 pt-10 pb-16">
        <PkSectionHeading title={t("notice.title")} note={t("notice.subtitle")} />

        <div className="grid gap-8 lg:grid-cols-2 mt-6">
          {/* ── Left: the instruction and the form ───────────────────────────── */}
          <div className="no-print space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">{t("notice.instruction")}</label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={3}
                placeholder={t("notice.placeholder")}
                className="pk-focus w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => run()}
                  disabled={loading || !instruction.trim()}
                  className="pk-focus inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                  style={{ background: "var(--pk-band)", color: "var(--pk-on-band)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {t("notice.prepare")}
                </button>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setInstruction(ex);
                      run(undefined, ex);
                    }}
                    className="pk-focus rounded-md px-2 py-1 text-xs"
                    style={{ border: "1px solid var(--pk-border)", color: "var(--pk-text-muted)" }}
                  >
                    {ex.slice(0, 42)}…
                  </button>
                ))}
              </div>
              {error && (
                <p className="mt-2 text-sm" style={{ color: "#b42318" }}>{error}</p>
              )}
            </div>

            {draft && (
              <>
                {/* What a clerk would otherwise send it back for. */}
                {draft.missing.length > 0 && (
                  <div
                    className="rounded-xl px-4 py-3 text-sm flex gap-3"
                    style={{ background: "var(--pk-surface-sunk)", border: "1px solid var(--pk-border-strong)" }}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#b54708" }} />
                    <div>
                      <div className="font-semibold">{t("notice.missingHeading")}</div>
                      <div style={{ color: "var(--pk-text-muted)" }}>
                        {draft.missing.map((m) => t(`notice.field.${m}` as never) || m).join(" · ")}
                      </div>
                    </div>
                  </div>
                )}

                {/*
                  The statutory power is called out on its own, whether the model supplied
                  one or left it blank. A notification citing a provision that does not
                  confer the power is void, so this is the one field the officer must put
                  their own eyes on either way.
                */}
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: "var(--pk-accent-soft)", border: "1px solid var(--pk-accent-line)" }}
                >
                  <div className="font-semibold mb-1">{t("notice.powerHeading")}</div>
                  <input
                    value={draft.intake.statutoryPower ?? ""}
                    onChange={(e) => patch("statutoryPower", e.target.value || undefined)}
                    placeholder={t("notice.powerPlaceholder")}
                    className="pk-focus w-full rounded-md px-2 py-1.5 text-sm"
                    style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}
                  />
                  <p className="mt-1.5 text-xs" style={{ color: "var(--pk-text-muted)" }}>
                    {draft.statutoryPowerFromModel ? t("notice.powerFromModel") : t("notice.powerConfirm")}
                  </p>
                </div>

                <Field label={t("notice.field.subject")} value={draft.intake.subject} onChange={(v) => patch("subject", v)} />
                <Field label={t("notice.field.effect")} value={draft.intake.effect} onChange={(v) => patch("effect", v)} textarea />
                <Field label={t("notice.field.appliesTo")} value={draft.intake.appliesTo} onChange={(v) => patch("appliesTo", v)} />

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("notice.field.department")} value={draft.intake.department} onChange={(v) => patch("department", v)} />
                  <Field label={t("notice.field.wing")} value={draft.intake.wing} onChange={(v) => patch("wing", v)} />
                  <Field label={t("notice.field.fileNumber")} value={draft.intake.fileNumber} onChange={(v) => patch("fileNumber", v)} />
                  <Field label={t("notice.field.serial")} value={draft.intake.serial} onChange={(v) => patch("serial", v)} />
                  <Field label={t("notice.field.signatoryName")} value={draft.intake.signatoryName} onChange={(v) => patch("signatoryName", v)} />
                  <Field
                    label={t("notice.field.effectiveFrom")}
                    value={draft.intake.effectiveFrom ?? ""}
                    onChange={(v) => patch("effectiveFrom", v || null)}
                    placeholder={t("notice.atOnce")}
                  />
                </div>

                <div>
                  <div className="text-xs font-medium mb-1.5">{t("notice.field.distribution")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_DISTRIBUTION.map((d) => {
                      const on = draft.intake.distribution.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() =>
                            patch(
                              "distribution",
                              on
                                ? draft.intake.distribution.filter((x) => x !== d)
                                : [...draft.intake.distribution, d]
                            )
                          }
                          className="pk-focus rounded-md px-2 py-1 text-xs text-start"
                          style={
                            on
                              ? { background: "var(--pk-band)", color: "var(--pk-on-band)" }
                              : { border: "1px solid var(--pk-border)", color: "var(--pk-text-muted)" }
                          }
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Approval trail. Nothing skips a step, and the label says "prepared",
                    not "issued" — this tool does not issue anything. */}
                <div>
                  <div className="text-xs font-medium mb-1.5">{t("notice.stage")}</div>
                  <div className="flex gap-1.5">
                    {(["draft", "reviewed", "approved", "issued"] as NoticeStage[]).map((s, idx, all) => {
                      const reached = all.indexOf(stage) >= idx;
                      const next = all.indexOf(stage) + 1 === idx;
                      return (
                        <button
                          key={s}
                          disabled={!reached && !next}
                          onClick={() => setStage(s)}
                          className="pk-focus flex-1 rounded-md px-2 py-1.5 text-xs disabled:opacity-40"
                          style={
                            reached
                              ? { background: "var(--pk-band)", color: "var(--pk-on-band)" }
                              : { border: "1px solid var(--pk-border)", color: "var(--pk-text-muted)" }
                          }
                        >
                          {t(`notice.stage.${s}` as never)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: "var(--pk-text-faint)" }}>
                    {t("notice.stageNote")}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Right: the six artefacts ─────────────────────────────────────── */}
          <div className="space-y-4">
            {!draft && (
              <div
                className="rounded-xl px-6 py-16 text-center text-sm"
                style={{ border: "1px dashed var(--pk-border-strong)", color: "var(--pk-text-muted)" }}
              >
                {t("notice.empty")}
              </div>
            )}

            {draft && r && (
              <>
                {!draft.urduReviewed && (
                  <div
                    className="no-print rounded-lg px-3 py-2 text-xs"
                    style={{ background: "var(--pk-surface-sunk)", border: "1px solid var(--pk-border)" }}
                  >
                    {t("notice.urduUnreviewed")}
                  </div>
                )}

                {/* The notification. Printable; everything else on the page is not. */}
                <Artefact
                  icon={FileText}
                  title={t("notice.artefact.notification")}
                  onCopy={() => copy("notification", r.notification)}
                  copied={copied === "notification"}
                  extra={
                    <button
                      onClick={() => window.print()}
                      className="pk-focus inline-flex items-center gap-1.5 text-xs"
                      style={{ color: "var(--pk-accent)" }}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {t("notice.print")}
                    </button>
                  }
                >
                  <div ref={printRef} className="pk-notice-print">
                    <pre className="whitespace-pre-wrap text-[13px] leading-relaxed font-serif m-0">
                      {r.notification}
                    </pre>
                  </div>
                </Artefact>

                <Artefact icon={Megaphone} title={t("notice.artefact.press")} onCopy={() => copy("press", r.pressRelease)} copied={copied === "press"}>
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed m-0">{r.pressRelease}</pre>
                </Artefact>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Artefact
                    icon={Smartphone}
                    title={t("notice.artefact.sms")}
                    badge={`${r.sms.length}/${SMS_LIMIT}`}
                    badgeWarn={r.sms.length > SMS_LIMIT}
                    onCopy={() => copy("sms", r.sms)}
                    copied={copied === "sms"}
                  >
                    <p className="text-xs leading-relaxed">{r.sms}</p>
                  </Artefact>

                  <Artefact
                    icon={MessageSquare}
                    title={t("notice.artefact.social")}
                    badge={`${r.socialPost.length}/${SOCIAL_LIMIT}`}
                    badgeWarn={r.socialPost.length > SOCIAL_LIMIT}
                    onCopy={() => copy("social", r.socialPost)}
                    copied={copied === "social"}
                  >
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed m-0">{r.socialPost}</pre>
                  </Artefact>
                </div>

                <Artefact icon={MessageSquare} title={t("notice.artefact.whatsapp")} onCopy={() => copy("wa", r.whatsapp)} copied={copied === "wa"}>
                  <pre className="whitespace-pre-wrap text-xs leading-relaxed m-0">{r.whatsapp}</pre>
                </Artefact>

                <Artefact icon={ImageIcon} title={t("notice.artefact.card")}>
                  <NoticeCard card={r.card} />
                </Artefact>

                <p className="no-print text-xs leading-relaxed" style={{ color: "var(--pk-text-faint)" }}>
                  {t("notice.doesNotSend")}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Only the notification prints. A press release and an SMS on the same sheet is
          not what anyone is trying to put in a file. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .pk-notice-print { padding: 2rem; }
          aside, nav, header { display: none !important; }
        }
      `}</style>
    </PkAppLayout>
  );
}

function Field({
  label, value, onChange, textarea, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  // Re-render only when the officer leaves the field — patching on every keystroke would
  // re-render six artefacts per character.
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onChange(local)}
          rows={3}
          className="pk-focus w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}
        />
      ) : (
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onChange(local)}
          placeholder={placeholder}
          className="pk-focus w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: "var(--pk-surface)", border: "1px solid var(--pk-border)" }}
        />
      )}
    </div>
  );
}

function Artefact({
  icon: Icon, title, children, onCopy, copied, badge, badgeWarn, extra,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  children: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
  badge?: string;
  badgeWarn?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--pk-border)" }}>
      <header
        className="no-print flex items-center gap-2 px-4 py-2"
        style={{ background: "var(--pk-surface-sunk)", borderBottom: "1px solid var(--pk-border)" }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--pk-accent)" }} />
        <span className="text-xs font-semibold flex-1">{title}</span>
        {badge && (
          <span
            className="pk-figure text-[11px] rounded px-1.5 py-0.5"
            style={badgeWarn ? { background: "#fef3f2", color: "#b42318" } : { color: "var(--pk-text-muted)" }}
          >
            <Ltr>{badge}</Ltr>
          </span>
        )}
        {extra}
        {onCopy && (
          <button onClick={onCopy} className="pk-focus inline-flex items-center gap-1 text-xs" style={{ color: "var(--pk-accent)" }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </header>
      <div className="px-4 py-3" style={{ background: "var(--pk-surface)" }}>{children}</div>
    </section>
  );
}

/** 1200×675, rendered as DOM at 16:9 so the browser shapes the Urdu correctly. */
function NoticeCard({ card }: { card: RenderedNotice["card"] }) {
  return (
    <div
      className="w-full rounded-lg overflow-hidden flex flex-col justify-between p-6"
      style={{ aspectRatio: "1200 / 675", background: "var(--pk-band)", color: "var(--pk-on-band)" }}
    >
      <div className="text-[11px] opacity-80">{card.eyebrow}</div>
      <div className="text-xl sm:text-2xl font-semibold leading-snug">{card.headline}</div>
      <div className="flex items-end justify-between gap-3 text-[11px]">
        <span className="opacity-90">{card.detail}</span>
        <span className="opacity-70 pk-figure"><Ltr>{card.reference}</Ltr></span>
      </div>
    </div>
  );
}
