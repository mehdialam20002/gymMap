/**
 * The information architecture, as data — `SCR-WEB-*` navigation.
 *
 * ┌─ ONE LIST, CONSUMED BY THE DESKTOP BAR, THE MOBILE DRAWER AND THE FOOTER ───────────────────┐
 * │ Three copies of a nav is three chances for them to disagree, and they always do: a route is │
 * │ renamed in the header, the drawer keeps the old label, and the footer keeps the old URL for │
 * │ another six months. Mobile navigation is REDESIGNED rather than collapsed — different       │
 * │ component, different interaction — but it reads the same source of truth.                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `built` MARKS WHAT ACTUALLY EXISTS ────────────────────────────────────────────────────────┐
 * │ The full IA is declared here because the shell has to be designed against the real shape of │
 * │ the product, not against whichever three pages happen to exist this week. But a nav item     │
 * │ pointing at a 404 is a broken promise on the most-used component on the site, so anything    │
 * │ not yet built is rendered as plain text with a "soon" marker rather than as a link.          │
 * │                                                                                              │
 * │ Flip the flag when the route lands. `nav.spec.ts` asserts every `built: true` href resolves  │
 * │ to a real file under `app/`, so the flag cannot drift from the router.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { MessageKey } from '../i18n/index.ts';

export interface NavItem {
  readonly href: string;
  readonly label: MessageKey;
  /** False until the route exists. Rendered as text, never as a dead link. */
  readonly built: boolean;
}

/** The primary bar. Deliberately short — six items is already the top of what a person scans. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/search', label: 'web.chrome.nav.search', built: true },
  { href: '/explore', label: 'web.chrome.nav.explore', built: true },
  { href: '/how-it-works', label: 'web.chrome.nav.howItWorks', built: false },
  { href: '/memberships', label: 'web.chrome.footer.memberships', built: false },
  { href: '/cities', label: 'web.chrome.nav.cities', built: true },
  { href: '/for-gyms', label: 'web.chrome.nav.forGyms', built: false },
];

export interface FooterColumn {
  readonly heading: MessageKey;
  readonly items: readonly NavItem[];
}

export const FOOTER_NAV: readonly FooterColumn[] = [
  {
    heading: 'web.chrome.footer.discover',
    items: [
      { href: '/search', label: 'web.chrome.nav.search', built: true },
      { href: '/explore', label: 'web.chrome.nav.explore', built: true },
      { href: '/cities', label: 'web.chrome.nav.cities', built: true },
      { href: '/compare', label: 'web.chrome.footer.compare', built: true },
    ],
  },
  {
    heading: 'web.chrome.footer.members',
    items: [
      { href: '/account/memberships', label: 'web.chrome.footer.memberships', built: true },
      { href: '/account/attendance', label: 'web.chrome.footer.visits', built: true },
      { href: '/account/favourites', label: 'web.chrome.footer.favourites', built: false },
      { href: '/account/referrals', label: 'web.chrome.footer.referrals', built: false },
    ],
  },
  {
    heading: 'web.chrome.footer.forGyms',
    items: [
      { href: '/for-gyms', label: 'web.chrome.footer.listGym', built: false },
      { href: '/for-gyms/signup', label: 'web.chrome.nav.signUp', built: false },
    ],
  },
  {
    heading: 'web.chrome.footer.company',
    items: [
      { href: '/about', label: 'web.chrome.footer.about', built: false },
      { href: '/contact', label: 'web.chrome.footer.contact', built: false },
    ],
  },
  {
    heading: 'web.chrome.footer.support',
    items: [
      { href: '/help', label: 'web.chrome.footer.help', built: false },
      { href: '/legal/terms', label: 'web.chrome.footer.terms', built: false },
      { href: '/legal/privacy', label: 'web.chrome.footer.privacy', built: false },
      { href: '/legal/refunds', label: 'web.chrome.footer.refunds', built: false },
    ],
  },
];
