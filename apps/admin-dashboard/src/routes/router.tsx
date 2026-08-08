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
        {/* ┌─ `h-screen` WITH ONE SCROLLING REGION, NOT A PAGE THAT GROWS ────────────────────┐
            │ It was `min-h-screen`, so the shell grew with the content and the sidebar grew with │
            │ it: the identity footer sat at the bottom of the DOCUMENT, hundreds of pixels below │
            │ the fold, and the topbar scrolled away with the table.                              │
            │                                                                                  │
            │ Fixing the shell to the viewport and scrolling only `<main>` keeps the navigation,  │
            │ the search and the identity permanently reachable — which for an officer who opens  │
            │ the queue 30-60 times a day is the difference between two clicks and a scroll then  │
            │ two clicks. It is also what makes the sticky decision bar on `SCR-ADM-003` sit at    │
            │ the bottom of the SCREEN rather than at the bottom of a very long page.              │
            └──────────────────────────────────────────────────────────────────────────────────┘ */}
        <div className="flex h-screen overflow-hidden bg-surface-sunken">
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
            {/* The ONE scrolling region. `min-h-0` because a flex child will not shrink below its
                content without it, which is the bug that makes `overflow-y-auto` silently do
                nothing inside a flex column. */}
            <main
              id="main"
              tabIndex={-1}
              aria-label={t('adm.chrome.mainLandmark')}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {/* The measure lives on an INNER wrapper, not on the scroll container.
                  `max-w-container` on the scrolling element would centre the scrollbar in the
                  middle of the screen — the container has to be full width and its contents
                  constrained. 1440px, because on an 1800px monitor a queue row otherwise puts a
                  gym's name at one edge and its status at the other with 1400px of nothing
                  between them, and the eye cannot associate the two. */}
              <div className="mx-auto w-full min-w-0 max-w-container px-inset-lg py-inset-lg">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </MfaGate>
    </>
  );
}

function AdminHeader() {
  // No session state here any more — identity moved to the sidebar footer.
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
            className="gm-hit-target flex h-[2.5rem] min-w-0 flex-1 max-w-ui items-center gap-inline-sm rounded-control border border-subtle bg-surface-sunken px-inset-sm text-sm text-content-muted transition-colors duration-fast ease-standard hover:border-strong"
          >
            {/* A magnifier, so the control reads as a search field before it is read at all. It
                was a bordered box with placeholder text, which reads as a disabled input. */}
            <ChromeGlyph icon="search" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">
              {t('adm.chrome.search.placeholder')}
            </span>
            <kbd className="shrink-0 rounded-control bg-surface-subtle px-inset-2xs font-mono text-xs">
              {t('adm.chrome.search.shortcut')}
            </kbd>
          </button>

          <div className="flex shrink-0 items-center gap-inline-sm">
            {/* +- THE TOPBAR CARRIES THREE THINGS NOW, NOT SEVEN -----------------------------+
                | It had a search field, an environment pill, a notifications bell, a help      |
                | button, a three-segment theme control, an avatar, a role, a truncated uuid    |
                | and a Sign out button. Nine controls, of which two were permanently disabled  |
                | and three were identity that belongs beside the person's name.                |
                |                                                                            |
                | The bell and the help button went entirely rather than staying disabled: an   |
                | inert control earns its place on a screen where the operator might reasonably |
                | look for it, and nobody hunts the topbar for a feature that does not exist.   |
                | They come back when `A-19` lands and there is something to notify.            |
                |                                                                            |
                | Identity moved to the SIDEBAR FOOTER, which is where the reference puts it    |
                | and where it reads as "who am I" rather than as another toolbar button.        |
                +-----------------------------------------------------------------------------+ */}
            <span className="hidden items-center gap-inline-2xs rounded-full bg-surface-subtle px-inset-sm py-inset-2xs text-xs font-medium text-content-secondary lg:inline-flex">
              <span
                aria-hidden="true"
                className="h-[0.5rem] w-[0.5rem] rounded-full bg-success-solid"
              />
              {t('adm.chrome.env')}
            </span>

            <ThemeToggle />
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

      {/* The identity, pinned to the bottom of the sidebar. See the note in the topbar. */}
      <SidebarIdentity collapsed={collapsed} />

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

/**
 * Who is signed in, and the way out. Pinned to the foot of the sidebar.
 *
 * ┌─ INITIALS AND A ROLE, NEVER A STOCK FACE ────────────────────────────────────────────────────┐
 * │ There is no avatar upload and no profile endpoint until `M-023`, and a stock portrait beside  │
 * │ real platform figures is a small fiction on a screen whose whole job is being trustworthy.    │
 * │                                                                                              │
 * │ The line under the name is the operator's ROLE, read from the token's `roles` claim — which   │
 * │ is the thing they actually need confirmed before they suspend a gym. The identifier they typed │
 * │ is in the `title`; after a reload only the uuid survives, and thirty-six characters of it in a │
 * │ 256px sidebar is noise.                                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
function SidebarIdentity({ collapsed }: { readonly collapsed: boolean }) {
  const session = useSession();
  const { signOut } = useSessionController();

  if (session.status !== 'AUTHENTICATED') return null;

  return (
    <div
      className={`flex items-center gap-inline-sm border-t border-subtle px-inset-md py-inset-sm ${
        collapsed ? 'justify-center' : ''
      }`}
    >
      <span
        aria-hidden="true"
        title={session.displayName}
        className="grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-full bg-surface-brand-subtle text-xs font-semibold text-content-brand"
      >
        {initialsOf(session.displayName)}
      </span>

      {!collapsed && (
        <>
          <span className="min-w-0 flex-1" title={session.displayName}>
            <span className="block truncate text-xs font-semibold text-content">
              {session.roleLabel ?? t('adm.chrome.roleUnknown')}
            </span>
            <span className="block truncate font-mono text-xs text-content-muted">
              {shortIdOf(session.displayName)}
            </span>
          </span>

          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            aria-label={t('adm.chrome.signOut')}
            title={t('adm.chrome.signOut')}
            className="gm-hit-target shrink-0 rounded-control px-inset-2xs text-content-muted transition-colors duration-fast ease-standard hover:text-content-danger"
          >
            {/* A door with an arrow. `aria-label` carries the meaning; the glyph is decorative. */}
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l-5-5 5-5M5 12h11" />
            </svg>
          </button>
        </>
      )}
    </div>
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
        // ┌─ A FILLED PILL, NOT A LEFT BORDER ────────────────────────────────────────────────┐
        // │ The 2px left border read as a bookmark stuck to the edge of the sidebar, and it     │
        // │ shifted the label 2px right of every inactive one — so the active item was both      │
        // │ marked AND misaligned, which is the sort of thing that looks unfinished without      │
        // │ anyone being able to say why.                                                        │
        // │                                                                                    │
        // │ A tinted rounded pill marks the item without moving it, and it is what the           │
        // │ reference uses. `font-semibold` and the brand ink carry it as well as the fill, so   │
        // │ the state does not depend on the tint being perceived (`AX9`).                        │
        // └────────────────────────────────────────────────────────────────────────────────────┘
        `gm-hit-target flex items-center justify-between gap-inline-xs rounded-control px-inset-sm py-inset-xs text-sm transition-colors duration-fast ease-standard ${
          isActive
            ? 'bg-surface-brand-subtle font-semibold text-content-brand'
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
              // `content-tertiary` (7.58:1) rather than muted (4.76:1). Muted passes the floor and
              // still fails the badge: this is 12px inside a 1px pill, and the floor is a minimum
              // for BODY text, not a target for the smallest text on the screen.
              className="shrink-0 rounded-control border border-subtle px-inset-2xs text-xs font-medium text-content-tertiary"
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
