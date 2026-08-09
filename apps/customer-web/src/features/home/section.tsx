/**
 * The homepage's section chrome — one heading treatment, one rhythm.
 *
 * A long marketing page is where spacing goes wrong: every section is authored on its own, each
 * picks a slightly different top padding and heading size, and the page reads as a stack of
 * separate documents. One component fixes the rhythm in one place.
 *
 * `tone` swaps the ground so consecutive sections alternate. That is the whole job of
 * `surface-subtle` — `ceiling white` in light, a shade off the canvas in dark — and it is why the
 * palette carries a band colour at all.
 */

import Link from 'next/link';

import type { MessageKey } from '../../shared/i18n/index.ts';
import { t } from '../../shared/i18n/index.ts';

export function Section({
  eyebrow,
  title,
  body,
  action,
  tone = 'default',
  children,
}: {
  /**
   * The small brand-coloured label above the heading.
   *
   * It is not decoration: a long marketing page is a stack of headings, and the eyebrow is what
   * tells a scanner which ONE of them they are currently in. Optional, because a section whose
   * heading already says it would just be repeating itself in two sizes.
   */
  readonly eyebrow?: MessageKey;
  readonly title: MessageKey;
  readonly body?: MessageKey;
  /** A "see all" affordance. Omitted rather than rendered dead when the route is unbuilt. */
  readonly action?: { readonly href: string; readonly label: MessageKey };
  readonly tone?: 'default' | 'subtle';
  readonly children: React.ReactNode;
}) {
  return (
    <section
      className={`border-t border-subtle ${tone === 'subtle' ? 'bg-surface-subtle' : 'bg-surface'}`}
    >
      {/* The reveal rides the INNER element, never the band. A full-bleed section that fades
          would take its background with it and open a stripe of page canvas mid-scroll. */}
      <div className="gm-reveal mx-auto max-w-container px-inset-md py-region-md">
        <div className="flex flex-wrap items-end justify-between gap-inline-md">
          <div className="max-w-prose">
            {eyebrow ? <p className="gm-eyebrow">{t(eyebrow)}</p> : null}
            <h2 className="mt-stack-2xs text-3xl font-bold tracking-tight text-content sm:text-4xl">
              {t(title)}
            </h2>
            {body ? (
              <p className="mt-stack-xs text-base text-content-secondary">{t(body)}</p>
            ) : null}
          </div>
          {action ? (
            <Link
              href={action.href}
              className="text-base font-medium text-content-link hover:underline"
            >
              {t(action.label)}
            </Link>
          ) : null}
        </div>

        <div className="mt-stack-xl">{children}</div>
      </div>
    </section>
  );
}
