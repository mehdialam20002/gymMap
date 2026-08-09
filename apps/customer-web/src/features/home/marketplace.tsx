/**
 * The four sections the marketplace reference carries that `SCR-WEB-001` was missing.
 *
 * ┌─ WHAT THE REFERENCE HAS THAT IS NOT HERE, AND WHY ──────────────────────────────────────────┐
 * │ It also carries a testimonials row (three named members with five stars each), a mobile-app │
 * │ banner with App Store and Play buttons, and an owner dashboard rendered out of styled divs.  │
 * │                                                                                             │
 * │ The testimonials cannot exist: `BR-REV-01` makes a review impossible without a recorded      │
 * │ check-in and there are none, so those three quotes would be invented words in the mouths of  │
 * │ invented people, on the page that sells earned reviews as the differentiator.                 │
 * │                                                                                             │
 * │ The app banner would advertise two store listings that do not exist. What DOES exist is the  │
 * │ account, so `MemberExperience` below describes that and links to it.                          │
 * │                                                                                             │
 * │ The dashboard mock is a fake product screenshot built from divs, which the taste skill names │
 * │ as the single most recognisable AI tell. The owner band states the offer in words instead.    │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { checkoutHref } from '../checkout/quote.ts';
import { EMPTY_QUERY, formatMinor, search } from '../discovery/search.ts';
import { compareKey, toCompareParams } from '../compare/compare.ts';
import { Section } from './section.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// The membership marketplace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three real plans from three different gyms, cheapest first.
 *
 * ┌─ NO STRUCK-THROUGH "ORIGINAL" PRICE ───────────────────────────────────────────────────────┐
 * │ Every card in the reference shows `₹4,999` over a crossed-out `₹5,999`. Those second        │
 * │ figures are invented, and inventing one here would be the exact thing `BR-PLN-03` exists to │
 * │ stop: a number the page made up, next to a number checkout will honour. A member who does   │
 * │ the subtraction is being told they saved something they never could have paid.               │
 * │                                                                                             │
 * │ Real discounts arrive with coupons (`FR-CART-*`), where the saving is a stored figure on the │
 * │ order rather than a decoration on a card.                                                    │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * One plan per gym, so the row is three gyms rather than three plans from whichever gym happens
 * to be cheapest. Derived at render from the same `search()` every other surface runs.
 */
function featuredPlans() {
  return search({ ...EMPTY_QUERY, sort: 'price-asc' })
    .slice(0, 3)
    .map((gym) => ({ gym, plan: gym.plans[0] }))
    .filter(
      (entry): entry is { gym: (typeof entry)['gym']; plan: NonNullable<(typeof entry)['plan']> } =>
        entry.plan !== undefined,
    );
}

export function Memberships() {
  const Next = icon.next;
  const Compare = icon.has;
  // The same three the teaser opens, so the two CTAs on this page agree with each other.
  const comparable = search({ ...EMPTY_QUERY, sort: 'distance' }).slice(0, 3);

  return (
    <Section
      eyebrow="web.home.eyebrow.plans"
      title="web.home.plans.title"
      body="web.home.plans.body"
      tone="subtle"
      action={{ href: '/search', label: 'web.home.plans.seeAll' }}
    >
      <ul className="grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-4">
        {featuredPlans().map(({ gym, plan }) => (
          <li key={plan.id} className="gm-card gm-card-interactive rounded-card p-inset-lg">
            <p className="gm-eyebrow">
              {gym.name} · {gym.city}
            </p>
            <h3 className="mt-stack-sm text-xl font-bold tracking-tight text-content">
              {plan.name}
            </h3>

            <p className="mt-stack-md text-4xl font-bold tabular-nums tracking-tight text-content">
              {formatMinor(plan.priceMinor)}
            </p>
            <p className="mt-stack-2xs text-sm text-content-muted">
              {t('web.home.plans.perMonth')} · {String(plan.durationDays)}{' '}
              {t('web.home.plans.days')}
            </p>

            <ul className="mt-stack-md flex flex-wrap gap-inline-xs">
              {gym.amenities.slice(0, 3).map((amenity) => (
                <li
                  key={amenity}
                  className="rounded-control bg-surface-sunken px-inset-xs py-inset-2xs text-xs text-content-secondary"
                >
                  {amenity}
                </li>
              ))}
            </ul>

            <Link
              href={checkoutHref(gym, plan)}
              data-on-solid="true"
              className="gm-hit-target mt-stack-lg flex w-full items-center justify-center gap-inline-2xs rounded-control bg-brand-solid px-inset-lg py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
            >
              {t('web.home.plans.view')}
              <Next aria-hidden="true" className="h-[1rem] w-[1rem]" />
            </Link>
          </li>
        ))}

        {/*
         * The fourth tile, as the reference has it: three plans and a way out for someone who is
         * not ready to pick one. It sits IN the grid rather than under it, because "I do not know
         * yet" is a real answer to this row and belongs at the same level as the three that
         * assume you do.
         */}
        <li className="gm-card gm-card-interactive flex flex-col justify-between rounded-card p-inset-lg">
          <div>
            <span className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-control bg-surface-sunken">
              <Compare
                aria-hidden="true"
                className="h-[1.375rem] w-[1.375rem] text-content-brand"
              />
            </span>
            <h3 className="mt-stack-md text-xl font-bold tracking-tight text-content">
              {t('web.home.plans.compareTitle')}
            </h3>
            <p className="mt-stack-sm text-base text-content-secondary">
              {t('web.home.plans.compareBody')}
            </p>
          </div>
          <Link
            href={toCompareParams(comparable.map(compareKey))}
            className="gm-hit-target mt-stack-lg flex w-full items-center justify-center gap-inline-2xs rounded-control border border-strong px-inset-lg py-inset-sm text-base font-semibold text-content transition-colors duration-fast ease-standard hover:border-brand"
          >
            {t('web.home.plans.compareCta')}
            <Next aria-hidden="true" className="h-[1rem] w-[1rem]" />
          </Link>
        </li>
      </ul>

      <p className="mt-stack-lg max-w-prose text-sm text-content-muted">
        {t('web.home.plans.noDiscountNote')}
      </p>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The compare teaser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A live three-gym table, and the link opens those same three.
 *
 * The reference's version is a static picture of a table. This one is built from the catalogue at
 * render, so it cannot show a price the results page disagrees with — and the CTA carries the
 * three gyms in its URL, so pressing it lands on exactly what was just read rather than on an
 * empty compare page the member then has to fill in.
 */
export function CompareTeaser() {
  const gyms = search({ ...EMPTY_QUERY, sort: 'distance' }).slice(0, 3);
  if (gyms.length === 0) return null;

  const rows: { label: MessageKey; cell: (gym: (typeof gyms)[number]) => string }[] = [
    { label: 'web.home.compareTeaser.rowPrice', cell: (gym) => formatMinor(gym.fromPriceMinor) },
    {
      label: 'web.home.compareTeaser.rowDistance',
      cell: (gym) => `${gym.distanceKm.toFixed(1)} km`,
    },
    {
      label: 'web.home.compareTeaser.rowRating',
      // `BR-REV-01` reaches even here: an unrated gym gets the words, never a zero.
      cell: (gym) => (gym.rating === null ? t('web.gym.facts.unrated') : gym.rating.toFixed(1)),
    },
  ];

  return (
    <section className="border-t border-subtle bg-surface">
      <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-md">
        <div className="grid gap-inline-xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="max-w-prose">
            <p className="gm-eyebrow">{t('web.home.eyebrow.compare')}</p>
            <h2 className="mt-stack-2xs text-3xl font-bold tracking-tight text-content sm:text-4xl">
              {t('web.home.compareTeaser.title')}
            </h2>
            <p className="mt-stack-md text-base text-content-secondary">
              {t('web.home.compareTeaser.body')}
            </p>
            <Link
              href={toCompareParams(gyms.map(compareKey))}
              data-on-solid="true"
              className="gm-hit-target mt-stack-lg inline-block rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
            >
              {t('web.home.compareTeaser.cta')}
            </Link>
          </div>

          {/* A real table, for the same reason the compare page uses one: every figure here means
              what it does because of the row and column it sits in. */}
          {/* `gm-compare-scroll` and not bare `overflow-x-auto`: the class carries the
              `position: relative` that keeps this table's `gm-visually-hidden` caption from
              escaping the scroll clip and widening the page. Same defect `/compare` had. */}
          <div className="gm-compare-scroll gm-card overflow-x-auto rounded-card">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <caption className="gm-visually-hidden">{t('web.compare.title')}</caption>
              <thead>
                <tr>
                  <td className="p-inset-sm" />
                  {gyms.map((gym) => (
                    <th
                      key={gym.id}
                      scope="col"
                      className="border-b border-strong p-inset-sm text-sm font-semibold text-content"
                    >
                      {gym.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th
                      scope="row"
                      className="border-b border-subtle p-inset-sm text-sm font-medium text-content-secondary"
                    >
                      {t(row.label)}
                    </th>
                    {gyms.map((gym) => (
                      <td
                        key={gym.id}
                        className="border-b border-subtle p-inset-sm text-sm tabular-nums text-content"
                      >
                        {row.cell(gym)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// What a membership actually gives you
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_FEATURES = [
  {
    glyph: 'verified',
    title: 'web.home.member.qr.title',
    body: 'web.home.member.qr.body',
  },
  {
    glyph: 'place',
    title: 'web.home.member.visits.title',
    body: 'web.home.member.visits.body',
  },
  {
    glyph: 'pricing',
    title: 'web.home.member.receipts.title',
    body: 'web.home.member.receipts.body',
  },
] as const satisfies readonly { glyph: keyof typeof icon; title: MessageKey; body: MessageKey }[];

/**
 * The reference sells an app here, with two store buttons. There is no app and no store listing,
 * so this sells the account — which exists, is linked, and is where all three of these things
 * genuinely live.
 */
export function MemberExperience() {
  return (
    <Section
      eyebrow="web.home.eyebrow.member"
      title="web.home.member.title"
      body="web.home.member.body"
      tone="subtle"
      action={{ href: '/account', label: 'web.home.member.cta' }}
    >
      <ul className="grid gap-stack-lg lg:grid-cols-3">
        {MEMBER_FEATURES.map((feature) => {
          const Glyph = icon[feature.glyph];
          return (
            <li key={feature.title} className="gm-card rounded-card p-inset-lg">
              <span className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-control bg-brand-solid">
                <Glyph
                  aria-hidden="true"
                  className="h-[1.375rem] w-[1.375rem] text-content-on-brand"
                />
              </span>
              <h3 className="mt-stack-md text-lg font-semibold text-content">{t(feature.title)}</h3>
              <p className="mt-stack-xs text-base text-content-secondary">{t(feature.body)}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────

const FAQ = [
  { q: 'web.home.faq.verified.q', a: 'web.home.faq.verified.a' },
  { q: 'web.home.faq.price.q', a: 'web.home.faq.price.a' },
  { q: 'web.home.faq.reviews.q', a: 'web.home.faq.reviews.a' },
  { q: 'web.home.faq.checkin.q', a: 'web.home.faq.checkin.a' },
] as const satisfies readonly { q: MessageKey; a: MessageKey }[];

/**
 * Four questions, and every answer is a rule the code enforces rather than a reassurance.
 *
 * `<details>` and not a JavaScript accordion: it opens before hydration, it is keyboard-operable
 * and announced correctly with no work, and a search engine reads the answers whether or not it
 * expands them — which is most of the point of putting an FAQ on a marketing page.
 */
export function HomeFaq() {
  return (
    <Section
      eyebrow="web.home.eyebrow.faq"
      title="web.home.faq.title"
      body="web.home.faq.body"
      tone="subtle"
    >
      {/* Two columns, because one would leave the right half of a 1440px band empty and the
          answers still want a reading measure. `items-start` so an open answer grows its own row
          instead of stretching the question beside it. */}
      <ul className="grid items-start gap-x-inline-xl md:grid-cols-2">
        {FAQ.map((item) => (
          <li key={item.q}>
            <details className="border-b border-subtle py-inset-md">
              <summary className="gm-hit-target cursor-pointer text-lg font-semibold text-content marker:text-content-brand">
                {t(item.q)}
              </summary>
              <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
                {t(item.a)}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The reviews band, with nothing in it, on purpose.
 *
 * ┌─ THE SECTION EXISTS. THE QUOTES DO NOT. ────────────────────────────────────────────────────┐
 * │ The reference fills this with three five-star testimonials from three named members and a   │
 * │ big "4.8 from verified members" figure. `BR-REV-01` makes a review impossible without a     │
 * │ recorded check-in, and there are no check-ins, so all four of those would be fabrications -  │
 * │ on the page whose entire argument is that its reviews are the ones you can trust.            │
 * │                                                                                             │
 * │ Leaving the section OUT was the previous answer and it was the weaker one. The rule is the  │
 * │ differentiator; a page that quietly omits the reviews band says nothing about it, while a   │
 * │ band that states the rule and then shows an honest zero demonstrates it. An empty state is  │
 * │ not a gap here, it is the argument.                                                          │
 * │                                                                                             │
 * │ When check-ins exist this component grows a list and the empty state stays for the gyms     │
 * │ that have none. Nothing here has to be undone.                                               │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function Reviews() {
  const Star = icon.reviews;
  const Verified = icon.verified;

  return (
    <Section
      eyebrow="web.home.eyebrow.reviews"
      title="web.home.reviews.title"
      body="web.home.reviews.body"
      tone="subtle"
      action={{ href: '/how-it-works', label: 'web.home.reviews.cta' }}
    >
      <div className="grid gap-stack-lg lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/*
         * The empty state is the LARGER half, not a footnote under three cards that are not
         * there. It is the thing this section currently has to say.
         */}
        <div className="gm-card flex flex-col items-start justify-center rounded-card p-inset-xl">
          <span className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full bg-surface-sunken">
            <Star aria-hidden="true" className="h-[1.375rem] w-[1.375rem] text-content-muted" />
          </span>
          <h3 className="mt-stack-md text-xl font-bold tracking-tight text-content">
            {t('web.home.reviews.emptyTitle')}
          </h3>
          <p className="mt-stack-xs max-w-prose text-base text-content-secondary">
            {t('web.home.reviews.emptyBody')}
          </p>
        </div>

        <ul className="grid gap-stack-md">
          {(
            [
              {
                glyph: Verified,
                title: 'web.home.reviews.ruleTitle',
                body: 'web.home.reviews.ruleBody',
              },
              {
                glyph: Star,
                title: 'web.home.reviews.unratedTitle',
                body: 'web.home.reviews.unratedBody',
              },
            ] as const
          ).map((item) => {
            const Glyph = item.glyph;
            return (
              <li key={item.title} className="gm-card rounded-card p-inset-lg">
                <span className="flex h-[2.25rem] w-[2.25rem] items-center justify-center rounded-control bg-brand-solid">
                  <Glyph
                    aria-hidden="true"
                    className="h-[1.125rem] w-[1.125rem] text-content-on-brand"
                  />
                </span>
                <h3 className="mt-stack-sm text-lg font-semibold text-content">{t(item.title)}</h3>
                <p className="mt-stack-2xs text-base text-content-secondary">{t(item.body)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
