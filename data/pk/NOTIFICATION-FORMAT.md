# The Punjab government notification format — as published

Grounded 2026-07-28 against real notifications issued by the Finance, Higher Education,
Agriculture, S&GAD, Home and School Education departments. Sources listed at the bottom.

## Why the sources are all scans, and why that matters commercially

**Every Punjab notification PDF found is a scan with no text layer.** `pdf-parse` extracts
2–8 characters from documents running to four pages. They are typed, printed, signed by
hand, stamped, and scanned back in.

That is not an obstacle to work around — it *is* the problem Waleed's client described.
The reason the text cannot be extracted is the same reason issuing one takes five to ten
staff and several days. Worth saying in the room: we know exactly what their current
pipeline looks like because we can see its fingerprints in their own published output.

(The format below therefore comes from Google's OCR of those scans, which is why each
element is quoted from a real document rather than reconstructed from memory.)

## Structure

```
                    GOVERNMENT OF THE PUNJAB
                  <DEPARTMENT NAME> DEPARTMENT
                   [Punjab Secretariat, Lahore]

                                   Dated Lahore, the <Nth Month, Year>

                          NOTIFICATION

No.SO(<Section>)<file>-<serial>/<year>.—  In exercise of the powers conferred by
<provision> of the <Act>, the Governor of the Punjab is pleased to <operative verb>…

2.   This notification shall come into force at once. [or: with effect from <date>]

                                          (<signature>)
                                          <NAME>
                                          SECTION OFFICER (<wing>)

Endst. No. & Date Even

A copy is forwarded for information and necessary action to:-

  1. …
  2. …
```

## The details that signal the document is real

**Reference number.** `SO(<section abbreviation>)<file>-<serial>/<year>`, sometimes with a
volume suffix. Observed verbatim:

- `NO. SO(Univ.)5-1/2018.Vol-III` — Higher Education
- `NO. SO (P-III) 3-10/2025-Ph.D.` — Agriculture
- `No.SO(CAB-I)2-9/2015` — Cabinet
- `No.SOR-III(S&GAD)` — Regulations wing, S&GAD
- `No. SOR-III-I-5/74` — S&GAD
- `Endst. No. FD(FR) 11-2/89(2016) (P-III)` — Finance

Note the section abbreviation is the *wing*, not the department, and the same wing appears
again in the signature block. `SO(CAB-I)` is signed by `SECTION OFFICER (CAB-I)`.

**The `.—` after the number.** A full stop then an em dash, running straight into the
operative text on the same line. This is the Pakistani statutory drafting convention and
is used in Acts, Ordinances and notifications alike. Getting it wrong is the fastest tell
that a document was produced by someone who has not read one.

**The opening.** `In exercise of the powers conferred by <provision> of the <Act>, the
Governor of the Punjab is pleased to …`. Where no statutory power is being exercised — a
transfer, an appointment — the notification opens directly with the operative sentence
instead.

**Commencement.** A numbered second paragraph: `It shall come into force at once` or
`with effect from <date>`.

**`Endst. No. & Date Even`.** The endorsement carrying the distribution list reuses the
notification's own number and date rather than taking new ones; `Even` means "the same".
An endorsement issued separately gets its own — `Endst, No. FD(FR) 11-2/89(2016) (P-III).
Dated: 26th December, 2017`. This is an internal convention that does not appear in any
style guide, and reproducing it correctly is the strongest single credibility signal in
the whole artefact.

**Distribution.** `A copy is forwarded for information and necessary action to:-` followed
by a numbered list. Recurring entries: `All Administrative Secretaries to Government of
the Punjab`, `All Heads of Attached Departments, Government of the Punjab`, `All Deputy
Commissioners`, the Accountant General, and the departmental website administrator.

**Dateline.** `Dated Lahore, the 25th April, 2022` — city, then `the`, then an ordinal
date. Not ISO, not `25/04/2022`.

## Sources

| Document | Department |
|---|---|
| `Notification No.FD.PC.40-58-2019(A)` dated 25 April 2022 | Finance |
| `NO. SO(Univ.)5-1/2018.Vol-III` dated 6 April 2022 | Higher Education |
| `NO. SO (P-III) 3-10/2025-Ph.D.` dated 16 July 2025 | Agriculture |
| `notification-no-62-of-2018` dated 26 March 2018 | S&GAD, via Punjab Laws |
| `Punjab SSOIU notification` | Home |
| `NO. SO (EAB)-Ferti-73(I-A)` | Essential Articles Board |

Re-verify before the demo: departments occasionally revise letterhead, and the wing
abbreviations change with restructuring.
