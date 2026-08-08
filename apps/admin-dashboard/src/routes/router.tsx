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

import {
  createBrowserRouter,
  NavLink,
  Outlet,
  RouterProvider,
  useNavigate,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { CommandPalette, useCommandKey, type CommandItem } from '@gymmap/ui';

import { t } from '../shared/i18n/index.ts';
import { useSession, useSessionController } from '../shared/auth/session.tsx';
import { platformOverview } from '../shared/api/admin.ts';
import { ImpersonationBanner } from '../shared/impersonation/banner.tsx';
import { ThemeToggle } from '../shared/theme/theme-toggle.tsx';
import { ChromeGlyph, NavGlyph } from '../shared/icons/index.tsx';
import { ApplicationReviewRoute } from './application-review.route.tsx';
import { MfaGate } from './mfa-gate.tsx';
import { PlannedScreen } from './planned-screen.tsx';
import { SCREEN_PLANS } from './screen-plan.ts';
import { NAV, PENDING_ROUTES, type NavItem } from './nav.ts';
import { PlatformDashboardRoute } from './platform-dashboard.route.tsx';
import { ApprovalQueueRoute } from './approval-queue.route.tsx';
import { GymRegisterRoute } from './gym-register.route.tsx';
import { GymDetailRoute } from './gym-detail.route.tsx';
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
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // `useCallback` because `useCommandKey` re-binds the listener whenever the handler identity
  // changes, and an inline arrow would rebind on every render of the shell.
  const open = useCallback(() => {
    setPaletteOpen(true);
  }, []);
  useCommandKey(open);

  const commands: readonly CommandItem[] = NAV.flatMap((group) =>
    group.items.map((item) => ({
      id: item.path,
      label: t(item.label),
      group: group.label === null ? t('adm.chrome.nav.dashboard') : t(group.label),
      // A screen that is not built is LISTED and DISABLED, so the palette tells the same story
      // the sidebar does. Hiding them would make ⌘K disagree with the navigation beside it.
      ...(item.state === 'IN_DEVELOPMENT'
        ? { hint: item.milestone ?? t('adm.chrome.inDevelopment'), disabled: true }
        : {}),
      onSelect: () => {
        void navigate(item.path);
      },
    })),
  );

  return (
    <>
      <header className="sticky top-0 z-sticky border-b border-subtle bg-surface">
        <div className="flex h-[4rem] items-center gap-inline-md px-inset-lg">
          {/* The trigger LOOKS like a search field and opens the palette, because that is what a
              person pressing it wants. It is a button rather than an input: an input that steals
              your keystrokes into a dialog is worse than one that never accepted them. */}
          <button
            type="button"
            onClick={open}
            className="gm-hit-target flex h-[2.25rem] min-w-0 flex-1 max-w-ui items-center justify-between gap-inline-sm rounded-control border border-subtle bg-surface-sunken px-inset-sm text-sm text-content-muted transition-colors duration-fast ease-standard hover:border-strong"
          >
            <span className="truncate">{t('adm.chrome.search.placeholder')}</span>
            <kbd className="shrink-0 rounded-control border border-subtle px-inset-2xs font-mono text-xs">
              {t('adm.chrome.search.shortcut')}
            </kbd>
          </button>

          <div className="flex shrink-0 items-center gap-inline-sm">
            {/* The environment, because an operator with two tabs open needs to know which one
                can suspend a real gym. Absent in production, where the answer is the default. */}
            <span className="hidden rounded-control bg-surface-warning-subtle px-inset-2xs text-xs font-semibold text-content-warning lg:inline">
              {t('adm.chrome.env')}
            </span>

            {/* ┌─ BOTH INERT, AND BOTH SAY WHY WHEN YOU HOVER THEM ───────────────────────┐
                │ There is no notifications table and no help centre — `A-19` leaves the      │
                │ notification vendors open, so a bell that opened an empty tray would be     │
                │ inventing the one thing a bell is for. Present because the shell is the     │
                │ shell; disabled because the alternative is a lie with a badge on it.         │
                └─────────────────────────────────────────────────────────────────────────────┘ */}
            <button
              type="button"
              disabled
              aria-label={t('adm.chrome.notifications')}
              title={t('adm.chrome.notifications')}
              className="gm-hit-target hidden rounded-control px-inset-2xs text-content-disabled sm:block"
            >
              <ChromeGlyph icon="notifications" />
            </button>
            <button
              type="button"
              disabled
              aria-label={t('adm.chrome.help')}
              title={t('adm.chrome.help')}
              className="gm-hit-target hidden rounded-control px-inset-2xs text-content-disabled sm:block"
            >
              <ChromeGlyph icon="help" />
            </button>

            <ThemeToggle />

            {session.status === 'AUTHENTICATED' && (
              <div className="flex items-center gap-inline-sm">
                {/* ┌─ INITIALS AND A ROLE, NOT A PHOTO AND NOT A UUID ────────────────────────┐
                    │ There is no avatar upload and no profile endpoint until `M-023`, and a    │
                    │ stock face beside real platform figures is a small fiction on a screen    │
                    │ whose whole job is being trustworthy.                                     │
                    │                                                                          │
                    │ The line under it is the operator's ROLE, read from the token's `roles`   │
                    │ claim — real, and the thing they actually need confirmed before they      │
                    │ suspend a gym. The identifier they typed sits in the `title`; after a     │
                    │ reload only the uuid survives, and thirty-six characters of it in a       │
                    │ topbar is noise rather than information.                                  │
                    └──────────────────────────────────────────────────────────────────────────┘ */}
                <span
                  aria-hidden="true"
                  className="grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-full bg-surface-brand-subtle text-xs font-semibold text-content-brand"
                >
                  {initialsOf(session.displayName)}
                </span>
                <span
                  title={session.displayName}
                  className="hidden max-w-[10rem] flex-col leading-tight lg:flex"
                >
                  <span className="truncate text-xs font-medium text-content">
                    {session.roleLabel ?? t('adm.chrome.roleUnknown')}
                  </span>
                  <span className="truncate font-mono text-xs text-content-muted">
                    {shortIdOf(session.displayName)}
                  </span>
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
        </div>
      </header>

      <CommandPalette
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false);
        }}
        items={commands}
        labels={{
          placeholder: t('adm.palette.placeholder'),
          empty: t('adm.palette.empty'),
          dialogLabel: t('adm.palette.label'),
          hintKeys: t('adm.palette.hint'),
        }}
      />
    </>
  );
}

/**
 * Initials from whatever the session carries — an email on this sign-in, a uuid after a reload.
 *
 * `first.last@…` gives `FL`; `admin@…` gives `AD`. Never a fabricated name: this reads what is
 * there and stops.
 */
function initialsOf(displayName: string): string {
  const local = displayName.split('@')[0] ?? displayName;
  const parts = local.split(/[._\-\s]+/).filter((part) => part !== '');
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

/**
 * The identifier, shortened for a topbar.
 *
 * An email keeps its local part — `anita.rao@gymmap.test` reads as `anita.rao`, which is what a
 * colleague would call them. A uuid keeps its first segment, because eight hex characters
 * distinguish two operators and thirty-six only fill the bar. The full value is in the `title`.
 */
function shortIdOf(displayName: string): string {
  if (displayName.includes('@')) return displayName.split('@')[0] ?? displayName;
  return displayName.split('-')[0] ?? displayName;
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
        collapsed ? 'w-[4rem]' : 'w-[16rem]'
      }`}
    >
      <div className="flex h-[4rem] items-center gap-inline-sm border-b border-subtle px-inset-md">
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
            ? 'border-l-2 border-brand bg-surface-brand-subtle font-semibold text-content-brand'
            : pending
              ? 'text-content-muted hover:bg-surface-sunken'
              : 'text-content-secondary hover:bg-surface-sunken hover:text-content'
        }`
      }
    >
      <span className="flex min-w-0 items-center gap-inline-xs">
        <NavGlyph icon={item.icon} className="shrink-0" />
        {!collapsed && <span className="truncate">{t(item.label)}</span>}
      </span>

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
      // `SCR-ADM-003`'s route, per 6.3. The DECISION actions are M-036; the screen is real.
      { path: 'approvals/:gymId', element: <ApplicationReviewRoute /> },
      { path: 'gyms', element: <GymRegisterRoute /> },
      { path: 'gyms/:gymId', element: <GymDetailRoute /> },
      { path: 'people', element: <PeopleRoute /> },
      { path: 'sessions', element: <SessionsRoute /> },
      // ┌─ A SPECIFIED SCREEN WHERE THERE IS ONE, A PLACEHOLDER OTHERWISE ─────────────────────┐
      // │ `SCREEN_PLANS` holds each unbuilt screen's own `§B8` specification, so the route      │
      // │ renders the real columns, the real filters and an honest account of the gap rather    │
      // │ than "SCR-ADM-009 · M-105", which answers neither question a reader has.               │
      // │                                                                                      │
      // │ `NotBuiltYet` remains the fallback for a nav entry with no plan written yet, so adding │
      // │ a route never produces a blank page — the plan is an upgrade, not a prerequisite.      │
      // └──────────────────────────────────────────────────────────────────────────────────────┘
      ...PENDING_ROUTES.map((route) => {
        const plan = SCREEN_PLANS[route.path];
        return {
          path: route.path.replace(/^\//, ''),
          element:
            plan === undefined ? (
              <NotBuiltYet screen={route.screen ?? '-'} milestone={route.milestone ?? '-'} />
            ) : (
              <PlannedScreen plan={plan} />
            ),
        };
      }),
    ],
  },
]);

export function AdminRouter() {
  return <RouterProvider router={router} />;
}

export { PENDING_ROUTES };
