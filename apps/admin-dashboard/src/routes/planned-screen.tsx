/**
 * A screen that exists, is specified, and has no data yet.
 *
 * ┌─ THIS IS AN HONEST SCREEN, NOT A PLACEHOLDER ────────────────────────────────────────────────┐
 * │ It renders the real `§B8` specification: the sentence describing what the screen is for, the  │
 * │ filters it will carry, and its column headers over an EMPTY body. Nothing here invents a row.  │
 * │                                                                                              │
 * │ The empty table is the point. An operator landing on Disputes sees a `Deadline` column and     │
 * │ learns that deadlines are tracked; they see no rows and read the line saying why. Both facts   │
 * │ are true, and neither is available from a placeholder that says "SCR-ADM-009 · M-105".         │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE CONTROLS ARE DISABLED, NOT ABSENT ─────────────────────────────────────────────────────┐
 * │ `DesignSystem.md` §5.4 keeps filters interactive during LOADING, and this is not loading — it │
 * │ is a screen with nothing to filter. A live filter over an empty table would be a control that │
 * │ demonstrably does nothing, which is the one thing worse than a disabled one.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { PageHeader, Panel } from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import type { ScreenPlan } from './screen-plan.ts';

/**
 * Which kind of blocker an identifier names.
 *
 * ┌─ A MILESTONE AND A DECISION ARE NOT THE SAME KIND OF WAIT ──────────────────────────────────┐
 * │ `M-104` unblocks by somebody writing code. `BLK-04` does not — it is seven questions for a   │
 * │ tax adviser, and no amount of engineering shortens it. `KL-006` is a commercial answer.       │
 * │                                                                                              │
 * │ Rendering them identically would let a reader plan around a date that does not exist. So the  │
 * │ two are labelled and toned differently, and the decision ones read as the harder wait,        │
 * │ because they are.                                                                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function blockerKind(id: string): 'BUILD' | 'DECISION' {
  return id.startsWith('M-') ? 'BUILD' : 'DECISION';
}

export function PlannedScreen({ plan }: { readonly plan: ScreenPlan }) {
  return (
    <>
      <PageHeader
        title={t(plan.titleKey)}
        subtitle={t(plan.contentKey)}
        // No chip where there is no id. The seven configuration pages are real destinations that
        // §B3 does not number, and an empty bordered box would read as a missing value.
        {...(plan.screen === undefined
          ? {}
          : {
              meta: (
                <span className="rounded-control border border-subtle px-inset-2xs font-mono text-xs text-content-muted">
                  {plan.screen}
                </span>
              ),
            })}
      />

      {/* ══ What it waits on. Above the table, because it is the answer to the empty one. ══ */}
      <section
        aria-label={t('adm.plan.blockedRegion')}
        className="mt-stack-md rounded-card border border-dashed border-subtle bg-surface-sunken p-inset-md"
      >
        <h2 className="text-sm font-semibold text-content-secondary">
          {t('adm.plan.blockedTitle')}
        </h2>

        <ul className="mt-stack-xs flex flex-wrap items-center gap-inline-xs">
          {plan.blockedOn.map((id) => {
            const decision = blockerKind(id) === 'DECISION';
            return (
              <li key={id}>
                <span
                  className={`inline-flex items-center gap-inline-2xs rounded-control px-inset-xs py-inset-2xs text-xs font-medium ${
                    decision
                      ? 'bg-surface-warning-subtle text-content-warning'
                      : 'bg-surface-info-subtle text-content-info'
                  }`}
                >
                  {/* The word, not only the tint — `AX8`. And the word is the distinction that
                      matters: "needs a decision" cannot be scheduled the way "needs building" can. */}
                  <span className="font-mono tabular-nums">{id}</span>
                  <span>
                    {decision ? t('adm.plan.needsDecision') : t('adm.plan.needsBuilding')}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        {plan.noteKey !== undefined && (
          <p className="mt-stack-xs max-w-prose text-xs text-content-muted">{t(plan.noteKey)}</p>
        )}
      </section>

      {/* ══ The filters §B8 names. Inert. ══════════════════════════════════════════════ */}
      {plan.filterKeys.length > 0 && (
        <div
          role="group"
          aria-label={t('adm.plan.filtersRegion')}
          className="mt-stack-sm flex flex-wrap items-center gap-inline-2xs"
        >
          {plan.filterKeys.map((key) => (
            <button
              key={key}
              type="button"
              disabled
              title={t('adm.plan.filterDisabled')}
              className="gm-hit-target rounded-control border border-subtle px-inset-sm py-inset-2xs text-xs text-content-disabled"
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}

      {/* ══ The columns, real, over an empty body. ═════════════════════════════════════ */}
      <Panel className="mt-stack-sm">
        {plan.columnKeys.length === 0 ? (
          // Some screens are not tables. §B8 gives `SCR-ADM-014` a report catalogue and settings a
          // form; drawing a headerless empty table for them would invent a shape the spec does not
          // describe.
          <p className="text-sm text-content-muted">{t('adm.plan.notATable')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: '48rem' }}>
              <caption className="gm-visually-hidden">{t(plan.contentKey)}</caption>
              <thead>
                <tr className="border-b border-subtle text-left">
                  {plan.columnKeys.map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="whitespace-nowrap px-inset-sm py-inset-xs text-xs font-semibold uppercase tracking-wide text-content-muted"
                    >
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {/* One cell spanning the table, saying why it is empty. NOT a set of dashed
                      skeleton rows: a skeleton means "data is coming in a moment", and here it is
                      not — the difference is the whole message. */}
                  <td
                    colSpan={plan.columnKeys.length}
                    className="px-inset-sm py-region-sm text-center text-sm text-content-muted"
                  >
                    {t('adm.plan.noRows')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
