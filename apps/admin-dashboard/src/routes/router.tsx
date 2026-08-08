/**
 * The route tree — `FolderStructure.md` §6, `NFR-SEC-11`, `AX2`.
 *
 * ┌─ EVERY ROUTE IS A CHILD OF ONE GATED LAYOUT ────────────────────────────────────────────────┐
 * │ `AdminLayout` renders `<MfaGate>` around `<Outlet/>`, so a route added anywhere in this      │
 * │ tree is gated by construction. There is no second top-level route and there must never be   │
 * │ one — `admin-shell.spec.ts` asserts exactly that, because "remember to nest it" is the       │
 * │ instruction that gets forgotten on the fifteenth screen.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The fifteen `SCR-ADM-*` routes are declared with a placeholder element rather than omitted. A
 * declared route with an honest "not built yet" panel gives the navigation something real to
 * point at and makes the remaining work visible in one file; an omitted route 404s and reads as
 * a bug. Each is replaced by its own milestone.
 */

import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';

import { t } from '../shared/i18n/index.ts';
import { useSession, useSessionController } from '../shared/auth/session.tsx';
import { ImpersonationBanner } from '../shared/impersonation/banner.tsx';
import { MfaGate } from './mfa-gate.tsx';
import { PlatformDashboardRoute } from './platform-dashboard.route.tsx';
import { SessionsRoute } from './sessions.route.tsx';
import { NotBuiltYet } from './not-built-yet.tsx';

/** `SCR-ADM-002` … `SCR-ADM-015`, and the milestone that delivers each. */
const PENDING_ROUTES = [
  { path: 'approvals', screen: 'SCR-ADM-002', milestone: 'M-036' },
  { path: 'approvals/:applicationId', screen: 'SCR-ADM-003', milestone: 'M-036' },
  { path: 'tenants', screen: 'SCR-ADM-004', milestone: 'M-114' },
  { path: 'users', screen: 'SCR-ADM-005', milestone: 'M-114' },
  { path: 'finance/orders', screen: 'SCR-ADM-006', milestone: 'M-115' },
  { path: 'finance/settlements', screen: 'SCR-ADM-007', milestone: 'M-097' },
  { path: 'finance/refunds', screen: 'SCR-ADM-008', milestone: 'M-103' },
  { path: 'finance/disputes', screen: 'SCR-ADM-009', milestone: 'M-103' },
  { path: 'finance/reconciliation', screen: 'SCR-ADM-010', milestone: 'M-096' },
  { path: 'configuration', screen: 'SCR-ADM-011', milestone: 'M-116' },
  { path: 'moderation', screen: 'SCR-ADM-012', milestone: 'M-084' },
  { path: 'support', screen: 'SCR-ADM-013', milestone: 'M-113' },
  { path: 'analytics', screen: 'SCR-ADM-014', milestone: 'M-108' },
  { path: 'audit', screen: 'SCR-ADM-015', milestone: 'M-117' },
] as const;

function AdminLayout() {
  const session = useSession();

  return (
    <>
      {/* First focusable element in the document (AX2). Before the banner, so a keyboard user
          reaches the content without tabbing through chrome. */}
      <a href="#main" className="gm-skip-link">
        {t('adm.chrome.skipToContent')}
      </a>

      {/* BR-DAT-02 — rendered HERE, above the gate's children, so no page can exist without it. */}
      <ImpersonationBanner session={session} />

      <MfaGate>
        <div className="flex min-h-screen flex-col">
          <AdminHeader />
          <div className="mx-auto flex w-full max-w-container flex-1 gap-inline-xl px-inset-md py-inset-md">
            <AdminNav />
            {/* tabIndex={-1} so the skip link moves FOCUS here, not merely the scroll position. */}
            <main
              id="main"
              tabIndex={-1}
              aria-label={t('adm.chrome.mainLandmark')}
              className="min-w-0 flex-1"
            >
              <Outlet />
            </main>
          </div>
        </div>
      </MfaGate>
    </>
  );
}

function AdminHeader() {
  const session = useSession();
  const { signOut } = useSessionController();

  return (
    <header className="border-b border-subtle bg-surface">
      <div className="mx-auto flex max-w-container items-center justify-between px-inset-md py-inset-sm">
        <span className="text-lg font-semibold text-content">{t('adm.chrome.brand')}</span>

        {session.status === 'AUTHENTICATED' && (
          <div className="flex items-center gap-inline-md">
            {/* The identifier they signed in with, truncated. Not a fabricated display name —
                there is no profile endpoint until M-023, and a plausible-looking invented name
                next to real data is the kind of detail nobody thinks to doubt. */}
            <span className="hidden max-w-48 truncate text-sm text-content-secondary sm:inline">
              {session.displayName}
            </span>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="gm-hit-target rounded-control border border-subtle px-inset-sm py-inset-xs text-base text-content-secondary hover:text-content"
            >
              {t('adm.chrome.signOut')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function AdminNav() {
  const items = [
    ['/', 'adm.chrome.nav.dashboard'],
    ['/sessions', 'adm.chrome.nav.sessions'],
    ['/approvals', 'adm.chrome.nav.approvals'],
    ['/tenants', 'adm.chrome.nav.tenants'],
    ['/finance/settlements', 'adm.chrome.nav.finance'],
    ['/moderation', 'adm.chrome.nav.moderation'],
    ['/audit', 'adm.chrome.nav.audit'],
  ] as const;

  return (
    <nav aria-label={t('adm.chrome.nav.label')} className="hidden w-48 shrink-0 lg:block">
      <ul className="flex flex-col gap-stack-2xs">
        {items.map(([href, key]) => (
          <li key={href}>
            <a
              href={href}
              className="gm-hit-target block rounded-control px-inset-sm py-inset-xs text-base text-content-secondary hover:bg-surface-sunken hover:text-content"
            >
              {t(key)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <PlatformDashboardRoute /> },
      // Real as of M-022, so it is a route and not a PENDING_ROUTES entry.
      { path: 'sessions', element: <SessionsRoute /> },
      ...PENDING_ROUTES.map((route) => ({
        path: route.path,
        element: <NotBuiltYet screen={route.screen} milestone={route.milestone} />,
      })),
    ],
  },
]);

export function AdminRouter() {
  return <RouterProvider router={router} />;
}

export { PENDING_ROUTES };
