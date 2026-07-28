"use client";

/**
 * Isolate left-to-right content inside right-to-left text.
 *
 * Strings that mix Urdu with Latin letters or digits — "NA-247 میں", "PML-N 45%",
 * "n=32 پوسٹس" — get visually reordered by the Unicode bidirectional algorithm, so a
 * constituency code can render as "247-NA". This is the single most common reason an
 * RTL interface looks broken to a native reader, and it is invisible to anyone
 * reading in English.
 *
 * Wrap every constituency code, percentage, party abbreviation, sample size, date and
 * Latin proper noun that appears inside Urdu prose. `<bdi>` does exactly this job:
 * it isolates its contents from the surrounding bidi context.
 *
 *   <Ltr>{constituency.code}</Ltr>
 *   <Ltr>{`${share}%`}</Ltr>
 */
export function Ltr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}

/**
 * Numbers formatted with Western digits (0-9), which are what Pakistani media and
 * government publications use. Explicitly not the Eastern Arabic-Indic set: mixing
 * numeral systems breaks chart axes, sorting and every regex in the codebase.
 */
export function LtrNumber({
  value,
  suffix,
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={className}>
      {value.toLocaleString("en-US")}
      {suffix}
    </bdi>
  );
}
