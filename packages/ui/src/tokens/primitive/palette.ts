/**
 * Tier 1 · The primitive ramps — `DesignSystem.md` §3.2. A-03, A-04, §C1.1.
 *
 * ┌─ NOTHING IN `apps/**` MAY NAME A VALUE IN THIS FILE ────────────────────────────────────────┐
 * │ `UI3` makes it a lint failure, and the reason is quieter than it looks. `text-indigo-600` in │
 * │ a feature file compiles, renders correctly, and silently opts that one element out of dark   │
 * │ mode, out of the §3.6 contrast proof, and out of every future palette change. It is not      │
 * │ wrong today; it is wrong in six months, invisibly.                                            │
 * │                                                                                              │
 * │ The Tailwind preset never emits primitive class names, so a primitive in an app does not     │
 * │ merely fail review — it does not exist as a class.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE BRAND IS INDIGO, AND THAT IS A SAFETY DECISION ────────────────────────────────────────┐
 * │ `SCR-DASH-009` puts a green ALLOWED and a red DENIED in front of a receptionist a few        │
 * │ hundred times a day, and `NFR-USE-01` makes that screen a WCAG 2.1 AA surface. A green brand │
 * │ would put every primary button, active nav item and focus ring in the same perceptual        │
 * │ neighbourhood as "this member may enter" — a neighbourhood that already contains red under   │
 * │ deuteranopia, roughly 1 in 16 men (§4.2 measures it at 1.05:1).                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Twelve steps per family. A step is a POSITION, not a value (`NG4`) — which is what lets §3.2's
 * step semantics ("white on a 700-step is ≥ 4.5:1") hold for a family added later.
 */

export const palette = {
  white: '#FFFFFF',
  black: '#000000',

  /** Cool slate. Deliberately cool so warm, artificially-lit gym photography reads as the warm thing. */
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  /** `brand`. Far from green and from red in every dichromat projection — see the header. */
  indigo: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA',
    800: '#3730A3',
    900: '#312E81',
    950: '#1E1B4B',
  },

  /** `success` — it worked. Payment captured, member checked in, plan published. */
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    // NOTE: 600 (#059669) is a CHART and DARK-MODE value only. White on it measures 3.77:1 —
    // below the 4.5:1 text floor. `bg-emerald-600 text-white` looks correct and is not; §3.8 F4
    // forbids it by name and contrast.proof.ts asserts the refusal.
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
    950: '#022C22',
  },

  /** `warning` — expiring memberships, arrears, SLA approaching breach, DLT template pending. */
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  /** `danger` — denial, failure, destructive action, dispute deadline breached. */
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },

  /** `info` — neutral disclosure. Never a call to action. */
  sky: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
    950: '#082F49',
  },
} as const;

export type Palette = typeof palette;
export type ColourFamily = Exclude<keyof Palette, 'white' | 'black'>;
export type RampStep = keyof Palette['neutral'];

/**
 * The step semantics of §3.2, recorded so a family added later is built the same way.
 *
 * Data rather than prose because `contrast.proof.ts` asserts these properties across every family
 * — a new ramp whose 700-step cannot carry white text fails CI rather than review.
 */
export const RAMP_CONTRACT = [
  {
    steps: [50, 100],
    use: 'Subtle status fills, hover washes, zebra striping',
    property: 'An 800-step foreground on a 50-step fill of the same family is >= 4.5:1',
  },
  {
    steps: [200, 300],
    use: 'Borders inside a status region, dark-mode text',
    property: 'A 300-step on the dark canvas neutral-900 is >= 4.5:1',
  },
  {
    steps: [400, 500],
    use: 'Illustration, chart series on dark. Never body text on white',
    property: 'A 400-step on neutral-900 is >= 3:1',
  },
  {
    steps: [600, 700],
    use: 'Solid interactive fills with white text; text on white',
    // Deliberately asserted at 700 and NOT at 600: emerald-600 fails it at 3.77:1, which is the
    // whole reason the semantic tier maps `success-solid` to 700 rather than to 600.
    property: 'White on a 700-step is >= 4.5:1',
  },
  {
    steps: [800, 950],
    use: 'Text on subtle fills, dark canvases, the desk deny fill',
    property: 'A 950-step on white is >= 12:1',
  },
] as const;
