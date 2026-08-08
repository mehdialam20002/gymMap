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
import { GymCard } from '../src/features/discovery/gym-card.tsx';
import { FixtureNotice } from '../src/features/discovery/search-results.tsx';
import { parseSearchQuery, search } from '../src/features/discovery/search.ts';

export default function HomePage() {
  return (
    <>
      <section className="border-b border-subtle bg-surface-subtle">
        <div className="mx-auto max-w-container px-inset-md py-region-md">
          <h1 className="max-w-prose text-4xl font-bold tracking-tight text-content">
            {t('web.home.hero.title')}
          </h1>
          <p className="mt-stack-md max-w-prose text-lg text-content-secondary">
            {t('web.home.hero.subtitle')}
          </p>

          {/*
           * A real <form> with a GET action, not a JavaScript handler. It works before hydration,
           * it works with JavaScript disabled, and the resulting URL is shareable and
           * crawlable — which is the whole reason SCR-WEB-002 keeps its state in the URL.
           */}
          <form
            action="/search"
            method="get"
            className="mt-stack-xl flex max-w-form flex-col gap-stack-sm"
          >
            <label htmlFor="q" className="text-base font-medium text-content-secondary">
              {t('web.home.hero.searchLabel')}
            </label>
            <div className="flex flex-wrap gap-inline-sm">
              <input
                id="q"
                name="q"
                type="search"
                placeholder={t('web.home.hero.searchPlaceholder')}
                // `h-input-height` and not a fixed height: DV2 forbids a fixed single-line box,
                // and the token is what density remaps.
                className="min-w-0 flex-1 rounded-control border border-input bg-surface px-inset-md py-inset-sm text-md text-content placeholder:text-content-muted"
              />
              <button
                type="submit"
                className="gm-hit-target rounded-control bg-brand-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover active:bg-brand-solid-active"
                data-on-solid="true"
              >
                {t('web.home.hero.searchAction')}
              </button>
            </div>
          </form>
        </div>
      </section>

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
