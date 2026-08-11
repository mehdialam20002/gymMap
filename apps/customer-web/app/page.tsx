/**
 * `SCR-WEB-001` — Home. Server-rendered for SEO (`§C1.1`, `FR-SRCH-13`, ADR-0019).
 *
 * A Server Component with no `'use client'`: nothing here is interactive yet, and the moment a
 * page opts into the client it stops being server-rendered for the crawler that `FR-SRCH-13`
 * exists for. The search box becomes a client island in the discovery milestones, not the page.
 *
 * `app/` is routing only (`F1`) — this renders the shell and the three product promises, and the
 * real discovery UI arrives from `src/features/discovery/` with `SCR-WEB-002`.
 */

import type { Metadata } from 'next';

import { t } from '../src/shared/i18n/index.ts';
import { Hero } from '../src/features/home/hero.tsx';
import type { RawParams } from '../src/features/discovery/search.ts';
import { parseCompare } from '../src/features/compare/compare.ts';
import { CompareRail } from '../src/features/compare/compare-rail.tsx';
import { HOME_COMPARE_BASE } from '../src/features/home/teaser.ts';
import {
  CityGrid,
  ClosingBand,
  CompareBand,
  Faq,
  ForOwners,
  Goals,
  GymRail,
  HowItWorks,
  MemberExperience,
  PlanRow,
  Promises,
  Reviews,
} from '../src/features/home/chalk.tsx';

/**
 * The home page's canonical, and it is the one page that could least afford not to have one.
 *
 * The compare rail keeps its selection in the URL (`FR-CMP-01`), by design and for good reasons -
 * a shared link opens the same four gyms, the back button removes the last one, and none of it
 * needs hydration. The consequence nobody had written down is that `/?gym=a&gym=b` is a real,
 * linkable, shareable address that serves the home page, and with eight listings and a cap of four
 * there are hundreds of them. Every chip on every card is one more, and they are all in the HTML
 * for a crawler to follow.
 *
 * `alternates.canonical` collapses the lot back to `/`. The rail keeps working exactly as it did.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * `searchParams`, because the compare selection lives in the URL (`FR-CMP-01`).
 *
 * It does NOT opt the route out of static rendering, which is what this note used to claim.
 * `app/layout.tsx` reads the per-response CSP nonce with `headers()`, and `headers()` in a layout
 * makes the whole application dynamic - `pnpm build` marks every route `ƒ`, including ones that
 * read no search parameters. The rail is free here; see the note in `compare-rail.tsx`.
 *
 * The alternative was a client island holding the same list in React state, which is a second
 * copy of a fact the URL already carries.
 */
export default function HomePage({ searchParams }: { readonly searchParams: RawParams }) {
  const { gyms: selected } = parseCompare(searchParams);

  return (
    <>
      <Hero />

      <Promises />
      <GymRail selected={selected} />

      <Goals />
      <HowItWorks />
      <PlanRow />
      <CompareBand />
      <Reviews />

      <MemberExperience />
      <CityGrid />
      <ForOwners />
      <Faq />

      <ClosingBand />

      {/*
       * Last band before the footer. It sat above the closing call to action first, which read as
       * "join now — actually, none of this works". Same sentence, same honesty, and it no longer
       * argues with the button directly above it.
       */}
      {/*
       * In the page's own voice, not a system alert.
       *
       * It was `border-info` on `surface-info-subtle` with `content-info` ink - the last element
       * on the page still wearing the palette everything else was rebuilt out of. A bright blue
       * notice bolted to the bottom of an ink-and-amber page reads as a browser warning about the
       * site rather than the site telling you where it is up to, and honest copy delivered in the
       * wrong voice gets skipped.
       *
       * `gm-note` is the same treatment the gym rail's sample notice already uses, which is the
       * right relationship: two statements of the same fact, in one voice.
       */}
      <section className="gm-sec gm-sec-tight gm-sec-paper">
        <div className="gm-wrap">
          <p className="gm-note">
            <b>{t('web.home.status.title')}</b> {t('web.home.status.body')}
          </p>
        </div>
      </section>

      {/*
       * Last in the document, which is also where it sits on screen. A fixed bar declared early
       * would reach a screen reader before the page it is about, announcing a selection nobody has
       * made yet.
       */}
      {/* The base is the home page and its own `#gyms` anchor. Stated, not defaulted: ADR-0050
          mounts this rail on five surfaces and four of them are not `/`. */}
      <CompareRail selected={selected} base={HOME_COMPARE_BASE} />
    </>
  );
}
