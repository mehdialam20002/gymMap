/**
 * The route tree and the console shell — `FolderStructure.md` §6, `NFR-SEC-11`, `AX2`.
 *
 * ┌─ EVERY ROUTE IS A CHILD OF ONE GATED LAYOUT ────────────────────────────────────────────────┐
 * │ `AdminLayout` renders `<MfaGate>` around `<Outlet/>`, so a route added anywhere in this      │
 * │ tree is gated by construction. There is no second top-level route and there must never be   │
 * │ one — `shell.spec.ts` asserts exactly that, because "remember to nest it" is the             │
 * │ instruction that gets forgotten on the fifteenth screen.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DENSITY IS COMPACT, AND THAT IS A REQUIREMENT RATHER THAN A PREFERENCE ────────────────────┐
 * │ `DesignSystem.md` §1.1: Anita reviews 30-60 applications a day and Vikram needs a figure he  │
 * │ can trace to its source. Compact density, dense split views, keyboard-first affordances.     │
 * │ Which is why the tiles are short and the queue sits high: the person who uses this screen    │
 * │ most must not scroll past decoration to reach their work.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The route list is `nav.ts`, as data. A screen that is not built declares that there, so the
 * sidebar badge and the placeholder panel cannot disagree about what exists.
 */

import { createBrowserRouter, NavLink, Outlet, RouterProvider } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { t } from '../shared/i18n/index.ts';
import { useSession, useSessionController } from '../shared/auth/session.tsx';
import { platformOverview } from '../shared/api/admin.ts';
import { ImpersonationBanner } from '../shared/impersonation/banner.tsx';
import { ThemeToggle } from '../shared/theme/theme-toggle.tsx';
import { MfaGate } from './mfa-gate.tsx';
import { NAV, PENDING_ROUTES, type NavItem } from './nav.ts';
import { PlatformDashboardRoute } from './platform-dashboard.route.tsx';
import { ApprovalQueueRoute } from './approval-queue.route.tsx';
import { GymRegisterRoute } from './gym-register.route.tsx';
import { PeopleRoute } from './people.route.tsx';
import { SessionsRoute } from './sessions.route.tsx';
import { NotBuiltYet } from './not-built-yet.tsx';

function AdminLayout() {
  const session = useSession();
  const [collapsed, setCollapsed] = useState(false);

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
        <div className="flex min-h-screen bg-surface-sunken">
          <AdminNav
            collapsed={collapsed}
            onToggle={() => {
              setCollapsed((current) => !current);
            }}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <AdminHeader />
            {/* tabIndex={-1} so the skip link moves FOCUS here, not merely the scroll position. */}
            {/* ┌─ THE CONTENT HAS A MEASURE, AND ON A WIDE SCREEN THAT IS THE POINT ──────────┐
                │ `max-w-container` is 1440px. Without it the console stretches to whatever the │
                │ monitor is, and on an 1800px screen a queue row puts a gym's name at one edge │
                │ and its status at the other with 1400px of nothing between them. The eye      │
                │ cannot associate the two, so every row has to be read twice.                   │
                │                                                                                │
                │ Compact density (`DesignSystem.md` §1.1) is about information per glance, not │
                │ about filling the glass.                                                       │
                └────────────────────────────────────────────────────────────────────────────────┘ */}
            <main
              id="main"
              tabIndex={-1}
              aria-label={t('adm.chrome.mainLandmark')}
              className="mx-auto w-full min-w-0 max-w-container flex-1 px-inset-lg py-inset-lg"
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
    <header className="sticky top-0 z-10 border-b border-subtle bg-surface">
      <div className="flex h-[3.5rem] items-center gap-inline-md px-inset-lg">
        {/* Search is presented but INERT, and it says so.
            Cross-entity search needs the B3.2 matrix to decide which results an operator may
            see, so it arrives with M-023. A live-looking box that returns nothing is the one
            control a demo is guaranteed to try, and finding it dead is worse than finding it
            honestly disabled. */}
        <label className="min-w-0 flex-1" htmlFor="admin-search">
          <span className="gm-visually-hidden">{t('adm.chrome.search.label')}</span>
          <input
            id="admin-search"
            type="search"
            disabled
            placeholder={t('adm.chrome.search.placeholder')}
            className="h-[2.25rem] w-full max-w-ui rounded-control border border-subtle bg-surface-sunken px-inset-sm text-sm text-content placeholder:text-content-muted disabled:cursor-not-allowed"
          />
        </label>

        <ThemeToggle />

        {session.status === 'AUTHENTICATED' && (
          <div className="flex shrink-0 items-center gap-inline-sm">
            {/* The identifier they signed in with. Not a fabricated display name — there is no
                profile endpoint until M-023, and a plausible invented name sitting next to real
                data is the kind of detail nobody thinks to doubt. */}
            <span className="hidden max-w-[14rem] truncate text-xs text-content-muted xl:inline">
              {session.displayName}
            </span>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              className="gm-hit-target rounded-control border border-subtle px-inset-sm py-inset-2xs text-sm text-content-secondary transition-colors duration-fast ease-standard hover:border-strong hover:text-content"
            >
              {t('adm.chrome.signOut')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function AdminNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  // The one live badge. `awaitingReview` is real because `tenant_status_enum` carries the whole
  // approval state machine, so "6 waiting" is a fact even though the review SCREEN is M-036.
  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: platformOverview,
    refetchInterval: 30_000,
  });

  return (
    <nav
      aria-label={t('adm.chrome.nav.label')}
      className={`hidden shrink-0 flex-col border-r border-subtle bg-surface lg:flex ${
        collapsed ? 'w-[4rem]' : 'w-[15rem]'
      }`}
    >
      <div className="flex h-[3.5rem] items-center gap-inline-sm border-b border-subtle px-inset-md">
        <span aria-hidden="true" className="text-lg font-bold text-content-brand">
          GM
        </span>
        {!collapsed && (
          <span className="truncate text-base font-semibold text-content">
            {t('adm.chrome.brand')}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-inset-xs py-inset-sm">
        {NAV.map((group, index) => (
          <div key={group.label ?? `group-${String(index)}`} className="mb-stack-sm">
            {group.label !== null && !collapsed && (
              <p className="px-inset-sm pb-inset-2xs pt-inset-xs text-xs font-semibold uppercase tracking-wide text-content-muted">
                {t(group.label)}
              </p>
            )}
            <ul className="flex flex-col gap-stack-2xs">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavItemLink
                    item={item}
                    collapsed={collapsed}
                    badge={
                      item.badge === 'awaitingReview'
                        ? overview.data?.gyms.awaitingReview
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="gm-hit-target border-t border-subtle px-inset-md py-inset-sm text-left text-sm text-content-muted transition-colors duration-fast ease-standard hover:text-content"
      >
        {collapsed ? '>>' : `<< ${t('adm.chrome.collapse')}`}
      </button>
    </nav>
  );
}

function NavItemLink({
  item,
  collapsed,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  badge: number | undefined;
}) {
  const pending = item.state === 'IN_DEVELOPMENT';

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      // `title` rather than a tooltip component: it works collapsed, it works on keyboard focus,
      // and it needs no library.
      title={pending ? `${t(item.label)} - ${t('adm.chrome.inDevelopment')}` : t(item.label)}
      className={({ isActive }) =>
        `gm-hit-target flex items-center justify-between gap-inline-xs rounded-control px-inset-sm py-inset-2xs text-sm transition-colors duration-fast ease-standard ${
          isActive
            ? 'bg-surface-brand-subtle font-semibold text-content-brand'
            : pending
              ? 'text-content-muted hover:bg-surface-sunken'
              : 'text-content-secondary hover:bg-surface-sunken hover:text-content'
        }`
      }
    >
      <span className="truncate">{collapsed ? t(item.label).slice(0, 2) : t(item.label)}</span>

      {!collapsed && (
        <>
          {/* A real count, or nothing at all. Never a 0 placeholder. */}
          {badge !== undefined && badge > 0 && (
            <span className="shrink-0 rounded-control bg-warning-solid px-inset-2xs text-xs font-semibold text-content-on-warning">
              {badge}
            </span>
          )}
          {/* ┌─ A MARK, NOT A SENTENCE ─────────────────────────────────────────────────────┐
              │ "In development" spelled out took ninety of the sidebar's two hundred and    │
              │ forty pixels, so "Application detail" rendered as "Application de…" and       │
              │ "Categories & amenities" as "Categories & a…". The badge was winning space    │
              │ from the label it describes, which is backwards: the operator reads the label │
              │ to navigate and the badge only to explain why a link is quiet.                │
              │                                                                               │
              │ `title` on the link carries the full wording, and `sr-only` text carries it   │
              │ to a screen reader, so nothing is lost — it stops being shouted.               │
              └───────────────────────────────────────────────────────────────────────────────┘ */}
          {pending && (
            <span
              aria-hidden="true"
              className="shrink-0 rounded-control border border-subtle px-inset-2xs text-xs font-medium text-content-muted"
            >
              {t('adm.chrome.inDevelopmentShort')}
            </span>
          )}
          {pending && <span className="gm-visually-hidden">{t('adm.chrome.inDevelopment')}</span>}
        </>
      )}
    </NavLink>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <PlatformDashboardRoute /> },
      { path: 'approvals', element: <ApprovalQueueRoute /> },
      { path: 'gyms', element: <GymRegisterRoute /> },
      { path: 'people', element: <PeopleRoute /> },
      { path: 'sessions', element: <SessionsRoute /> },
      ...PENDING_ROUTES.map((route) => ({
        path: route.path.replace(/^\//, ''),
        element: <NotBuiltYet screen={route.screen ?? '-'} milestone={route.milestone ?? '-'} />,
      })),
    ],
  },
]);

export function AdminRouter() {
  return <RouterProvider router={router} />;
}

export { PENDING_ROUTES };
