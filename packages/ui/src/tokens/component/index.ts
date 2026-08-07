/**
 * Tier 3 · Component tokens — `DesignSystem.md` §2.1, §7.3.
 *
 * ┌─ WHY THREE TIERS AND NOT TWO ───────────────────────────────────────────────────────────────┐
 * │ Two tiers is the common shortcut and it breaks at exactly the point this product reaches:    │
 * │ the third surface. With semantic tokens alone, "the dashboard table row is denser than the   │
 * │ customer card" becomes a per-component Tailwind override, and after four sprints there are   │
 * │ eleven row heights.                                                                           │
 * │                                                                                              │
 * │ Component tokens make density a REMAP (`density/`) instead of an override, and the check-in  │
 * │ desk's oversized mode a data attribute rather than a fork.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * These are the COMFORTABLE values. `density/` overrides the size-bearing ones; nothing here that
 * names a colour is ever remapped, because density changes size and never meaning (§1.3, §7.2).
 */

export const componentTokens = {
  // --- control: buttons, selects --------------------------------------------
  'control-height': '44px',
  'control-inset-x': 'var(--gm-space-inset-md)',
  'control-font': 'var(--gm-font-size-md)',

  // --- input ----------------------------------------------------------------
  'input-height': '44px',
  // TS2 — 16px on EVERY surface and EVERY density. Below it, iOS Safari zooms the viewport on
  // focus, producing exactly the horizontal scroll NFR-USE-07 forbids. A bug fix as a token.
  'input-font': 'var(--gm-font-size-md)',

  // --- table ----------------------------------------------------------------
  'table-row-height': '56px',
  'table-cell-inset-x': 'var(--gm-space-inset-md)',
  'table-header-height': '48px',

  // --- card -----------------------------------------------------------------
  'card-inset': 'var(--gm-space-inset-lg)',
  'card-gap': 'var(--gm-space-stack-lg)',

  // --- badge, avatar, icon --------------------------------------------------
  'badge-height': '24px',
  'avatar-default': '40px',
  'icon-size': '20px',

  // --- typography and rhythm ------------------------------------------------
  'body-font': 'var(--gm-font-size-md)',
  'section-gap': 'var(--gm-space-inset-xl)',

  // --- focus ----------------------------------------------------------------
  // FR3 — 2px at comfortable and compact, 3px at oversized. A receptionist at arm's length must
  // see where the keyboard is.
  'focus-ring-width': '2px',
  // FR2 — drawn OUTSIDE the control, so it never overlaps the control's own border and never
  // reduces the painted contrast measured in §3.6.
  'focus-ring-offset': '2px',
} as const;

/**
 * §4 · The check-in desk — `SCR-DASH-009`, `NFR-USE-01`, `NFR-USE-09`.
 *
 * `NG5` normally forbids a token naming a screen. The desk is the one exception, because it is a
 * genuine third density with a legal accessibility obligation of its own, and it therefore owns
 * the `desk-` namespace outright.
 *
 * ┌─ THE VERDICT COLOURS ARE IDENTICAL IN BOTH THEMES, AND THAT IS THE POINT ───────────────────┐
 * │ Allow is the BRIGHT state and deny is the DARK one. A theme toggle that inverted the panels  │
 * │ would re-teach a receptionist the opposite of what they learned over three months. Only      │
 * │ `desk-idle-fill` shifts between themes, and it is neither verdict in either.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const deskTokens = {
  'desk-verdict-allow-fill': '#ECFDF5',
  'desk-verdict-allow-content': '#065F46',
  'desk-verdict-deny-fill': '#7F1D1D',
  'desk-verdict-deny-content': '#FFFFFF',
  'desk-offline-fill': '#FCD34D',
  'desk-offline-content': '#0F172A',

  // §2.6 — the escape hatch, and it is a CLOSED LIST OF TWO, not a principle. Both reference a
  // physical constant of the rendering context rather than a design choice, so re-expressing
  // either as a semantic token would imply it could be changed for taste. A third requires §12.
  /** The camera's aspect, not a design decision. */
  'desk-camera-aspect': '4 / 3',
  /** Tied to a tablet's portrait viewport and the arm's-length requirement, not to the space scale. */
  'desk-verdict-min-height': '52svh',
} as const;

export type ComponentTokenKey = keyof typeof componentTokens;
export type DeskTokenKey = keyof typeof deskTokens;
