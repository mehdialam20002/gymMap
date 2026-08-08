/**
 * Accounts by role — the part of `SCR-ADM-005` that has data behind it today.
 *
 * ┌─ IT COUNTS GRANTS, NOT PEOPLE, AND SAYS SO ─────────────────────────────────────────────────┐
 * │ One person can hold `GYM_OWNER` at two gyms, and both grants are real. Summing this column  │
 * │ therefore does NOT give the number of accounts, which is why the account total is shown      │
 * │ separately rather than left for the reader to derive incorrectly.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The per-person list is `M-023`: it needs the permission matrix to decide which operator may see
 * which accounts, and a list that showed every account to every platform role would be the
 * authorisation gap the matrix exists to close.
 */

import { useQuery } from '@tanstack/react-query';

import { t } from '../shared/i18n/index.ts';
import { platformOverview } from '../shared/api/admin.ts';

/** `§B3.1` order: platform roles, then tenant, then branch, then self. */
const ROLE_ORDER = [
  'SUPER_ADMIN',
  'VERIFICATION_OFFICER',
  'FINANCE',
  'SUPPORT_AGENT',
  'MODERATOR',
  'GYM_OWNER',
  'GYM_MANAGER',
  'RECEPTIONIST',
  'TRAINER',
  'MEMBER',
  'USER',
  'VISITOR',
];

export function PeopleRoute() {
  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: platformOverview,
    refetchInterval: 30_000,
  });

  const byRole = overview.data?.people.byRole ?? {};
  const roles = Object.keys(byRole).sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a);
    const bi = ROLE_ORDER.indexOf(b);
    // A role added to the database but not to ROLE_ORDER sorts last rather than first. Unknown
    // things belong at the bottom of a list an operator scans from the top.
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('adm.people.title')}</h1>
      <p className="mt-stack-2xs max-w-prose text-sm text-content-secondary">
        {t('adm.people.subtitle')}
      </p>

      {overview.isPending && (
        <p className="mt-stack-md text-sm text-content-muted">{t('adm.state.loading')}</p>
      )}

      {overview.data !== undefined && (
        <>
          <div className="mt-stack-md flex flex-wrap gap-inline-md">
            <Figure label={t('adm.dashboard.tile.accounts')} value={overview.data.people.count} />
            <Figure
              label={t('adm.dashboard.tile.sessions')}
              value={overview.data.people.activeSessions}
            />
          </div>

          <div className="mt-stack-md overflow-x-auto rounded-card border border-subtle bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-subtle text-left">
                  <th
                    scope="col"
                    className="px-inset-md py-inset-xs text-xs font-semibold uppercase tracking-wide text-content-muted"
                  >
                    {t('adm.people.role')}
                  </th>
                  <th
                    scope="col"
                    className="px-inset-md py-inset-xs text-right text-xs font-semibold uppercase tracking-wide text-content-muted"
                  >
                    {t('adm.people.grants')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role} className="border-b border-subtle last:border-0">
                    <td className="px-inset-md py-inset-xs text-content">{role}</td>
                    <td className="px-inset-md py-inset-xs text-right tabular-nums text-content-secondary">
                      {byRole[role]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-subtle bg-surface px-inset-md py-inset-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-content-muted">{label}</p>
      <p className="mt-stack-2xs text-xl font-semibold tabular-nums text-content">{value}</p>
    </div>
  );
}
