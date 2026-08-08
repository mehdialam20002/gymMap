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

import Link from 'next/link';

import { t } from '../src/shared/i18n/index.ts';
import { Hero } from '../src/features/home/hero.tsx';
import { GymCard } from '../src/features/discovery/gym-card.tsx';
import { FixtureNotice } from '../src/features/discovery/search-results.tsx';
import { parseSearchQuery, search } from '../src/features/discovery/search.ts';

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="mx-auto max-w-container px-inset-md py-region-md">
        <ul className="grid gap-stack-lg sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ['web.home.value.verified.title', 'web.home.value.verified.body'],
              ['web.home.value.pricing.title', 'web.home.value.pricing.body'],
              ['web.home.value.reviews.title', 'web.home.value.reviews.body'],
            ] as const
          ).map(([title, body]) => (
            <li
              key={title}
              className="rounded-card border border-subtle bg-surface p-inset-lg shadow-xs dark:shadow-none"
            >
              <h2 className="text-xl font-semibold text-content">{t(title)}</h2>
              <p className="mt-stack-xs text-base text-content-secondary">{t(body)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/*
       * Six of the eight fixture listings, sorted nearest-first — the same query `/search` runs,
       * through the same module, so the home page cannot drift from the results page.
       */}
      <section className="mx-auto max-w-container px-inset-md pb-region-md">
        <div className="flex flex-wrap items-baseline justify-between gap-inline-md">
          <h2 className="text-2xl font-semibold text-content">{t('web.home.featured.title')}</h2>
          <Link href="/search" className="text-base font-medium text-content-brand hover:underline">
            {t('web.home.featured.seeAll')}
          </Link>
        </div>

        <div className="mt-stack-md">
          <FixtureNotice />
        </div>

        <ul className="mt-stack-md grid gap-stack-md lg:grid-cols-2">
          {search(parseSearchQuery({ sort: 'distance' }))
            .slice(0, 6)
            .map((gym) => (
              <GymCard key={gym.id} gym={gym} />
            ))}
        </ul>
      </section>

      <section className="mx-auto max-w-container px-inset-md pb-region-md">
        <div className="rounded-card border border-info bg-surface-info-subtle p-inset-lg">
          <h2 className="text-lg font-semibold text-content-info">{t('web.home.status.title')}</h2>
          <p className="mt-stack-2xs max-w-ui text-base text-content-info">
            {t('web.home.status.body')}
          </p>
        </div>
      </section>
    </>
  );
}
