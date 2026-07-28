"use client";

/**
 * Section heading: a rule, a title, an optional note.
 *
 * One component so every section on the page indents, weighs and spaces identically —
 * the thing that actually reads as "designed" to an institutional audience is
 * repetition, not ornament.
 *
 * The leading rule is drawn with a logical border so it sits on the correct side in
 * both directions; `border-l` would strand it on the far side of the text in Urdu.
 */
export function PkSectionHeading({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="mb-5">
      <h2
        className="text-lg sm:text-xl font-semibold ps-3.5"
        style={{ borderInlineStart: "3px solid var(--pk-accent)" }}
      >
        {title}
      </h2>
      {note && (
        <p
          className="text-xs sm:text-[13px] mt-2 ps-3.5 max-w-3xl leading-relaxed"
          style={{ color: "var(--pk-text-muted)" }}
        >
          {note}
        </p>
      )}
    </div>
  );
}
