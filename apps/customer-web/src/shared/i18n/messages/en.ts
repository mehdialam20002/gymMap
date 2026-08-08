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
  'web.chrome.nav.primary': 'Main',
  'web.chrome.nav.explore': 'Explore',
  'web.chrome.nav.howItWorks': 'How it works',
  'web.chrome.nav.cities': 'Cities',
  'web.chrome.nav.signIn': 'Log in',
  'web.chrome.nav.signUp': 'Sign up',
  'web.chrome.nav.openMenu': 'Open menu',
  'web.chrome.nav.closeMenu': 'Close menu',
  'web.chrome.location.label': 'Change location',
  'web.chrome.location.anywhere': 'All cities',

  // --- footer ---------------------------------------------------------------
  'web.chrome.footer.landmark': 'Footer',
  'web.chrome.footer.tagline': 'Find a gym you can trust, at a price you can see.',
  'web.chrome.footer.discover': 'Discover',
  'web.chrome.footer.members': 'Members',
  'web.chrome.footer.forGyms': 'For gyms',
  'web.chrome.footer.company': 'Company',
  'web.chrome.footer.support': 'Support',
  'web.chrome.footer.memberships': 'Memberships',
  'web.chrome.footer.compare': 'Compare gyms',
  // Shown beside a nav item whose route does not exist yet. Better than a link to a 404, and
  // better than hiding the item — the shape of the product is part of what the nav communicates.
  'web.chrome.nav.soon': 'Soon',
  'web.chrome.footer.checkIn': 'QR check-in',
  'web.chrome.footer.visits': 'Visit history',
  'web.chrome.footer.favourites': 'Favourites',
  'web.chrome.footer.referrals': 'Referrals',
  'web.chrome.footer.listGym': 'List your gym',
  'web.chrome.footer.ownerDashboard': 'Owner dashboard',
  'web.chrome.footer.about': 'About',
  'web.chrome.footer.contact': 'Contact',
  'web.chrome.footer.help': 'Help centre',
  'web.chrome.footer.legal': 'Legal',
  'web.chrome.footer.terms': 'Terms of use',
  'web.chrome.footer.privacy': 'Privacy policy',
  'web.chrome.footer.refunds': 'Refund policy',
  // OQ-01 / OQ-16: India, and mandatory rather than configurable under RBI data localisation.
  'web.chrome.footer.region': 'India',
  'web.chrome.footer.language': 'English',
  'web.chrome.footer.rights': 'GymMap',

  // --- SCR-WEB-001 home -----------------------------------------------------
  'web.home.meta.title': 'GymMap — find and join a gym near you',
  'web.home.meta.description':
    'Compare gyms near you by price, distance and facilities. See the real price before you visit, and join online.',
  // Split so one phrase can carry the brand accent. Kept as two keys rather than markup inside
  // one string: a translator must be able to move the accent, and in several languages the
  // emphasised phrase is not the tail of the sentence.
  'web.home.hero.titleLead': 'Find a gym that fits',
  'web.home.hero.titleAccent': 'your life',
  // NOT "India's #1". Every superlative on this page has to be defensible, and a marketplace
  // with no live listings cannot defend a ranking claim to a consumer or to ASCI.
  'web.home.hero.badge': 'Verified gyms, real prices',
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

  // The combined search control. The city select is a real <select> inside the GET form, so it
  // works before hydration and lands in a shareable URL.
  'web.home.hero.cityLabel': 'City',
  'web.home.hero.cityAny': 'All cities',

  /*
   * The three promises, in the compact form the hero needs. Deliberately the SAME three claims
   * the cards below make at length, because they are the differentiators (BR-GYM-01, BR-PLN-03,
   * BR-REV-01) and a hero that gestures at them while a strip of invented statistics does the
   * persuading has its priorities backwards.
   */
  'web.home.hero.promise.verified.title': 'Verified gyms',
  'web.home.hero.promise.verified.note': 'Approved by a person',
  'web.home.hero.promise.pricing.title': 'Real price',
  'web.home.hero.promise.pricing.note': 'No hidden fees',
  'web.home.hero.promise.reviews.title': 'Earned reviews',
  'web.home.hero.promise.reviews.note': 'Only after a check-in',

  'web.home.hero.browseLabel': 'Browse by activity',
  /*
   * The chip LABEL is translatable; the query value it links to is not. The value has to stay the
   * literal string the catalogue carries, or the filter matches nothing the moment a second
   * language exists — a bug that would look like "search is broken in Hindi".
   */
  'web.home.hero.category.strength': 'Strength',
  'web.home.hero.category.cardio': 'Cardio',
  'web.home.hero.category.yoga': 'Yoga',
  'web.home.hero.category.boxing': 'Boxing',
  'web.home.hero.category.swimming': 'Swimming',

  // The LONG form of the three promises. The trust strip states them in four words each, directly
  // under the hero; this section explains the mechanism behind each one further down the page.
  // Two lengths, two jobs — not a duplicate.
  'web.home.why.title': 'Why GymMap',
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

  // --- SCR-WEB-001 · trust strip --------------------------------------------
  // The three promises the cards below state at length, plus payments. Presented as a strip
  // because in a marketplace trust is not a feature list, it is the conversion mechanism.
  'web.home.trust.verified.title': 'Verified gyms',
  'web.home.trust.verified.body': 'Every listing is reviewed by a person before it goes live.',
  'web.home.trust.pricing.title': 'Transparent pricing',
  'web.home.trust.pricing.body': 'Taxes and fees are shown before you commit. No surprises.',
  'web.home.trust.reviews.title': 'Earned reviews',
  'web.home.trust.reviews.body': 'Only members with a recorded check-in can write one.',
  'web.home.trust.payments.title': 'Secure payments',
  'web.home.trust.payments.body': 'Your membership activates when the payment is confirmed.',

  // --- SCR-WEB-001 · explore by goal ----------------------------------------
  'web.home.goals.title': 'What are you training for?',
  'web.home.goals.body': 'Start from the outcome, not the equipment list.',
  'web.home.goals.strength': 'Build strength',
  'web.home.goals.weight': 'Lose weight',
  'web.home.goals.fitness': 'Improve fitness',
  'web.home.goals.flexibility': 'Move better',
  'web.home.goals.sport': 'Train for sport',
  'web.home.goals.routine': 'Stay in a routine',

  // --- SCR-WEB-001 · categories ---------------------------------------------
  'web.home.categories.title': 'Explore by activity',
  'web.home.categories.seeAll': 'See every activity',

  // --- SCR-WEB-001 · how it works -------------------------------------------
  'web.home.how.title': 'How GymMap works',
  'web.home.how.discover.title': 'Discover',
  'web.home.how.discover.body': 'Search gyms near you, filtered by what you actually need.',
  'web.home.how.compare.title': 'Compare',
  'web.home.how.compare.body': 'Put price, distance, facilities and reviews side by side.',
  'web.home.how.choose.title': 'Choose',
  'web.home.how.choose.body': 'Pick the plan that fits. The price you see is the price charged.',
  'web.home.how.join.title': 'Join',
  'web.home.how.join.body': 'Pay online and check in with a QR code from your phone.',

  // --- SCR-WEB-001 · cities -------------------------------------------------
  'web.home.cities.title': 'Where we have listings',
  // "{count} gyms" with a real number from the catalogue. Every figure on this page is counted
  // from data or it is absent - there is no strip of invented totals anywhere on this surface.
  'web.home.cities.count': '{count} gyms',
  'web.home.cities.countOne': '1 gym',

  // --- SCR-WEB-001 · for gym owners -----------------------------------------
  'web.home.owners.eyebrow': 'For gym owners',
  'web.home.owners.title': 'Turn local searches into members.',
  'web.home.owners.body':
    'List your gym, sell memberships online, take payments and track check-ins from one place.',
  'web.home.owners.cta': 'List your gym',

  // --- SCR-WEB-001 · closing --------------------------------------------------
  'web.home.closing.title': 'Your next gym is closer than you think.',
  'web.home.closing.cta': 'Find a gym near you',

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
  'web.search.filters.facilities': 'Facilities',
  // "Up to" and not "Under": ₹2,500 is included, and a member who picks the ₹2,500 band and finds
  // a ₹2,500 plan missing from the results has been misled by one word.
  'web.search.filters.price': 'Monthly price, up to',
  'web.search.filters.rating': 'Rating, at least',
  'web.search.filters.anyCity': 'Any city',
  'web.search.filters.anyActivity': 'Any activity',
  'web.search.filters.anyFacility': 'Any facility',
  'web.search.filters.anyPrice': 'Any price',
  'web.search.filters.anyRating': 'Any rating',
  // The rating floors read as "4.0 and above". `{rating}` is substituted at the call site.
  'web.search.filters.ratingAndUp': '{rating} and above',
  'web.search.filters.clearAll': 'Clear all filters',
  'web.search.filters.activeLabel': 'Active filters',
  // Prefixes each removable chip's accessible name, so a screen reader hears what the × does
  // rather than a bare filter value.
  'web.search.filters.remove': 'Remove filter',
  'web.search.filters.term': 'Search',
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
  'web.search.empty.removeFacility': 'Remove this facility',
  'web.search.empty.raisePrice': 'Show any price',
  'web.search.empty.dropRating': 'Show any rating',
  'web.search.empty.everyCity': 'Search every city',
  'web.search.empty.clearTerm': 'Clear the search term',
  'web.search.metaTitle.any': 'Verified gyms',
  'web.search.metaDescription':
    'Every gym on GymMap is verified before it is listed, and every review comes from a member who actually checked in.',

  // --- the result card ------------------------------------------------------
  'web.gym.perMonthFrom': 'per month, from',
  'web.gym.verified': 'Verified',
  // `{count}` is substituted at the call site. Not string concatenation: a translator must be
  // able to move the number, and several languages put it after the noun.
  'web.gym.amenitiesMore': '+{count} more',
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
  'web.gym.gallery.label': 'Photos of this gym',
  // Stated on the page rather than only in a code comment: a member looking at four photos of a
  // gym they are about to pay for is entitled to know whose photos they are.
  'web.gym.gallery.provenance':
    'Sample photography. A listed gym uploads its own photos before it goes live.',
  'web.gym.facts.from': 'From',
  'web.gym.facts.perMonth': 'per month',
  'web.gym.facts.distance': 'Distance',
  'web.gym.facts.km': 'km away',
  'web.gym.facts.rating': 'Rating',
  'web.gym.facts.unrated': 'Not yet rated',
  // "4.7 213 reviews" ran together in the facts strip and read as one number. The preposition is
  // doing real work; `{count}` is substituted at the call site so a translator can move it.
  'web.gym.facts.reviewCount': 'from {count} reviews',
  'web.gym.facts.open': 'Opening hours',
  'web.gym.section.similar': 'Other verified gyms in this city',
  'web.gym.similar.none':
    'This is the only verified gym listed in this city so far. More appear as they are approved.',
  'web.gym.directions': 'Open in maps',
  // Says where the link goes. An external destination announced as "Open in maps" alone is a
  // surprise for anyone who did not expect to leave the site (AX2, NFR-USE-*).
  'web.gym.directionsHint': 'opens Google Maps in a new tab',
  'web.gym.plans.title': 'Membership plans',
  'web.gym.plans.days': 'days',
  'web.gym.plans.join': 'Join this gym',
  // Invariant 3 stated to the member in their own words, on the screen where the price is read.
  'web.gym.plans.joinNotice':
    'Checkout opens once payments are live. The price you see here is the price you will be charged — it is revalidated on the server before any payment is taken.',
  'web.gym.notFound.title': 'Gym not found',
  'web.gym.compare.add': 'Add to compare',
  'web.gym.compare.remove': 'Remove from compare',

  // --- SCR-WEB-004 · compare ------------------------------------------------
  'web.compare.title': 'Compare gyms',
  'web.compare.metaDescription':
    'Put up to four verified gyms side by side — price, distance, rating and facilities.',
  'web.compare.empty.title': 'Nothing to compare yet',
  'web.compare.empty.body':
    'Pick up to four gyms and see them side by side. Every listing here has been checked by a person before it appeared.',
  'web.compare.pick.title': 'Add a gym',
  'web.compare.pick.action': 'Compare these',
  'web.compare.pick.full':
    'Four gyms is the limit. Remove one to add another — past four this stops being a decision and becomes a spreadsheet.',
  // `{keys}` is substituted at the call site.
  'web.compare.unresolved':
    'These are no longer listed and have been left out: {keys}. A gym can be delisted after a comparison is shared.',
  'web.compare.truncated': 'Only the first four gyms in this link are shown.',
  'web.compare.row.price': 'From, per month',
  'web.compare.row.distance': 'Distance',
  'web.compare.row.rating': 'Rating',
  'web.compare.row.verified': 'Verified',
  'web.compare.row.hours': 'Opening hours',
  'web.compare.row.plans': 'Plans',
  'web.compare.row.activities': 'Activities',
  'web.compare.facilities': 'Facilities',
  'web.compare.has': 'Yes',
  'web.compare.hasNot': 'No',
  'web.compare.view': 'View gym',
  'web.compare.remove': 'Remove',
  'web.compare.cheapest': 'Lowest price here',
  'web.compare.nearest': 'Closest here',
  // Says what the mark means before the table uses it. Never colour alone (AX8).
  'web.compare.legend':
    'A tick means the gym lists that facility. A dash means it has not listed it, which is not the same as not having it.',

  // The page-level disclosure. Deliberately the LAST thing before the footer: the closing call to
  // action gets its moment, and the caveat lands where fine print belongs rather than interrupting
  // the read. The listing grid carries its own, narrower notice — this one is about the platform,
  // that one is about those eight cards.
  'web.home.status.title': 'Where this is up to',
  'web.home.status.body':
    'Search and gym pages work, over a sample catalogue. Accounts, online joining and payments ' +
    'are being built next, and no gym is listed here until a person has checked it.',

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
