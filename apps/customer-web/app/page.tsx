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
import { Section } from '../src/features/home/section.tsx';
import { Cities, Closing, ForOwners, Goals, HowItWorks } from '../src/features/home/sections.tsx';
import {
  CompareTeaser,
  HomeFaq,
  MemberExperience,
  Memberships,
  Reviews,
} from '../src/features/home/marketplace.tsx';
import { GymCard } from '../src/features/discovery/gym-card.tsx';
import { FixtureNotice } from '../src/features/discovery/search-results.tsx';
import { parseSearchQuery, search } from '../src/features/discovery/search.ts';

export default function HomePage() {
  return (
    <>
      <Hero />

      {/*
       * Six of the eight fixture listings, sorted nearest-first — the same query `/search` runs,
       * through the same module, so the home page cannot drift from the results page.
       */}
      <Section
        eyebrow="web.home.eyebrow.featured"
        title="web.home.featured.title"
        action={{ href: '/search', label: 'web.home.featured.seeAll' }}
      >
        <FixtureNotice />
        <ul className="mt-stack-lg grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-3">
          {search(parseSearchQuery({ sort: 'distance' }))
            .slice(0, 6)
            .map((gym) => (
              <GymCard key={gym.id} gym={gym} />
            ))}
        </ul>
      </Section>

      <Goals />
      <HowItWorks />
      <Memberships />
      <CompareTeaser />
      <Reviews />

      {/* The long form of the three promises — the mechanism behind each strip item. */}
      <Section eyebrow="web.home.eyebrow.why" title="web.home.why.title">
        <ul className="grid gap-stack-lg sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ['web.home.value.verified.title', 'web.home.value.verified.body'],
              ['web.home.value.pricing.title', 'web.home.value.pricing.body'],
              ['web.home.value.reviews.title', 'web.home.value.reviews.body'],
            ] as const
          ).map(([title, body]) => (
            <li key={title} className="gm-card rounded-card p-inset-lg">
              <h3 className="text-lg font-semibold text-content">{t(title)}</h3>
              <p className="mt-stack-xs text-base text-content-secondary">{t(body)}</p>
            </li>
          ))}
        </ul>
      </Section>

      <MemberExperience />
      <Cities />
      <ForOwners />
      <HomeFaq />

      <Closing />

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
