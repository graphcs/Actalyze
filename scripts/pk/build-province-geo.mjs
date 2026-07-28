#!/usr/bin/env node
/**
 * Turn OCHA's COD-AB download into per-province district polygons the browser can hold.
 *
 * Source: HDX "Pakistan - Subnational Administrative Boundaries", CC BY-IGO, so it is
 * commercially usable — which is not true of most boundary data for Pakistan and is the
 * reason this dataset was chosen over anything prettier.
 *
 * The raw district layer is 11 MB. Shipping that to a browser to draw a map two inches
 * wide is absurd, and on a conference-centre connection it is the difference between a
 * demo and an apology. Each province is therefore simplified and written out on its own,
 * so a page loads only the province it is showing.
 *
 * ── Why Visvalingam and not the default ───────────────────────────────────────────
 *
 * Douglas-Peucker keeps points by distance from a chord, which preserves spikes and
 * eats gentle curves — on a river boundary like the Indus it produces visible zigzag.
 * Visvalingam ranks points by the area of the triangle they form with their neighbours,
 * which is what mapshaper's `weighted` variant applies, and it degrades far more
 * gracefully at the compression we need here.
 *
 * `-clean` first, because COD-AB has slivers where districts were re-cut, and
 * simplifying an unclean topology opens gaps between neighbours that show as white
 * cracks on a dark background.
 *
 * Usage:  node scripts/pk/build-province-geo.mjs
 * Input:  .pk-geo-cache/pak_admin{1,2}.geojson   (re-fetchable; see the findings doc)
 * Output: public/pk/geo/<province>.json
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CACHE = '.pk-geo-cache';
const OUT_DIR = 'public/pk/geo';
const ADM2 = join(CACHE, 'pak_admin2.geojson');
const POP = join(CACHE, 'pak_admpop_adm2.csv');

/**
 * Simplification is per-province rather than global because the provinces differ by two
 * orders of magnitude in polygon complexity. Balochistan is enormous and smooth;
 * Punjab's canal-country districts are intricate and small. One percentage for both
 * either bloats Balochistan or shreds Lahore.
 */
const PROVINCES = [
  { codab: 'Punjab', slug: 'punjab', keep: '6%' },
  { codab: 'Sindh', slug: 'sindh', keep: '6%' },
  { codab: 'Khyber Pakhtunkhwa', slug: 'kp', keep: '5%' },
  { codab: 'Balochistan', slug: 'balochistan', keep: '3.5%' },
  { codab: 'Islamabad', slug: 'ict', keep: '25%' },
];

if (!existsSync(ADM2)) {
  console.error(`Missing ${ADM2}. Re-download COD-AB first — see data/pk/DAY0-PROVINCIAL-FINDINGS.md`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

/**
 * The 2017 census names its districts differently from the 2026 boundary file, and in
 * places counts them differently too. Three distinct situations, kept apart because
 * only the first is lossless:
 *
 *   1. **Spelling** — `Layyah`/`Leiah`, `Las Bela`/`Lasbela`. Same district, joined.
 *   2. **Split since 2017** — Chitral became Chitral Lower and Upper in 2018; Kohistan
 *      became three. The census has one figure for the parent and there is no honest
 *      way to divide it between the children, so both children are left without a
 *      figure and told why. Apportioning by area would be an invention, and inventing
 *      a population for a district is precisely the kind of thing this product exists
 *      to not do.
 *   3. **Newer than the census** — Duki, Chaman, Shaheed Sikandarabad. No figure exists.
 *
 * Karachi is its own case: the source reports the whole city as one row, so the six
 * Karachi districts carry no separate figure. That is a real limitation of the 2017
 * release rather than a join failure, and it is stated on the map.
 */
const POP_ALIASES = {
  'layyah': 'Leiah',
  'las bela': 'Lasbela',
  'sheerani': 'Sherani',
  'qambar shahdadkot': 'Kambar Shahdad Kot',
  'shaheed benazirabad': 'Shaheed Benazir Abad',
  'tando allah yar': 'Tando Allahyar',
  'umerkot': 'Umer Kot',
  'dera ismail khan': 'D. I. Khan',
  'malakand pa': 'Malakand',
};

/** Why a district has no figure. Rendered instead of a blank, so a gap reads as known. */
const POP_ABSENT = {
  'Chitral Lower': 'split from Chitral after the 2017 census',
  'Chitral Upper': 'split from Chitral after the 2017 census',
  'Kohistan Lower': 'split from Kohistan after the 2017 census',
  'Kohistan Upper': 'split from Kohistan after the 2017 census',
  'Kolai Palas Kohistan': 'split from Kohistan after the 2017 census',
  'Duki': 'district created after the 2017 census',
  'Chaman': 'district created after the 2017 census',
  'Shaheed Sikandarabad': 'district created after the 2017 census',
  'Central Karachi': 'counted only as part of Karachi City in the 2017 census',
  'East Karachi': 'counted only as part of Karachi City in the 2017 census',
  'South Karachi': 'counted only as part of Karachi City in the 2017 census',
  'West Karachi': 'counted only as part of Karachi City in the 2017 census',
  'Korangi Karachi': 'counted only as part of Karachi City in the 2017 census',
  'Malir Karachi': 'counted only as part of Karachi City in the 2017 census',
};

/** 2017 census district population, joined BY NAME. See below for why not by pcode. */
function loadPopulation() {
  if (!existsSync(POP)) {
    console.warn('  ! no population CSV; districts will carry geometry only');
    return new Map();
  }
  const rows = readFileSync(POP, 'utf8').split('\n').filter(Boolean);
  const head = rows[0].replace(/^﻿/, '').split(',');
  const idx = (n) => head.indexOf(n);
  const map = new Map();
  for (const line of rows.slice(1)) {
    // No embedded commas in this file's name column; verified against the source.
    const c = line.split(',');
    const raw = c[idx('admin2Name_en')]?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
    // Alias to the boundary file's spelling where the two disagree about the same place.
    const name = POP_ALIASES[key] ?? raw;
    map.set(name.toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim(), {
      total: Number(c[idx('T_TL')]) || null,
      urban: Number(c[idx('U_TL')]) || null,
      rural: Number(c[idx('R_TL')]) || null,
      male: Number(c[idx('M_TL')]) || null,
      female: Number(c[idx('F_TL')]) || null,
    });
  }
  return map;
}

const population = loadPopulation();
console.log(`Population rows: ${population.size} (Census 2017)`);

const summary = [];

for (const prov of PROVINCES) {
  const tmp = join(CACHE, `_tmp_${prov.slug}.json`);

  // mapshaper's filter runs against the source properties, so the province split and the
  // simplification happen in one pass over the 11 MB file.
  execFileSync(
    'npx',
    [
      '--yes', 'mapshaper',
      ADM2,
      '-filter', `adm1_name === '${prov.codab}'`,
      '-clean',
      // Each token separate: execFile does not word-split, so `weighted 6%` as one
      // argument reaches mapshaper as a single unparseable string.
      '-simplify', 'weighted', prov.keep, 'keep-shapes',
      // Everything the map needs and nothing it does not: the raw file carries four
      // name variants per level plus validity dates, which is most of its weight.
      '-filter-fields', 'adm2_name,adm2_pcode,area_sqkm,center_lat,center_lon',
      '-o', tmp, 'format=geojson', 'precision=0.0001',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const fc = JSON.parse(readFileSync(tmp, 'utf8'));

  /**
   * Attach population here rather than at request time so the page has no join to do.
   *
   * BY NAME, NEVER BY PCODE. The two HDX datasets disagree: `PK2` is Khyber
   * Pakhtunkhwa in the population file and Balochistan in COD-AB. A pcode join
   * produces a complete, plausible-looking map with two provinces' populations
   * swapped — see data/pk/DAY0-PROVINCIAL-FINDINGS.md.
   */
  let matched = 0;
  for (const f of fc.features) {
    const p = f.properties;
    const key = String(p.adm2_name).toLowerCase().replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim();
    const pop = population.get(key);
    if (pop) {
      matched++;
      p.pop_total = pop.total;
      p.pop_urban = pop.urban;
      p.pop_male = pop.male;
      p.pop_female = pop.female;
      // Derived here so every consumer computes them the same way, and rounded to the
      // precision the source actually supports — a density to four decimals from a
      // simplified polygon area would be false precision.
      p.density = pop.total && p.area_sqkm ? Math.round(pop.total / p.area_sqkm) : null;
      p.urban_share = pop.total && pop.urban ? Math.round((pop.urban / pop.total) * 1000) / 10 : null;
      p.sex_ratio = pop.male && pop.female ? Math.round((pop.male / pop.female) * 1000) / 10 : null;
    } else {
      p.pop_total = null;
      p.density = null;
      p.urban_share = null;
      p.sex_ratio = null;
      // A named reason, so the map can say "created after the 2017 census" rather than
      // leaving a blank the reader has to interpret as either missing or zero.
      p.pop_absent = POP_ABSENT[p.adm2_name] ?? 'no district figure in the 2017 census release';
    }
  }

  const outPath = join(OUT_DIR, `${prov.slug}.json`);
  writeFileSync(outPath, JSON.stringify(fc));
  rmSync(tmp, { force: true });

  const kb = Math.round(readFileSync(outPath).length / 1024);
  summary.push({ province: prov.codab, districts: fc.features.length, matched, kb });
  console.log(`  ${prov.codab.padEnd(20)} ${String(fc.features.length).padStart(3)} districts  ${String(matched).padStart(3)} with population  ${String(kb).padStart(4)} KB`);
}

writeFileSync(
  join(OUT_DIR, 'manifest.json'),
  JSON.stringify(
    {
      source: 'OCHA COD-AB, Pakistan Subnational Administrative Boundaries',
      sourceUrl: 'https://data.humdata.org/dataset/cod-ab-pak',
      licence: 'CC BY-IGO',
      boundaryVintage: '2026-01-26',
      populationSource: 'HDX COD-PS, Pakistan Subnational Population Statistics',
      populationVintage: 'Census 2017',
      builtBy: 'scripts/pk/build-province-geo.mjs',
      provinces: summary,
    },
    null,
    2
  )
);

console.log('\nWrote', OUT_DIR + '/manifest.json');
