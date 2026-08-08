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
  // BR-GYM-01, at the point of action. The subtitle carries the pricing promise, so this one
  // carries the other differentiator rather than repeating it.
  'web.home.hero.trust': 'Every gym here was approved by a person before it appeared.',
  // WCAG 2.2.2. The hero loop runs longer than five seconds, so a mechanism to stop it is an
  // obligation, not a courtesy — and the label has to say what it stops, because a lone pause
  // glyph on a page with no audio reads as a media player.
  'web.home.hero.motionPause': 'Pause background video',
  'web.home.hero.motionPlay': 'Play background video',

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

  // --- SCR-WEB-002 · the featured strip -------------------------------------
  'web.home.featured.title': 'Verified gyms near you',
  'web.home.featured.seeAll': 'See all gyms',

  // --- the fixture banner ---------------------------------------------------
  // Rendered on every page that shows the placeholder catalogue. A demo that cannot be told
  // apart from production is how a screenshot of invented gyms ends up in a pitch deck.
  'web.fixtureNotice':
    'Sample listings. These gyms are illustrative — real listings appear once gym onboarding and verification are live.',

  // --- SCR-WEB-002 · results, facets, empty state ---------------------------
  'web.search.heading.any': 'Gyms near you',
  'web.search.heading.query': 'Results for',
  'web.search.count.none': 'No gyms match these filters.',
  'web.search.count.one': 'verified gym',
  'web.search.count.many': 'verified gyms',
  'web.search.field.label': 'Search gyms by name, area or activity',
  'web.search.field.placeholder': 'Gym, area or activity',
  'web.search.action': 'Search',
  'web.search.filters.label': 'Filters',
  'web.search.filters.city': 'City',
  'web.search.filters.activity': 'Activity',
  'web.search.filters.anyCity': 'Any city',
  'web.search.filters.anyActivity': 'Any activity',
  'web.search.sort.label': 'Sort',
  'web.search.sort.relevance': 'Most relevant',
  'web.search.sort.priceAsc': 'Price: low to high',
  'web.search.sort.priceDesc': 'Price: high to low',
  'web.search.sort.rating': 'Highest rated',
  'web.search.sort.distance': 'Nearest',
  'web.search.empty.title': 'Nothing matched',
  // States the reason the catalogue is small, which is BR-GYM-01 working rather than a fault.
  'web.search.empty.body':
    'Every gym on GymMap is verified before it is listed, so the catalogue is smaller than a directory that lists anyone. Try widening the search.',
  'web.search.empty.removeCategory': 'Remove this activity',
  'web.search.empty.everyCity': 'Search every city',
  'web.search.empty.clearTerm': 'Clear the search term',
  'web.search.metaTitle.any': 'Verified gyms',
  'web.search.metaDescription':
    'Every gym on GymMap is verified before it is listed, and every review comes from a member who actually checked in.',

  // --- the result card ------------------------------------------------------
  'web.gym.perMonthFrom': 'per month, from',
  'web.gym.verified': 'Verified',
  // BR-REV-01 — a review needs a recorded check-in, so a new listing has none. Never a zero.
  'web.gym.newListing': 'New listing · no reviews yet',
  'web.gym.reviews.one': 'review',
  'web.gym.reviews.many': 'reviews',

  // --- SCR-WEB-003 · the gym page -------------------------------------------
  'web.gym.breadcrumb.root': 'Gyms',
  'web.gym.verifiedByPlatform': 'Verified by GymMap',
  'web.gym.section.about': 'About',
  'web.gym.section.amenities': 'Amenities',
  'web.gym.section.location': 'Where and when',
  'web.gym.section.reviews': 'Reviews',
  'web.gym.reviews.none':
    'No reviews yet. On GymMap a review can only be written by a member who has checked in at this gym — so a new listing starts empty rather than starting with reviews nobody earned.',
  'web.gym.reviews.earned':
    'members have reviewed this gym, and every one of them checked in first. Individual reviews appear here once the reviews module is live.',
  'web.gym.plans.title': 'Membership plans',
  'web.gym.plans.days': 'days',
  'web.gym.plans.join': 'Join this gym',
  // Invariant 3 stated to the member in their own words, on the screen where the price is read.
  'web.gym.plans.joinNotice':
    'Checkout opens once payments are live. The price you see here is the price you will be charged — it is revalidated on the server before any payment is taken.',
  'web.gym.notFound.title': 'Gym not found',

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
