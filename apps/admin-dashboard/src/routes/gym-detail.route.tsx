/**
 * `SCR-ADM-004` detail — one gym.
 *
 * ┌─ THE HEADER AND THE OVERVIEW ARE REAL. THE OTHER SEVEN TABS ARE NOT ────────────────────────┐
 * │ A `tenant` row carries the business: legal name, trading name, entity type, GSTIN, PAN,      │
 * │ commission rate, registered address, approval status, subscription. All of that is read      │
 * │ through the audited cross-tenant elevation and is exactly what the register shows.           │
 * │                                                                                              │
 * │ Branches, plans, documents, members, finance and reviews have NO TABLES until M-026…M-115.   │
 * │ Their tabs are present, disabled, and name the milestone — a tab that opens onto an empty    │
 * │ panel teaches an operator that the console is unreliable, and one that is simply missing     │
 * │ makes the remaining work invisible.                                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NO SINGLE-GYM ENDPOINT, AND THAT IS DELIBERATE FOR NOW ────────────────────────────────────┐
 * │ This reads the register list and picks the row, rather than adding `GET /admin/gyms/{id}`.   │
 * │ The list is already cached by the register screen, so opening a gym costs no request, and    │
 * │ every cross-tenant read is one more audited elevation to justify. At twenty-three gyms that  │
 * │ is right; past a few hundred it is not, and the endpoint arrives with `M-036` which needs it │
 * │ anyway to load the application dossier.                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Panel, StateBoundary, TableSkeleton, toSurfaceState } from '@gymmap/ui';

import { t, type MessageKey } from '../shared/i18n/index.ts';
import { formatBps, platformGyms, type GymRow } from '../shared/api/admin.ts';
import { toProblem } from '../shared/api/client.ts';
import { GYM_STATUS_LABEL, statusTone } from './status-pill.tsx';

/** The eight tabs. `built` is the honest half of the declaration. */
const TABS: ReadonlyArray<{ id: string; label: MessageKey; built: boolean; milestone?: string }> = [
  { id: 'overview', label: 'adm.detail.tab.overview', built: true },
  { id: 'branches', label: 'adm.detail.tab.branches', built: false, milestone: 'M-114' },
  { id: 'plans', label: 'adm.detail.tab.plans', built: false, milestone: 'M-041' },
  { id: 'documents', label: 'adm.detail.tab.documents', built: false, milestone: 'M-029' },
  { id: 'members', label: 'adm.detail.tab.members', built: false, milestone: 'M-114' },
  { id: 'finance', label: 'adm.detail.tab.finance', built: false, milestone: 'M-097' },
  { id: 'reviews', label: 'adm.detail.tab.reviews', built: false, milestone: 'M-084' },
  { id: 'activity', label: 'adm.detail.tab.activity', built: false, milestone: 'M-117' },
];

export function GymDetailRoute() {
  const { gymId } = useParams<{ gymId: string }>();
  const [tab, setTab] = useState('overview');

  const query = useQuery({
    // The SAME key the register uses, so opening a gym from the list is a cache hit rather than
    // a second audited elevation.
    queryKey: ['admin', 'gyms', 'all'],
    queryFn: () => platformGyms(),
  });

  const gym = query.data?.gyms.find((row) => row.id === gymId);

  const state = toSurfaceState(query, {
    // "Loaded, but this id is not in it" is EMPTY, not an error. A mistyped or stale url is not
    // a failure of the request that just succeeded.
    isEmpty: () => gym === undefined,
    toProblem,
  });

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-content-muted">
        <Link to="/gyms" className="hover:underline">
          {t('adm.gyms.title')}
        </Link>
        {' / '}
        <span className="text-content-secondary">
          {gym?.trading_name ?? gym?.legal_name ?? '…'}
        </span>
      </nav>

      <StateBoundary
        state={state}
        regionLabelText={t('adm.detail.region')}
        loadingFallback={<TableSkeleton rows={5} />}
        onRetry={() => {
          void query.refetch();
        }}
        emptyState={{
          title: t('adm.detail.notFound'),
          bodyText: t('adm.detail.notFoundBody'),
          primaryAction: { label: t('adm.gyms.title'), href: '/gyms' },
        }}
      >
        {() =>
          gym === undefined ? null : (
            <>
              <header className="mt-stack-sm flex flex-wrap items-start justify-between gap-inline-md">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-inline-sm">
                    <h1 className="text-xl font-semibold text-content">
                      {gym.trading_name ?? gym.legal_name}
                    </h1>
                    <Badge tone={statusTone(gym.status)}>{GYM_STATUS_LABEL[gym.status]}</Badge>
                  </div>
                  <p className="mt-stack-2xs text-sm text-content-secondary">
                    {[gym.city, gym.state].filter(Boolean).join(', ') || gym.legal_name}
                  </p>
                </div>

                {/* Editing a tenant is M-114 and every mutation here is audited, so the control
                    is present and inert rather than absent. */}
                <Button disabled>{t('adm.detail.edit')}</Button>
              </header>

              <div
                role="tablist"
                aria-label={t('adm.detail.region')}
                className="mt-stack-md flex flex-wrap gap-inline-2xs border-b border-subtle"
              >
                {TABS.map((entry) => {
                  const active = entry.id === tab;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      // An unbuilt tab is DISABLED, not clickable-then-empty. `title` carries the
                      // milestone so the answer is available without opening anything.
                      disabled={!entry.built}
                      title={
                        entry.built ? undefined : `${t(entry.label)} - ${entry.milestone ?? ''}`
                      }
                      onClick={() => {
                        setTab(entry.id);
                      }}
                      className={`gm-hit-target -mb-px border-b-2 px-inset-sm py-inset-xs text-sm transition-colors duration-fast ease-standard ${
                        active
                          ? 'border-brand font-semibold text-content-brand'
                          : entry.built
                            ? 'border-transparent text-content-secondary hover:text-content'
                            : 'cursor-not-allowed border-transparent text-content-disabled'
                      }`}
                    >
                      {t(entry.label)}
                    </button>
                  );
                })}
              </div>

              {tab === 'overview' && <Overview gym={gym} />}
            </>
          )
        }
      </StateBoundary>
    </>
  );
}

function Overview({ gym }: { readonly gym: GymRow }) {
  return (
    <div className="mt-stack-md grid gap-inline-sm xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 flex flex-col gap-inline-sm">
        <Panel title={t('adm.detail.business')}>
          <dl className="grid gap-stack-2xs sm:grid-cols-2">
            <Field label={t('adm.detail.legalName')} value={gym.legal_name} />
            <Field
              label={t('adm.detail.entityType')}
              value={gym.entity_type.toLowerCase().replace(/_/g, ' ')}
            />
            <Field
              label={t('adm.gyms.col.gstin')}
              value={gym.gstin ?? t('adm.gyms.notRegistered')}
              mono={gym.gstin !== null}
            />
            <Field
              label={t('adm.gyms.col.commission')}
              value={formatBps(gym.commission_rate_bps)}
            />
            <Field
              label={t('adm.gyms.col.subscription')}
              value={gym.subscription_status.toLowerCase().replace(/_/g, ' ')}
            />
            <Field
              label={t('adm.detail.registeredOn')}
              value={new Date(gym.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />
          </dl>
        </Panel>

        <Panel title={t('adm.detail.address')}>
          <p className="text-sm text-content-secondary">
            {[gym.city, gym.state].filter(Boolean).join(', ') || t('adm.detail.noAddress')}
          </p>
          {/* The street line is not in the register projection — `BR-DAT-06`, a screen that lists
              gyms has no need of it. It arrives with the dossier in M-036. */}
          <p className="mt-stack-2xs text-xs text-content-muted">{t('adm.detail.addressNote')}</p>
        </Panel>
      </div>

      <aside className="flex min-w-0 flex-col gap-inline-sm">
        <Panel title={t('adm.detail.identifiers')}>
          <dl className="flex flex-col gap-stack-2xs">
            <Field label="ID" value={gym.id} mono />
            <Field label={t('adm.gyms.col.status')} value={GYM_STATUS_LABEL[gym.status]} />
          </dl>
        </Panel>

        {/* KYC has no table until M-029. Named with its milestone rather than shown as a list of
            green ticks nobody verified. */}
        <Panel title={t('adm.detail.kyc')}>
          <p className="text-xs text-content-muted">{t('adm.detail.kycPending')}</p>
        </Panel>
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-content-muted">{label}</dt>
      <dd
        className={`mt-stack-2xs truncate text-sm text-content ${mono ? 'font-mono tabular-nums' : 'capitalize'}`}
      >
        {value}
      </dd>
    </div>
  );
}
