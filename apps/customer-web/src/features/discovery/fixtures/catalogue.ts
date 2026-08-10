/**
 * A FIXTURE catalogue — not data, and never to be mistaken for it.
 *
 * ┌─ WHY THIS FILE EXISTS AND WHEN IT DIES ─────────────────────────────────────────────────────┐
 * │ `gyms`, `branches` and `plans` are created by M-026 … M-036, and the discovery endpoints     │
 * │ that read them arrive later still. Until then there is nothing to render, and a search       │
 * │ results page with no results demonstrates nothing.                                            │
 * │                                                                                              │
 * │ So the shapes below are the shapes the API will return — `SearchResult` and `GymDetail` are  │
 * │ written against `apis/Discovery.md`, not invented to suit the components. Replacing this      │
 * │ module with a fetch is then a change to ONE file, and every component above it is already    │
 * │ consuming the real contract.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ EVERY PRICE HERE IS INTEGER PAISE ─────────────────────────────────────────────────────────┐
 * │ Invariant 2: money is integer minor units, never a float and never a `numeric`. A fixture is │
 * │ exactly where a `2999.00` slips in and teaches the component above it to expect rupees —     │
 * │ and that component is then wrong forever, against real data, in a way that rounds silently.  │
 * │ `4_99_900` is ₹4,999.00.                                                                      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Marked at the top of every rendered page — the banner text is `web.fixtureNotice` in the message
 * catalogue, because `NFR-USE-08` puts every user-facing string there and a second copy here would
 * be the one that gets edited. A demo that cannot be told apart from production is how a
 * screenshot of invented gyms ends up in a pitch deck.
 */

export interface PlanSummary {
  readonly id: string;
  readonly name: string;
  /** Integer paise. See the header. */
  readonly priceMinor: bigint;
  readonly durationDays: number;
}

export interface SearchResult {
  readonly id: string;
  readonly slug: string;
  readonly citySlug: string;
  readonly name: string;
  readonly locality: string;
  readonly city: string;
  readonly categories: readonly string[];
  readonly amenities: readonly string[];
  /** Null until the gym has earned reviews — `BR-REV-01`. Never rendered as a zero. */
  readonly rating: number | null;
  readonly reviewCount: number;
  /** The cheapest plan, which is what a results card shows. Integer paise. */
  readonly fromPriceMinor: bigint;
  /**
   * Kilometres from the CITY CENTRE, not from the reader.
   *
   * The distinction is the whole of `A-08`'s honesty rule applied to a number: the app has no
   * geolocation of any kind, asks for no permission and reads no coordinate, so a figure rendered
   * as a bare "1.2 km" beside a locality reads as "from you" and cannot be. Every label that
   * exposes this field now names its origin - the hero's control, the sort, the chip and the card -
   * because a filter called "Within 2 km" with an unstated origin is a claim, not a control.
   *
   * When a real geolocation arrives, this becomes a computed distance from the reader and the
   * labels change with it. Until then it says what it is.
   */
  readonly distanceKm: number;
  /** `BR-GYM-01` — nothing is listed before a human approves it. All fixtures are verified. */
  readonly verified: true;
  /**
   * Cover photography. Pexels for now, because the fixture catalogue is demo data and real media
   * arrives with `FR-GYM-02`'s upload path. The host is named in `next.config.mjs` and admitted by
   * `CSP_MEDIA_HOST`; it is not a wildcard, so swapping it for the CDN is a two-line change.
   *
   * Sized at the width the card actually renders. Requesting a 4000px original and letting the
   * browser scale it is the most common way a listing page spends its LCP budget.
   */
  readonly photo: string;
  /** Alternative text. A gym's cover is decorative NEXT TO its name, so this stays short. */
  readonly photoAlt: string;
}

/** One image in a gym's gallery. `alt` describes what is IN it, never "gym photo 2 of 4". */
export interface Photo {
  readonly src: string;
  readonly alt: string;
}

export interface GymDetail extends SearchResult {
  readonly about: string;
  readonly address: string;
  readonly openingHours: string;
  readonly plans: readonly PlanSummary[];
  /**
   * The gallery, EXCLUDING the cover — the detail page renders `photo` first and these after it,
   * so a photo never appears twice in the same mosaic.
   *
   * Three each, and each one verified to resolve rather than typed from memory: every id here was
   * fetched through the running image optimiser before it was committed, because a mistyped digit
   * is a broken image that only shows up on one gym's page, at one breakpoint, in a demo.
   */
  readonly gallery: readonly Photo[];
}

/**
 * The gallery URL shape, in one place.
 *
 * `w=1600` and not the card's `w=1200`: the gallery's lead image is up to 60% of a 1440px viewport
 * and the card's is a third of it. Requesting the same width for both means one of them is wrong,
 * and the one that is wrong is the larger — a soft, upscaled hero on the page whose whole job is
 * making a gym look like somewhere you would go.
 */
const galleryPhoto = (id: number, alt: string): Photo => ({
  src: `https://images.pexels.com/photos/${String(id)}/pexels-photo-${String(id)}.jpeg?auto=compress&cs=tinysrgb&w=1600`,
  alt,
});

/**
 * Eight gyms across four cities.
 *
 * Deliberately uneven: two have no reviews at all, prices span ₹899 to ₹4,999 a month, and the
 * amenity lists do not overlap neatly. A fixture where every row looks the same makes every
 * filter, every empty state and every sort look like it works.
 */
export const CATALOGUE: readonly GymDetail[] = [
  {
    id: 'gym-001',
    slug: 'iron-house-indiranagar',
    citySlug: 'bengaluru',
    name: 'Iron House Strength Club',
    locality: 'Indiranagar',
    city: 'Bengaluru',
    categories: ['Strength', 'CrossFit'],
    amenities: ['Free weights', 'Powerlifting platform', 'Showers', 'Parking'],
    rating: 4.7,
    reviewCount: 213,
    fromPriceMinor: 2_49_900n,
    distanceKm: 1.2,
    verified: true,
    photo:
      'https://images.pexels.com/photos/9958669/pexels-photo-9958669.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'barbell floor',
    gallery: [
      galleryPhoto(3916766, 'dumbbell rack'),
      galleryPhoto(6389067, 'gymnastic rings'),
      galleryPhoto(6389513, 'dumbbells and medicine balls'),
      galleryPhoto(9545909, 'conditioning corner'),
    ],
    about:
      'A barbell-first gym with four competition platforms and coaches who compete. Not a circuit ' +
      'studio: if you want to learn to squat, deadlift and press properly, this is the room.',
    address: '412, 12th Main Road, Indiranagar, Bengaluru 560038',
    openingHours: 'Mon–Sat 05:00–23:00 · Sun 06:00–14:00',
    plans: [
      { id: 'p-001', name: 'Monthly', priceMinor: 2_49_900n, durationDays: 30 },
      { id: 'p-002', name: 'Quarterly', priceMinor: 6_49_900n, durationDays: 90 },
      { id: 'p-003', name: 'Annual', priceMinor: 21_99_900n, durationDays: 365 },
    ],
  },
  {
    id: 'gym-002',
    slug: 'pulse-fitness-koramangala',
    citySlug: 'bengaluru',
    name: 'Pulse Fitness Koramangala',
    locality: 'Koramangala 5th Block',
    city: 'Bengaluru',
    categories: ['Gym', 'Cardio', 'Group classes'],
    amenities: ['Air conditioning', 'Steam room', 'Showers', 'Locker', 'Cafe'],
    rating: 4.3,
    reviewCount: 486,
    fromPriceMinor: 1_99_900n,
    distanceKm: 3.8,
    verified: true,
    photo:
      'https://images.pexels.com/photos/7031706/pexels-photo-7031706.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'machine floor',
    gallery: [
      galleryPhoto(12250460, 'treadmill row'),
      galleryPhoto(17211446, 'weights and free-weight area'),
      galleryPhoto(8933584, 'stationary bikes'),
      galleryPhoto(29224211, 'floor under geometric lighting'),
    ],
    about:
      // NOT "the app shows live occupancy". There is no such feature, and this sentence renders on
      // the listing page AND in its meta description - a capability claim in a search result for a
      // thing nobody built. The busy hours are a fact the gym can state; the app is not.
      'A large mixed-use floor with a full cardio deck, three studios and classes running from ' +
      '06:00. Busiest between 19:00 and 21:00.',
    address: '80 Feet Road, Koramangala 5th Block, Bengaluru 560095',
    openingHours: 'Mon–Sun 05:30–22:30',
    plans: [
      { id: 'p-004', name: 'Monthly', priceMinor: 1_99_900n, durationDays: 30 },
      { id: 'p-005', name: 'Half-yearly', priceMinor: 9_99_900n, durationDays: 180 },
    ],
  },
  {
    id: 'gym-003',
    slug: 'the-yoga-room-jayanagar',
    citySlug: 'bengaluru',
    name: 'The Yoga Room',
    locality: 'Jayanagar 4th Block',
    city: 'Bengaluru',
    categories: ['Yoga', 'Pilates'],
    amenities: ['Mats provided', 'Showers', 'Women-only hours'],
    rating: 4.9,
    reviewCount: 97,
    fromPriceMinor: 1_49_900n,
    distanceKm: 6.1,
    verified: true,
    photo:
      'https://images.pexels.com/photos/7186312/pexels-photo-7186312.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'empty studio floor',
    gallery: [
      galleryPhoto(25599832, 'Pilates tower studio'),
      galleryPhoto(17227607, 'daylit floor'),
      galleryPhoto(6389067, 'rings over the mat floor'),
      galleryPhoto(17211446, 'open practice floor'),
    ],
    about:
      'Small classes, capped at twelve. Ashtanga and Iyengar in the mornings, restorative in the ' +
      'evenings. Two women-only slots a day.',
    address: '22, 11th Main, Jayanagar 4th Block, Bengaluru 560011',
    openingHours: 'Mon–Sat 06:00–20:00',
    plans: [
      { id: 'p-006', name: 'Monthly · 12 classes', priceMinor: 1_49_900n, durationDays: 30 },
      { id: 'p-007', name: 'Monthly · unlimited', priceMinor: 2_29_900n, durationDays: 30 },
    ],
  },
  {
    id: 'gym-004',
    slug: 'apex-crossfit-powai',
    citySlug: 'mumbai',
    name: 'Apex CrossFit Powai',
    locality: 'Powai',
    city: 'Mumbai',
    categories: ['CrossFit', 'Strength'],
    amenities: ['Rig', 'Rowers', 'Showers', 'Parking', 'Physio on site'],
    rating: 4.6,
    reviewCount: 154,
    fromPriceMinor: 3_49_900n,
    distanceKm: 2.4,
    verified: true,
    photo:
      'https://images.pexels.com/photos/9545914/pexels-photo-9545914.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'rig and conditioning',
    gallery: [
      galleryPhoto(17227607, 'daylit conditioning floor'),
      galleryPhoto(8611382, 'row of rowing machines'),
      galleryPhoto(9545909, 'conditioning floor'),
      galleryPhoto(6389067, 'gymnastic rings'),
    ],
    about:
      'An affiliate box running five classes a day plus open gym. Coaches scale every workout, so ' +
      'a first-timer and a regional competitor train in the same hour.',
    address: 'Hiranandani Gardens, Powai, Mumbai 400076',
    openingHours: 'Mon–Sat 06:00–22:00 · Sun 08:00–12:00',
    plans: [
      { id: 'p-008', name: 'Monthly', priceMinor: 3_49_900n, durationDays: 30 },
      { id: 'p-009', name: 'Quarterly', priceMinor: 9_49_900n, durationDays: 90 },
    ],
  },
  {
    id: 'gym-005',
    slug: 'harbour-fitness-bandra',
    citySlug: 'mumbai',
    name: 'Harbour Fitness Bandra',
    locality: 'Bandra West',
    city: 'Mumbai',
    categories: ['Gym', 'Personal training'],
    amenities: ['Air conditioning', 'Sauna', 'Towel service', 'Valet parking'],
    rating: 4.1,
    reviewCount: 322,
    fromPriceMinor: 4_99_900n,
    distanceKm: 5.7,
    verified: true,
    photo:
      'https://images.pexels.com/photos/12250460/pexels-photo-12250460.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'cardio row',
    gallery: [
      galleryPhoto(20418606, 'treadmills under blue light'),
      galleryPhoto(34761566, 'treadmills, ellipticals and bikes'),
      galleryPhoto(29224211, 'floor under geometric lighting'),
      galleryPhoto(7031705, 'bikes and treadmills'),
    ],
    about:
      'A premium floor overlooking the bay, with personal training as the default rather than an ' +
      'upsell. Every membership includes an assessment and a written programme.',
    address: 'Turner Road, Bandra West, Mumbai 400050',
    openingHours: 'Mon–Sun 06:00–23:00',
    plans: [
      { id: 'p-010', name: 'Monthly', priceMinor: 4_99_900n, durationDays: 30 },
      { id: 'p-011', name: 'Annual', priceMinor: 44_99_900n, durationDays: 365 },
    ],
  },
  {
    id: 'gym-006',
    slug: 'capital-strength-saket',
    citySlug: 'delhi',
    name: 'Capital Strength Saket',
    locality: 'Saket',
    city: 'Delhi',
    categories: ['Gym', 'Strength', 'Boxing'],
    amenities: ['Free weights', 'Boxing ring', 'Showers', 'Locker'],
    // No reviews yet. `BR-REV-01` — a review requires a recorded check-in, so a new listing has
    // none, and the card must NOT render `0.0` next to four stars' worth of empty space.
    rating: null,
    reviewCount: 0,
    fromPriceMinor: 1_79_900n,
    distanceKm: 4.3,
    verified: true,
    photo:
      'https://images.pexels.com/photos/3916766/pexels-photo-3916766.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'dumbbell rack',
    gallery: [
      galleryPhoto(8611297, 'boxing ring and bags'),
      galleryPhoto(5750886, 'heavy bags'),
      galleryPhoto(29392546, 'mirrored weights floor'),
      galleryPhoto(6389513, 'dumbbells and medicine balls'),
    ],
    about:
      'Opened this quarter. Weights floor plus a full ring, with boxing classes four evenings a ' +
      'week. No reviews yet, because a review here can only be left by a member who checked in.',
    address: 'Press Enclave Road, Saket, New Delhi 110017',
    openingHours: 'Mon–Sat 05:00–22:00',
    plans: [
      { id: 'p-012', name: 'Monthly', priceMinor: 1_79_900n, durationDays: 30 },
      { id: 'p-013', name: 'Quarterly', priceMinor: 4_79_900n, durationDays: 90 },
    ],
  },
  {
    id: 'gym-007',
    slug: 'neighbourhood-gym-lajpat-nagar',
    citySlug: 'delhi',
    name: 'Neighbourhood Gym',
    locality: 'Lajpat Nagar',
    city: 'Delhi',
    categories: ['Gym', 'Cardio'],
    amenities: ['Free weights', 'Treadmills', 'Locker'],
    rating: 3.8,
    reviewCount: 61,
    // The floor of the range. A results page where everything costs about the same makes a price
    // sort look like it does nothing.
    fromPriceMinor: 89_900n,
    distanceKm: 8.9,
    verified: true,
    photo:
      'https://images.pexels.com/photos/17211446/pexels-photo-17211446.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'small floor',
    gallery: [
      galleryPhoto(3916766, 'dumbbell rack'),
      galleryPhoto(12250460, 'treadmill row'),
      galleryPhoto(6389513, 'free weights corner'),
      galleryPhoto(7031705, 'cardio corner'),
    ],
    about:
      'No frills and no contract pressure. Machines, dumbbells to 40 kg, and a treadmill row. ' +
      'The cheapest verified listing in South Delhi.',
    address: 'Ring Road, Lajpat Nagar IV, New Delhi 110024',
    openingHours: 'Mon–Sun 06:00–21:30',
    plans: [{ id: 'p-014', name: 'Monthly', priceMinor: 89_900n, durationDays: 30 }],
  },
  {
    id: 'gym-008',
    slug: 'coastal-swim-and-gym-besant-nagar',
    citySlug: 'chennai',
    name: 'Coastal Swim & Gym',
    locality: 'Besant Nagar',
    city: 'Chennai',
    categories: ['Swimming', 'Gym'],
    amenities: ['25m pool', 'Showers', 'Locker', 'Parking'],
    rating: null,
    reviewCount: 0,
    fromPriceMinor: 2_79_900n,
    distanceKm: 3.1,
    verified: true,
    photo:
      'https://images.pexels.com/photos/8933584/pexels-photo-8933584.jpeg?auto=compress&cs=tinysrgb&w=1200',
    photoAlt: 'bikes and pool hall',
    gallery: [
      galleryPhoto(7031705, 'bikes and treadmills'),
      galleryPhoto(33966785, 'training track'),
      galleryPhoto(29526371, 'weights floor'),
      galleryPhoto(9545909, 'weights floor'),
    ],
    about:
      'A 25-metre pool with lane hours from 05:30, plus a weights floor. Swim-only and combined ' +
      'memberships are priced separately.',
    address: '2nd Avenue, Besant Nagar, Chennai 600090',
    openingHours: 'Mon–Sun 05:30–21:00',
    plans: [
      { id: 'p-015', name: 'Swim only · monthly', priceMinor: 2_79_900n, durationDays: 30 },
      { id: 'p-016', name: 'Swim + gym · monthly', priceMinor: 3_99_900n, durationDays: 30 },
    ],
  },
];

/**
 * The city facets, derived rather than listed — a hard-coded list drifts from the catalogue.
 *
 * ┌─ `photo` IS A REAL LISTING'S COVER, NOT A STOCK SHOT OF THE CITY ───────────────────────────┐
 * │ The home page's city tiles need an image each. The reference fills them with skyline stock,   │
 * │ and buying that here would mean a curated `city → photo` map: editorial data invented to      │
 * │ decorate a page, which then has to be maintained per city forever and says nothing true.      │
 * │                                                                                              │
 * │ So a city's tile shows the cover of a gym that is ACTUALLY LISTED IN IT, and `photoAlt` names │
 * │ that gym. A new city needs no new asset, a city with no listings has no tile because it is    │
 * │ not in this list at all, and nothing on the page claims to be a photograph of a city.         │
 * │                                                                                              │
 * │ `?? gym.photo` rather than plain assignment: the reducer visits every gym, so assigning each  │
 * │ time would leave whichever listing happens to be LAST in the file — the tile would change     │
 * │ when an unrelated gym was appended. First-wins in catalogue order is stable.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const CITIES: ReadonlyArray<{
  slug: string;
  name: string;
  count: number;
  photo: string;
  photoAlt: string;
}> = Object.values(
  CATALOGUE.reduce<
    Record<string, { slug: string; name: string; count: number; photo: string; photoAlt: string }>
  >((acc, gym) => {
    const existing = acc[gym.citySlug];
    acc[gym.citySlug] = {
      slug: gym.citySlug,
      name: gym.city,
      count: (existing?.count ?? 0) + 1,
      photo: existing?.photo ?? gym.photo,
      photoAlt: existing?.photoAlt ?? gym.photoAlt,
    };
    return acc;
  }, {}),
).sort((a, b) => a.name.localeCompare(b.name));

/** Every category present, deduplicated. Same reasoning as `CITIES`. */
export const CATEGORIES: readonly string[] = [
  ...new Set(CATALOGUE.flatMap((gym) => gym.categories)),
].sort((a, b) => a.localeCompare(b));

/**
 * Every amenity present, deduplicated.
 *
 * Derived, not curated — an amenity a gym offers is offered whether or not anyone remembered to
 * add it to a list here, and a filter that silently cannot express "Sauna" is worse than no
 * amenity filter at all. When these become a controlled vocabulary on the gym profile
 * (`FR-GYM-*`), this export reads that vocabulary instead and every caller is unchanged.
 */
export const AMENITIES: readonly string[] = [
  ...new Set(CATALOGUE.flatMap((gym) => gym.amenities)),
].sort((a, b) => a.localeCompare(b));
