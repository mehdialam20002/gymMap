/**
 * The DEMO dataset — real rows in real tables, for showing the console to someone.
 *
 * ┌─ WHY THIS IS NOT PART OF `seedSql()` ───────────────────────────────────────────────────────┐
 * │ The v0.2 seed is a TEST FIXTURE. Three tenants with published uuids and eleven §6.6          │
 * │ principals, referenced by id from every isolation, integration and contract suite. Adding    │
 * │ twenty more gyms to it would break `roles-seed.int-spec.ts`, the AC-8 principal assertions   │
 * │ and every count in `users-constraints.int-spec.ts` — and it would make a demo concern into a │
 * │ reason those suites have to change.                                                           │
 * │                                                                                              │
 * │ Test fixtures and demo data have different lifetimes and different owners. Separate entry    │
 * │ point (`pnpm db:seed:demo`), separate uuid namespace, separate email domain, and one         │
 * │ statement removes all of it (`--remove`).                                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THESE ARE REAL ROWS, AND THAT IS THE POINT ────────────────────────────────────────────────┐
 * │ A `tenant` IS the gym business in this schema: legal name, trading name, GSTIN, PAN,         │
 * │ commission rate, settlement cycle, registered address. The status column carries the whole   │
 * │ `C4.4` approval workflow — DRAFT, SUBMITTED, UNDER_REVIEW, INFO_REQUESTED, APPROVED,          │
 * │ REJECTED, SUSPENDED, CLOSED.                                                                  │
 * │                                                                                              │
 * │ So the admin console's approval queue reads a real state machine over real rows. It is NOT   │
 * │ the customer-web fixture catalogue, which is a TypeScript array because `gyms`, `branches`   │
 * │ and `plans` do not exist until M-026…M-036.                                                   │
 * │                                                                                              │
 * │ What is still absent has no table and therefore no number: revenue, orders, settlements,     │
 * │ refunds, memberships, check-ins. The console shows nothing for those rather than a zero.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The data is deliberately uneven. Statuses are not evenly spread, three gyms have been waiting
 * longer than the rest, two are suspended for different reasons, commission rates differ by
 * negotiation, and one application has been sitting in INFO_REQUESTED for nineteen days. A demo
 * where every row looks the same proves nothing about the screen that renders it.
 */

export const DEMO_NAMESPACE = '0192de00' as const;
/** Every demo account. One `LIKE` removes the lot — see `removeDemoSql()`. */
export const DEMO_EMAIL_DOMAIN = 'demo.gymmap.test' as const;

const id = (n: number): string => `${DEMO_NAMESPACE}-0000-7000-8000-${String(n).padStart(12, '0')}`;

export interface DemoGym {
  readonly id: string;
  readonly legalName: string;
  readonly tradingName: string;
  readonly entityType: 'SOLE_PROPRIETOR' | 'PARTNERSHIP' | 'COMPANY' | 'OTHER';
  readonly status:
    | 'DRAFT'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'INFO_REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'SUSPENDED'
    | 'CLOSED';
  readonly city: string;
  readonly state: string;
  /** The two-digit GST state code. Real ones: 27 Maharashtra, 29 Karnataka, 07 Delhi, 33 TN. */
  readonly stateCode: string;
  readonly postalCode: string;
  readonly addressLine1: string;
  readonly pan: string | null;
  readonly gstin: string | null;
  readonly taxStatus: 'NOT_REGISTERED' | 'REGISTERED' | 'COMPOSITION' | 'PENDING';
  /** Basis points. 1200 = 12.00%. Negotiated, so they differ. */
  readonly commissionBps: number;
  readonly subscription: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  /** Days before now that the row was created. Drives "waiting 19 days" in the queue. */
  readonly createdDaysAgo: number;
}

/**
 * Twenty-two gyms.
 *
 * Weighted the way a real platform is: most approved and trading, a working queue of six waiting
 * on a human, and a small tail of rejected, suspended and abandoned. `BR-GYM-01` is why the queue
 * exists at all — nothing is listed before a person approves it.
 */
export const DEMO_GYMS: readonly DemoGym[] = [
  // ── Approved and trading ────────────────────────────────────────────────────────────────
  {
    id: id(1),
    legalName: 'Iron House Strength Private Limited',
    tradingName: 'Iron House Strength Club',
    entityType: 'COMPANY',
    status: 'APPROVED',
    city: 'Bengaluru',
    state: 'Karnataka',
    stateCode: '29',
    postalCode: '560038',
    addressLine1: '412, 12th Main Road, Indiranagar',
    pan: 'AABCI7391K',
    gstin: '29AABCI7391K1ZP',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'ACTIVE',
    createdDaysAgo: 412,
  },
  {
    id: id(2),
    legalName: 'Pulse Wellness LLP',
    tradingName: 'Pulse Fitness Koramangala',
    entityType: 'PARTNERSHIP',
    status: 'APPROVED',
    city: 'Bengaluru',
    state: 'Karnataka',
    stateCode: '29',
    postalCode: '560095',
    addressLine1: '80 Feet Road, Koramangala 5th Block',
    pan: 'AAFFP2284Q',
    gstin: '29AAFFP2284Q1Z4',
    taxStatus: 'REGISTERED',
    // Negotiated down: high volume, and they were an early signing.
    commissionBps: 1050,
    subscription: 'ACTIVE',
    createdDaysAgo: 388,
  },
  {
    id: id(3),
    legalName: 'Lakshmi Menon',
    tradingName: 'The Yoga Room',
    entityType: 'SOLE_PROPRIETOR',
    status: 'APPROVED',
    city: 'Bengaluru',
    state: 'Karnataka',
    stateCode: '29',
    postalCode: '560011',
    addressLine1: '22, 11th Main, Jayanagar 4th Block',
    pan: 'AGTPM4417C',
    // Under the 20 lakh threshold, so genuinely not registered. Not every gym has a GSTIN, and
    // a demo where they all do hides the case the tax code actually has to handle.
    gstin: null,
    taxStatus: 'NOT_REGISTERED',
    commissionBps: 1200,
    subscription: 'ACTIVE',
    createdDaysAgo: 297,
  },
  {
    id: id(4),
    legalName: 'Apex Conditioning Private Limited',
    tradingName: 'Apex CrossFit Powai',
    entityType: 'COMPANY',
    status: 'APPROVED',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400076',
    addressLine1: 'Hiranandani Gardens, Powai',
    pan: 'AAGCA8812M',
    gstin: '27AAGCA8812M1ZR',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'ACTIVE',
    createdDaysAgo: 341,
  },
  {
    id: id(5),
    legalName: 'Harbour Leisure Private Limited',
    tradingName: 'Harbour Fitness Bandra',
    entityType: 'COMPANY',
    status: 'APPROVED',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400050',
    addressLine1: 'Turner Road, Bandra West',
    pan: 'AADCH5529J',
    gstin: '27AADCH5529J1ZK',
    taxStatus: 'REGISTERED',
    commissionBps: 1400,
    subscription: 'ACTIVE',
    createdDaysAgo: 266,
  },
  {
    id: id(6),
    legalName: 'Capital Combat Sports LLP',
    tradingName: 'Capital Strength Saket',
    entityType: 'PARTNERSHIP',
    status: 'APPROVED',
    city: 'New Delhi',
    state: 'Delhi',
    stateCode: '07',
    postalCode: '110017',
    addressLine1: 'Press Enclave Road, Saket',
    pan: 'AAGFC3364L',
    gstin: '07AAGFC3364L1ZB',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'ACTIVE',
    createdDaysAgo: 74,
  },
  {
    id: id(7),
    legalName: 'Suresh Kumar Yadav',
    tradingName: 'Neighbourhood Gym',
    entityType: 'SOLE_PROPRIETOR',
    status: 'APPROVED',
    city: 'New Delhi',
    state: 'Delhi',
    stateCode: '07',
    postalCode: '110024',
    addressLine1: 'Ring Road, Lajpat Nagar IV',
    pan: 'BJKPY9903H',
    gstin: null,
    taxStatus: 'NOT_REGISTERED',
    commissionBps: 1200,
    subscription: 'ACTIVE',
    createdDaysAgo: 203,
  },
  {
    id: id(8),
    legalName: 'Coastal Aquatics Private Limited',
    tradingName: 'Coastal Swim & Gym',
    entityType: 'COMPANY',
    status: 'APPROVED',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    postalCode: '600090',
    addressLine1: '2nd Avenue, Besant Nagar',
    pan: 'AAECC6675D',
    gstin: '33AAECC6675D1ZW',
    taxStatus: 'REGISTERED',
    commissionBps: 1300,
    subscription: 'ACTIVE',
    createdDaysAgo: 58,
  },
  {
    id: id(9),
    legalName: 'Cyber Fit Ventures Private Limited',
    tradingName: 'CyberFit Hitech City',
    entityType: 'COMPANY',
    status: 'APPROVED',
    city: 'Hyderabad',
    state: 'Telangana',
    stateCode: '36',
    postalCode: '500081',
    addressLine1: 'Madhapur, Hitech City',
    pan: 'AAHCC1148F',
    gstin: '36AAHCC1148F1ZT',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'ACTIVE',
    createdDaysAgo: 152,
  },
  {
    id: id(10),
    legalName: 'Sadhana Movement LLP',
    tradingName: 'Sadhana Yoga Shala',
    entityType: 'PARTNERSHIP',
    status: 'APPROVED',
    city: 'Pune',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '411001',
    addressLine1: 'Koregaon Park, Lane 5',
    pan: 'AAJFS7720N',
    gstin: '27AAJFS7720N1ZQ',
    taxStatus: 'COMPOSITION',
    commissionBps: 1200,
    subscription: 'ACTIVE',
    createdDaysAgo: 119,
  },
  {
    id: id(11),
    legalName: 'Gateway Fitness Private Limited',
    tradingName: 'Gateway Gym Colaba',
    entityType: 'COMPANY',
    status: 'APPROVED',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '400005',
    addressLine1: 'Shahid Bhagat Singh Road, Colaba',
    pan: 'AAFCG2201B',
    gstin: '27AAFCG2201B1ZG',
    taxStatus: 'REGISTERED',
    commissionBps: 1250,
    subscription: 'ACTIVE',
    createdDaysAgo: 91,
  },
  {
    id: id(12),
    legalName: 'Rani Bhattacharya',
    tradingName: 'Studio 47 Pilates',
    entityType: 'SOLE_PROPRIETOR',
    status: 'APPROVED',
    city: 'Kolkata',
    state: 'West Bengal',
    stateCode: '19',
    postalCode: '700019',
    addressLine1: 'Ballygunge Circular Road',
    pan: 'AKQPB5583R',
    gstin: null,
    taxStatus: 'NOT_REGISTERED',
    commissionBps: 1200,
    // On a trial that has not converted yet. Real, and the finance screen has to cope with it.
    subscription: 'TRIAL',
    createdDaysAgo: 21,
  },
  {
    id: id(13),
    legalName: 'Summit Athletics Private Limited',
    tradingName: 'Summit Athletic Club',
    entityType: 'COMPANY',
    status: 'APPROVED',
    city: 'Ahmedabad',
    state: 'Gujarat',
    stateCode: '24',
    postalCode: '380015',
    addressLine1: 'Satellite Road, Jodhpur Village',
    pan: 'AAGCS9042V',
    gstin: '24AAGCS9042V1ZL',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    // Subscription lapsed. The dashboard must show this differently from a healthy gym.
    subscription: 'PAST_DUE',
    createdDaysAgo: 233,
  },

  // ── The queue: waiting on a human ───────────────────────────────────────────────────────
  {
    id: id(14),
    legalName: 'Titan Iron Works LLP',
    tradingName: 'Titan Gym Anna Nagar',
    entityType: 'PARTNERSHIP',
    status: 'UNDER_REVIEW',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    postalCode: '600040',
    addressLine1: '2nd Avenue, Anna Nagar',
    pan: 'AAKFT6618E',
    gstin: '33AAKFT6618E1ZM',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'TRIAL',
    createdDaysAgo: 4,
  },
  {
    id: id(15),
    legalName: 'Alpha Fitness Clubs Private Limited',
    tradingName: 'Alpha Fitness Club',
    entityType: 'COMPANY',
    status: 'UNDER_REVIEW',
    city: 'Bengaluru',
    state: 'Karnataka',
    stateCode: '29',
    postalCode: '560076',
    addressLine1: 'Bannerghatta Road, BTM Layout',
    pan: 'AAJCA4472T',
    gstin: '29AAJCA4472T1ZY',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'TRIAL',
    createdDaysAgo: 6,
  },
  {
    id: id(16),
    legalName: 'Core Strength Fitness',
    tradingName: 'Core Strength Gym',
    entityType: 'SOLE_PROPRIETOR',
    status: 'SUBMITTED',
    city: 'New Delhi',
    state: 'Delhi',
    stateCode: '07',
    postalCode: '110092',
    addressLine1: 'Vikas Marg, Laxmi Nagar',
    pan: 'CDXPS2216G',
    gstin: null,
    taxStatus: 'PENDING',
    commissionBps: 1200,
    subscription: 'TRIAL',
    createdDaysAgo: 2,
  },
  {
    id: id(17),
    legalName: 'Fit Nation Hyderabad LLP',
    tradingName: 'Fit Nation',
    entityType: 'PARTNERSHIP',
    status: 'SUBMITTED',
    city: 'Hyderabad',
    state: 'Telangana',
    stateCode: '36',
    postalCode: '500034',
    addressLine1: 'Road No. 12, Banjara Hills',
    pan: 'AALFF8830W',
    gstin: '36AALFF8830W1ZD',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'TRIAL',
    createdDaysAgo: 1,
  },
  {
    id: id(18),
    legalName: 'Prithvi Sports Academy Private Limited',
    tradingName: 'Prithvi Sports Academy',
    entityType: 'COMPANY',
    // Nineteen days in INFO_REQUESTED. The oldest thing in the queue, and the case the screen
    // exists to surface: it is not waiting on us, and it is also not moving.
    status: 'INFO_REQUESTED',
    city: 'Jaipur',
    state: 'Rajasthan',
    stateCode: '08',
    postalCode: '302017',
    addressLine1: 'Malviya Nagar Industrial Area',
    pan: 'AAICP3357U',
    gstin: '08AAICP3357U1ZN',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'TRIAL',
    createdDaysAgo: 19,
  },
  {
    id: id(19),
    legalName: 'Mohammed Faisal Ansari',
    tradingName: 'Fitness First Kalyan',
    entityType: 'SOLE_PROPRIETOR',
    status: 'INFO_REQUESTED',
    city: 'Kalyan',
    state: 'Maharashtra',
    stateCode: '27',
    postalCode: '421301',
    addressLine1: 'Murbad Road, Kalyan West',
    pan: 'BQWPA1174Z',
    gstin: null,
    taxStatus: 'PENDING',
    commissionBps: 1200,
    subscription: 'TRIAL',
    createdDaysAgo: 11,
  },

  // ── The tail ────────────────────────────────────────────────────────────────────────────
  {
    id: id(20),
    legalName: 'Ultimate Fitness Zone',
    tradingName: 'Ultimate Fitness',
    entityType: 'SOLE_PROPRIETOR',
    // Rejected: the PAN did not match the account holder. Real reason, real outcome.
    status: 'REJECTED',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    stateCode: '09',
    postalCode: '226010',
    addressLine1: 'Gomti Nagar Extension',
    pan: 'AZTPR8891Y',
    gstin: null,
    taxStatus: 'NOT_REGISTERED',
    commissionBps: 1200,
    subscription: 'CANCELLED',
    createdDaysAgo: 47,
  },
  {
    id: id(21),
    legalName: 'Beast Mode Gyms Private Limited',
    tradingName: 'Beast Mode Gym',
    entityType: 'COMPANY',
    // Suspended on a live review-integrity investigation. BR-REV-03.
    status: 'SUSPENDED',
    city: 'Noida',
    state: 'Uttar Pradesh',
    stateCode: '09',
    postalCode: '201301',
    addressLine1: 'Sector 18, Noida',
    pan: 'AAECB4426P',
    gstin: '09AAECB4426P1ZS',
    taxStatus: 'REGISTERED',
    commissionBps: 1200,
    subscription: 'CANCELLED',
    createdDaysAgo: 178,
  },
  {
    id: id(22),
    legalName: 'Healthify Studios LLP',
    tradingName: 'Healthify Studio',
    entityType: 'PARTNERSHIP',
    // Started an application and never finished it. Most DRAFTs look like this.
    status: 'DRAFT',
    city: 'Kochi',
    state: 'Kerala',
    stateCode: '32',
    postalCode: '682016',
    addressLine1: 'Panampilly Nagar',
    pan: null,
    gstin: null,
    taxStatus: 'NOT_REGISTERED',
    commissionBps: 1200,
    subscription: 'TRIAL',
    createdDaysAgo: 33,
  },
];

export interface DemoPerson {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  /** `null` for a platform role, a tenant id for a tenant-scoped one. */
  readonly roleKey: string | null;
  readonly tenantId: string | null;
  readonly createdDaysAgo: number;
}

const person = (
  n: number,
  fullName: string,
  local: string,
  roleKey: string | null,
  tenantId: string | null,
  createdDaysAgo: number,
  status: DemoPerson['status'] = 'ACTIVE',
): DemoPerson => ({
  id: id(1000 + n),
  email: `${local}@${DEMO_EMAIL_DOMAIN}`,
  fullName,
  status,
  roleKey,
  tenantId,
  createdDaysAgo,
});

/**
 * Owners for the trading gyms, plus staff, plus members.
 *
 * Names are real Indian names spread across regions rather than the same three from a placeholder
 * generator. One account is SUSPENDED and one is still PENDING_VERIFICATION, because a user list
 * where every row is ACTIVE never exercises the states the screen has to render.
 */
export const DEMO_PEOPLE: readonly DemoPerson[] = [
  person(1, 'Rohan Iyer', 'rohan.iyer', 'GYM_OWNER', id(1), 410),
  person(2, 'Anjali Rao', 'anjali.rao', 'GYM_OWNER', id(2), 386),
  person(3, 'Lakshmi Menon', 'lakshmi.menon', 'GYM_OWNER', id(3), 295),
  person(4, 'Farhan Qureshi', 'farhan.qureshi', 'GYM_OWNER', id(4), 339),
  person(5, 'Devika Nambiar', 'devika.nambiar', 'GYM_OWNER', id(5), 264),
  person(6, 'Harpreet Singh Bedi', 'harpreet.bedi', 'GYM_OWNER', id(6), 72),
  person(7, 'Suresh Kumar Yadav', 'suresh.yadav', 'GYM_OWNER', id(7), 201),
  person(8, 'Ananya Krishnan', 'ananya.krishnan', 'GYM_OWNER', id(8), 56),
  person(9, 'Vivek Reddy', 'vivek.reddy', 'GYM_OWNER', id(9), 150),
  person(10, 'Aditi Deshpande', 'aditi.deshpande', 'GYM_OWNER', id(10), 117),

  person(11, 'Zoya Merchant', 'zoya.merchant', 'GYM_MANAGER', id(1), 220),
  person(12, 'Nikhil Bhatt', 'nikhil.bhatt', 'GYM_MANAGER', id(4), 180),
  person(13, 'Sneha Kulkarni', 'sneha.kulkarni', 'RECEPTIONIST', id(2), 140),
  person(14, 'Rajat Chaudhary', 'rajat.chaudhary', 'RECEPTIONIST', id(5), 96),
  person(15, 'Tanvi Shah', 'tanvi.shah', 'TRAINER', id(1), 310),
  person(16, 'Karan Malhotra', 'karan.malhotra', 'TRAINER', id(9), 88),

  person(17, 'Ishaan Gupta', 'ishaan.gupta', 'MEMBER', null, 190),
  person(18, 'Nandini Pillai', 'nandini.pillai', 'MEMBER', null, 176),
  person(19, 'Aryan Kapoor', 'aryan.kapoor', 'MEMBER', null, 143),
  person(20, 'Meghna Bose', 'meghna.bose', 'MEMBER', null, 128),
  person(21, 'Siddharth Jain', 'siddharth.jain', 'MEMBER', null, 97),
  person(22, 'Pooja Rathore', 'pooja.rathore', 'MEMBER', null, 84),
  person(23, 'Aakash Venkatesh', 'aakash.venkatesh', 'MEMBER', null, 61),
  person(24, 'Ritika Chawla', 'ritika.chawla', 'MEMBER', null, 40),
  person(25, 'Yusuf Khan', 'yusuf.khan', 'MEMBER', null, 22),
  // Suspended after a review-integrity flag. The user list must render this differently.
  person(26, 'Gaurav Saxena', 'gaurav.saxena', 'MEMBER', null, 155, 'SUSPENDED'),
  // Registered and never confirmed the address. Common, and it is not an error state.
  person(27, 'Sara Thomas', 'sara.thomas', 'MEMBER', null, 3, 'PENDING_VERIFICATION'),

  person(28, 'Aparna Iyengar', 'aparna.iyengar', 'VERIFICATION_OFFICER', null, 300),
  person(29, 'Manish Tripathi', 'manish.tripathi', 'SUPPORT_AGENT', null, 280),
  person(30, 'Ritu Bansal', 'ritu.bansal', 'FINANCE', null, 320),
];

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Volume.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Another 240 gyms, generated, so the register looks like a platform rather than a test fixture.
 *
 * ┌─ GENERATED, BUT NOT RANDOM ─────────────────────────────────────────────────────────────────┐
 * │ `Math.random()` would give a different database on every run, which makes "the register      │
 * │ showed 14 suspended yesterday" unreproducible and any screenshot un-recreatable. Every value │
 * │ below is derived from the index, so the same command always produces the same 240 rows.      │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The twenty-two written by hand above stay at the TOP of the register — they are backdated
 * furthest and the list is newest-first, so a demo lands on the recognisable ones. These fill the
 * pages behind them.
 *
 * The status mix is weighted the way a real platform is: roughly four in five approved, a working
 * queue, and a thin tail of rejected and suspended. A register where every page looks the same
 * proves nothing about the filters above it.
 */
const CITIES: ReadonlyArray<readonly [string, string, string]> = [
  ['Bengaluru', 'Karnataka', '29'],
  ['Mumbai', 'Maharashtra', '27'],
  ['New Delhi', 'Delhi', '07'],
  ['Chennai', 'Tamil Nadu', '33'],
  ['Hyderabad', 'Telangana', '36'],
  ['Pune', 'Maharashtra', '27'],
  ['Kolkata', 'West Bengal', '19'],
  ['Ahmedabad', 'Gujarat', '24'],
  ['Jaipur', 'Rajasthan', '08'],
  ['Kochi', 'Kerala', '32'],
  ['Lucknow', 'Uttar Pradesh', '09'],
  ['Indore', 'Madhya Pradesh', '23'],
];

const PREFIX = [
  'Iron',
  'Pulse',
  'Apex',
  'Summit',
  'Titan',
  'Core',
  'Zenith',
  'Forge',
  'Vital',
  'Prime',
  'Urban',
  'Alpha',
  'Nova',
  'Peak',
  'Elite',
];

const SUFFIX = ['Fitness', 'Strength Club', 'Gym', 'Athletic Club', 'Wellness', 'Studio'];

/** Index → status, on a fixed 20-slot wheel. Four in five approved. */
const STATUS_WHEEL: readonly DemoGym['status'][] = [
  ...(Array.from({ length: 15 }, () => 'APPROVED') as DemoGym['status'][]),
  'SUBMITTED',
  'UNDER_REVIEW',
  'SUSPENDED',
  'REJECTED',
  'DRAFT',
];

function generated(): readonly DemoGym[] {
  return Array.from({ length: 240 }, (_, index): DemoGym => {
    const n = index + 100;
    const city = CITIES[index % CITIES.length] ?? CITIES[0]!;
    const status = STATUS_WHEEL[index % STATUS_WHEEL.length] ?? 'APPROVED';
    const entity = (['COMPANY', 'PARTNERSHIP', 'SOLE_PROPRIETOR'] as const)[index % 3] ?? 'COMPANY';
    const registered = index % 4 !== 3;
    const tradingName = `${PREFIX[index % PREFIX.length] ?? 'Iron'} ${SUFFIX[index % SUFFIX.length] ?? 'Gym'} ${city[0]}`;

    // A PAN-shaped string derived from the index. Deliberately not a real-looking issued PAN:
    // the format is right so the column renders correctly, and the value is obviously synthetic.
    const pan = `AAA${entity[0] ?? 'C'}D${String(1000 + index).slice(0, 4)}Z`;

    return {
      id: id(n),
      legalName:
        `${tradingName} ${entity === 'COMPANY' ? 'Private Limited' : entity === 'PARTNERSHIP' ? 'LLP' : ''}`.trim(),
      tradingName,
      entityType: entity,
      status,
      city: city[0],
      state: city[1],
      stateCode: city[2],
      postalCode: `${city[2]}${String(1000 + index).slice(0, 4)}`,
      addressLine1: `Unit ${String(index + 1)}, ${city[0]} Industrial Estate`,
      pan,
      gstin: registered ? `${city[2]}${pan}1Z${String(index % 10)}` : null,
      taxStatus: registered ? 'REGISTERED' : 'NOT_REGISTERED',
      // 10.50% to 14.00%, in quarter-point steps. Commission is negotiated, so a register where
      // every row reads 12% hides the one column an operator scans for an outlier.
      commissionBps: 1050 + (index % 15) * 25,
      subscription: status === 'APPROVED' ? (index % 9 === 0 ? 'PAST_DUE' : 'ACTIVE') : 'TRIAL',
      createdDaysAgo: index % 400,
    };
  });
}

/** The written rows first, then the generated fill. */
export const DEMO_GYMS_ALL: readonly DemoGym[] = [...DEMO_GYMS, ...generated()];
