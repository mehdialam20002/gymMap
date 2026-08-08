/**
 * The SLA chip and the age cell - `AdminDashboard.md` 6.2 "Column semantics", `Admin.md` 5.1.1.
 *
 * +- A GLYPH, NOT COLOUR ALONE. THE SPEC SAYS SO AND SO DOES `AX8` -----------------------------+
 * | 6.2: `sla.state` renders "as a chip **with a glyph, not colour alone**: `A BRE` breached,    |
 * | `(clock) 21h` approaching, plain hours within". Two of the three states are red and amber,   |
 * | which for a red-green colour-blind operator triaging sixty applications a day is one signal. |
 * +---------------------------------------------------------------------------------------------+
 *
 * +- NOTHING HERE IS COMPUTED. THAT IS THE WHOLE DESIGN ----------------------------------------+
 * | No threshold, no target, no subtraction. `UI-ADM-4` forbids the console hard-coding the SLA  |
 * | target, and 5.1.1 forbids it deriving the state - a browser in IST computing hours from a    |
 * | UTC timestamp is wrong 23% of the day, and "breaches tomorrow" when it breaches tonight is   |
 * | how a breach happens. The server sends `state`; this picks a glyph for it.                   |
 * +---------------------------------------------------------------------------------------------+
 */

import { Tooltip, type Tone } from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import type { GymRow } from '../shared/api/admin.ts';

type SlaState = NonNullable<GymRow['sla']>['state'];

/** Glyph, tone and label per state. Ordered as an operator experiences them. */
const SLA_LOOK: Record<SlaState, { readonly glyph: string; readonly tone: Tone; readonly key: string }> =
  {
    // A filled triangle, not an exclamation mark: it reads as a warning sign at 11px where `!`
    // reads as the letter l.
    BREACHED: { glyph: '\u25B2', tone: 'danger', key: 'adm.sla.breached' },
    APPROACHING: { glyph: '\u23F1', tone: 'warning', key: 'adm.sla.approaching' },
    WITHIN: { glyph: '', tone: 'neutral', key: 'adm.sla.within' },
    // Deliberately NOT warning-toned. A paused application is not the platform being late; the
    // wall-clock age beside it is what stops the pause hiding a stalled one.
    PAUSED: { glyph: '\u23F8', tone: 'info', key: 'adm.sla.paused' },
  };

const CHIP: Record<Tone, string> = {
  neutral: 'text-content-secondary',
  brand: 'bg-surface-brand-subtle text-content-brand',
  success: 'bg-surface-success-subtle text-content-success',
  warning: 'bg-surface-warning-subtle text-content-warning',
  danger: 'bg-surface-danger-subtle text-content-danger',
  info: 'bg-surface-info-subtle text-content-info',
};

export function SlaChip({ gym }: { readonly gym: GymRow }) {
  const sla = gym.sla;

  // A decided application has no SLA and says so with an em dash rather than a reassuring chip.
  // `WITHIN` on something nobody is waiting for would read as "still fine".
  if (sla === null) {
    return (
      <span aria-label={t('adm.sla.none')} className="text-xs text-content-muted">
        &#8212;
      </span>
    );
  }

  const look = SLA_LOOK[sla.state];

  // 6.2: "A breach shows NEGATIVE `hours_remaining` and stays in the queue." Rendered as the
  // server sent it, sign included - the difference between -2h and -700h is the triage order.
  const figure =
    sla.state === 'PAUSED'
      ? t('adm.sla.pausedShort')
      : `${String(sla.hours_remaining ?? 0)}\u2009h`;

  return (
    <Tooltip
      id={`sla-${gym.id}`}
      text={
        sla.state === 'PAUSED'
          ? t('adm.sla.pausedTip').replace('{h}', String(sla.age_hours_wall_clock))
          : t('adm.sla.tip')
              .replace('{t}', String(sla.target_hours))
              .replace('{h}', String(sla.age_hours_wall_clock))
      }
    >
      <span
        className={`inline-flex items-center gap-inline-2xs rounded-control px-inset-2xs py-[0.0625rem] text-xs font-semibold tabular-nums ${CHIP[look.tone]}`}
      >
        {look.glyph !== '' && <span aria-hidden="true">{look.glyph}</span>}
        {/* The WORD is in the accessible name, so the state never depends on the glyph or the
            tint being perceived. */}
        <span className="gm-visually-hidden">{t(look.key as Parameters<typeof t>[0])}</span>
        <span>{figure}</span>
      </span>
    </Tooltip>
  );
}

/**
 * The age cell.
 *
 * `age_hours` under three days, days above it. Ninety-one hours is a number an officer has to
 * divide; "3 days" is one they can act on. The exact hours stay in the SLA chip's tooltip, so
 * nothing is lost by rounding the display.
 */
export function AgeCell({ gym }: { readonly gym: GymRow }) {
  const hours = gym.age_hours;
  const label =
    hours < 72
      ? `${String(hours)}\u2009h`
      : `${String(Math.floor(hours / 24))}\u2009${t('adm.sla.days')}`;

  return <span className="text-xs tabular-nums text-content-secondary">{label}</span>;
}
