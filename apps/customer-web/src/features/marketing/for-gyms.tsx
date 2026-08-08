/**
 * `SCR-WEB-030` — the owner-facing marketing page and its application form.
 *
 * ┌─ THE COMMISSION RATE IS NOT ON THIS PAGE, AND THAT IS DELIBERATE ───────────────────────────┐
 * │ `LAUNCH_MARKET_INDIA.md` records the launch commission, so the number exists and could be   │
 * │ typed here. Publishing a price is the owner's decision, not a page author's — and a rate     │
 * │ printed on a marketing page becomes a rate every negotiation starts from.                    │
 * │                                                                                             │
 * │ What IS stated is the shape of the charge, which is the part an owner actually needs before │
 * │ they apply: commission per sale and nothing else, no listing fee, no monthly charge, and     │
 * │ `BR-FIN-05` — the rate on the day of a sale is the rate that sale keeps, so a later change   │
 * │ never rewrites an old settlement. That last sentence is a real guarantee, enforced in the    │
 * │ ledger, and it is worth more to an owner than a headline percentage.                          │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { CITIES } from '../discovery/fixtures/catalogue.ts';

const VALUE = [
  {
    title: 'web.forGyms.value.reach.title',
    body: 'web.forGyms.value.reach.body',
    glyph: 'search',
  },
  { title: 'web.forGyms.value.sell.title', body: 'web.forGyms.value.sell.body', glyph: 'pricing' },
  {
    title: 'web.forGyms.value.checkin.title',
    body: 'web.forGyms.value.checkin.body',
    glyph: 'verified',
  },
  { title: 'web.forGyms.value.money.title', body: 'web.forGyms.value.money.body', glyph: 'secure' },
] as const satisfies readonly { title: MessageKey; body: MessageKey; glyph: keyof typeof icon }[];

const STEPS = [
  { title: 'web.forGyms.steps.apply.title', body: 'web.forGyms.steps.apply.body' },
  { title: 'web.forGyms.steps.verify.title', body: 'web.forGyms.steps.verify.body' },
  { title: 'web.forGyms.steps.live.title', body: 'web.forGyms.steps.live.body' },
  { title: 'web.forGyms.steps.paid.title', body: 'web.forGyms.steps.paid.body' },
] as const satisfies readonly { title: MessageKey; body: MessageKey }[];

const FAQ = [
  { q: 'web.forGyms.faq.control.q', a: 'web.forGyms.faq.control.a' },
  { q: 'web.forGyms.faq.reviews.q', a: 'web.forGyms.faq.reviews.a' },
  { q: 'web.forGyms.faq.data.q', a: 'web.forGyms.faq.data.a' },
  { q: 'web.forGyms.faq.exclusive.q', a: 'web.forGyms.faq.exclusive.a' },
] as const satisfies readonly { q: MessageKey; a: MessageKey }[];

export function ForGymsPage() {
  return (
    <>
      {/*
       * The owner band's colours, on the surface that band was advertising. `surface-media` is
       * theme-invariant and opaque, so the pairing is one `contrast.proof.ts` can measure.
       */}
      <section className="border-b border-subtle bg-surface-media">
        <div className="mx-auto max-w-container px-inset-md py-region-md">
          <p className="text-xs font-medium uppercase tracking-wide text-content-on-media-accent">
            {t('web.forGyms.hero.eyebrow')}
          </p>
          <h1 className="mt-stack-sm max-w-prose text-4xl font-bold tracking-tight text-content-on-media sm:text-5xl">
            {t('web.forGyms.title')}
          </h1>
          <p className="mt-stack-md max-w-prose text-lg text-content-on-media">
            {t('web.forGyms.hero.body')}
          </p>

          <div className="mt-stack-xl flex flex-wrap gap-inline-md">
            <Link
              href="/for-gyms/signup"
              data-on-solid="true"
              className="gm-hit-target inline-block rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
            >
              {t('web.forGyms.hero.cta')}
            </Link>
            {/*
             * `data-on-media` and not `data-on-solid`: the focus ring resolves to
             * `content-inverse` under `on-solid`, which goes near-black in dark theme and all but
             * vanishes on this band. See `focus.css`.
             */}
            <a
              href="#how"
              data-on-media="true"
              className="gm-hit-target inline-block rounded-control border border-strong px-inset-xl py-inset-sm text-base font-semibold text-content-on-media"
            >
              {t('web.forGyms.hero.secondary')}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-container px-inset-md py-region-md">
        <h2 className="text-2xl font-semibold tracking-tight text-content sm:text-3xl">
          {t('web.forGyms.value.title')}
        </h2>
        <ul className="mt-stack-xl grid gap-stack-lg sm:grid-cols-2">
          {VALUE.map((item) => {
            const Glyph = icon[item.glyph];
            return (
              <li
                key={item.title}
                className="rounded-card border border-subtle bg-surface-raised p-inset-lg"
              >
                <span className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full bg-surface-brand-subtle">
                  <Glyph aria-hidden="true" className="h-[1.5rem] w-[1.5rem] text-content-brand" />
                </span>
                <h3 className="mt-stack-md text-lg font-semibold text-content">{t(item.title)}</h3>
                <p className="mt-stack-xs text-base text-content-secondary">{t(item.body)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="how" className="border-y border-subtle bg-surface-subtle">
        <div className="mx-auto max-w-container px-inset-md py-region-md">
          <h2 className="text-2xl font-semibold tracking-tight text-content sm:text-3xl">
            {t('web.forGyms.steps.title')}
          </h2>
          <ol className="mt-stack-xl grid gap-stack-lg sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      </section>

      <section className="mx-auto max-w-container px-inset-md py-region-md">
        <div className="max-w-prose">
          <h2 className="text-2xl font-semibold tracking-tight text-content sm:text-3xl">
            {t('web.forGyms.commission.title')}
          </h2>
          <p className="mt-stack-md text-base text-content-secondary">
            {t('web.forGyms.commission.body')}
          </p>
        </div>

        <h2 className="mt-region-sm text-2xl font-semibold tracking-tight text-content sm:text-3xl">
          {t('web.forGyms.faq.title')}
        </h2>
        {/*
         * `<details>` and not a JavaScript accordion. It opens before hydration, it is keyboard
         * operable and announced correctly with no work, and a search engine reads the answers
         * whether or not it expands them.
         */}
        <ul className="mt-stack-lg max-w-prose">
          {FAQ.map((item) => (
            <li key={item.q}>
              <details className="border-b border-subtle py-inset-md">
                <summary className="gm-hit-target cursor-pointer text-base font-medium text-content">
                  {t(item.q)}
                </summary>
                <p className="mt-stack-sm text-base text-content-secondary">{t(item.a)}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-subtle bg-surface-subtle">
        <div className="mx-auto max-w-container px-inset-md py-region-md text-center">
          <h2 className="mx-auto max-w-prose text-2xl font-semibold tracking-tight text-content sm:text-3xl">
            {t('web.forGyms.signup.title')}
          </h2>
          <Link
            href="/for-gyms/signup"
            data-on-solid="true"
            className="gm-hit-target mt-stack-lg inline-block rounded-control bg-brand-solid px-inset-xl py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
          >
            {t('web.forGyms.hero.cta')}
          </Link>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The application form
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ┌─ THE FORM IS COMPLETE AND ITS ENDPOINT IS NOT, AND IT SAYS SO ABOVE THE FIELDS ─────────────┐
 * │ Gym onboarding (`FR-ONB-*`) has no endpoint yet. The choice was between omitting the page,   │
 * │ shipping a form that silently discards an owner's details, or shipping the real fields with  │
 * │ the truth stated where it cannot be missed.                                                   │
 * │                                                                                              │
 * │ The notice sits ABOVE the fields, not beside the button: a gym owner who reads it after       │
 * │ typing their address and phone number has already been wasted. `aria-describedby` ties it to │
 * │ the form so a screen reader hears it as part of the form rather than as passing prose, and    │
 * │ the submit is disabled so nothing can be sent nowhere.                                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function ForGymsSignup() {
  const fields = [
    {
      id: 'gym',
      label: 'web.forGyms.signup.field.gym',
      type: 'text',
      autoComplete: 'organization',
    },
    {
      id: 'contact',
      label: 'web.forGyms.signup.field.contact',
      type: 'text',
      autoComplete: 'name',
    },
    { id: 'email', label: 'web.forGyms.signup.field.email', type: 'email', autoComplete: 'email' },
    { id: 'phone', label: 'web.forGyms.signup.field.phone', type: 'tel', autoComplete: 'tel' },
  ] as const satisfies readonly {
    id: string;
    label: MessageKey;
    type: string;
    autoComplete: string;
  }[];

  return (
    <div className="mx-auto max-w-container px-inset-md py-region-md">
      <h1 className="text-3xl font-bold tracking-tight text-content">
        {t('web.forGyms.signup.title')}
      </h1>
      <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
        {t('web.forGyms.signup.intro')}
      </p>

      <p
        id="signup-notice"
        role="status"
        className="mt-stack-lg max-w-form rounded-card border border-warning bg-surface-warning-subtle px-inset-md py-inset-sm text-base text-content-warning"
      >
        {t('web.forGyms.signup.notice')}
      </p>

      <form aria-describedby="signup-notice" className="mt-stack-lg max-w-form">
        <div className="flex flex-col gap-stack-md">
          {fields.map((field) => (
            <div key={field.id}>
              {/* A real `<label for>`, never a placeholder standing in for one — a placeholder
                  disappears the moment somebody types and takes the question with it. */}
              <label htmlFor={field.id} className="block text-sm font-medium text-content">
                {t(field.label)}
              </label>
              <input
                id={field.id}
                name={field.id}
                type={field.type}
                autoComplete={field.autoComplete}
                disabled
                className="mt-stack-2xs w-full rounded-control border border-input bg-surface-disabled px-inset-md py-inset-sm text-base text-content-disabled"
              />
            </div>
          ))}

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-content">
              {t('web.forGyms.signup.field.city')}
            </label>
            <select
              id="city"
              name="city"
              disabled
              className="mt-stack-2xs w-full rounded-control border border-input bg-surface-disabled px-inset-md py-inset-sm text-base text-content-disabled"
            >
              {CITIES.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="about" className="block text-sm font-medium text-content">
              {t('web.forGyms.signup.field.about')}
            </label>
            <textarea
              id="about"
              name="about"
              rows={4}
              disabled
              className="mt-stack-2xs w-full rounded-control border border-input bg-surface-disabled px-inset-md py-inset-sm text-base text-content-disabled"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled
          aria-disabled="true"
          className="gm-hit-target mt-stack-xl w-full rounded-control bg-surface-disabled px-inset-lg py-inset-sm text-md font-semibold text-content-disabled"
        >
          {t('web.forGyms.signup.submit')}
        </button>
      </form>

      <p className="mt-stack-lg max-w-prose text-sm text-content-muted">
        {t('web.forGyms.signup.verifyNote')}
      </p>
    </div>
  );
}
