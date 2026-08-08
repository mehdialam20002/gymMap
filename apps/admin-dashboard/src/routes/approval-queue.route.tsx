/**
 * `SCR-ADM-002` — the approval queue. `BR-GYM-01`, `C4.4`.
 *
 * ┌─ THIS LIST IS REAL, AND THE ACTIONS ON IT ARE NOT ──────────────────────────────────────────┐
 * │ `tenants.status` carries the whole `C4.4` state machine, so SUBMITTED, UNDER_REVIEW and      │
 * │ INFO_REQUESTED are live rows read through an audited cross-tenant elevation. The count in    │
 * │ the sidebar is a fact.                                                                        │
 * │                                                                                              │
 * │ Opening an application and acting on it is `M-036`, and the panel at the bottom says so      │
 * │ rather than offering an Approve button that would do nothing. A demo where the most          │
 * │ important button is decorative is worse than one where it is honestly absent.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ OLDEST FIRST — THE ORDER IS THE FEATURE ───────────────────────────────────────────────────┐
 * │ Newest-first is the default everywhere else and would be wrong here. A queue sorted newest   │
 * │ first starves its own tail: the application that has been waiting nineteen days sinks       │
 * │ further every time somebody else applies, and nobody ever decides to ignore it.              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useQuery } from '@tanstack/react-query';

import { t } from '../shared/i18n/index.ts';
import { AWAITING_STATUSES, platformGyms, type GymRow } from '../shared/api/admin.ts';
import { StatusPill } from './status-pill.tsx';

export function ApprovalQueueRoute() {
  const queue = useQuery({
    queryKey: ['admin', 'gyms', 'queue'],
    // One request, filtered here. The three awaiting statuses are one concept — "waiting on a
    // human" — and three round trips would let them arrive at different moments and render a
    // queue that reorders itself as it loads.
    queryFn: async () => {
      const { gyms } = await platformGyms();
      return gyms
        .filter((gym) => AWAITING_STATUSES.includes(gym.status))
        .sort((a, b) => b.waiting_days - a.waiting_days);
    },
    refetchInterval: 30_000,
  });

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('adm.queue.title')}</h1>
      <p className="mt-stack-2xs max-w-prose text-sm text-content-secondary">
        {t('adm.queue.subtitle')}
      </p>

      {queue.isPending && (
        <p className="mt-stack-md text-sm text-content-muted">{t('adm.state.loading')}</p>
      )}

      {queue.isError && (
        <p
          role="alert"
          className="mt-stack-md rounded-control border border-danger bg-surface-danger-subtle px-inset-sm py-inset-xs text-sm text-content-danger"
        >
          {t('adm.gyms.loadFailed')}
        </p>
      )}

      {queue.data !== undefined &&
        (queue.data.length === 0 ? (
          <p className="mt-stack-md rounded-card border border-subtle bg-surface p-inset-lg text-sm text-content-secondary">
            {t('adm.queue.empty')}
          </p>
        ) : (
          <ul className="mt-stack-md flex flex-col gap-stack-2xs">
            {queue.data.map((gym) => (
              <QueueRow key={gym.id} gym={gym} />
            ))}
          </ul>
        ))}

      <p className="mt-stack-lg max-w-prose rounded-card border border-dashed border-subtle bg-surface-sunken p-inset-md text-sm text-content-muted">
        {t('adm.queue.reviewNote')}
      </p>
    </>
  );
}

function QueueRow({ gym }: { readonly gym: GymRow }) {
  // Ten days is where "waiting" becomes "stuck". Not a rule from the spec — an SLA is M-036's to
  // define — so it emphasises rather than alarms: heavier text, no red, no icon. Inventing a
  // breach indicator before anyone has agreed the threshold would be worse than none.
  const stale = gym.waiting_days >= 10;

  return (
    <li className="flex flex-wrap items-center justify-between gap-inline-md rounded-card border border-subtle bg-surface px-inset-md py-inset-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-content">
          {gym.trading_name ?? gym.legal_name}
        </p>
        <p className="mt-stack-2xs truncate text-xs text-content-secondary">
          {[gym.city, gym.state].filter(Boolean).join(', ') || gym.legal_name}
          {' · '}
          {gym.entity_type.toLowerCase().replace(/_/g, ' ')}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-inline-md">
        <span
          className={`text-xs tabular-nums ${stale ? 'font-semibold text-content' : 'text-content-muted'}`}
        >
          {gym.waiting_days} {gym.waiting_days === 1 ? t('adm.queue.day') : t('adm.queue.days')}{' '}
          {t('adm.queue.waiting')}
        </span>
        <StatusPill status={gym.status} />
      </div>
    </li>
  );
}
