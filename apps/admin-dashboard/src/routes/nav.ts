/**
 * The navigation, as data — `SCR-ADM-001` … `SCR-ADM-015`.
 *
 * ┌─ EVERY ITEM DECLARES WHETHER IT IS BUILT, AND THE UNBUILT ONES SAY SO ON THE LINK ──────────┐
 * │ A nav item that looks identical to a working one and then lands on an empty panel teaches   │
 * │ an operator that the console is unreliable. Worse, in a demo it invites a question nobody    │
 * │ can answer honestly on the spot.                                                             │
 * │                                                                                              │
 * │ So `state` is part of the route declaration, the sidebar renders a visible badge, and the    │
 * │ milestone that delivers each is named. Making it data rather than a component decision means │
 * │ the dashboard's "not built yet" section and the sidebar cannot disagree.                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `badge` names a live counter. Only `approvals` has one, because the approval queue is the only
 * unbuilt-adjacent screen whose COUNT is real: `tenant_status_enum` carries the whole C4.4 state
 * machine, so "6 waiting" is a fact even though the review screen itself is M-036.
 */

import type { MessageKey } from '../shared/i18n/index.ts';

export type NavState = 'BUILT' | 'IN_DEVELOPMENT';

export interface NavItem {
  readonly path: string;
  readonly label: MessageKey;
  readonly state: NavState;
  /** The `SCR-ADM-*` screen id, for the placeholder panel. */
  readonly screen?: string;
  /** The milestone that delivers it. Shown to the operator, not hidden in a comment. */
  readonly milestone?: string;
  /** A live count rendered beside the label. */
  readonly badge?: 'awaitingReview';
}

export interface NavGroup {
  readonly label: MessageKey | null;
  readonly items: readonly NavItem[];
}

export const NAV: readonly NavGroup[] = [
  {
    label: null,
    items: [{ path: '/', label: 'adm.chrome.nav.dashboard', state: 'BUILT' }],
  },
  {
    label: 'adm.chrome.group.gyms',
    items: [
      {
        path: '/approvals',
        label: 'adm.chrome.nav.approvals',
        // The QUEUE is real — it lists live rows from the real state machine. Acting on one
        // (approve, reject, request info) is SCR-ADM-003 below.
        state: 'BUILT',
        screen: 'SCR-ADM-002',
        badge: 'awaitingReview',
      },
      {
        path: '/approvals/:applicationId',
        label: 'adm.chrome.nav.approvalDetail',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-003',
        milestone: 'M-036',
      },
      {
        path: '/gyms',
        label: 'adm.chrome.nav.allGyms',
        // The register. Real: it reads the tenants table through an audited elevation.
        state: 'BUILT',
        screen: 'SCR-ADM-004',
      },
      {
        path: '/categories',
        label: 'adm.chrome.nav.categories',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-011',
        milestone: 'M-116',
      },
    ],
  },
  {
    label: 'adm.chrome.group.people',
    items: [
      {
        path: '/people',
        label: 'adm.chrome.nav.people',
        // Role-grant counts are real. The per-person list needs the B3.2 matrix to decide which
        // operator may see which account, so it arrives with M-023.
        state: 'BUILT',
        screen: 'SCR-ADM-005',
      },
      // No SCR-ADM id: FR-AUTH-09's own-devices screen is not one of the fifteen. It exists
      // because M-022 made it real, and inventing an id for it would corrupt the numbering the
      // route-table assertion depends on.
      { path: '/sessions', label: 'adm.chrome.nav.sessions', state: 'BUILT' },
    ],
  },
  {
    label: 'adm.chrome.group.commerce',
    items: [
      {
        path: '/finance/orders',
        label: 'adm.chrome.nav.orders',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-006',
        milestone: 'M-115',
      },
      {
        path: '/finance/settlements',
        label: 'adm.chrome.nav.settlements',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-007',
        milestone: 'M-097',
      },
      {
        path: '/finance/refunds',
        label: 'adm.chrome.nav.refunds',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-008',
        milestone: 'M-103',
      },
      {
        path: '/finance/disputes',
        label: 'adm.chrome.nav.disputes',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-009',
        milestone: 'M-103',
      },
      {
        path: '/finance/reconciliation',
        label: 'adm.chrome.nav.reconciliation',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-010',
        milestone: 'M-096',
      },
    ],
  },
  {
    label: 'adm.chrome.group.operations',
    items: [
      {
        path: '/moderation',
        label: 'adm.chrome.nav.moderation',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-012',
        milestone: 'M-084',
      },
      {
        path: '/support',
        label: 'adm.chrome.nav.support',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-013',
        milestone: 'M-113',
      },
      {
        path: '/analytics',
        label: 'adm.chrome.nav.analytics',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-014',
        milestone: 'M-108',
      },
      {
        path: '/audit',
        label: 'adm.chrome.nav.audit',
        state: 'IN_DEVELOPMENT',
        screen: 'SCR-ADM-015',
        milestone: 'M-117',
      },
    ],
  },
];

/** Flat view, for the router and for the "not built" summary on the dashboard. */
export const NAV_ITEMS: readonly NavItem[] = NAV.flatMap((group) => group.items);

export const PENDING_ROUTES = NAV_ITEMS.filter((item) => item.state === 'IN_DEVELOPMENT');
