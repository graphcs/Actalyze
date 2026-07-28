# Day 0 — provincial build, source verification

Probed 2026-07-28. Everything below was checked against the live source, not assumed.

## Boundaries — CONFIRMED, this is the centrepiece dependency

**HDX COD-AB "Pakistan - Subnational Administrative Boundaries"**, updated 2026-01-26,
**CC BY-IGO (commercially usable)**.

| Layer | Features | Size |
|---|---|---|
| `pak_admin1.geojson` | 7 provinces | 836 KB |
| `pak_admin2.geojson` | **160 districts** | 11 MB |
| `pak_admin3.geojson` | 577 tehsils | 20 MB |

Districts per province: **Punjab 36, Sindh 29, KP 35, Balochistan 35, Islamabad 1**
(plus Azad Kashmir 10, Gilgit Baltistan 14 — separate assemblies, out of scope).

Useful properties: `adm2_name`, `adm2_pcode`, `adm1_name`, `area_sqkm`, `center_lat`,
`center_lon`. Centroids are precomputed, so no need to derive them.

## The seat → district join — WORKS, 37 aliases needed

`data/pk/constituencies.json` already carries `districts[]` for all 263 filled NA seats.
Against COD-AB `adm2_name`, normalised (lowercase, strip `.`/`'`, collapse spaces and
hyphens): **105 of 142 distinct district names match exactly, 37 do not.** Every one of
the 37 resolves. They fall into three groups, and the third is the one that needs a
caption rather than a lookup:

1. **Spelling variants** — `D.G.Khan`→`Dera Ghazi Khan`, `Gawadar`→`Gwadar`,
   `Layyah`→`Leiah`, `Battagram`→`Batagram`, `Umerkot`→`Umer Kot`,
   `Naushero Feroze`→`Naushahro Feroze`, `Musa Khail`→`Musakhel`, and so on.
2. **Word order** — the Karachi districts invert: `Karachi Central`→`Central Karachi`,
   `Malir`→`Malir Karachi`.
3. **Districts newer than COD-AB's vintage, which have no polygon of their own** and
   must be drawn as part of the parent they were carved from: `Kot Addu`→Muzaffargarh,
   `Talagang`→Chakwal, `Taunsa`→Dera Ghazi Khan, `Murree`→Rawalpindi,
   `Wazirabad`→Gujranwala, `Karachi Keamari`→West Karachi, `Hub`→Lasbela,
   `Usta Muhammad`→Jaffarabad, `Surab`→Kalat.

Group 3 is an approximation and the map must say so where it applies. Group 1 and 2 are
pure lookups and carry no loss.

## Provincial assembly rosters — all four obtainable

| Assembly | Source | Found |
|---|---|---|
| **KP** (`PK`, 115) | `pakp.gov.pk/members/` | **120 codes on one page** — same shape as `na.gov.pk` |
| **Balochistan** (`PB`, 51) | `pabalochistan.gov.pk/list-members` | **50 codes on one page** |
| **Sindh** (`PS`, 130) | `pas.gov.pk/assembly-members-directory` | **78 codes on page 1 — paginated**, needs paging |
| **Punjab** (`PP`, 297) | `pap.gov.pk` **DOWN** | DNS resolves to 103.226.217.162, both :80 and :443 time out. Same signature as the FSC site. Fall back to Wikipedia's *List of members of the 18th Provincial Assembly of the Punjab* and the Wayback capture of 2025-09-03, both labelled with vintage. |

## Indicators — 2017 census, and a pcode trap worth knowing about

**HDX COD-PS `pak_admpop_adm2_v2.csv`** — 131 districts with `T_TL` (total), `U_TL`
(urban), `R_TL` (rural), `M_TL`, `F_TL`, `TG_TL`. Official, but **reference year 2017**.

**Join by name, never by pcode.** The two HDX datasets use incompatible province codes:
`PK2` is **Khyber Pakhtunkhwa** in the population CSV and **Balochistan** in COD-AB. A
pcode join would file KP's population under Balochistan and look entirely plausible.
HDX flags the incompatibility in the dataset notes; this confirms it concretely.

Four honest indicators come out of this plus COD-AB's `area_sqkm`:
population, **urban share** (`U_TL/T_TL`), **sex ratio** (`M_TL/F_TL`), and **density**
(`T_TL/area_sqkm`). All computed from official data; all labelled **Census 2017**.

**2023 census — not obtained.** `census23.pbos.gov.pk/Analysis/DistrictWise` exists and
answers 200, but renders through a JS layer with no discoverable data endpoint in
`Charts.js`; the district tables are not reachable without reverse-engineering the POST
it makes. PBS also publishes *Provincial Census Report 2023* PDFs per province and a
*District Census Report 2023* for Islamabad only. Treat 2023 district tables as a
follow-up, not a Day-1 dependency — and until then label every population figure 2017,
because a Chief Minister knows the 2023 numbers.

**ASER Pakistan** returns 401 to non-browser clients. Not available this week.

## Consequences for the plan

- The drill-down map is unblocked and can be built against real, licensed geometry.
- The indicator picker ships with four real indicators rather than the education and
  health series originally hoped for. That is thinner than planned but honest, and the
  page must not pad it with anything unsourced.
- Punjab's roster comes from a secondary source with a visible date. Everything else is
  first-party.
