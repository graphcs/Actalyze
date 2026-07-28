"use client";

/**
 * The crescent-and-star mark, and the roundel seal built from it.
 *
 * ── What this is, and what it deliberately is not ─────────────────────────────────
 *
 * It is a self-authored crescent and five-pointed star, drawn from solved geometry
 * (`public/pk/crescent-star.svg`): an outer disc with an offset inner disc removed,
 * the limb thickness and the angle of the opening chosen rather than eyeballed, and
 * the star seated in the bay. Canted so the opening faces the upper leading corner,
 * which is how the emblem is set on the flag.
 *
 * It is **not** the flag. There is no green-and-white rectangle, no hoist band, no
 * 3:2 field. Pakistan's Flag Code governs how the national flag may be displayed and
 * the safest way to honour it in software is not to reproduce it: use flag-derived
 * colour, which is always permitted, and an emblem that cannot be cropped or
 * stretched into a defaced flag because it was never a flag to begin with. A circular
 * seal reads unambiguously as an emblem.
 *
 * It is also **not** the National Assembly's own crest. That is official insignia
 * belonging to the Secretariat; a vendor putting it on a product implies an
 * endorsement nobody has given.
 *
 * Rendered as a CSS mask over `currentColor`, so one asset serves white-on-green in
 * the rail, deep green on paper, and the lighter tint in dark mode.
 */

/** The bare mark. Size it with width/height utilities at the call site. */
export function PkCrest({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`pk-mask pk-mask-crest block ${className}`} />;
}

/** The mark inside a double-ruled roundel — used large, as a watermark. */
export function PkSeal({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`pk-mask pk-mask-seal block ${className}`} />;
}

/**
 * The repeating jali lattice, as a masked layer.
 *
 * Islamic geometric patterning is a rich and genuinely local idiom — this is the
 * eight-fold khatam of Mughal screen work — and unlike national symbolism it carries
 * no protocol risk at all. Kept to a few per cent opacity so it is texture behind
 * text, never pattern competing with it.
 */
export function PkGirih({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`pk-girih block ${className}`} />;
}
