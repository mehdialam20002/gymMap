/**
 * `SCR-WEB-005` — checkout review. `BR-PLN-03`, `FR-CART-04`, `BR-PAY-02`.
 *
 * ┌─ THE PAGE STATES INVARIANT 3 RATHER THAN ONLY OBEYING IT ───────────────────────────────────┐
 * │ "This total is checked again on our server before any payment is taken. If it does not       │
 * │ match, the payment is stopped rather than charged at a different figure."                     │
 * │                                                                                              │
 * │ That sentence is on the screen because the guarantee is worth nothing to a member who does   │
 * │ not know it exists — and because a marketplace where the price moves between the listing     │
 * │ and the card is the single thing this product is differentiating against.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ AND IT DOES NOT PRETEND TO TAKE A PAYMENT ─────────────────────────────────────────────────┐
 * │ The payments module is not built and `EP-08`'s Razorpay adapter does not exist. So the       │
 * │ button is disabled and says why, in one sentence, next to it. A live-looking Pay button on   │
 * │ a fixture listing is the one control a client demo is guaranteed to press.                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';
import { FixtureNotice } from '../discovery/search-results.tsx';
import { formatMinorExact } from '../discovery/search.ts';
import { GymPhoto } from '../discovery/gym-photo.tsx';
import type { CheckoutSelection } from './quote.ts';

export function Checkout({ selection }: { readonly selection: CheckoutSelection }) {
  const { gym, plan, quote } = selection;

  if (gym === null || plan === null || quote === null) return <NotAvailable />;

  const Secure = icon.secure;
  const Verified = icon.verified;

  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <FixtureNotice />

      <h1 className="gm-h2 mt-stack-lg">{t('web.checkout.title')}</h1>

      <div className="mt-stack-xl grid gap-inline-xl lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0">
          <h2 className="text-xl font-semibold text-content">
            {t('web.checkout.section.membership')}
          </h2>

          <div className="gm-card mt-stack-md flex flex-wrap gap-inline-lg rounded-card p-inset-lg">
            {/*
             * The cover is not a link. It pointed at the same gym page as the name three lines
             * below it, so the panel shipped two anchors to one destination and the first was
             * named by the stock photograph's alt text - a screen reader read the contents of a
             * sample image as the label of a link to a gym. Same defect as the one removed from
             * `gym-card.tsx`; the name below is the one anchor, and it always was the useful one.
             */}
            <span className="relative block aspect-video w-[12rem] shrink-0 overflow-hidden rounded-card bg-surface-sunken">
              {/* Cover plus its own disclosure - see `gym-photo.tsx`. */}
              <GymPhoto gym={gym} sizes="12rem" className="h-full w-full" />
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-content">
                <Link href={`/gyms/${gym.citySlug}/${gym.slug}`} className="hover:underline">
                  {gym.name}
                </Link>
              </h3>
              <p className="mt-stack-2xs text-base text-content-secondary">
                {gym.locality}, {gym.city}
              </p>
              <p className="gm-card-badge gm-card-badge-inline mt-stack-xs">
                <Verified aria-hidden="true" className="h-[0.875rem] w-[0.875rem]" weight="fill" />
                {t('web.gym.verifiedByPlatform')}
              </p>

              <dl className="mt-stack-md grid gap-stack-xs sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-content-muted">{t('web.checkout.plan')}</dt>
                  <dd className="mt-stack-2xs text-base font-medium text-content">{plan.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-content-muted">{t('web.checkout.duration')}</dt>
                  <dd className="mt-stack-2xs text-base font-medium text-content">
                    {String(plan.durationDays)} {t('web.checkout.days')}
                  </dd>
                </div>
              </dl>

              <p className="mt-stack-md">
                <Link
                  href={`/gyms/${gym.citySlug}/${gym.slug}`}
                  className="gm-card-add text-sm font-semibold"
                >
                  {t('web.checkout.changePlan')}
                </Link>
              </p>
            </div>
          </div>
        </section>

        <aside className="gm-plan-card lg:self-start">
          <div className="gm-card rounded-card p-inset-lg">
            <h2 className="text-lg font-semibold text-content">
              {t('web.checkout.section.total')}
            </h2>

            {/*
             * A `<dl>` and `tabular-nums`, because this is a column of figures a member is about
             * to be charged and misaligned digits in a total is the oldest way to look untrusted.
             */}
            <dl className="mt-stack-md text-base">
              <Line
                term={t('web.checkout.line.gross')}
                value={formatMinorExact(quote.grossMinor)}
              />
              {quote.discountMinor > 0n && (
                <Line
                  term={t('web.checkout.line.discount')}
                  value={`− ${formatMinorExact(quote.discountMinor)}`}
                />
              )}
              <Line term={t('web.checkout.line.net')} value={formatMinorExact(quote.netMinor)} />

              {/*
               * CGST and SGST as their own lines, because that is what an Indian invoice shows
               * and the two must be seen to sum to the tax. They are split OUT of one 18% figure
               * rather than computed independently — see `quote.ts`.
               */}
              {quote.taxComponents.map((component) => (
                <Line
                  key={component.code}
                  term={`${component.code} ${String(Number(component.bps) / 100)}%`}
                  value={formatMinorExact(component.amountMinor)}
                />
              ))}

              <div className="mt-stack-sm flex items-baseline justify-between gap-inline-md border-t border-strong pt-inset-sm">
                <dt className="text-base font-semibold text-content">
                  {t('web.checkout.line.total')}
                </dt>
                <dd className="text-xl font-semibold tabular-nums text-content">
                  {formatMinorExact(quote.totalMinor)}
                </dd>
              </div>
            </dl>

            <p className="mt-stack-xs text-sm text-content-muted">
              {t('web.checkout.line.taxNote')}
            </p>

            <p className="mt-stack-md flex gap-inline-sm rounded-card bg-surface-sunken p-inset-md text-sm text-content-secondary">
              <Secure aria-hidden="true" className="mt-px h-[1.125rem] w-[1.125rem] shrink-0" />
              {t('web.checkout.priceProof')}
            </p>

            <button
              type="button"
              disabled
              aria-disabled="true"
              className="gm-hit-target mt-stack-lg w-full rounded-control bg-surface-disabled px-inset-lg py-inset-sm text-md font-semibold text-content-disabled"
            >
              {t('web.checkout.pay')}
            </button>
            <p className="mt-stack-xs text-sm text-content-muted">{t('web.checkout.payNotice')}</p>

            <p className="mt-stack-md">
              <Link href="/checkout/confirmation" className="gm-card-add text-sm font-semibold">
                {t('web.confirmation.title')}
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Line({ term, value }: { readonly term: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-inline-md py-inset-2xs">
      <dt className="text-content-secondary">{term}</dt>
      <dd className="tabular-nums text-content">{value}</dd>
    </div>
  );
}

/**
 * A link that names a gym or a plan that does not exist.
 *
 * Rendered rather than 404'd: the URL is a real route and the member arrived from somewhere, so
 * "that plan is not available, here is how to find one" is more use than a not-found page. It
 * also covers the case the parser deliberately rejects — a plan id that belongs to a different
 * gym than the one named.
 */
function NotAvailable() {
  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <h1 className="text-2xl font-semibold text-content">{t('web.checkout.notFound.title')}</h1>
      <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
        {t('web.checkout.notFound.body')}
      </p>
      <Link
        href="/search"
        data-on-solid="true"
        className="gm-hit-target mt-stack-lg inline-block rounded-control bg-brand-solid px-inset-lg py-inset-sm text-base font-semibold text-content-on-brand transition-colors duration-fast ease-standard hover:bg-brand-solid-hover"
      >
        {t('web.checkout.notFound.action')}
      </Link>
    </div>
  );
}
