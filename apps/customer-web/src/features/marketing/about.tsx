/**
 * `SCR-WEB-021` — about, and the team.
 *
 * ┌─ THE FOUR RULES ARE THE PAGE, AND THEY ARE NOT MARKETING ───────────────────────────────────┐
 * │ An About page usually says what a company believes. This one says what the product REFUSES  │
 * │ to do, because those four refusals are the whole difference between this and a directory,   │
 * │ and every one of them is enforced in code rather than promised in copy:                      │
 * │                                                                                             │
 * │   verification before visibility   `BR-GYM-01` - no listing renders before a human approves │
 * │   the price shown is charged      `BR-PLN-03` - the server revalidates and aborts on drift  │
 * │   reviews are earned              `BR-REV-01` - a review needs a recorded check-in          │
 * │   activation is webhook-driven    `BR-PAY-02` - a client success signal never activates     │
 * │                                                                                             │
 * │ Which is why this page can be written at all today. It makes no claim about scale, funding, │
 * │ headcount or traction - there is nothing true to say about any of those - and every sentence │
 * │ on it is checkable against a rule that already exists.                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The team section is illustrative and says so twice: once on the section and once on every card.
 * `fixtures/team.ts` carries the reasoning and is the only module to change when the real people
 * arrive.
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { TEAM, initialsOf } from './fixtures/team.ts';

/** The product's four refusals, in the order a member meets them. */
const RULES = [
  { key: 'verified', glyph: 'verified' },
  { key: 'pricing', glyph: 'pricing' },
  { key: 'reviews', glyph: 'reviews' },
  { key: 'payments', glyph: 'secure' },
] as const;

export function AboutPage() {
  const Search = icon.search;

  return (
    <div className="gm-wrap gm-sec">
      <header>
        <p className="gm-eyebrow-k">{t('web.about.eyebrow')}</p>
        <h1 className="mt-stack-xs gm-h2">{t('web.about.title')}</h1>
        {/*
         * The measure goes on the element that SETS the font size. `ch` resolves against whatever
         * carries the rule, so `max-w-prose` on a 16px wrapper caps 14px copy at 112 characters
         * rather than 68 - the same correction `/for-gyms` and `/how-it-works` both carry.
         */}
        <p className="mt-stack-sm gm-lede max-w-prose">{t('web.about.lede')}</p>
      </header>

      <section className="mt-region-sm">
        <p className="gm-eyebrow-k">{t('web.about.why.eyebrow')}</p>
        <h2 className="mt-stack-xs gm-h2">{t('web.about.why.title')}</h2>
        <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
          {t('web.about.why.body')}
        </p>

        {/*
         * `.gm-cards` steps 1 -> 2 at `md` -> 3 at `xl`, and there are FOUR rules, so the last
         * one would sit alone on a second row at the widest step. Two columns from `sm` and four
         * from `xl` keeps them square at every width, and both are token breakpoints (`BP4`).
         */}
        <ul className="mt-stack-lg grid gap-stack-md sm:grid-cols-2 xl:grid-cols-4">
          {RULES.map((rule) => {
            const Glyph = icon[rule.glyph];
            return (
              <li key={rule.key} className="gm-card rounded-card p-inset-lg">
                <Glyph
                  aria-hidden="true"
                  className="h-[1.5rem] w-[1.5rem] text-content-on-media-accent"
                />
                <h3 className="mt-stack-sm gm-h3">
                  {t(`web.about.rules.${rule.key}.title` as never)}
                </h3>
                <p className="mt-stack-2xs text-sm text-content-secondary">
                  {t(`web.about.rules.${rule.key}.body` as never)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-region-sm">
        <p className="gm-eyebrow-k">{t('web.about.team.eyebrow')}</p>
        <h2 className="mt-stack-xs gm-h2">{t('web.about.team.title')}</h2>
        <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
          {t('web.about.team.body')}
        </p>

        {/*
         * The section notice, in the same voice and the same box as the listings notice on
         * `/search` and the account notice on `/account`. A reader who has seen one recognises
         * this one, which is most of what makes a disclosure work.
         */}
        <p className="mt-stack-md max-w-prose rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-base text-content-warning">
          {t('web.about.team.notice')}
        </p>

        <ul className="mt-stack-lg grid gap-stack-md sm:grid-cols-2 xl:grid-cols-4">
          {TEAM.map((person) => (
            <li key={person.id} className="gm-card rounded-card p-inset-lg">
              {/*
               * A ROW, not an absolutely positioned badge. `.gm-card-badge` was tried and it is
               * built for sitting on a photograph: it sets `left: 13px` itself, so adding a
               * `right` stretched it across the whole card, and its translucent near-black ground
               * reads as a grey bar on a card surface in the light theme. A flex row cannot
               * collide with the avatar and needs no positioning at all.
               */}
              <div className="flex items-start justify-between gap-inline-sm">
                {/*
                 * Initials, never a face. A generated portrait of somebody who does not exist is
                 * the one thing on this page a reader could not tell from a real one, which is
                 * exactly the filler `ai-tells.md` bans. `aria-hidden` because the name is read
                 * out below it.
                 */}
                <span
                  aria-hidden="true"
                  className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full bg-surface-sunken font-display text-lg font-bold text-content-on-media-accent"
                >
                  {initialsOf(person.name)}
                </span>

                {/*
                 * The marker travels with the CARD. `gym-art.ts` settled this for the stock covers
                 * and the argument is the same: a screenshot of one card outlives the banner it
                 * was captured under, so the page notice above cannot be the only disclosure.
                 *
                 * The warning tokens, matching the notice above it rather than `.gm-tag`, which
                 * this card already uses for `Founder`. Two chips in one treatment would read as
                 * two attributes of the person; a disclosure is not an attribute of the person.
                 */}
                <p className="shrink-0 rounded-control border border-warning bg-surface-warning-subtle px-inset-xs py-inset-2xs font-mono text-2xs uppercase tracking-wide text-content-warning">
                  {t('web.about.team.sample')}
                </p>
              </div>

              {/* `gm-is-name` — `DV4` under `ADR-0052`: identity chrome may shift case, a person's
                  name may not, and `.gm-h3` uppercases. */}
              <p className="mt-stack-sm gm-h3 gm-is-name">{person.name}</p>

              <p className="mt-stack-2xs flex flex-wrap items-center gap-inline-2xs text-sm font-medium text-content">
                {t(person.role)}
                {person.founder ? (
                  <span className="gm-tag text-2xs">{t('web.about.team.founderLabel')}</span>
                ) : null}
              </p>

              <p className="mt-stack-2xs text-sm text-content-secondary">{t(person.owns)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-region-sm">
        <div className="gm-card max-w-prose rounded-card border-strong p-inset-xl text-base">
          <h2 className="gm-h3">{t('web.about.cta.title')}</h2>
          <p className="mt-stack-sm text-base text-content-secondary">{t('web.about.cta.body')}</p>
          <div className="mt-stack-lg flex flex-wrap gap-inline-sm">
            <Link href="/search" className="gm-btn gm-btn-amber">
              <Search aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
              {t('web.about.cta.search')}
            </Link>
            <Link href="/how-it-works" className="gm-btn gm-btn-ghost gm-btn-sm">
              {t('web.about.cta.how')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
