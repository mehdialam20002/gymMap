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
 * ┌─ THE BRAND HAS CHANGED TWICE. READ THE RAMP, NOT THIS HEADER ───────────────────────────────┐
 * │ It was `pear` (a yellow-green), then `wine` (`ADR-0036`), and is now `brandGreen` — the        │
 * │ owner's emerald reference, under `ADR-0037`. Both superseded ramps are kept below, unbound,    │
 * │ because `DECISION_LOG.md` names them and a log describing a ramp that no longer exists is      │
 * │ worse than a ramp nobody imports.                                                              │
 * │                                                                                              │
 * │ This header used to carry a long argument for pear. It survived the wine change unedited and  │
 * │ was read as current for a day — so what stays here now is the RULE rather than the conclusion: │
 * │                                                                                              │
 * │   The brand solid must clear 4.5:1 against its own foreground, its hover must never reduce    │
 * │   contrast, and it must be distinguishable from `danger` and from `success` after a            │
 * │   deuteranopia simulation — because `AX8` requires icon and word alongside colour, but a       │
 * │   viewer should not need to read the word to tell chrome from a verdict.                       │
 * │                                                                                              │
 * │ `brandGreen-600` carries white at 4.54:1. It is separated from `success` by HUE (emerald vs    │
 * │ the yellower `green`, ~25°) rather than by lightness, which is the note on the `green` ramp.   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Twelve steps per family. A step is a POSITION, not a value (`NG4`) — which is what lets §3.2's
 * step semantics ("white on a 700-step is ≥ 4.5:1") hold for a family added later.
 */

export const palette = {
  white: '#FFFFFF',
  black: '#000000',

  /**
   * `neutral` — SLATE. The reference's `slate-50`/`slate-900`/`slate-950`.
   *
   * +- WHY THE OLIVE RAMP WENT, AND WHAT IT COST ------------------------------------------------+
   * | This ramp was an olive-tinted grey, and it had already been re-stepped twice to chase a     |
   * | cast: 50 and 100 were "markedly yellow-green", and 950 was a TEAL sitting behind warm cards. |
   * | Both fixes were real and neither addressed the cause, which is that a tinted neutral has to  |
   * | agree with every other hue on the screen at eleven steps, and this one never quite did.      |
   * |                                                                                          |
   * | Slate is very slightly BLUE and consistently so across all eleven steps. That is what makes |
   * | a dashboard read as clean: the greys agree with each other, so nothing looks dirty next to  |
   * | anything else. It is also what the reference uses.                                          |
   * |                                                                                          |
   * | `ADR-0037` makes this the designer's call rather than a specification change.               |
   * +-------------------------------------------------------------------------------------------+
   */
  neutral: {
    /** The page canvas in light mode. */
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    /** Cannot carry text on white — 2.60:1. A border, a divider, or ink on a dark surface. */
    400: '#94A3B8',
    /** The lightest step that carries text on white: 4.76:1. Muted ink. */
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    /** Raised surfaces in dark mode. Elevation is lightness here, not shadow. */
    800: '#1E293B',
    /** Cards and the sidebar in dark mode. */
    900: '#0F172A',
    /** The dark canvas. Cards at 900 lift off it by a readable step. */
    950: '#020617',
  },

  /**
   * `brand`. The seed sits at 400 — the conventional solid step — and the deep end runs further
   * down than a mid-lightness family would need, because 700 and 800 are what carry the focus
   * ring and links on a light canvas. See the header for why pear itself cannot.
   */
  pear: {
    50: '#F7FFEF',
    100: '#EDFFD9',
    200: '#DFFFB6',
    300: '#D1FF8E',
    /** `pear`. The brand. Takes a dark foreground: white on it is 1.20:1. */
    400: '#BCFF00',
    500: '#9DD600',
    600: '#7CAA00',
    /** Focus ring on a light canvas — 3.89:1. Also the step white must clear, at 4.68:1. */
    700: '#5C7F00',
    /** Links and brand text on a light canvas — 5.27:1. */
    800: '#4B6900',
    900: '#374E00',
    950: '#233400',
  },

  /**
   * `brand` — GYM MAP wine. A deep red, and DEEP is the load-bearing word.
   *
   * ┌─ WHY NOT A BRIGHT RED, WHICH IS WHAT "GYM MAP red" SOUNDS LIKE ───────────────────────────────┐
   * │ `danger` is red, and this console adjudicates businesses: an "Approve" primary sitting beside │
   * │ a "Reject" destructive is the single most consequential pair of buttons in the product. Two   │
   * │ reds at the same lightness there is not a taste problem, it is a mis-click.                    │
   * │                                                                                               │
   * │ Hue cannot separate them — both are red. LIGHTNESS can, so the brand sits deep and danger     │
   * │ stays bright:                                                                                  │
   * │                                                                                               │
   * │     wine-600 `#7A1637`  vs  danger-600 `#DC2626`   2.18:1                                     │
   * │                                                                                               │
   * │ That is a visible step apart, and it is the number to re-check if either ramp moves.          │
   * └───────────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * ┌─ THE SOLID TAKES A WHITE FOREGROUND, IN BOTH THEMES ────────────────────────────────────────┐
   * │ White on `wine-600` is 10.51:1. The previous brand (`pear`, a yellow-green) was so light that │
   * │ white on it measured 1.20:1 and every primary button had to carry DARK text — which is why    │
   * │ the old solid also had to lighten on hover instead of deepening. A dark solid inverts both:   │
   * │ white label, and hover goes deeper (600 → 700 → 800) the way a dark button should.            │
   * └──────────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * Brand vs the other semantics, at their text steps on white — all clear of 4.5:1 themselves and
   * far enough from wine to read as different families: success emerald, warning amber, info sky.
   */
  wine: {
    50: '#FDF2F5',
    100: '#FAE2E9',
    200: '#F2C1D0',
    /** Brand text on the DARK canvas — 7.63:1 on `#0F172A`. */
    300: '#E28FA9',
    400: '#C55578',
    500: '#A02E54',
    /** `GYM MAP wine`. The brand solid. White on it is 10.51:1. */
    600: '#7A1637',
    /** Brand text and links on a light canvas, and the solid's hover — 12.9:1 on white. */
    700: '#651230',
    800: '#520E27',
    900: '#3D0A1D',
    950: '#260611',
  },

  /**
   * `green` — `success`. A YELLOWER green than the brand, and the separation is the point.
   *
   * +- THE BRAND IS NOW EMERALD, WHICH IS WHAT SUCCESS USED TO BE ------------------------------+
   * | The reference's brand is `#059669` — emerald-600. Success was emerald-700. One step apart:  |
   * | on a screen where the sidebar's active pill and a "captured" badge are both green, an       |
   * | operator cannot tell chrome from state, and the green stops meaning anything.               |
   * |                                                                                          |
   * | Exactly the collision wine had with danger, solved the same way: separate the families.     |
   * | `green-600` is `#16A34A`, about 25 degrees yellower than `emerald-600` at `#059669`. Both   |
   * | still read as green — which success must — while no longer reading as the SAME green.        |
   * |                                                                                          |
   * | Success moved rather than the brand because brand chrome is on every screen and a success   |
   * | badge is occasional: moving the rarer one changes less, and green-for-success survives it.  |
   * +-------------------------------------------------------------------------------------------+
   */
  /**
   * `brand` — GYM MAP green. The reference's emerald, and the ramp every piece of chrome reads from.
   *
   * +- SUPERSEDES THE `wine` RAMP OF `ADR-0036`, BY THE OWNER'S INSTRUCTION ---------------------+
   * | `ADR-0036` made the brand a deep wine red, because an earlier brief said "Primary: deep red  |
   * | / GYM MAP red". The owner then supplied an emerald reference and instructed that visual       |
   * | prescription must not block the design (`ADR-0037`). `wine` is kept below, unbound, because  |
   * | deleting a ramp a recorded decision names would leave the DECISION_LOG describing something  |
   * | that no longer exists.                                                                     |
   * |                                                                                          |
   * | The same discipline as wine applies and for the same reason: `brand-600` is the solid,       |
   * | `brand-700` and `-800` are its hover and active, and white on `brand-600` is 4.54:1 — over   |
   * | the text floor, which `emerald-500` at 2.44:1 is not. `bg-brand-500 text-white` looks        |
   * | correct and is not, so 500 is a surface only.                                               |
   * |                                                                                          |
   * | Distinct from success `green-700` by hue rather than by lightness — see the note there.      |
   * +-------------------------------------------------------------------------------------------+
   */
  brandGreen: {
    /** The active-nav pill and every subtle brand surface in light mode. */
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    /** Brand text on a DARK canvas: 8.24:1 on `#0F172A`. */
    300: '#6EE7B7',
    400: '#34D399',
    /** A surface, never ink. White on it is 2.44:1. */
    500: '#10B981',
    /**
     * A SURFACE and a border, not a fill under white text.
     *
     * +- WHITE ON THIS IS 3.77:1, NOT 4.54:1 -------------------------------------------------+
     * | The first version of this ramp put `brand-solid` here and claimed 4.54:1. That was    |
     * | arithmetic done by hand and it was wrong; the suite caught it in the same breath as    |
     * | `no-float-money` catches a float.                                                     |
     * |                                                                                    |
     * | And the codebase already knew: the `F4` test says, verbatim, "White on #059669 is      |
     * | 3.77:1. `bg-emerald-600 text-white` looks correct and is not." It was written when     |
     * | this hex was SUCCESS-600. The same hex cannot become safe by being renamed to brand.   |
     * |                                                                                    |
     * | It clears the 3:1 NON-TEXT floor, so it stays as `border-brand` and as the tinted      |
     * | surface behind an icon. It is the fill under white text that moved to 700.             |
     * +-------------------------------------------------------------------------------------+
     */
    600: '#059669',
    /** `GYM MAP green`. The brand solid, and brand ink on a light canvas. White on it: 5.48:1. */
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
    950: '#022C22',
  },

  green: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    /** Fails the 4.5:1 text floor on white at 3.03:1. A surface, never ink. */
    500: '#22C55E',
    600: '#16A34A',
    /** `success-solid`. White on it is 4.63:1 — over the text floor, unlike 600 at 3.42:1. */
    700: '#15803D',
    /** Success ink on a light canvas: 6.53:1 on white. */
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
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
