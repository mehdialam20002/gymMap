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

export default function HomePage() {
  return (
    <>
      <Hero />

      <Promises />
      <GymRail />

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
      {/* `subtle`, because the closing call to action above it is the plain band. */}
      <section className="border-t border-subtle bg-surface-subtle">
        <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-sm">
          <div className="rounded-card border border-info bg-surface-info-subtle p-inset-lg">
            <h2 className="text-base font-semibold text-content-info">
              {t('web.home.status.title')}
            </h2>
            <p className="mt-stack-2xs max-w-ui text-sm text-content-info">
              {t('web.home.status.body')}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
