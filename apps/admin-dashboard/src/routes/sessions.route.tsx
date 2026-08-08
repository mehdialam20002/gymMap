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
import { useState } from 'react';
import { ConfirmDialog, PageHeader, ToastStack, useToasts } from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import { listSessions, revokeSession, type SessionRow } from '../shared/api/client.ts';
import { REASON_FLOOR } from '../shared/reason/reason.ts';

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

  const toasts = useToasts();
  /** The row awaiting confirmation. `null` when no dialog is open. */
  const [pending, setPending] = useState<SessionRow | null>(null);

  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      // A toast, not silence. The row disappears on the next poll, and a disappearance is
      // ambiguous - it looks the same as a list that reloaded. `AC-6` also gives revocation 60
      // seconds to propagate, so "gone from this list" and "signed out everywhere" are not the
      // same instant and the wording says the former.
      toasts.push('success', t('adm.sessions.revoked'));
    },
    onError: () => {
      // `danger` toasts do not expire (see `useToasts`). A failed revocation that faded would
      // leave an operator believing a device was signed out when it was not.
      toasts.push('danger', t('adm.sessions.revokeFailed'));
    },
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
                // +- CONFIRMATION FIRST. `NFR-USE-06`, AND THIS IS ONE OF THE ELEVEN ------------+
                // | `AdminDashboard.md` 5.2 enumerates eleven destructive actions on this        |
                // | surface. Number 6 is "Force logout / revoke sessions", and its consequence   |
                // | line must state "the number of sessions, and that the user must sign in      |
                // | again". It was a one-click button with no confirmation at all.               |
                // +-----------------------------------------------------------------------------+
                setPending(row);
              }}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => {
          setPending(null);
        }}
        onConfirm={(reasonText) => {
          const row = pending;
          setPending(null);
          if (row === null) return;
          // The reason is collected and, for now, only proves the floor was met: `DELETE
          // /v1/auth/sessions/:id` takes no reason body, because it is a member acting on their
          // OWN device rather than an administrator acting on someone else's. When this screen
          // gains the platform-staff force-logout of `SCR-ADM-005`, the reason goes on the wire and
          // into `audit_log` - `FR-ADMN-02` requires it on every admin mutation, and RS1 makes it
          // required on every admin POST/PUT/PATCH with no exception.
          void reasonText;
          revoke.mutate(row.id);
        }}
        title={
          pending?.current === true
            ? t('adm.sessions.confirm.titleHere')
            : t('adm.sessions.confirm.title')
        }
        // `DC2` - what happens to whom, with the real device and the real count. Never "Are you
        // sure?". `DC1` wants the figures server-computed, and these are: the list is the server's.
        description={
          pending?.current === true
            ? t('adm.sessions.confirm.bodyHere')
            : t('adm.sessions.confirm.body')
                .replace('{d}', pending?.device_label ?? t('adm.sessions.unknownDevice'))
                .replace('{n}', String(sessions.data?.sessions.length ?? 0))
        }
        // `DC5` - reversible, and the reverse is named. Signing in again is the reverse, and saying
        // so is what stops an operator hesitating over a control they should use freely.
        reversibility={{ kind: 'REVERSIBLE', text: t('adm.sessions.confirm.reversible') }}
        reason={{
          label: t('adm.reason.label'),
          hint: t('adm.reason.hint'),
          // The shared constant, never a literal. `RD2` puts the general floor at ten characters
          // after trimming, matching the server's `RS3`, and `RD4`'s higher floors are per-action
          // entries in `REASON_FLOOR` rather than a number typed into a component.
          minLength: REASON_FLOOR.general,
        }}
        busy={revoke.isPending}
        // `DC4` - the button carries the VERB, never "OK".
        labels={{
          confirm: t('adm.sessions.confirm.verb'),
          cancel: t('adm.action.cancel'),
          close: t('adm.action.close'),
          charactersShort: t('adm.reason.short'),
        }}
      />

      <ToastStack
        messages={toasts.messages}
        onDismiss={toasts.dismiss}
        dismissLabel={t('adm.action.dismiss')}
      />
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
