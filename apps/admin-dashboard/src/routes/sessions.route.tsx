/**
 * `SCR-ADM-016` — the operator's own devices. `FR-AUTH-09`, `AC-6`, `AC-10`.
 *
 * ┌─ THE `current` FLAG IS NOT DECORATION ──────────────────────────────────────────────────────┐
 * │ Without it, the single most common outcome of this screen is an operator signing THEMSELVES │
 * │ out while trying to remove a device they do not recognise — and then concluding the feature │
 * │ is broken. The row they are using is marked, and its revoke control says what it will do.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE ADDRESS IS SHOWN IN FULL, DELIBERATELY ────────────────────────────────────────────────┐
 * │ `BR-DAT-06` keeps personal data out of logs, traces and analytics. This is none of those: it │
 * │ is the operator's own address, on their own screen, and masking it would remove the exact    │
 * │ signal the page exists to provide — *"signed in from a city I have never visited"*.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Revocation is proved by the list refetching, not by removing the row optimistically. An
 * optimistic removal shows the device gone whether or not the server agreed — which on a security
 * screen is the one place a hopeful lie is unacceptable.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import { listSessions, revokeSession, type SessionRow } from '../shared/api/client.ts';

const SESSIONS_KEY = ['auth', 'sessions'] as const;

export function SessionsRoute() {
  const queryClient = useQueryClient();

  const sessions = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: listSessions,
    // `AC-6` allows revocation 60 seconds to propagate. Polling well inside that means a device
    // revoked from another tab disappears here without the operator wondering whether it worked.
    refetchInterval: 20_000,
  });

  const revoke = useMutation({
    mutationFn: revokeSession,
    onSettled: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  return (
    <>
      <PageHeader title={t('adm.sessions.title')} subtitle={t('adm.sessions.subtitle')} />

      {sessions.isPending && (
        <p className="mt-stack-lg text-base text-content-muted">{t('adm.state.loading')}</p>
      )}

      {sessions.isError && (
        <p
          role="alert"
          className="mt-stack-lg rounded-control border border-danger bg-surface-danger-subtle px-inset-sm py-inset-xs text-base text-content-danger"
        >
          {t('adm.sessions.loadFailed')}
        </p>
      )}

      {sessions.data !== undefined && (
        <ul className="mt-stack-lg flex flex-col gap-stack-sm">
          {sessions.data.sessions.map((row) => (
            <SessionCard
              key={row.id}
              row={row}
              busy={revoke.isPending && revoke.variables === row.id}
              onRevoke={() => {
                revoke.mutate(row.id);
              }}
            />
          ))}
        </ul>
      )}

      {revoke.isError && (
        <p role="alert" className="mt-stack-sm text-base text-content-danger">
          {t('adm.sessions.revokeFailed')}
        </p>
      )}
    </>
  );
}

function SessionCard({
  row,
  busy,
  onRevoke,
}: {
  row: SessionRow;
  busy: boolean;
  onRevoke: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-inline-md rounded-card border border-subtle bg-surface p-inset-md">
      <div className="min-w-0">
        <p className="text-base font-medium text-content">
          {row.device_label ?? t('adm.sessions.unknownDevice')}
          {row.current && (
            <span className="ml-inline-xs rounded-control bg-surface-info-subtle px-inset-xs py-inset-2xs text-sm font-semibold text-content-info">
              {t('adm.sessions.thisDevice')}
            </span>
          )}
        </p>
        <p className="mt-stack-2xs text-sm text-content-secondary">
          {row.ip ?? t('adm.sessions.unknownAddress')} · {formatStarted(row.started_at)}
        </p>
      </div>

      <button
        type="button"
        onClick={onRevoke}
        disabled={busy}
        className="gm-hit-target shrink-0 rounded-control border border-danger px-inset-sm py-inset-xs text-base font-medium text-content-danger disabled:border-subtle disabled:text-content-disabled"
      >
        {busy
          ? t('adm.sessions.revoking')
          : row.current
            ? // Says what it will actually do. "Revoke" on the row you are using is a control
              // whose consequence the operator learns by triggering it.
              t('adm.sessions.signOutHere')
            : t('adm.sessions.revoke')}
      </button>
    </li>
  );
}

/**
 * A readable start time in the viewer's own locale and zone.
 *
 * The server sends UTC, as it should. Rendering that verbatim would make an operator in IST do
 * timezone arithmetic to answer "was that me, ten minutes ago?" — which is the only question this
 * column exists to answer.
 */
function formatStarted(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
