/**
 * `SCR-WEB-020` — how it works, for a member. `FR-SRCH-13`.
 *
 * ┌─ EACH STEP CARRIES THE RULE BEHIND IT ─────────────────────────────────────────────────────┐
 * │ A four-step "how it works" is the most skippable page a marketplace ships, because every    │
 * │ marketplace's four steps are the same four steps. What is not the same is WHY each one can  │
 * │ be trusted: a human approves the listing, the total is revalidated server-side, the         │
 * │ membership activates on a webhook, a review needs a check-in.                                │
 * │                                                                                             │
 * │ Those four rules are the product. Putting them next to the steps they govern is the only    │
 * │ thing that makes this page worth the scroll — and each one is a business rule the code       │
 * │ elsewhere in this app enforces, stated in a member's words rather than invented for copy.   │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';

const STEPS = [
  {
    title: 'web.home.how.discover.title',
    body: 'web.home.how.discover.body',
    rule: 'web.howItWorks.discover.rule',
    glyph: 'search',
  },
  {
    title: 'web.home.how.compare.title',
    body: 'web.home.how.compare.body',
    rule: 'web.howItWorks.compare.rule',
    glyph: 'pricing',
  },
  {
    title: 'web.home.how.choose.title',
    body: 'web.home.how.choose.body',
    rule: 'web.howItWorks.choose.rule',
    glyph: 'secure',
  },
  {
    title: 'web.home.how.join.title',
    body: 'web.home.how.join.body',
    rule: 'web.howItWorks.join.rule',
    glyph: 'verified',
  },
] as const satisfies readonly {
  title: MessageKey;
  body: MessageKey;
  rule: MessageKey;
  glyph: keyof typeof icon;
}[];

export function HowItWorksPage() {
  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <h1 className="gm-h2 sm:text-5xl">{t('web.howItWorks.title')}</h1>
      <p className="mt-stack-sm max-w-prose text-lg text-content-secondary">
        {t('web.howItWorks.intro')}
      </p>

      {/* An `<ol>`: this is a real sequence a member moves through in order, so the ordinal
          carries information and a screen reader should hear it. */}
      <ol className="mt-stack-xl flex flex-col gap-stack-lg">
        {STEPS.map((step, index) => {
          const Glyph = icon[step.glyph];
          return (
            <li
              key={step.title}
              className="gm-card grid gap-inline-lg rounded-card p-inset-lg sm:grid-cols-[auto_minmax(0,1fr)]"
            >
              <span className="flex h-[3rem] w-[3rem] shrink-0 items-center justify-center rounded-full gm-glyph-ring">
                <Glyph
                  aria-hidden="true"
                  className="h-[1.5rem] w-[1.5rem] text-content-on-media-accent"
                />
              </span>

              <div className="min-w-0">
                <span
                  aria-hidden="true"
                  className="block text-sm font-semibold tabular-nums text-content-on-media-accent"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="mt-stack-2xs text-xl font-semibold text-content">{t(step.title)}</h2>
                <p className="mt-stack-xs max-w-prose text-base text-content-secondary">
                  {t(step.body)}
                </p>

                <div className="mt-stack-md rounded-card bg-surface-sunken p-inset-md">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
                    {t('web.howItWorks.rule')}
                  </h3>
                  <p className="mt-stack-2xs max-w-prose text-base text-content">{t(step.rule)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mt-region-sm max-w-prose border-t border-subtle pt-stack-xl">
        <h2 className="text-2xl font-semibold text-content">{t('web.howItWorks.reviews.title')}</h2>
        <p className="mt-stack-sm text-base text-content-secondary">
          {t('web.howItWorks.reviews.body')}
        </p>
      </section>

      <p className="mt-stack-xl">
        <Link
          href="/search"
          data-on-solid="true"
          className="gm-hit-target inline-block rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
        >
          {t('web.howItWorks.cta')}
        </Link>
      </p>
    </div>
  );
}
