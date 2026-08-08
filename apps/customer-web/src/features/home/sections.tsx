/**
 * `SCR-WEB-001`'s content sections.
 *
 * ┌─ EVERY FIGURE ON THIS PAGE IS COUNTED, OR IT IS ABSENT ─────────────────────────────────────┐
 * │ The reference this page was designed against carries a statistics strip — 12,000+ gyms, 2M+ │
 * │ members, 4.8 average rating — and a floating card with member avatars. None of it is here.  │
 * │                                                                                             │
 * │ There are eight listings and no check-ins, so those numbers would be false statements made  │
 * │ by the platform to a consumer. The rating badge would be worse than false: `BR-REV-01` says │
 * │ a review requires a recorded check-in, and the page states that promise three sections down.│
 * │ Inventing a review count to sell the product whose selling point is real reviews is the one │
 * │ lie that discredits everything around it.                                                    │
 * │                                                                                             │
 * │ The city counts below ARE real — counted from the catalogue at render. When the catalogue   │
 * │ becomes an API they keep working, because they were never hard-coded.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { CITIES } from '../discovery/fixtures/catalogue.ts';
import { Section } from './section.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Trust
// ─────────────────────────────────────────────────────────────────────────────

const TRUST = [
  {
    glyph: 'verified',
    title: 'web.home.trust.verified.title',
    body: 'web.home.trust.verified.body',
  },
  { glyph: 'pricing', title: 'web.home.trust.pricing.title', body: 'web.home.trust.pricing.body' },
  { glyph: 'reviews', title: 'web.home.trust.reviews.title', body: 'web.home.trust.reviews.body' },
  { glyph: 'secure', title: 'web.home.trust.payments.title', body: 'web.home.trust.payments.body' },
] as const satisfies readonly {
  glyph: keyof typeof icon;
  title: MessageKey;
  body: MessageKey;
}[];

/** Sits directly under the hero, on the band colour, before anything asks for a decision. */
export function TrustStrip() {
  return (
    <section className="border-b border-subtle bg-surface-subtle">
      <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-sm">
        <ul className="grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => {
            const Glyph = icon[item.glyph];
            return (
              <li key={item.title} className="flex gap-inline-sm">
                <Glyph
                  aria-hidden="true"
                  className="mt-px h-[1.5rem] w-[1.5rem] shrink-0 text-content-brand"
                />
                <div>
                  <h2 className="text-base font-semibold text-content">{t(item.title)}</h2>
                  <p className="mt-stack-2xs text-sm text-content-secondary">{t(item.body)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each goal is a real query. "Build strength" is `?category=Strength`, which the results page
 * already understands — so these are entry points rather than decoration, and they are crawlable
 * (`FR-SRCH-13`).
 */
const GOALS = [
  { label: 'web.home.goals.strength', query: 'category=Strength', glyph: 'strength' },
  { label: 'web.home.goals.weight', query: 'category=Cardio', glyph: 'cardio' },
  { label: 'web.home.goals.fitness', query: 'category=Gym', glyph: 'strength' },
  { label: 'web.home.goals.flexibility', query: 'category=Yoga', glyph: 'yoga' },
  { label: 'web.home.goals.sport', query: 'category=Boxing', glyph: 'boxing' },
  { label: 'web.home.goals.routine', query: 'category=Group%20classes', glyph: 'cardio' },
] as const satisfies readonly { label: MessageKey; query: string; glyph: keyof typeof icon }[];

export function Goals() {
  const Next = icon.next;

  return (
    <Section title="web.home.goals.title" body="web.home.goals.body">
      <ul className="grid gap-stack-md sm:grid-cols-2 lg:grid-cols-3">
        {GOALS.map((goal) => {
          const Glyph = icon[goal.glyph];
          return (
            <li key={goal.label}>
              <Link
                href={`/search?${goal.query}`}
                className="group flex items-center gap-inline-md rounded-card border border-subtle bg-surface-raised p-inset-lg transition-colors duration-fast ease-standard hover:border-brand"
              >
                <span className="flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded-full bg-surface-brand-subtle">
                  <Glyph aria-hidden="true" className="h-[1.5rem] w-[1.5rem] text-content-brand" />
                </span>
                <span className="text-base font-semibold text-content">{t(goal.label)}</span>
                {/*
                 * `ml-auto` so the caret sits at the far edge and the tile reads as a row rather
                 * than a label floating in a wide box. Decorative — the whole tile is the link and
                 * its accessible name is the goal, so the caret must not add a second one.
                 */}
                <Next
                  aria-hidden="true"
                  className="ml-auto h-[1.25rem] w-[1.25rem] shrink-0 text-content-muted transition-colors duration-fast ease-standard group-hover:text-content-brand"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'web.home.how.discover.title', body: 'web.home.how.discover.body' },
  { title: 'web.home.how.compare.title', body: 'web.home.how.compare.body' },
  { title: 'web.home.how.choose.title', body: 'web.home.how.choose.body' },
  { title: 'web.home.how.join.title', body: 'web.home.how.join.body' },
] as const satisfies readonly { title: MessageKey; body: MessageKey }[];

export function HowItWorks() {
  return (
    <Section title="web.home.how.title" tone="subtle">
      {/*
       * Numbered, and the numbers earn it: this is a real sequence a member moves through in
       * order, so the ordinal carries information. An `<ol>` says the same thing to a screen
       * reader that the large numerals say to everyone else.
       */}
      <ol className="grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-t border-strong pt-stack-md">
            <span
              aria-hidden="true"
              className="block text-sm font-semibold tabular-nums text-content-brand"
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-stack-xs text-lg font-semibold text-content">{t(step.title)}</h3>
            <p className="mt-stack-2xs text-sm text-content-secondary">{t(step.body)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cities
// ─────────────────────────────────────────────────────────────────────────────

export function Cities() {
  const Place = icon.place;

  // `CITIES` is derived from the catalogue in the fixtures module, so the count is a fact about
  // the data rather than a number typed into a marketing page. A city with no listings is not in
  // the list at all, which is the correct behaviour and one nobody has to remember to implement.
  const cities = [...CITIES].sort((a, b) => b.count - a.count);

  return (
    <Section title="web.home.cities.title">
      <ul className="grid gap-stack-md sm:grid-cols-2 lg:grid-cols-4">
        {cities.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/search?city=${encodeURIComponent(entry.name)}`}
              className="flex items-center justify-between gap-inline-sm rounded-card border border-subtle bg-surface-raised p-inset-lg transition-colors duration-fast ease-standard hover:border-brand"
            >
              <span className="flex items-center gap-inline-xs">
                <Place aria-hidden="true" className="h-[1.25rem] w-[1.25rem] text-content-muted" />
                <span className="text-base font-semibold text-content">{entry.name}</span>
              </span>
              <span className="text-sm tabular-nums text-content-secondary">
                {entry.count === 1
                  ? t('web.home.cities.countOne')
                  : t('web.home.cities.count').replace('{count}', String(entry.count))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gym owners, and the close
// ─────────────────────────────────────────────────────────────────────────────

export function ForOwners() {
  return (
    /*
     * A hairline top and bottom. `surface-media` is theme-INVARIANT — it has to be, because the
     * hero copy is proved legible against it in both themes — so in dark mode the band and the
     * page canvas are within a step or two of each other and the section stops reading as a band
     * at all. In light mode the borders are invisible against near-black and cost nothing.
     */
    <section className="border-y border-subtle bg-surface-media">
      <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-md">
        <div className="max-w-prose">
          <p className="text-xs font-medium uppercase tracking-wide text-content-on-media-accent">
            {t('web.home.owners.eyebrow')}
          </p>
          <h2 className="mt-stack-sm text-2xl font-semibold tracking-tight text-content-on-media sm:text-3xl">
            {t('web.home.owners.title')}
          </h2>
          <p className="mt-stack-sm text-base text-content-on-media">{t('web.home.owners.body')}</p>
          {/*
           * `/for-gyms` does not exist yet, so this states the offer without promising a page.
           * It becomes a Link in the phase that builds that surface — one line, one file.
           */}
          <p className="mt-stack-lg inline-flex items-center rounded-control border border-strong px-inset-lg py-inset-sm text-base font-semibold text-content-on-media">
            {t('web.home.owners.cta')}
          </p>
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section className="border-t border-subtle bg-surface-subtle">
      <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-md text-center">
        <h2 className="mx-auto max-w-prose text-2xl font-semibold tracking-tight text-content sm:text-3xl">
          {t('web.home.closing.title')}
        </h2>
        <Link
          href="/search"
          data-on-solid="true"
          className="gm-hit-target mt-stack-lg inline-flex items-center rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover active:bg-brand-solid-active"
        >
          {t('web.home.closing.cta')}
        </Link>
      </div>
    </section>
  );
}
