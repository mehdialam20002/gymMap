/**
 * `SCR-ADM-003` — Application Review. `docs/ui/AdminDashboard.md` §6.3.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE MOST CONSEQUENTIAL SCREEN IN THE PLATFORM, AND THE ONE MOST DANGEROUS TO FAKE
 *
 * §6.3 says it plainly: this screen carries `OBJ-03` — *"guarantee that every listed gym is a real,
 * verified business"* — and `RSK-01`, fake or non-existent gyms listed, **score 20, the highest in
 * the register**. `A3.2`: *"Trust is the marketplace's only durable moat. It is cheap to lose and
 * expensive to rebuild."*
 *
 * Which sets a hard rule for this file, stricter than anywhere else in the console:
 *
 *   NO SAMPLE DATA. NOT ONE FIELD.
 *
 * Elsewhere a labelled sample figure is honest — a made-up revenue number beside a banner costs
 * nothing. Here a fabricated `✓ PAN legible` or a green `4 pre-checks passed` is a screenshot that
 * says a human verified something. That is the exact claim the platform sells, and inventing it
 * even behind a banner would be rehearsing the failure `RSK-01` describes. So every region whose
 * data does not exist yet renders as an explicit ABSENCE with its milestone named, never as a
 * plausible pass.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ WHAT IS REAL HERE ─────────────────────────────────────────────────────────────────────────┐
 * │ The header, the application data and the SLA. `tenants` carries the business — legal name,   │
 * │ entity type, GSTIN, commission, registered city and state, status — and the SLA is computed  │
 * │ server-side (`Admin.md` §5.1.1). All of it read through the audited cross-tenant elevation.  │
 * │                                                                                              │
 * │ Absent, with milestones: KYC documents and the inline viewer (`M-029`), the pre-check panel  │
 * │ and its eight checks (`M-036`), the structured checklist (`M-036`), version history and the   │
 * │ field-level diff (`M-036`), internal notes (`M-036`), and the three decision endpoints.       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE ACTION BAR IS STICKY AND INERT, AND BOTH HALVES MATTER ─────────────────────────────────┐
 * │ §6.3.2: the bar is `position: sticky; bottom: 0` at every width, *"because an officer must    │
 * │ never scroll to decide"*. So it is sticky now, while there is nothing to decide, because the  │
 * │ layout is the thing being got right.                                                          │
 * │                                                                                              │
 * │ Inert because `POST …/approve`, `…/reject` and `…/request-info` do not exist. A live-looking  │
 * │ Approve that silently did nothing on THIS screen would be the worst button in the product.    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  DecisionBar,
  Panel,
  StateBoundary,
  TableSkeleton,
  Timeline,
  toSurfaceState,
} from '@gymmap/ui';

import { t, type MessageKey } from '../shared/i18n/index.ts';
import { formatBps, platformGyms, type GymRow } from '../shared/api/admin.ts';
import { toProblem } from '../shared/api/client.ts';
import { GYM_STATUS_LABEL, statusTone } from './status-pill.tsx';
import { SlaChip } from './sla-chip.tsx';

export function ApplicationReviewRoute() {
  const { gymId } = useParams<{ gymId: string }>();

  const query = useQuery({
    // The register's key, so arriving from the queue costs no request and no second audited
    // elevation. `M-036` brings `GET /v1/admin/applications/:id`, which this becomes.
    queryKey: ['admin', 'gyms', 'all'],
    queryFn: () => platformGyms(),
  });

  const gym = query.data?.gyms.find((row) => row.id === gymId);

  const state = toSurfaceState(query, {
    // A url that does not match a row is EMPTY, not an error: the request succeeded. A stale link
    // from a decided application is the common case and it is not a failure.
    isEmpty: () => gym === undefined,
    toProblem,
  });

  return (
    <>
      <nav aria-label={t('adm.detail.breadcrumb')} className="text-xs text-content-muted">
        <Link to="/approvals" className="hover:underline">
          {t('adm.queue.title')}
        </Link>
        {' / '}
        <span className="text-content-secondary">
          {gym?.trading_name ?? gym?.legal_name ?? '…'}
        </span>
      </nav>

      <StateBoundary
        state={state}
        regionLabelText={t('adm.review.region')}
        loadingFallback={<TableSkeleton rows={8} />}
        onRetry={() => {
          void query.refetch();
        }}
        emptyState={{
          title: t('adm.review.notFound'),
          bodyText: t('adm.review.notFoundBody'),
          primaryAction: { label: t('adm.queue.title'), href: '/approvals' },
        }}
      >
        {() => (gym === undefined ? null : <Review gym={gym} />)}
      </StateBoundary>
    </>
  );
}

function Review({ gym }: { readonly gym: GymRow }) {
  return (
    <>
      {/* ══ Header — §6.3.2's top strip. Every field real. ═════════════════════════════ */}
      <header className="mt-stack-sm flex flex-wrap items-start justify-between gap-inline-md">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            {gym.trading_name ?? gym.legal_name}
          </h1>
          <div className="mt-stack-2xs flex flex-wrap items-center gap-inline-sm text-xs text-content-secondary">
            <Badge tone={statusTone(gym.status)}>{GYM_STATUS_LABEL[gym.status]}</Badge>
            <span>{[gym.city, gym.state].filter(Boolean).join(', ') || gym.legal_name}</span>
            <span aria-hidden="true">&middot;</span>
            <span className="tabular-nums">
              {t('adm.review.submitted')} {new Date(gym.created_at).toLocaleDateString('en-IN')}
            </span>
            <SlaChip gym={gym} />
          </div>
        </div>

        {/* §6.3's header carries `Reassign`. There is no assignee to reassign until the
            applications table exists, so the control names its milestone rather than opening a
            picker over nothing. */}
        <span title={t('adm.review.reassignWhy')}>
          <Button disabled>{t('adm.review.reassign')}</Button>
        </span>
      </header>

      {/* ══ Pre-checks — §6.3.4. PC1 puts this above the split, full width. ════════════ */}
      <div className="mt-stack-md" />
      <AbsentRegion
        titleKey="adm.review.prechecks"
        bodyKey="adm.review.prechecksBody"
        milestone="M-036"
        emphasis
      />

      {/* ══ The split. §6.3.2: documents left, checklist right. ════════════════════════ */}
      <div className="mt-stack-md grid gap-inline-md xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-stack-md">
          <AbsentRegion
            titleKey="adm.review.documents"
            bodyKey="adm.review.documentsBody"
            milestone="M-029"
          />

          {/* The one panel on this screen with real content. */}
          <Panel title={t('adm.review.applicationData')}>
            <dl className="grid gap-stack-xs sm:grid-cols-2">
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
              <Field label={t('adm.review.tenantId')} value={gym.id} mono />
            </dl>

            {/* ┌─ WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────┐
                │ PAN, the registration number, the street address, the contact number and │
                │ the bank account are all on `tenants` and none is in this response. The  │
                │ register projection selects columns explicitly (`BR-DAT-06`), so a       │
                │ screen that lists gyms cannot receive a PAN by accident.                 │
                │                                                                         │
                │ They belong on THIS screen — §6.3.2's Application data block lists them  │
                │ — and they arrive with the dossier endpoint, which can log the access     │
                │ that reading them requires. Adding them to the register projection would │
                │ have put a PAN into the queue's response for every gym at once.          │
                └─────────────────────────────────────────────────────────────────────────┘ */}
            <p className="mt-stack-sm text-xs text-content-muted">{t('adm.review.dataNote')}</p>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-stack-md">
          <AbsentRegion
            titleKey="adm.review.checklist"
            bodyKey="adm.review.checklistBody"
            milestone="M-036"
          />
          <AbsentRegion
            titleKey="adm.review.notes"
            bodyKey="adm.review.notesBody"
            milestone="M-036"
          />

          {/* History is the one absent region with a shape worth showing, because the ONE event it
              would contain is real: the application arrived, and we know when. A timeline of one is
              still a timeline, and it makes the gap legible — the versions and the field-level diff
              are what is missing, not the concept. */}
          <Panel title={t('adm.review.history')}>
            <Timeline
              label={t('adm.review.history')}
              emptyText={t('adm.review.historyEmpty')}
              entries={[
                {
                  id: 'submitted',
                  headline: t('adm.review.timelineSubmitted'),
                  at: new Date(gym.created_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                  tone: 'info',
                  detail: (
                    <p className="text-xs text-content-muted">
                      {t('adm.review.timelineOnlyEvent')}
                    </p>
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      </div>

      {/* ══ §6.3.2: sticky at bottom, every width. An officer must never scroll to decide. ══ */}
      <DecisionBar
        disabled
        note={t('adm.review.barNote')}
        // Inert, so these never fire. Present as the real handlers they will be, rather than as
        // `() => {}` placeholders that hide which action each button carries.
        onReject={() => undefined}
        onRequestInfo={() => undefined}
        onApprove={() => undefined}
        labels={{
          reject: t('adm.review.reject'),
          requestInfo: t('adm.review.requestInfo'),
          approve: t('adm.review.approve'),
          region: t('adm.review.barRegion'),
        }}
      />
    </>
  );
}

/**
 * A region whose data does not exist, stated as an absence.
 *
 * ┌─ WHY THIS IS NOT AN EMPTY PANEL ────────────────────────────────────────────────────────────┐
 * │ An empty bordered box teaches an operator that the console is unreliable — they cannot tell  │
 * │ "nothing to show" from "failed to load". A region that is simply missing makes the remaining │
 * │ work invisible, and on this screen it would also hide which evidence a decision is currently │
 * │ being made without.                                                                          │
 * │                                                                                              │
 * │ So each one names what it will hold, why it does not yet, and the milestone. `emphasis` is    │
 * │ for the pre-check panel, which `PC1` makes the first thing below the header: an officer must  │
 * │ not be able to mistake "no failures shown" for "no failures".                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function AbsentRegion({
  titleKey,
  bodyKey,
  milestone,
  emphasis = false,
}: {
  readonly titleKey: MessageKey;
  readonly bodyKey: MessageKey;
  readonly milestone: string;
  readonly emphasis?: boolean;
}) {
  return (
    <section
      aria-label={t(titleKey)}
      // No `mt-*`. `SP2`: gaps use `gap`, not margins — and flex gaps do NOT collapse with
      // margins, so this margin was ADDING to the column's gap and producing 20px between the
      // first two boxes and 8px between the next two, in one 400px column.
      className={`rounded-card border border-dashed p-inset-md ${
        emphasis ? 'border-warning bg-surface-warning-subtle' : 'border-subtle bg-surface-sunken'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-inline-sm">
        <h2
          className={`text-sm font-semibold ${emphasis ? 'text-content-warning' : 'text-content-secondary'}`}
        >
          {t(titleKey)}
        </h2>
        <span className="rounded-control border border-subtle px-inset-2xs text-xs font-medium tabular-nums text-content-muted">
          {milestone}
        </span>
      </div>
      <p className="mt-stack-2xs max-w-prose text-xs text-content-muted">{t(bodyKey)}</p>
    </section>
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
