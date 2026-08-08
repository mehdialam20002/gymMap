/**
 * `SCR-WEB-007` — what happens after payment. `BR-PAY-02`, `FR-PAY-03`, `AC-PAY-02.1`.
 *
 * ┌─ INVARIANT 5, WRITTEN DOWN WHERE A MEMBER READS IT ─────────────────────────────────────────┐
 * │ "Membership activation is webhook-driven. A client-side success signal never activates a     │
 * │ membership."                                                                                  │
 * │                                                                                              │
 * │ Every product states that as an engineering rule and then ships a confirmation page that     │
 * │ says "Payment successful!" — which teaches the member that THIS PAGE is the confirmation.    │
 * │ It is not, and the difference is what protects them: a lost connection, a closed tab or a    │
 * │ failed redirect cannot leave somebody paid and without a membership, because none of those   │
 * │ was ever what activated it.                                                                   │
 * │                                                                                              │
 * │ So this page explains the mechanism instead of announcing a result. When the payments        │
 * │ module lands it gains the order's real state — pending, then active — and the explanation    │
 * │ stays, because "pending" is the state a member will actually see for a few seconds and it     │
 * │ needs to be a reassuring word rather than an alarming one.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';
import { icon } from '../../shared/icons/index.tsx';

const NEXT_STEPS = [
  'web.confirmation.next.qr',
  'web.confirmation.next.receipt',
  'web.confirmation.next.email',
] as const satisfies readonly MessageKey[];

export function Confirmation() {
  const Secure = icon.secure;
  const Has = icon.has;

  return (
    <div className="mx-auto max-w-container px-inset-md py-region-md">
      <h1 className="text-3xl font-bold tracking-tight text-content">
        {t('web.confirmation.title')}
      </h1>

      <div className="mt-stack-xl grid gap-inline-xl lg:grid-cols-2">
        <section className="rounded-card border border-subtle bg-surface-raised p-inset-lg">
          <h2 className="flex items-start gap-inline-sm text-lg font-semibold text-content">
            <Secure
              aria-hidden="true"
              className="mt-px h-[1.25rem] w-[1.25rem] shrink-0 text-content-brand"
            />
            {t('web.confirmation.webhook.title')}
          </h2>
          <p className="mt-stack-sm max-w-prose text-base text-content-secondary">
            {t('web.confirmation.webhook.body')}
          </p>
        </section>

        <section className="rounded-card border border-subtle bg-surface-raised p-inset-lg">
          <h2 className="text-lg font-semibold text-content">{t('web.confirmation.next.title')}</h2>
          <ul className="mt-stack-sm flex flex-col gap-stack-sm">
            {NEXT_STEPS.map((key) => (
              <li key={key} className="flex gap-inline-sm text-base text-content-secondary">
                <Has
                  aria-hidden="true"
                  className="mt-px h-[1.125rem] w-[1.125rem] shrink-0 text-content-success"
                />
                {t(key)}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-stack-xl max-w-prose">
        <h2 className="text-lg font-semibold text-content">
          {t('web.confirmation.pending.title')}
        </h2>
        <p className="mt-stack-sm text-base text-content-secondary">
          {t('web.confirmation.pending.body')}
        </p>
      </section>

      <p className="mt-stack-xl">
        <Link href="/search" className="text-base font-medium text-content-link hover:underline">
          {t('web.search.heading.any')}
        </Link>
      </p>
    </div>
  );
}
