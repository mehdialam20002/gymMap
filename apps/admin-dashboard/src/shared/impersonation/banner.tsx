/**
 * The impersonation banner — `FR-AUTH-12`, `BR-DAT-02`. `FolderStructure.md` §6.
 *
 * ┌─ RENDERED BY THE ROOT LAYOUT, NEVER BY A FEATURE ───────────────────────────────────────────┐
 * │ §6's rule: "shared/impersonation/ is imported by the root layout, not by a feature — the     │
 * │ banner must be impossible to render a page WITHOUT."                                          │
 * │                                                                                              │
 * │ A per-page banner is one forgotten import away from an operator viewing a member's data      │
 * │ while believing they are viewing their own. That is the exact confusion `BR-DAT-02` exists   │
 * │ to prevent, and it is silent: nothing looks wrong.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Warning colours and not danger: impersonation is a legitimate, audited support capability, not
 * a failure. `danger` here would make the everyday support flow look like an error and teach
 * operators to ignore red — which costs when something actually is wrong (§3.10).
 *
 * The restriction line is stated rather than left implicit: `AC-AUTH-03.2` disables financial
 * mutations and cross-tenant reads during a session, and a silently missing button reads as a
 * bug and generates a support ticket.
 */

import { t } from '../i18n/index.ts';
import type { AdminSession } from '../auth/session.tsx';

export function ImpersonationBanner({ session }: { session: AdminSession }) {
  if (session.status !== 'AUTHENTICATED' || !session.impersonating) return null;

  return (
    // role="status" and not "alert": an alert interrupts the screen reader mid-sentence, and this
    // is a persistent condition rather than an event. aria-live="polite" announces it once the
    // user pauses, which is the right urgency for something that is true for the whole session.
    <div
      role="status"
      aria-live="polite"
      aria-label={t('adm.impersonation.label')}
      className="sticky top-0 z-app-chrome border-b border-warning bg-warning-solid px-inset-md py-inset-sm text-content-on-warning"
      data-on-solid="true"
    >
      <div className="mx-auto flex max-w-container flex-wrap items-center gap-inline-md">
        <span className="text-base font-semibold">
          {t('adm.impersonation.actingAs')}: {session.impersonating.subjectLabel}
        </span>
        <span className="text-sm">{t('adm.impersonation.restriction')}</span>
        <button
          type="button"
          className="gm-hit-target ml-auto rounded-control border border-current px-inset-sm py-inset-2xs text-sm font-medium"
        >
          {t('adm.impersonation.end')}
        </button>
      </div>
    </div>
  );
}
