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

import { t } from '../src/shared/i18n/index.ts';
import { Hero } from '../src/features/home/hero.tsx';
import type { RawParams } from '../src/features/discovery/search.ts';
import { parseCompare } from '../src/features/compare/compare.ts';
import { CompareRail } from '../src/features/compare/compare-rail.tsx';
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
 * `searchParams`, because the compare selection lives in the URL (`FR-CMP-01`).
 *
 * This opts the route out of static rendering. The HTML is still produced on the server, so
 * `FR-SRCH-13` and everything about crawling is unchanged; what is given up is the full-page
 * cache. That is the price of a selection that survives being shared, works with JavaScript off,
 * and is undone by the back button - and it is a price this page can pay while its catalogue is a
 * fixture. The alternative was a client island holding the same list in React state, which is a
 * second copy of a fact the URL already carries.
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
      <CompareRail selected={selected} />
    </>
  );
}
