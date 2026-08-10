'use client';

/**
 * The error state — one of the four states `B6` requires on every screen.
 *
 * `'use client'` is mandatory for an error boundary; it is the one place in `app/` where it is
 * not a smell.
 *
 * The digest is shown, and the raw message is NOT. `BR-DAT-06` keeps personal data out of error
 * traces, and an unhandled server error can carry a query fragment or an identifier in its
 * message. The digest is a hash the server logs alongside the real error, so support can find it
 * without the user's screen becoming the leak.
 */

import { t } from '../src/shared/i18n/index.ts';

export default function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="gm-wrap gm-sec gm-sec-tight">
      <div className="max-w-ui rounded-card border border-danger bg-surface-danger-subtle p-inset-lg">
        {/*
         * `gm-h2 text-content-danger`, because `gm-h2-danger` is defined in no stylesheet in this
         * repository. It has always been an unmatched selector, so the error page's heading has
         * been rendering at the same size and weight as the sentence beneath it - on the one screen
         * whose whole job is to be scanned quickly by somebody who has just hit a failure.
         * `not-found.tsx` uses the real `gm-h2`, which is how the typo survived review.
         */}
        <h1 className="gm-h2 text-content-danger">{t('web.state.error.title')}</h1>
        <p className="mt-stack-sm text-base text-content-danger">{t('web.state.error.body')}</p>

        {error.digest ? (
          <p className="mt-stack-md text-sm text-content-danger">
            {t('web.state.error.reference')}: <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="gm-hit-target mt-stack-lg rounded-control bg-danger-solid px-inset-lg py-inset-sm text-md font-semibold text-content-on-danger transition-colors duration-fast ease-standard hover:bg-danger-solid-hover"
          data-on-solid="true"
        >
          {t('web.state.error.retry')}
        </button>
      </div>
    </div>
  );
}
