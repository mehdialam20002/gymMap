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
import { icon } from '../../shared/icons/index.tsx';
import { FixtureNotice } from '../discovery/search-results.tsx';
import { GymCard } from '../discovery/gym-card.tsx';
import { checkoutHref } from '../checkout/quote.ts';
import { formatMinor, search, EMPTY_QUERY } from '../discovery/search.ts';
import type { GymDetail as Gym } from '../discovery/fixtures/catalogue.ts';
import { Gallery } from './gallery.tsx';

export function GymDetail({ gym }: { readonly gym: Gym }) {
  const Verified = icon.verified;
  const Place = icon.place;

  return (
    /*
     * `gm-wrap` and the tight section rhythm, so the page a member lands on from the results looks
     * like the same product they were just reading. It was `max-w-container` with `py-region-sm`,
     * which is the pre-identity shell.
     */
    <article className="gm-wrap gm-sec gm-sec-tight">
      <FixtureNotice />

      {/*
       * `gm-hit-target` on both crumbs.
       *
       * A trail's links are inline text and WCAG 2.2 SC 2.5.8 exempts those from its minimum, so
       * they were left at 16px tall - which is defensible and still hard to hit on a phone. They
       * sit in a ROW with a slash between them, not stacked, so the pointer target can grow
       * without running into a neighbour. That is the whole reason the footer's column of links
       * needed real row height instead: expansion there would have overlapped.
       */}
      <nav aria-label="Breadcrumb" className="gm-crumbs mt-stack-lg">
        <Link href="/search" className="gm-hit-target hover:underline">
          {t('web.gym.breadcrumb.root')}
        </Link>
        {' / '}
        <Link href={`/search?city=${gym.citySlug}`} className="gm-hit-target hover:underline">
          {gym.city}
        </Link>
        {/* The current page is named and NOT linked. A breadcrumb whose last crumb links to
            itself is a control that does nothing, and it is the one screen readers announce. */}
        {' / '}
        <span aria-current="page" className="text-content">
          {gym.name}
        </span>
      </nav>

      <header className="mt-stack-sm">
        {/*
         * `gm-h2` and not `gm-display`: this is a NAME, and the display face at `wdth 112` turns a
         * gym's own name into a poster. The identity's largest voice belongs to the marketing
         * copy; a listing gets the section voice, which is the same distinction `.gm-h3` makes on
         * the cards.
         */}
        <h1 className="gm-h2">{gym.name}</h1>
        <p className="gm-card-meta mt-stack-2xs">
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
          {/* `BR-GYM-01` is a fact about the listing, not a success state - same reasoning as the
              results card's badge, which is why they now share a treatment. */}
          <span className="gm-card-badge gm-card-badge-inline">
            <Verified aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" weight="fill" />
            {t('web.gym.verifiedByPlatform')}
          </span>
        </div>
      </header>

      <Gallery gym={gym} />

      <div className="mt-stack-xl grid gap-inline-xl lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <AtAGlance gym={gym} />

          <Section title={t('web.gym.section.about')}>
            <p className="max-w-prose text-base text-content-secondary">{gym.about}</p>
          </Section>

          <Section title={t('web.gym.section.amenities')}>
            <ul className="flex flex-wrap gap-inline-xs">
              {gym.amenities.map((amenity) => (
                <li key={amenity} className="gm-tag">
                  {amenity}
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t('web.gym.section.location')}>
            <p className="text-base text-content-secondary">{gym.address}</p>
            <p className="mt-stack-2xs text-base text-content-secondary">{gym.openingHours}</p>

            {/*
             * ┌─ A LINK TO A MAP, NOT AN EMBEDDED ONE ────────────────────────────────────────┐
             * │ `DEP-02` — no tile vendor is chosen, so there is no map on this page. An       │
             * │ embed picked to fill the gap would be a third-party script and a new host in   │
             * │ `img-src` and `connect-src`, chosen by whoever was building a page rather than │
             * │ by the decision that names the vendor.                                          │
             * │                                                                                │
             * │ A link costs nothing, needs no CSP change, and hands the member the app that   │
             * │ already has their location and their preferred navigation. It is replaced by   │
             * │ the real map the day `DEP-02` closes.                                           │
             * └────────────────────────────────────────────────────────────────────────────────┘
             *
             * `noopener` is not optional on a `_blank` link: without it the opened page can
             * reach back through `window.opener` and navigate this tab somewhere else.
             */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${gym.name}, ${gym.address}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gm-hit-target mt-stack-sm inline-flex items-center gap-inline-2xs rounded-control border border-subtle px-inset-md py-inset-xs text-base font-medium text-content-secondary transition-colors duration-fast ease-standard hover:border-strong hover:text-content"
            >
              <Place aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
              {t('web.gym.directions')}
              <span className="gm-visually-hidden"> ({t('web.gym.directionsHint')})</span>
            </a>
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

        {/* `gm-plan-card` pins the card below the header on desktop — same
            `--gm-chrome-height` the filter rail uses, declared once in globals.css. */}
        <aside className="gm-plan-card lg:self-start">
          <div className="gm-card rounded-card p-inset-lg">
            <h2 className="text-lg font-semibold text-content">{t('web.gym.plans.title')}</h2>

            {/*
             * Each plan is a LINK to its own checkout URL rather than a radio in a form. The
             * choice is then in the address bar, so it survives a refresh, can be sent to the
             * person actually paying, and arrives at `/checkout` as a gym-and-plan pair the
             * parser can reject if they do not belong together.
             */}
            <ul className="mt-stack-md flex flex-col gap-stack-sm">
              {gym.plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex items-baseline justify-between gap-inline-sm border-b border-subtle pb-inset-sm last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-base font-medium text-content">
                      <Link
                        href={checkoutHref(gym, plan)}
                        className="rounded-control hover:underline"
                      >
                        {plan.name}
                      </Link>
                    </p>
                    <p className="text-sm text-content-muted">
                      {`${String(plan.durationDays)} ${t('web.gym.plans.days')}`}
                    </p>
                  </div>
                  {/*
                   * The per-plan price and NOTHING derived from it. No "₹833/month" on the
                   * annual plan, no "save 12%": `BR-PLN-03` makes the displayed price the
                   * charged price, checkout revalidates it on the server, and a figure this
                   * page computed is a figure checkout has never heard of. The member would
                   * see the abort, not the saving.
                   */}
                  <p className="shrink-0 text-lg font-semibold tabular-nums text-content">
                    {formatMinor(plan.priceMinor)}
                  </p>
                </li>
              ))}
            </ul>

            {/*
             * The button opens the REVIEW screen, which is a real page, and it is the review
             * screen that says payments are not live.
             *
             * A disabled button here was the earlier version. It stopped a member from ever
             * reaching the total, the tax breakdown or the sentence about server-side
             * revalidation — the three things this flow exists to show. Nothing on the way
             * charges anybody: `/checkout` is where the flow stops, and it says so there.
             *
             * The first plan is the cheapest, because `fromPriceMinor` is defined as the cheapest
             * and the list is authored in ascending order; a member who wants another one clicks
             * its name, two lines up.
             */}
            {gym.plans[0] !== undefined && (
              <Link
                href={checkoutHref(gym, gym.plans[0])}
                data-on-solid="true"
                className="gm-hit-target mt-stack-lg block w-full rounded-control bg-brand-solid px-inset-lg py-inset-sm text-center text-md font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
              >
                {t('web.gym.plans.join')}
              </Link>
            )}
            <p className="mt-stack-xs text-sm text-content-muted">
              {t('web.gym.plans.joinNotice')}
            </p>
          </div>
        </aside>
      </div>

      <SimilarGyms gym={gym} />
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-stack-xl first:mt-0">
      <h2 className="gm-h3">{title}</h2>
      <div className="mt-stack-sm">{children}</div>
    </section>
  );
}

/**
 * The four facts a member checks before reading a word of prose: what it costs, how far it is,
 * how it is rated, when it is open.
 *
 * A `<dl>` and not a row of divs — each of these IS a term and its value, and the pairing is what
 * a screen reader needs to read "From: ₹2,499 per month" rather than four loose fragments.
 */
function AtAGlance({ gym }: { readonly gym: Gym }) {
  const facts: { key: string; term: string; value: string; hint?: string }[] = [
    {
      key: 'price',
      term: t('web.gym.facts.from'),
      value: formatMinor(gym.fromPriceMinor),
      hint: t('web.gym.facts.perMonth'),
    },
    {
      key: 'distance',
      term: t('web.gym.facts.distance'),
      value: gym.distanceKm.toFixed(1),
      hint: t('web.gym.facts.km'),
    },
    {
      key: 'rating',
      term: t('web.gym.facts.rating'),
      // `BR-REV-01` again, in the one place a dash would have been easier: an unrated gym gets a
      // sentence, never `0.0` and never `—`. A dash reads as missing data about the gym; the
      // gym is not missing anything, it is new.
      value: gym.rating === null ? t('web.gym.facts.unrated') : gym.rating.toFixed(1),
      ...(gym.rating === null
        ? {}
        : {
            hint: t('web.gym.facts.reviewCount').replace(
              '{count}',
              gym.reviewCount.toLocaleString('en-IN'),
            ),
          }),
    },
    { key: 'open', term: t('web.gym.facts.open'), value: gym.openingHours },
  ];

  return (
    <dl className="gm-card grid gap-stack-md rounded-card p-inset-lg sm:grid-cols-2 xl:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.key}>
          <dt className="text-sm text-content-muted">{fact.term}</dt>
          <dd className="mt-stack-2xs text-base font-semibold text-content">
            {fact.value}
            {fact.hint === undefined ? null : (
              <span className="ml-inline-xs text-sm font-regular text-content-secondary">
                {fact.hint}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Other verified gyms in the same city.
 *
 * Real internal links between real listings, which is what makes a listing page worth crawling at
 * all (`FR-SRCH-13`) — and what a member who has decided this gym is not for them actually needs.
 * Sorted nearest-first through the same `search()` every other surface uses, so the ordering here
 * cannot drift from the ordering on the results page.
 */
function SimilarGyms({ gym }: { readonly gym: Gym }) {
  const others = search({ ...EMPTY_QUERY, city: gym.citySlug, sort: 'distance' })
    .filter((candidate) => candidate.id !== gym.id)
    .slice(0, 3);

  return (
    <Section title={t('web.gym.section.similar')}>
      {others.length === 0 ? (
        <p className="max-w-prose text-base text-content-secondary">{t('web.gym.similar.none')}</p>
      ) : (
        <ul className="grid gap-stack-md sm:grid-cols-2 xl:grid-cols-3">
          {others.map((other) => (
            <GymCard key={other.id} gym={other} />
          ))}
        </ul>
      )}
    </Section>
  );
}
