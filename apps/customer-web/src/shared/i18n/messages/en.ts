/**
 * The English message catalogue — `NFR-USE-08`, `I18N1`, `I18N5`.
 *
 * ┌─ EXTERNALISED FROM THE FIRST COMMIT, BEFORE ANY SECOND LANGUAGE EXISTS ─────────────────────┐
 * │ `ASM-07` assumes a single launch language and `A4.2` defers multi-language UI. `NFR-USE-08`  │
 * │ does NOT defer externalisation, and the distinction is the whole point: adding a second      │
 * │ language later is a translation job; retrofitting externalisation is an edit to every        │
 * │ component in fifty-five screens.                                                              │
 * │                                                                                              │
 * │ `I18N5` fails CI on a hard-coded user-facing literal in `apps/**`.                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Keys are `<area>.<screen>.<thing>`, matching the screen ids in `docs/ui/`. Flat rather than
 * nested so a key is greppable: searching for `web.home.hero.title` finds the string and its one
 * call site, which a nested object does not allow.
 */

export const en = {
  // --- chrome, shared across every page -------------------------------------
  'web.chrome.skipToContent': 'Skip to main content',
  'web.chrome.mainLandmark': 'Main content',
  'web.chrome.brand': 'GymMap',
  'web.chrome.nav.search': 'Find a gym',
  'web.chrome.nav.forGyms': 'List your gym',
  'web.chrome.nav.account': 'My account',
  'web.chrome.theme.toggle': 'Switch theme',
  'web.chrome.theme.light': 'Light',
  'web.chrome.theme.dark': 'Dark',
  'web.chrome.footer.legal': 'Legal',
  'web.chrome.footer.terms': 'Terms of use',
  'web.chrome.footer.privacy': 'Privacy policy',
  'web.chrome.footer.refunds': 'Refund policy',

  // --- SCR-WEB-001 home -----------------------------------------------------
  'web.home.meta.title': 'GymMap — find and join a gym near you',
  'web.home.meta.description':
    'Compare gyms near you by price, distance and facilities. See the real price before you visit, and join online.',
  'web.home.hero.title': 'Find a gym that fits your life',
  // BR-PLN-03 is a product promise, so the home page states it rather than implying it.
  'web.home.hero.subtitle':
    'Compare gyms near you by price, distance and facilities. The price you see is the price you pay.',
  'web.home.hero.searchLabel': 'Search by city, area or gym name',
  'web.home.hero.searchPlaceholder': 'Try “Indiranagar” or “Iron Temple”',
  'web.home.hero.searchAction': 'Search',
  'web.home.hero.nearMe': 'Use my location',

  'web.home.value.verified.title': 'Every gym is checked',
  // BR-GYM-01. Stated plainly because it is the differentiator, not a footnote.
  'web.home.value.verified.body':
    'A person reviews every listing before it appears here. No gym is visible until it has been approved.',
  'web.home.value.pricing.title': 'The price you see is the price you pay',
  'web.home.value.pricing.body':
    'Taxes and fees are shown before you commit. The total is confirmed again at checkout, and a mismatch stops the payment rather than charging you a different figure.',
  'web.home.value.reviews.title': 'Reviews from people who actually went',
  // BR-REV-01, BR-REV-03.
  'web.home.value.reviews.body':
    'A review can only be written by a member with a recorded check-in at that gym.',

  'web.home.status.title': 'Coming together',
  'web.home.status.body':
    'Search, gym profiles and online joining are being built. This page is the shell they arrive in.',

  // --- states, the four every screen must have (B6, §16.9) ------------------
  'web.state.loading': 'Loading',
  'web.state.empty.title': 'Nothing here yet',
  'web.state.error.title': 'Something went wrong at our end',
  'web.state.error.body':
    'This is our fault, not yours. Try again in a moment — if it keeps happening, the reference below helps us find it.',
  'web.state.error.retry': 'Try again',
  'web.state.error.reference': 'Reference',
  'web.state.notFound.title': 'That page does not exist',
  'web.state.notFound.body':
    'The link may be old, or the gym may no longer be listed. Search for what you were looking for.',
  'web.state.notFound.action': 'Back to search',
} as const;

export type MessageKey = keyof typeof en;
