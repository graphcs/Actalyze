# Pakistan build — Day 0 de-risk results

Run 2026-07-27. These were the assumptions that could have sunk the week; all four
are now settled with live evidence. Two of them change the implementation.

## 1. SerpAPI works for Pakistan — but the engine choice matters

`gl=pk` returns genuinely Pakistani coverage. A national query returned 100 results
from Dawn, Express Tribune, Arab News PK, Radio Pakistan and Business Recorder.

**The finding that changes the build: `engine=google_news` returns ZERO snippets for
Pakistan.** Measured 0/100, 0/42 and 0/43 across three queries. Snippets are where
numbers live, so the grounded-polling extractor — which retrieves, extracts a figure,
then re-verifies that figure against the article text — cannot work on that engine.

`engine=google&tbm=nws` **does** carry them: 10/10 snippets, with real figures
("14 per cent of the respondents in Punjab", "30 percent of respondents nationwide")
and real constituency coverage (NA-121, NA-126 Lahore).

So:

| Use | Engine |
|---|---|
| Headlines / news cards | `engine=google_news` (fine, no snippet needed) |
| Polling extraction, anything parsing figures | `engine=google&tbm=nws` — **required** |

The existing US polling route already uses `tbm=nws`, so that pattern ports directly.

## 2. Urdu retrieval is thinner and mixed — lead with English

`hl=ur` returned 42 results vs 100 for `hl=en`, and the results were **mixed
language**: mostly English headlines from Express Tribune with some genuine Urdu from
Geo News.

Decision: retrieve with `hl=en` as the primary path and treat Urdu results as
additive. The Urdu *interface* is unaffected — this is only about which headlines the
retrieval layer surfaces. Do not block on Urdu news coverage.

## 3. Google Trends has a Politics category for `geo=PK`

52 trending items with categories: Sports(14), Other(12), Entertainment(9),
Business and Finance(6), Law and Government(6), **Politics(5)**, Games(3).

The existing `category === 'politics'` filter in `src/trending/serpapi.ts` will work,
but 5 items is thin — **also accept `Law and Government`**, which is where items like
"ajk elections" landed. Sample queries confirmed real political content.

## 4. India contamination is much lower than feared

The worry was that shared place names (Punjab, Hyderabad, Gujrat/Gujarat) would pull
Indian coverage into constituency feeds. Tested with the worst-case query — "Punjab
assembly budget" — and got **8/8 Pakistani results**: Express Tribune, Dawn, APP,
The Nation, Business Recorder.

`gl=pk` is doing most of the work by itself. Still build the exclusion filter as
defence, but it is not the critical path it was assumed to be.

One nuance for the filter design: a Lahore query surfaced an **NDTV** story that was
genuinely about Pakistan. So filter on *Indian subject matter*
(`Modi|BJP|Lok Sabha|Ayushman|Yojana|crore|Amritsar|Chandigarh`), **not** on Indian
outlets — a domain allowlist plus a topic blocklist, not an outlet blocklist.

## 5. The member roster scraped cleanly

`scripts/pk/scrape-na-members.mjs` → `constituencies.json` + `members.json`.

**333 of 336 seats**, zero warnings: 263 general (of 266), 60 women-reserved,
10 minority-reserved. Vacant: **NA-1, NA-175, NA-256** — the app must say "vacant"
rather than 404 or invent a member.

Party totals match an independent verification exactly:

| Party | Seats | | Party | Seats |
|---|---|---|---|---|
| PML-N | 132 | | PML-Q | 5 |
| Independent | 79 | | IPP | 4 |
| PPP | 74 | | MWM / SIC / PML-Z / PKNAP / BAP / NP / PkMAP | 1 each |
| MQM-P | 22 | | | |
| JUI-F | 10 | | | |

Note **PML-N is 132, not the 125 figure quoted earlier** — treat the scrape as source
of truth and re-run it the morning of the demo.

Corrections applied in the scraper rather than downstream:

- na.gov.pk labels **both NA-47 and NA-48 as "ICT-II"**. NA-48 is overridden to
  ICT-III and flagged `nameOverridden: true`.
- **`PML` on na.gov.pk means PML-Q**, not PML-N; **`JUI (P)`** is the party everyone
  calls JUI-F. Both official and common names are stored.
- Reserved-seat members get `constituency: null` — they are allocated by proportional
  representation from party lists and have no geography at all.
- 20 seats are multi-district (`-cum-`) and are parsed into district arrays, e.g.
  `NA-12 Kohistan-cum-Lower Kohistan-cum-Kolai Pallas` → three districts.

### Incidental confirmation that the old boundary data would have been fatal

The scrape shows **NA-36 = Hangu-cum-Orakzai (KP)**. In the HDX "constituency
boundaries" dataset — the one that looked like the obvious source — NA-36 is
`MOHAMDAN AGENCY, Province: FATA`, an administrative unit that no longer exists.
Confirms the decision to use OCHA COD-AB district polygons plus a seat cartogram
instead.
