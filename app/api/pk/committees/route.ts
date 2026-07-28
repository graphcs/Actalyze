import { NextRequest, NextResponse } from 'next/server';
import {
  PK_COMMITTEE_META,
  blocBreakdown,
  getCommittee,
  listCommittees,
  partyBreakdown,
  searchCommittees,
  type PkCommittee,
  type PkCommitteeKind,
} from '@/lib/pk/committees';

/**
 * Committee catalogue and composition.
 *
 * Pure local data — `data/pk/committees.json`, scraped from na.gov.pk and joined to
 * the member roster. No search spend, no LLM, no network: this route is the part of
 * the oversight pack that must render even when SerpAPI is out of quota and the
 * document library is unreachable, because composition is the thing a committee
 * secretary is checking against.
 *
 *   GET /api/pk/committees                     → the whole catalogue, summarised
 *   GET /api/pk/committees?kind=standing       → one class of committee
 *   GET /api/pk/committees?q=finance           → search
 *   GET /api/pk/committees?slug=finance-and-revenue → one committee, in full
 */

const KINDS: PkCommitteeKind[] = ['standing', 'special', 'parliamentary', 'other'];

function summarise(c: PkCommittee) {
  const parties = partyBreakdown(c);
  return {
    slug: c.slug,
    name: c.name,
    nameOfficial: c.nameOfficial,
    kind: c.kind,
    compositionClass: c.compositionClass,
    chairName: c.chairName,
    chairVacant: c.chairVacant,
    chairUid: c.chairUid,
    memberCount: c.members.length,
    senatorCount: c.senators.length,
    parties: parties.slice(0, 4),
    blocs: blocBreakdown(c),
    reportCount: c.reports.length,
    latestReport: c.reports[0] ?? null,
    nextMeeting: c.meetings[0] ?? null,
    sourceUrl: c.sourceUrl,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const slug = params.get('slug');
  const q = params.get('q');
  const kindParam = params.get('kind');

  if (slug) {
    const committee = getCommittee(slug);
    if (!committee) {
      return NextResponse.json({ error: `No committee "${slug}"` }, { status: 404 });
    }
    return NextResponse.json({
      committee,
      parties: partyBreakdown(committee),
      blocs: blocBreakdown(committee),
      meta: PK_COMMITTEE_META,
    });
  }

  if (kindParam && !KINDS.includes(kindParam as PkCommitteeKind)) {
    return NextResponse.json(
      { error: `kind must be one of ${KINDS.join(', ')}` },
      { status: 400 }
    );
  }

  const base = q
    ? searchCommittees(q, 50)
    : listCommittees(kindParam ? (kindParam as PkCommitteeKind) : undefined);

  return NextResponse.json({
    committees: base.map(summarise),
    meta: PK_COMMITTEE_META,
  });
}
