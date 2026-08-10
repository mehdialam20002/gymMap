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
  // `toggle` is the pre-hydration name only: the server cannot know which theme is showing, so
  // for one paint the control names itself rather than an outcome it would get wrong half the
  // time. The other two name the DESTINATION, which is the only thing a reader wants announced.
  'web.chrome.theme.toggle': 'Switch theme',
  'web.chrome.theme.toLight': 'Switch to the light theme',
  'web.chrome.theme.toDark': 'Switch to the dark theme',
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

  // --- the announcement bar -------------------------------------------------
  // Three claims, and each one is a rule the code enforces rather than a slogan: BR-GYM-01,
  // BR-PLN-03, BR-REV-01. A bar that says "50% OFF" is the version of this that gets ignored.
  'web.chrome.announce.claims': 'Verified gyms · Transparent pricing · Earned reviews',
  'web.chrome.announce.link': 'How GymMap works',

  // --- footer ---------------------------------------------------------------
  'web.chrome.footer.landmark': 'Footer',
  // The trail's landmark. It was `aria-label="Breadcrumb"` in three components - the one English
  // literal on the site that never went through the catalogue, and one a translator could not
  // reach.
  'web.chrome.breadcrumb.landmark': 'Breadcrumb',
  'web.chrome.footer.tagline': 'Find a gym you can trust, at a price you can see.',
  /*
   * No YEAR. The reference reads "© 2026 GymMap", and a year written into a string is wrong from
   * the first of January and wrong silently - nobody reviews a footer in the new year. The repo
   * also bans reading the ambient clock (`no-bare-date`, `AC-FND-13.3`), so a computed year would
   * need the `Clock` port injected into site chrome for a decoration. A notice with no year is
   * complete on its own.
   */
  'web.chrome.footer.copyright': '© GymMap',
  // Stated, not offered - see the note beside the region line in `site-footer.tsx`.
  'web.chrome.footer.currency': '₹ INR',
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
  'web.home.meta.title': 'GymMap: find and join a gym near you',
  'web.home.meta.description':
    'Compare gyms near you by price, distance and facilities. See the real price before you visit, and join online.',
  // Split so one phrase can carry the brand accent. Kept as two keys rather than markup inside
  // one string: a translator must be able to move the accent, and in several languages the
  // emphasised phrase is not the tail of the sentence.
  // Three deliberate lines, because the display face is 142px and a headline that reflows at
  // that size is a different picture at every width. Kept as three keys so a translator can
  // rebreak them; one string with markup inside would not survive a language that reorders.
  'web.home.hero.titleOne': 'Find a gym',
  'web.home.hero.titleTwo': 'that fits',
  // `{n}` is the city count, substituted from the catalogue at render. The reference says
  // "69 verified gyms live", which would be a false statement: there are eight fixtures and no
  // approved listings. This says the thing that is true.
  /*
   * NOT "Live in 4 cities".
   *
   * Two problems in six words. "Live" is a market-presence claim, and there are zero approved
   * listings - the same claim this rewrite deleted from the owner console for exactly this
   * reason. And the four city NAMES were typed in beside a counted `{n}`, so the number came from
   * the catalogue and the list did not: add a fifth city and the tag reads "5 cities" over four
   * names.
   *
   * Both halves are counted now, and the sentence describes the sample rather than the market.
   */
  'web.home.hero.tagCities': 'Sample catalogue · {cities}',
  'web.home.hero.titleAccent': 'your life',
  // NOT "India's #1". Every superlative on this page has to be defensible, and a marketplace
  // with no live listings cannot defend a ranking claim to a consumer or to ASCI.
  // BR-PLN-03 is a product promise, so the home page states it rather than implying it.
  'web.home.hero.subtitle':
    'Compare gyms near you by price, distance and facilities. The price you see is the price you pay.',
  'web.home.hero.searchLabel': 'Search by city, area or gym name',
  'web.home.hero.searchPlaceholder': 'Try “Indiranagar” or “Iron Temple”',
  'web.home.hero.searchAction': 'Search',
  // BR-GYM-01, at the point of action. The subtitle carries the pricing promise, so this one
  // carries the other differentiator rather than repeating it.
  // The hero is a still photograph now, so there is no motion to stop and WCAG 2.2.2 is not
  // engaged. The alt describes what is IN the frame: "hero image" is a fact about the layout,
  // which is not something a screen-reader user can do anything with.

  // The combined search control. The city select is a real <select> inside the GET form, so it
  // works before hydration and lands in a shareable URL.
  'web.home.hero.cityLabel': 'City',
  'web.home.hero.cityAny': 'All cities',
  // `FR-SRCH-03` distance radius. `{km}` is substituted at the call site rather than being four
  // separate keys, so a translator writes the phrase once and the numbers stay numbers.
  'web.home.hero.radiusLabel': 'Distance from centre',
  'web.home.hero.radiusAny': 'Any distance',
  'web.home.hero.radiusWithin': 'Within {km} km of the centre',

  /*
   * The three promises, in the compact form the hero needs. Deliberately the SAME three claims
   * the cards below make at length, because they are the differentiators (BR-GYM-01, BR-PLN-03,
   * BR-REV-01) and a hero that gestures at them while a strip of invented statistics does the
   * persuading has its priorities backwards.
   */

  'web.home.hero.browseLabel': 'Browse by activity',
  /*
   * The chip LABEL is translatable; the query value it links to is not. The value has to stay the
   * literal string the catalogue carries, or the filter matches nothing the moment a second
   * language exists — a bug that would look like "search is broken in Hindi".
   */
  // The orbit beside the headline. Its labels are the CATEGORY names the catalogue carries, so
  // every node lands on results - see the note on ORBIT in hero.tsx.
  // NOT the same string as `browseLabel`. Both are `<nav>` landmarks on the homepage, and two
  // landmarks with one accessible name is a screen-reader user hearing "Browse by activity"
  // twice with no way to tell which list they are in.
  'web.home.hero.orbitLabel': 'Activities, as a constellation',
  'web.home.hero.category.group': 'Group classes',
  'web.home.hero.category.strength': 'Strength',
  'web.home.hero.category.cardio': 'Cardio',
  'web.home.hero.category.yoga': 'Yoga',
  'web.home.hero.category.boxing': 'Boxing',
  'web.home.hero.category.swimming': 'Swimming',

  // The LONG form of the four promises. The hero's marquee states each in four words; this band
  // explains the mechanism behind it. Two lengths, two jobs — not a duplicate. The titles are
  // shared with the marquee (`web.home.trust.*.title`) rather than written twice, because two
  // strings for one claim is how the two surfaces start disagreeing.
  'web.home.eyebrow.promises': 'What we guarantee',
  'web.home.promises.title': 'Four rules the product enforces',
  'web.home.promises.body':
    'Not positioning. Each of these is a check in the code, and the page cannot show you something that breaks one.',
  // BR-GYM-01. Stated plainly because it is the differentiator, not a footnote.
  'web.home.value.verified.body':
    'A person reviews every listing before it appears here. No gym is visible until it has been approved.',
  // BR-PLN-03. The figure is revalidated on the server at checkout, and a mismatch aborts.
  'web.home.value.pricing.body':
    'Taxes and fees are shown before you commit. The total is confirmed again at checkout, and a mismatch stops the payment rather than charging you a different figure.',
  // BR-REV-01, BR-REV-03.
  'web.home.value.reviews.body':
    'A review can only be written by a member with a recorded check-in at that gym.',
  // BR-PAY-02. A browser that says "success" has not activated anything.
  'web.home.value.payments.body':
    'Your membership starts when the payment provider confirms the payment to us, not when the browser returns from the payment screen.',

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
  // Names the GYM, because that is what the photograph actually shows. "Gyms in Bengaluru"
  // would describe a photo of a city that nobody took.

  // --- SCR-WEB-001 · for gym owners -----------------------------------------
  'web.home.owners.eyebrow': 'For gym owners',
  'web.home.owners.title': 'Turn local searches into members.',
  'web.home.owners.body':
    'List your gym, sell memberships online, take payments and track check-ins from one place.',
  'web.home.owners.cta': 'List your gym',
  // The four things the gym dashboard does. Capabilities, not outcomes — "get discovered" is a
  // description of the product; "grow revenue 40%" would be a promise nobody has measured.
  'web.home.owners.point.discovered': 'Get discovered locally',
  'web.home.owners.point.sell': 'Sell memberships online',
  'web.home.owners.point.checkins': 'Manage check-ins',
  'web.home.owners.point.track': 'Track performance',
  'web.home.owners.preview.title': 'Owner dashboard',
  /*
   * NOT "Live". `A-08` / `LC5`: nothing may claim to be live that is not, and this panel carries
   * no data at all - it is a drawing of the console with the figures deliberately left as blocks.
   * A green "Live" chip on a drawing is the same defect as a counting animation on a stale
   * figure, and the caption underneath already tells the truth.
   */
  'web.home.owners.preview.badge': 'Illustration',
  'web.home.owners.preview.revenue': 'Revenue',
  'web.home.owners.preview.members': 'Members',
  // Says what the panel IS. Without this a reader is entitled to assume the blocks were numbers
  // that failed to load, which is a worse impression than the honest one.
  'web.home.owners.preview.caption':
    'An illustration of the owner dashboard. Your own figures appear here once your gym is listed.',

  // --- SCR-WEB-001 · closing --------------------------------------------------
  // Split so the accent phrase can move: at 116px the closing headline is display type, and a
  // translator has to be able to put the emphasis where their language puts it.
  'web.home.closing.titleLead': 'Your next gym is closer',
  'web.home.closing.titleAccent': 'than you think',
  'web.home.closing.body':
    'Search verified gyms, compare memberships and join with the price you were shown.',
  'web.home.closing.title': 'Your next gym is closer than you think.',
  'web.home.closing.cta': 'Find a gym near you',

  // ── the "Chalk & Iron" sections ────────────────────────────────────────
  'web.home.fixture.label': 'Sample',
  'web.home.fixture.body':
    'These listings are illustrative. Real ones appear here once gym onboarding and verification are live.',
  'web.home.plans.perMonthFrom': 'per month, from',
  'web.home.compare.remove': 'Remove from compare',
  'web.home.compare.add': 'Add to compare',
  'web.home.card.view': 'View',
  'web.home.cities.seeAll': 'View all cities',
  // Deliberately "listings" and not "gyms". The figure is how many are LISTED, which today is a
  // fixture count, and calling it anything grander would be the invented total this page keeps
  // refusing to print.
  /*
   * Both forms. Chennai has one listing and the page read "1 listings" - the kind of defect that
   * survives review because nobody re-reads a count they wrote the formatter for. The component
   * picks; `en.ts` does not know the number.
   */
  'web.home.cities.listings': 'listings',
  'web.home.cities.listingsOne': 'listing',

  // --- SCR-WEB-002 · the featured strip -------------------------------------
  'web.home.featured.title': 'Verified gyms near you',
  'web.home.featured.seeAll': 'See all gyms',

  // --- the fixture banner ---------------------------------------------------
  // Rendered on every page that shows the placeholder catalogue. A demo that cannot be told
  // apart from production is how a screenshot of invented gyms ends up in a pitch deck.
  'web.fixtureNotice':
    'Sample listings. These gyms are illustrative. Real listings appear once gym onboarding and verification are live.',

  // --- SCR-WEB-002 · results, facets, empty state ---------------------------
  'web.search.eyebrow': 'Search results',
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
  // The card's and the comparison's distance. The unit used to be a bare ` km` typed into the
  // JSX, which is both a hard-coded user-facing string and a number with no stated origin.
  'web.gym.distanceFromCentre': '{km} km from centre',
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
  'web.search.sort.distance': 'Nearest the centre',
  'web.search.empty.title': 'Nothing matched',
  // States the reason the catalogue is small, which is BR-GYM-01 working rather than a fault.
  'web.search.empty.body':
    'Every gym on GymMap is verified before it is listed, so the catalogue is smaller than a directory that lists anyone. Try widening the search.',
  'web.search.empty.removeCategory': 'Remove this activity',
  'web.search.empty.removeFacility': 'Remove this facility',
  'web.search.empty.raisePrice': 'Show any price',
  'web.search.empty.dropRating': 'Show any rating',
  'web.search.empty.everyCity': 'Search every city',
  // The seventh relaxation. Six filters could be dropped from the empty state and the distance
  // radius could not - the one filter the home page's hero can set, so the most likely way to
  // arrive here was the one the panel refused to undo.
  'web.search.empty.anyDistance': 'Search any distance',
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
    'No reviews yet. On GymMap a review can only be written by a member who has checked in at this gym, so a new listing starts empty rather than starting with reviews nobody earned.',
  'web.gym.reviews.earned':
    'members have reviewed this gym, and every one of them checked in first. Individual reviews appear here once the reviews module is live.',
  /*
   * NOT "Photos of this gym", which is what this said and is what the caption two lines below
   * spends a sentence denying. The label is the figure's accessible name, so a screen-reader user
   * got the claim and a sighted one got the correction.
   *
   * The gallery KEEPS its photographs where the cards lost theirs, and the difference is the
   * disclosure: here it is directly under the mosaic, specific and unavoidable. On a card it was
   * a banner at the top of a list of eight, which does not travel with the screenshot of one card.
   */
  // Rides ON the image, not on the page. A banner at the top of a results list does not travel
  // with a screenshot of one card, and this is the same disclosure the gallery already carries.
  'web.gym.samplePhoto': 'Sample photo',
  // The same disclosure, for the image's alt text. The visible pill is `aria-hidden` so it
  // cannot leak into the accessible name of a link wrapped round the cover; a statement about
  // an image belongs in that image's description, which is what this is.
  'web.gym.samplePhotoAlt': '{description} (sample photo)',
  'web.gym.gallery.label': 'Sample photos, not this gym',
  // Stated on the page rather than only in a code comment: a member looking at four photos of a
  // gym they are about to pay for is entitled to know whose photos they are.
  'web.gym.gallery.provenance':
    'Sample photography. A listed gym uploads its own photos before it goes live.',
  'web.gym.facts.from': 'From',
  'web.gym.facts.perMonth': 'per month',
  'web.gym.facts.distance': 'Distance',
  'web.gym.facts.rating': 'Rating',
  'web.gym.facts.unrated': 'Not yet rated',
  'web.gym.facts.verified': 'Verified',
  'web.gym.facts.reviews': 'reviews',
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
    'Checkout opens once payments are live. The price you see here is the price you will be charged. It is revalidated on the server before any payment is taken.',
  'web.gym.notFound.title': 'Gym not found',
  'web.gym.compare.add': 'Add to compare',
  'web.gym.compare.remove': 'Remove from compare',

  // --- SCR-WEB-004 · compare ------------------------------------------------
  'web.compare.title': 'Compare gyms',
  // The comparison's first column has no heading of its own - it labels the rows. A screen
  // reader still needs to be told what the column IS, so the header cell carries this and hides
  // it, rather than being empty and announcing nothing.
  'web.compare.rowLabel': 'What is being compared',
  /*
   * `AX8` - the marked cell is mint AND says so, because colour is never the only signal.
   *
   * And it names the FACT rather than declaring a winner. "Best" is the platform ranking one
   * listing above another on the screen where the decision is made, and `BR-GYM-*` gives no basis
   * for that; "lowest price" is arithmetic about three numbers on display. `compare.spec.ts`
   * enforces the distinction across the whole `web.compare.*` namespace.
   */
  // --- FR-CMP-01 · the compare rail -----------------------------------------
  // The selection lives in the URL, so every one of these labels describes a LINK. "Clear" is a
  // link to the page with no gyms on it, not a button that mutates something.
  'web.compare.rail.label': 'Gyms you are comparing',
  // One form, because "1 of 4 gyms selected" is already grammatical - a singular key here would
  // be two strings a translator has to keep identical for no reason.
  'web.compare.rail.count': 'of {max} gyms selected',
  'web.compare.rail.remove': 'Remove {gym} from the comparison',
  'web.compare.rail.clear': 'Clear',
  'web.compare.rail.cta': 'Compare',
  'web.compare.rail.full': 'That is the maximum. Remove one to swap in another.',
  'web.compare.markLowest': 'lowest price shown',
  'web.compare.markNearest': 'nearest of these',
  'web.compare.markRated': 'highest rated of these',
  'web.compare.metaDescription':
    'Put up to four verified gyms side by side: price, distance, rating and facilities.',
  'web.compare.empty.title': 'Nothing to compare yet',
  'web.compare.empty.body':
    'Pick up to four gyms and see them side by side. Every listing here has been checked by a person before it appeared.',
  'web.compare.pick.title': 'Add a gym',
  'web.compare.pick.action': 'Compare these',
  'web.compare.pick.full':
    'Four gyms is the limit. Remove one to add another. Past four this stops being a decision and becomes a spreadsheet.',
  // `{keys}` is substituted at the call site.
  /*
   * NOT "these are no longer listed". That asserted, as a platform statement of fact, that each of
   * these WAS a listing and has since been removed - for text that came out of the URL bar. Any
   * `?gym=anything` produced it, so arbitrary input was echoed back inside a claim the product had
   * no basis for. What is actually known is that the link did not match a gym; delisting is one
   * possible reason among several, and it is offered as one.
   */
  'web.compare.unresolved':
    'Some links in this comparison did not match a gym and were left out: {keys}. A link can go stale if a gym is delisted after it was shared.',
  // Beyond a handful, the list stops being information and starts being the URL pasted back.
  'web.compare.unresolvedMore': 'and {count} more',
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

  // --- SCR-WEB-005/006/007 · checkout, payment, confirmation ----------------
  'web.checkout.title': 'Review your membership',
  'web.checkout.metaDescription':
    'Check the gym, the plan and the total before you pay. The price shown is the price charged.',
  'web.checkout.notFound.title': 'That plan is not available',
  'web.checkout.notFound.body':
    'The link named a gym or a plan that does not exist. Pick a plan from the gym page and it will bring the right one here.',
  'web.checkout.notFound.action': 'Find a gym',
  'web.checkout.section.membership': 'What you are buying',
  'web.checkout.section.total': 'What you pay',
  'web.checkout.plan': 'Plan',
  'web.checkout.duration': 'Length',
  'web.checkout.days': 'days',
  'web.checkout.line.gross': 'Plan price',
  'web.checkout.line.discount': 'Discount',
  'web.checkout.line.net': 'Subtotal',
  'web.checkout.line.total': 'Total',
  'web.checkout.line.taxNote': 'Tax is added to the listed price, not included in it.',
  // Invariant 3, said to the member in their own words on the screen where the price is read.
  'web.checkout.priceProof':
    'This total is checked again on our server before any payment is taken. If it does not match, the payment is stopped rather than charged at a different figure.',
  'web.checkout.pay': 'Continue to payment',
  // Says exactly why the button does nothing, rather than looking broken.
  'web.checkout.payNotice':
    'Payments are not live yet. When they are, this hands you to the payment provider. GymMap never sees your card details.',
  'web.checkout.changePlan': 'Choose a different plan',

  'web.confirmation.title': 'What happens after you pay',
  'web.confirmation.metaDescription':
    'How a GymMap membership is activated, and why the confirmation comes from our server rather than from your browser.',
  // Invariant 5, and the reason it exists, in one paragraph a member can act on.
  'web.confirmation.webhook.title': 'Your membership activates on our server, not in this tab',
  'web.confirmation.webhook.body':
    'When you pay, the payment provider tells our server directly. That message is what activates the membership. This page reaching you is not the confirmation, which is why a lost connection, a closed tab or a failed redirect cannot leave you paid and without a membership.',
  'web.confirmation.next.title': 'What you will get',
  'web.confirmation.next.qr':
    'A membership QR code in your account, which the gym scans when you arrive.',
  'web.confirmation.next.receipt':
    'A receipt with the same figures you approved, to the nearest paise.',
  'web.confirmation.next.email':
    'An email, once the payment is confirmed rather than when it is started.',
  'web.confirmation.pending.title': 'If the confirmation is slow',
  // --- SCR-WEB-020 · how it works (members) --------------------------------
  'web.howItWorks.title': 'How GymMap works',
  'web.howItWorks.metaDescription':
    'Find a verified gym, see the real price, join online and check in with a code. Here is each step and what happens behind it.',
  'web.howItWorks.intro':
    'Four steps, and one rule behind each of them. The rules are what make the steps worth trusting, so they are stated rather than implied.',
  'web.howItWorks.rule': 'The rule behind it',
  // Each step's rule is the business rule itself, in a member's words.
  'web.howItWorks.discover.rule':
    'A person reviews every gym before it is listed. Nothing appears here because it paid to.',
  'web.howItWorks.compare.rule':
    'Every figure on a listing is the gym’s own, shown in full. Taxes are added on the review screen before you commit, never after.',
  'web.howItWorks.choose.rule':
    'The total you approve is checked again on our server before any payment is taken. A mismatch stops the payment rather than charging a different figure.',
  'web.howItWorks.join.rule':
    'Your membership activates when the payment provider confirms the payment to our server, not when your browser returns. A dropped connection cannot leave you paid and without a membership.',
  'web.howItWorks.reviews.title': 'Why the reviews here are different',
  'web.howItWorks.reviews.body':
    'A review can only be written by a member with a recorded check-in at that gym. That is the whole rule. It means a new gym starts with no reviews rather than with reviews nobody earned, and it means the ones you read came from people who actually went.',
  'web.howItWorks.cta': 'Find a gym near you',

  // --- SCR-WEB-030 · for gyms ----------------------------------------------
  'web.forGyms.title': 'List your gym on GymMap',
  'web.forGyms.metaDescription':
    'Reach members searching for a gym near them, sell memberships online, take payments and track check-ins from one place.',
  'web.forGyms.hero.eyebrow': 'For gym owners',
  'web.forGyms.hero.body':
    'People searching for a gym in your area are already looking. GymMap puts your listing in front of them with your real prices, and gives you the tools to turn a search into a member.',
  'web.forGyms.hero.cta': 'Start listing',
  'web.forGyms.hero.secondary': 'How verification works',

  'web.forGyms.value.title': 'What you get',
  'web.forGyms.value.reach.title': 'Local search that finds you',
  'web.forGyms.value.reach.body':
    'Your gym appears on the city and activity pages members actually search for, with your photos, your facilities and your prices.',
  'web.forGyms.value.sell.title': 'Memberships sold online',
  'web.forGyms.value.sell.body':
    'Members choose a plan and pay before they arrive. The membership is issued automatically once the payment is confirmed.',
  'web.forGyms.value.checkin.title': 'Check-in without a register',
  'web.forGyms.value.checkin.body':
    'Members show a code, your staff scan it on any phone or tablet, and the visit is recorded against the right membership.',
  'web.forGyms.value.money.title': 'Money you can reconcile',
  'web.forGyms.value.money.body':
    'Every sale is broken down to the paise: what the member paid, the tax, our commission, the gateway fee and what settles to you. Nothing is rounded away.',

  'web.forGyms.steps.title': 'How listing works',
  'web.forGyms.steps.apply.title': 'Tell us about the gym',
  'web.forGyms.steps.apply.body':
    'Name, address, what you offer, your plans and prices, and the documents that show the business is yours.',
  'web.forGyms.steps.verify.title': 'A person checks it',
  'web.forGyms.steps.verify.body':
    'Not a script. Someone reads the application and confirms the gym is real before anything goes live, which is the reason a member trusts what they find here.',
  'web.forGyms.steps.live.title': 'The listing goes live',
  'web.forGyms.steps.live.body':
    'It appears in search, on your city page and on the pages for every activity you offer.',
  'web.forGyms.steps.paid.title': 'You get paid',
  'web.forGyms.steps.paid.body':
    'Payments settle to your account on a fixed cycle, with a statement that reconciles to the paise.',

  'web.forGyms.commission.title': 'What it costs',
  // The rate itself is documented (LAUNCH_MARKET_INDIA.md) and publishing it is the owner's
  // decision, not a page author's — so this states the SHAPE of the charge honestly and leaves
  // the number to the signup conversation rather than inventing or leaking one.
  /*
   * ┌─ SCOPED TO LISTING, WHICH IS WHAT THIS PAGE SELLS ─────────────────────────────────────────┐
   * │ This read "A commission per membership sold, and nothing else: no listing fee, no monthly   │
   * │ charge..." - an absolute claim about every fee GymMap would ever charge, and                │
   * │ `MASTER_PRD.md` §A6.1 lists a monthly SaaS subscription as Phase 1 revenue. Recorded as     │
   * │ `KL-112`, and the owner has now ruled.                                                      │
   * │                                                                                             │
   * │ The ruling: the two charges are for two different products, which is what the repository's  │
   * │ own one-line description has said all along - "Gym Marketplace AND Multi-Tenant Gym         │
   * │ Management SaaS". A gym pays COMMISSION for members this marketplace sends it, and pays a   │
   * │ SUBSCRIPTION for the management software it uses every day whether or not a member arrives. │
   * │ §A6.2's tiers are priced by branches, active members and staff seats - the gym's own        │
   * │ operations, not anything GymMap delivers.                                                    │
   * │                                                                                             │
   * │ So the sentence was not false, it was unscoped. One clause fixes it: the commission is what │
   * │ LISTING costs. The marketplace's strongest promise survives intact - a gym with no sales    │
   * │ pays nothing to be listed, which is the only offer a marketplace with no members yet can    │
   * │ honestly make - and it no longer denies a product this page is not selling.                 │
   * └─────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  'web.forGyms.commission.body':
    'Listing on GymMap costs a commission per membership sold, and nothing else: no listing fee, no monthly charge for your listing, and no fee for a month with no sales. The rate is agreed before you list and is shown on every statement, and the rate that applied on the day of a sale is the rate that sale keeps. A later change never rewrites an old settlement.',

  'web.forGyms.faq.title': 'Questions owners ask',
  'web.forGyms.faq.control.q': 'Do I lose control of my prices?',
  'web.forGyms.faq.control.a':
    'No. You set the plans and the prices, and you change them when you like. What GymMap guarantees a member is that the price they were shown is the price they are charged.',
  'web.forGyms.faq.reviews.q': 'Can someone review my gym without visiting?',
  'web.forGyms.faq.reviews.a':
    'No. A review requires a recorded check-in at your gym. That protects you at least as much as it protects the member.',
  'web.forGyms.faq.data.q': 'Whose members are they?',
  'web.forGyms.faq.data.a':
    'Yours. You see who holds a membership at your gym and when they came, and you can export it.',
  'web.forGyms.faq.exclusive.q': 'Do I have to be exclusive to GymMap?',
  'web.forGyms.faq.exclusive.a':
    'No. Listing here does not stop you selling memberships at the door, on your own site, or anywhere else.',

  'web.forGyms.signup.title': 'Start listing your gym',
  'web.forGyms.signup.metaDescription':
    'Send your gym’s details and a person will review the listing before it goes live.',
  'web.forGyms.signup.intro':
    'This is the first half of onboarding: enough for a person to check the gym is real. Plans, photos and payout details come after that, in the owner dashboard.',
  'web.forGyms.signup.field.gym': 'Gym name',
  'web.forGyms.signup.field.city': 'City',
  'web.forGyms.signup.field.contact': 'Your name',
  'web.forGyms.signup.field.email': 'Email',
  'web.forGyms.signup.field.phone': 'Phone',
  'web.forGyms.signup.field.about': 'Anything we should know',
  'web.forGyms.signup.submit': 'Send the application',
  // The form is complete and its endpoint is not. Said next to the button rather than discovered
  // by a gym owner who filled it in.
  'web.forGyms.signup.notice':
    'Gym onboarding is not connected yet, so this form does not send anything. It is here so the fields can be reviewed. Nothing you type is stored or transmitted.',
  'web.forGyms.signup.verifyNote':
    'Every application is read by a person. A gym is not listed until it has been approved, which is why the catalogue is smaller than a directory that lists anyone.',

  // --- the section eyebrows -------------------------------------------------
  // Five eyebrows, not eleven. One states the section's AUDIENCE, its FORM, or the product
  // RULE it demonstrates - never a restatement of the heading below it, and never a mood.
  // The six that did neither are gone with their keys; see `SectionHead` in `chalk.tsx`.
  'web.home.eyebrow.member': 'The member experience',
  'web.home.eyebrow.reviews': 'Earned reviews',
  'web.home.eyebrow.faq': 'Questions',

  // --- SCR-WEB-001 · the membership marketplace ------------------------------
  // NOT "Best memberships this month". Eight listings and no sales data, so "best" would be a
  // ranking the platform cannot defend, on the screen where a member decides where to spend.
  'web.home.plans.title': 'Plans from verified gyms',
  'web.home.plans.body':
    'Every plan below is the gym’s own price, listed as they set it. No introductory rate that expires and no fee added at checkout.',
  'web.home.plans.seeAll': 'See all gyms',
  'web.home.plans.perMonth': 'per month',
  'web.home.plans.days': 'days',
  'web.home.plans.view': 'View this plan',
  // BR-PLN-03, stated where the prices are. The reference strikes through an invented "original"
  // price on every card; a discount this page made up is one checkout would refuse to honour.
  'web.home.plans.noDiscountNote':
    'No struck-through prices here. A discount is real or it is not shown, and the figure you see is the figure the server charges.',

  // --- SCR-WEB-001 · the compare teaser --------------------------------------
  'web.home.compareTeaser.title': 'Still deciding? Put them side by side.',
  'web.home.compareTeaser.body':
    // NOT "live". The table is built from the sample catalogue, and "live" beside three figures
    // is the reader taking them for current market data. What is true, and is the point, is that
    // it comes from the SAME listings the results page and checkout use, so it cannot disagree
    // with them.
    'Up to four gyms at once: price, distance, rating and every facility, in one view. The table below is built from the same listings the results page uses, so the figures cannot disagree.',
  'web.home.compareTeaser.cta': 'Start comparing',
  'web.home.compareTeaser.rowPrice': 'From, per month',
  'web.home.compareTeaser.rowDistance': 'Distance',
  'web.home.compareTeaser.rowRating': 'Rating',

  // --- SCR-WEB-001 · what a membership gives you -----------------------------
  'web.home.member.title': 'Your membership, in your pocket',
  'web.home.member.body':
    'Once you join, everything about the membership lives in your account: the code you show at the door, every visit that was recorded, and a receipt for every rupee.',
  'web.home.member.qr.title': 'A code at the door',
  'web.home.member.qr.body':
    'Your gym scans it and the visit is recorded. The code is signed by our server and lasts sixty seconds, so a screenshot is worth nothing to anyone else.',
  'web.home.member.visits.title': 'Every visit, listed',
  'web.home.member.visits.body':
    'A visit appears the moment a gym scans you in. It is the same record your gym sees, so there is nothing to dispute.',
  'web.home.member.receipts.title': 'Receipts that never change',
  'web.home.member.receipts.body':
    'The figures on a receipt are the ones you were charged, stored with the order. A later change to a price or a tax rate cannot rewrite it.',
  'web.home.member.cta': 'See the account',

  // --- SCR-WEB-001 · FAQ ------------------------------------------------------
  // ── The reviews band. The reference fills this with three five-star quotes from three named
  // members. `BR-REV-01` makes a review impossible without a recorded check-in and there are
  // none, so the section states the RULE and the current count instead. It is the same promise
  // the page makes three sections up, and stating it while having nothing to show is the only
  // version of this section that is true today.
  'web.home.reviews.title': 'Reviews you can trust, when there are reviews',
  'web.home.reviews.body':
    'A review on GymMap requires a recorded check-in at that gym. Nobody can write about a gym they have never been to, and nobody can buy their way onto this page.',
  'web.home.reviews.emptyTitle': 'No reviews yet',
  'web.home.reviews.emptyBody':
    'Check-ins start when the first gyms finish onboarding. Until then this space stays empty rather than filling up with quotes we made up.',
  'web.home.reviews.ruleTitle': 'Earned, not collected',
  'web.home.reviews.ruleBody':
    'Only a member with a visit on record can leave one, and the visit has to be scanned by the gym.',
  'web.home.reviews.unratedTitle': 'New listings say so',
  'web.home.reviews.unratedBody':
    'A gym with no reviews shows as a new listing. It never shows a zero, because a zero would read as members rating it badly.',
  'web.home.reviews.cta': 'See how check-in works',

  // ── The fourth card in the plans row, matching the reference's "not sure?" tile.
  'web.home.plans.compareTitle': 'Not sure yet?',
  'web.home.plans.compareBody':
    'Put up to four gyms side by side and see price, distance, rating and every facility in one view.',
  'web.home.plans.compareCta': 'Compare gyms',

  'web.home.faq.title': 'Good to know',
  'web.home.faq.body': 'The four things people ask before they pick a gym here.',
  'web.home.faq.verified.q': 'Are all the gyms really checked?',
  'web.home.faq.verified.a':
    'Yes. A person reads every application and confirms the gym is real before the listing appears. Nothing is listed because it paid to be.',
  'web.home.faq.price.q': 'Is the price I see the price I pay?',
  'web.home.faq.price.a':
    'Yes. Taxes are shown on the review screen before you commit, and the total is checked again on our server before any payment is taken. If it does not match, the payment stops rather than going through at a different figure.',
  'web.home.faq.reviews.q': 'Can someone review a gym they never visited?',
  'web.home.faq.reviews.a':
    'No. A review requires a recorded check-in at that gym. It is why a new listing starts with no reviews rather than with reviews nobody earned.',
  'web.home.faq.checkin.q': 'How does check-in work?',
  'web.home.faq.checkin.a':
    'You open your membership and show the code. The gym scans it, and the visit appears in your history and in theirs within seconds.',

  // --- SCR-WEB-008/009 · city and activity landings ------------------------
  // `{city}` / `{activity}` / `{count}` are substituted at the call site. A translator must be
  // able to move them, and several languages put the noun before the place.
  'web.landing.city.title': 'Gyms in {city}',
  'web.landing.city.metaDescription':
    'Every verified gym in {city} on GymMap, with the price you actually pay. Compare by distance, facilities and monthly cost.',
  'web.landing.city.intro':
    'Every listing in {city} has been checked by a person before it appeared, and the monthly price on each card is the price charged at checkout.',
  // The gym grid's own heading on both landings. Visually hidden: the h1 above it already says
  // what is being listed, but the outline needs a level 2 between that h1 and the cards' h3.
  'web.landing.listingsHeading': 'Listings',
  // The two hub pages were a heading, one line and a grid of tiles - about 1,000px against the
  // home page's 11,000. These name the cross-link band each one gained: from cities you want
  // to know what is on offer, and from an activity you want to know where it is.
  'web.landing.cities.activities': 'What you can do',
  'web.landing.explore.cities': 'Where to find them',
  'web.landing.city.activities': 'Activities in {city}',
  'web.landing.city.otherCities': 'Other cities',
  'web.landing.city.seeAll': 'See all {count} in search',
  'web.landing.city.empty':
    'No verified listings in this city yet. Gyms appear here as they are approved.',

  'web.landing.activity.title': '{activity} gyms',
  'web.landing.activity.metaDescription':
    'Verified gyms offering {activity}, with real monthly prices and reviews from members who checked in.',
  'web.landing.activity.intro':
    'Gyms that list {activity} among what they offer. Every one has been checked by a person, and every review comes from a member who was recorded at the door.',
  'web.landing.activity.cities': 'Where to find {activity}',
  'web.landing.activity.other': 'Other activities',
  'web.landing.activity.empty':
    'No verified gyms list this activity yet. They appear here as they are approved.',

  'web.landing.cities.title': 'Cities',
  'web.landing.cities.metaDescription':
    'Every city where GymMap has verified listings, with how many gyms are in each.',
  'web.landing.cities.intro':
    'A city appears here once it has a verified listing. The counts are what is actually listed, not what is planned.',
  'web.landing.explore.title': 'Explore by activity',
  'web.landing.explore.metaDescription':
    'Browse verified gyms by what they offer: strength, cardio, yoga, swimming, boxing and more.',
  'web.landing.explore.intro':
    'Start from what you want to do. Each activity lists the gyms that offer it, in the cities where they are.',
  'web.landing.count.one': 'gym',
  'web.landing.count.many': 'gyms',

  // --- SCR-WEB-01x · the member account ------------------------------------
  'web.account.title': 'Your account',
  'web.account.metaDescription': 'Your memberships, check-in code, visit history and receipts.',
  // The account area is rendered over a sample member because sign-in is not wired to this app
  // yet. Said once, at the top of every account screen, in the same voice as the listing notice.
  'web.account.demoNotice':
    'Sample account. Sign-in is not connected to this site yet, so these are illustrative records. They are here so the screens can be reviewed.',
  'web.account.nav.label': 'Account',
  'web.account.nav.overview': 'Overview',
  'web.account.nav.memberships': 'Memberships',
  'web.account.nav.attendance': 'Visit history',
  'web.account.nav.orders': 'Receipts',
  'web.account.nav.reviews': 'Reviews',
  'web.account.memberSince': 'Member since',

  'web.account.overview.active': 'Your current membership',
  'web.account.overview.none':
    'No active membership. Find a gym and the membership appears here once the payment is confirmed.',
  'web.account.overview.recentVisits': 'Recent visits',
  'web.account.overview.checkIn': 'Show check-in code',
  'web.account.overview.findGym': 'Find a gym',

  'web.account.memberships.title': 'Memberships',
  'web.account.memberships.validity': 'Valid',
  'web.account.memberships.to': 'to',
  'web.account.memberships.visits': 'visits recorded',
  // A membership with one check-in read "1 visits recorded". Same shape as `listingsOne`.
  'web.account.memberships.visitsOne': 'visit recorded',
  'web.account.memberships.plan': 'Plan',
  // The four states, and the sentence each one needs. PENDING is the one that exists only
  // because activation is webhook-driven (BR-PAY-02).
  'web.account.status.ACTIVE': 'Active',
  'web.account.status.PENDING': 'Waiting for payment confirmation',
  'web.account.status.EXPIRED': 'Expired',
  'web.account.status.CANCELLED': 'Cancelled',
  'web.account.status.pendingNote':
    'The payment has been started and our server has not yet heard from the provider. It activates on that message, not on this page.',
  'web.account.status.expiredNote': 'Renew from the gym page to start a new membership.',

  // The check-in screen's own not-found. It used to borrow `web.checkout.notFound.body`, which
  // talks about gyms and plans - wrong subject, wrong screen, and no way back.
  'web.account.qr.notFound':
    'We could not find that membership. It may have been removed, or the link may be out of date.',
  'web.account.qr.backToMemberships': 'Back to your memberships',
  'web.account.qr.title': 'Check-in code',
  // FR-CHK-02 / BR-CHK-02, stated where the code would be. The reason the panel is empty is the
  // reason the feature is safe.
  'web.account.qr.serverIssued':
    'The code is signed by our server and lasts 60 seconds. It cannot be produced by this page, which is what makes a screenshot of it worthless to anyone else.',
  'web.account.qr.pending':
    'A check-in code is issued once the membership is active. This one is still waiting on the payment confirmation.',
  'web.account.qr.expired': 'This membership has ended, so it no longer has a check-in code.',
  'web.account.qr.placeholder': 'The code appears here when check-in goes live.',
  // The same panel on a membership that is not active. "When check-in goes live" is a promise
  // this one will never be able to keep, whatever ships.
  'web.account.qr.placeholderInactive':
    'A check-in code belongs to an active membership. This one cannot show a code.',
  'web.account.qr.howTo':
    'Show it at the desk. The gym scans it, and the visit appears below within seconds.',

  'web.account.attendance.title': 'Visit history',
  'web.account.attendance.none':
    'No visits yet. A visit is recorded when a gym scans your check-in code.',
  'web.account.attendance.count': 'visits',
  // Six today, so this has never been seen. It is one check-in away from being seen.
  'web.account.attendance.countOne': 'visit',

  'web.account.orders.title': 'Receipts',
  'web.account.orders.reference': 'Reference',
  'web.account.orders.placed': 'Placed',
  'web.account.orders.subtotal': 'Subtotal',
  'web.account.orders.total': 'Total paid',
  // The same row on an order the provider has not confirmed. `BR-PAY-02` makes the webhook the
  // only thing that can say a payment happened, so the receipt must not say it first.
  'web.account.orders.totalDue': 'Total',
  'web.account.orders.none': 'No receipts yet.',
  // `/account/memberships` was the only account list with no empty state: a member with none
  // got a heading and an empty `<ul>`. Every sibling list has one, and each offers a way on.
  'web.account.memberships.none':
    'No memberships yet. When you join a gym, it appears here with its validity and your check-in code.',
  'web.account.memberships.findGym': 'Find a gym',
  // §A6.3 stated to the member: what they are reading is what they were charged, not a fresh sum.
  /*
   * "recorded", not "charged".
   *
   * This sentence sits above the WHOLE list, and the list contains an order whose own badge two
   * lines below reads "Awaiting confirmation". So the page stated that money had moved, above an
   * order where it had not - `BR-PAY-02` puts that statement in exactly one place, the provider's
   * webhook, and a paragraph of explanatory copy is not it.
   *
   * The sentence's actual subject was never the charge. It is `MASTER_PRD.md` §A6.3: a figure on a
   * receipt is stored and never recomputed. That survives intact.
   */
  'web.account.orders.persisted':
    'These are the figures recorded at the time of purchase. They are stored with the order and are never recalculated, so a later change to a price or a tax rate cannot alter a receipt you already have.',
  'web.account.orders.status.PAID': 'Paid',
  'web.account.orders.status.PENDING': 'Awaiting confirmation',
  'web.account.orders.status.REFUNDED': 'Refunded',

  'web.account.reviews.title': 'Reviews',
  // BR-REV-01 / BR-REV-03, as the reason the list is short rather than as an apology.
  'web.account.reviews.rule':
    'You can review a gym you have checked in at. That is the whole rule, and it is why a review on GymMap means something: nobody can write one about a gym they have never been to.',
  'web.account.reviews.eligible': 'Gyms you can review',
  'web.account.reviews.none':
    'Once you have checked in somewhere, that gym appears here and you can write about it.',
  'web.account.reviews.write': 'Write a review',
  'web.account.reviews.soon': 'Writing reviews opens with the reviews module.',

  'web.confirmation.pending.body':
    'A payment can be confirmed a few seconds after you return. Your account shows the membership as pending until our server hears from the provider, and it never shows it as active before that.',

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
    'This is our fault, not yours. Try again in a moment. If it keeps happening, the reference below helps us find it.',
  'web.state.error.retry': 'Try again',
  'web.state.error.reference': 'Reference',
  'web.state.notFound.title': 'That page does not exist',
  'web.state.notFound.body':
    'The link may be old, or the gym may no longer be listed. Search for what you were looking for.',
  'web.state.notFound.action': 'Back to search',
} as const;

export type MessageKey = keyof typeof en;
