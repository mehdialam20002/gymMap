/**
 * `SCR-ADM-001` — the platform dashboard.
 *
 * Compact density and keyboard-first: Anita reviews 30–60 applications a day and Vikram needs a
 * figure he can trace to its source events (`DesignSystem.md` §1.1). The failure mode this
 * surface guards against is ambiguity about which figure is authoritative — so the shell shows
 * no figures at all rather than placeholder numbers.
 *
 * A dashboard full of `0` or `—` is worse than an empty one: an operator reads a zero as data.
 */

import { t } from '../shared/i18n/index.ts';

export function PlatformDashboardRoute() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-content">{t('adm.dashboard.title')}</h1>
      <p className="mt-stack-2xs text-base text-content-secondary">{t('adm.dashboard.subtitle')}</p>

      <div className="mt-stack-lg rounded-card border border-info bg-surface-info-subtle p-inset-lg">
        <h2 className="text-lg font-semibold text-content-info">{t('adm.shell.status.title')}</h2>
        <p className="mt-stack-2xs max-w-ui text-base text-content-info">
          {t('adm.shell.status.body')}
        </p>
      </div>
    </>
  );
}
