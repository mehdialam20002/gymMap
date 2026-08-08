/**
 * `SCR-ADM-004` — the gym register. Every gym business on the platform.
 *
 * ┌─ TABULAR NUMERALS ON EVERY FIGURE IN A COLUMN — `DesignSystem.md` §1.1 ─────────────────────┐
 * │ Proportional digits make a column of numbers ragged, and a ragged column cannot be scanned  │
 * │ for an outlier — which is the only reason to put numbers in a column. `tabular-nums` on the │
 * │ commission cell is not typography preference, it is what makes the column readable.          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The commission arrives as integer basis points and is divided in exactly one place
 * (`formatBps`). Same discipline as integer paise, same reason: a rate held as a float is a
 * rounding difference between what the gym agreed and what the ledger applies.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { t } from '../shared/i18n/index.ts';
import {
  GYM_STATUSES,
  formatBps,
  platformGyms,
  type GymStatus,
  type GymRow,
} from '../shared/api/admin.ts';
import { GYM_STATUS_LABEL, StatusPill } from './status-pill.tsx';

export function GymRegisterRoute() {
  const [status, setStatus] = useState<GymStatus | null>(null);

  const gyms = useQuery({
    queryKey: ['admin', 'gyms', status ?? 'all'],
    queryFn: () => platformGyms(status),
    refetchInterval: 60_000,
  });

  return (
    <>
      <h1 className="text-xl font-semibold text-content">{t('adm.gyms.title')}</h1>
      <p className="mt-stack-3xs text-sm text-content-secondary">{t('adm.gyms.subtitle')}</p>

      {/* Buttons rather than a <select>: eight options, all visible, one keystroke each. AX2 is
          keyboard-first and a select needs three interactions to change one filter. */}
      <div
        role="group"
        aria-label={t('adm.gyms.col.status')}
        className="mt-stack-md flex flex-wrap gap-inline-2xs"
      >
        <FilterChip
          active={status === null}
          onClick={() => {
            setStatus(null);
          }}
        >
          {t('adm.gyms.filterAll')}
        </FilterChip>
        {GYM_STATUSES.map((candidate) => (
          <FilterChip
            key={candidate}
            active={status === candidate}
            onClick={() => {
              // Clicking the active chip clears it. Two clicks to undo one is the commonest
              // complaint about filter bars.
              setStatus(status === candidate ? null : candidate);
            }}
          >
            {GYM_STATUS_LABEL[candidate]}
          </FilterChip>
        ))}
      </div>

      {gyms.isPending && (
        <p className="mt-stack-md text-sm text-content-muted">{t('adm.state.loading')}</p>
      )}

      {gyms.isError && (
        <p
          role="alert"
          className="mt-stack-md rounded-control border border-danger bg-surface-danger-subtle px-inset-sm py-inset-xs text-sm text-content-danger"
        >
          {t('adm.gyms.loadFailed')}
        </p>
      )}

      {gyms.data !== undefined &&
        (gyms.data.gyms.length === 0 ? (
          <p className="mt-stack-md rounded-card border border-subtle bg-surface p-inset-lg text-sm text-content-secondary">
            {t('adm.gyms.empty')}
          </p>
        ) : (
          <div className="mt-stack-md overflow-x-auto rounded-card border border-subtle bg-surface">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="gm-visually-hidden">{t('adm.gyms.subtitle')}</caption>
              <thead>
                <tr className="border-b border-subtle text-left">
                  <Th>{t('adm.gyms.col.gym')}</Th>
                  <Th>{t('adm.gyms.col.location')}</Th>
                  <Th>{t('adm.gyms.col.status')}</Th>
                  <Th>{t('adm.gyms.col.subscription')}</Th>
                  <Th align="right">{t('adm.gyms.col.commission')}</Th>
                  <Th>{t('adm.gyms.col.gstin')}</Th>
                </tr>
              </thead>
              <tbody>
                {gyms.data.gyms.map((gym) => (
                  <GymTableRow key={gym.id} gym={gym} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}

function GymTableRow({ gym }: { gym: GymRow }) {
  return (
    <tr className="border-b border-subtle last:border-0 hover:bg-surface-sunken">
      <Td>
        <span className="font-medium text-content">{gym.trading_name ?? gym.legal_name}</span>
        {/* The legal name is what appears on an invoice and in a dispute, so it is shown too
            when it differs — not collapsed into the trading name. */}
        {gym.trading_name !== null && gym.trading_name !== gym.legal_name && (
          <span className="block truncate text-xs text-content-muted">{gym.legal_name}</span>
        )}
      </Td>
      <Td>{[gym.city, gym.state].filter(Boolean).join(', ') || '-'}</Td>
      <Td>
        <StatusPill status={gym.status} />
      </Td>
      <Td>
        <span className="text-xs text-content-secondary">
          {gym.subscription_status.toLowerCase().replace(/_/g, ' ')}
        </span>
      </Td>
      <Td align="right">
        <span className="tabular-nums">{formatBps(gym.commission_rate_bps)}</span>
      </Td>
      <Td>
        {gym.gstin === null ? (
          // Not an error, and not every gym has one — below the threshold, registration is not
          // required. Rendering an empty cell would read as missing data.
          <span className="text-xs text-content-muted">{t('adm.gyms.notRegistered')}</span>
        ) : (
          <span className="font-mono text-xs tabular-nums text-content-secondary">{gym.gstin}</span>
        )}
      </Td>
    </tr>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      scope="col"
      className={`px-inset-md py-inset-xs text-xs font-semibold uppercase tracking-wide text-content-muted ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <td
      className={`max-w-64 px-inset-md py-inset-xs align-top text-content-secondary ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </td>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // `aria-pressed` and not colour alone. A filter whose only "on" signal is a background tint
      // is invisible to a screen reader (AX2).
      aria-pressed={active}
      className={`gm-hit-target rounded-control border px-inset-sm py-inset-3xs text-xs transition-colors duration-fast ease-standard ${
        active
          ? 'border-brand bg-surface-brand-subtle font-semibold text-content-brand'
          : 'border-subtle text-content-secondary hover:text-content'
      }`}
    >
      {children}
    </button>
  );
}
