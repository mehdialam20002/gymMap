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
 * ┌─ THE BRAND IS PEAR, AND THE GREEN OBJECTION WAS MEASURED RATHER THAN ASSUMED ───────────────┐
 * │ This file previously argued that the brand could not be green: `SCR-DASH-009` puts a green   │
 * │ ALLOWED and a red DENIED in front of a receptionist a few hundred times a day, and a green   │
 * │ brand would put every primary button in the same perceptual neighbourhood as "this member    │
 * │ may enter".                                                                                   │
 * │                                                                                              │
 * │ That argument is about a brand green at the SAME LIGHTNESS as the verdict green. Pear is not │
 * │ one: it is L 0.822 against emerald-700's 0.15, so lightness separates them even after hue    │
 * │ collapses. Simulated with Viénot deuteranopia and measured:                                   │
 * │                                                                                              │
 * │     pear vs success emerald-700   4.68:1                                                     │
 * │     pear vs danger  red-700       4.46:1                                                     │
 * │     pear vs warning amber-700     3.66:1   ← the tightest pair; both read yellow             │
 * │                                                                                              │
 * │ The amber pair is the one to watch: a warning badge beside a pear call to action will look   │
 * │ RELATED to roughly 1 in 16 men. It clears the 3:1 non-text floor, and `AX8` already requires │
 * │ icon AND word AND colour on every status, so the redundancy that carries it is present. It   │
 * │ is recorded here so nobody later reads 3.66 as comfortable.                                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHAT INVERTS BECAUSE THE BRAND IS NOW A LIGHT COLOUR ──────────────────────────────────────┐
 * │ White on pear is 1.20:1. The solid brand fill therefore carries a DARK foreground in BOTH    │
 * │ themes, not just in dark — and §3.5's state derivation flips with it: hover and active must  │
 * │ LIGHTEN (400 → 300 → 200), because darkening a light fill under dark text reduces contrast.  │
 * │ The rule that hover never reduces contrast is unchanged; only its direction is.               │
 * │                                                                                              │
 * │ Pear is also unusable as TEXT on a light canvas — 1.00:1 on `neutral-200`. Links, active nav │
 * │ and the focus ring take the deep steps (800 and 700) instead, which is why this ramp's dark  │
 * │ end is pushed further down than the indigo ramp it replaces.                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Twelve steps per family. A step is a POSITION, not a value (`NG4`) — which is what lets §3.2's
 * step semantics ("white on a 700-step is ≥ 4.5:1") hold for a family added later.
 */

export const palette = {
  white: '#FFFFFF',
  black: '#000000',

  /**
   * Warm-neutral, carrying a faint olive cast from `laurel leaf`. Four steps are the brand's own
   * named colours; the rest are generated along the same hue at the luminance profile the previous
   * slate ramp used, so every §3.6 pairing keeps its ratio and the migration stayed a palette
   * change rather than sixty separate re-arguments.
   *
   *   200 `ceiling white`   300 `celeste`   400 `laurel leaf`   950 `rich black`
   */
  neutral: {
    /*
     * 50 and 100 were `#F7FCE7` and `#F1F6E2` — a markedly stronger yellow-green than the rest
     * of the ramp, which from 200 on is an almost-neutral grey-olive (`#E9EBE6`, `#D2D3CE`).
     * The two lightest steps did not sit on the same hue line as the family they belong to.
     *
     * That is a ramp defect rather than a taste question, and it was highly visible: the admin
     * canvas is `surface-sunken` (100), so every light-mode screen in the console rendered on a
     * pale yellow-green wash while the cards on top of it were near-neutral.
     *
     * Re-stepped onto the same hue as 200-400, lighter. The brand's olive character is kept —
     * these are not grey — and the cast that read as "wrong colour" is gone.
     */
    50: '#FAFBF8',
    100: '#F3F5F0',
    /** `ceiling white`. */
    200: '#E9EBE6',
    /** `celeste`. */
    300: '#D2D3CE',
    /** `laurel leaf`. Cannot carry text on a light canvas — 2.42:1. A surface, or ink on dark. */
    400: '#96998C',
    500: '#72746A',
    600: '#53554D',
    700: '#3F413A',
    800: '#282925',
    900: '#171815',
    /** `rich black`. The dark canvas, and `surface-media` in BOTH themes. */
    950: '#061414',
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
   * `brand` — GymMap wine. A deep red, and DEEP is the load-bearing word.
   *
   * ┌─ WHY NOT A BRIGHT RED, WHICH IS WHAT "GymMap red" SOUNDS LIKE ───────────────────────────────┐
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
    /** `GymMap wine`. The brand solid. White on it is 10.51:1. */
    600: '#7A1637',
    /** Brand text and links on a light canvas, and the solid's hover — 12.9:1 on white. */
    700: '#651230',
    800: '#520E27',
    900: '#3D0A1D',
    950: '#260611',
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
