/**
 * `SCR-WEB-003` — the gym page. `FR-DETL-01` … `FR-DETL-11`, `BR-PLN-03`, `BR-REV-01`.
 *
 * ┌─ THE PRICE SHOWN HERE IS THE PRICE CHARGED — INVARIANT 3 ───────────────────────────────────┐
 * │ `BR-PLN-03` and `FR-CART-04` make this a server-side contract: whatever a member reads on   │
 * │ this page is revalidated at checkout, and a MISMATCH ABORTS rather than quietly charging     │
 * │ either figure.                                                                                │
 * │                                                                                              │
 * │ Which is why every amount below is rendered from integer paise through one formatter, and    │
 * │ why nothing on this page computes a discount, a pro-rata or a "save 20%". A number this page │
 * │ invents is a number checkout will refuse to honour, and the member sees the abort.           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND THE REVIEWS ARE EARNED — INVARIANT 4 ──────────────────────────────────────────────────┐
 * │ `BR-REV-01`/`BR-REV-03`: no review exists without a recorded check-in. So a gym with no      │
 * │ reviews is shown as new, never as zero-rated, and the page says WHY — that sentence is the   │
 * │ product's main differentiator from a directory anyone can astroturf.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { FixtureNotice } from '../discovery/search-results.tsx';
import { formatMinor } from '../discovery/search.ts';
import type { GymDetail as Gym } from '../discovery/fixtures/catalogue.ts';

export function GymDetail({ gym }: { readonly gym: Gym }) {
  return (
    <article className="mx-auto max-w-container px-inset-md py-region-sm">
      <FixtureNotice />

      <nav aria-label="Breadcrumb" className="mt-stack-lg text-sm text-content-secondary">
        <Link href="/search" className="hover:underline">
          {t('web.gym.breadcrumb.root')}
        </Link>
        {' / '}
        <Link href={`/search?city=${gym.citySlug}`} className="hover:underline">
          {gym.city}
        </Link>
      </nav>

      <header className="mt-stack-sm">
        <h1 className="text-4xl font-bold tracking-tight text-content">{gym.name}</h1>
        <p className="mt-stack-2xs text-lg text-content-secondary">
          {gym.locality}, {gym.city}
        </p>

        <div className="mt-stack-sm flex flex-wrap items-center gap-inline-sm">
          {gym.rating === null ? (
            <span className="text-base text-content-muted">{t('web.gym.newListing')}</span>
          ) : (
            <span className="text-base text-content-secondary">
              <span className="font-semibold text-content">{gym.rating.toFixed(1)} ★</span>{' '}
              <span className="text-content-muted">
                {`(${gym.reviewCount.toLocaleString('en-IN')} ${t('web.gym.reviews.many')})`}
              </span>
            </span>
          )}
          <span className="rounded-control bg-surface-success-subtle px-inset-xs py-inset-2xs text-sm font-medium text-content-success">
            {t('web.gym.verifiedByPlatform')}
          </span>
        </div>
      </header>

      <div className="mt-stack-xl grid gap-inline-xl lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Section title={t('web.gym.section.about')}>
            <p className="max-w-prose text-base text-content-secondary">{gym.about}</p>
          </Section>

          <Section title={t('web.gym.section.amenities')}>
            <ul className="flex flex-wrap gap-inline-xs">
              {gym.amenities.map((amenity) => (
                <li
                  key={amenity}
                  className="rounded-control bg-surface-sunken px-inset-sm py-inset-2xs text-base text-content-secondary"
                >
                  {amenity}
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t('web.gym.section.location')}>
            <p className="text-base text-content-secondary">{gym.address}</p>
            <p className="mt-stack-2xs text-base text-content-secondary">{gym.openingHours}</p>
          </Section>

          <Section title={t('web.gym.section.reviews')}>
            {gym.reviewCount === 0 ? (
              <p className="max-w-prose text-base text-content-secondary">
                {t('web.gym.reviews.none')}
              </p>
            ) : (
              <p className="max-w-prose text-base text-content-secondary">
                {`${gym.reviewCount.toLocaleString('en-IN')} ${t('web.gym.reviews.earned')}`}
              </p>
            )}
          </Section>
        </div>

        <aside className="lg:sticky lg:top-inset-lg lg:self-start">
          <div className="rounded-card border border-subtle bg-surface p-inset-lg shadow-xs dark:shadow-none">
            <h2 className="text-lg font-semibold text-content">{t('web.gym.plans.title')}</h2>

            <ul className="mt-stack-md flex flex-col gap-stack-sm">
              {gym.plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-baseline justify-between gap-inline-sm border-b border-subtle pb-inset-sm last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-base font-medium text-content">{plan.name}</p>
                    <p className="text-sm text-content-muted">
                      {`${String(plan.durationDays)} ${t('web.gym.plans.days')}`}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-semibold text-content">
                    {formatMinor(plan.priceMinor)}
                  </p>
                </li>
              ))}
            </ul>

            {/* Disabled, and it says why. A live-looking Join button on a fixture listing would
                be the one control a client demo is guaranteed to press. */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="gm-hit-target mt-stack-lg w-full rounded-control bg-surface-disabled px-inset-lg py-inset-sm text-md font-semibold text-content-disabled"
            >
              {t('web.gym.plans.join')}
            </button>
            <p className="mt-stack-xs text-sm text-content-muted">
              {t('web.gym.plans.joinNotice')}
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-stack-xl first:mt-0">
      <h2 className="text-xl font-semibold text-content">{title}</h2>
      <div className="mt-stack-sm">{children}</div>
    </section>
  );
}
