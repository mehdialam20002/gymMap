/**
 * The admin catalogue — `NFR-USE-08`, `I18N1`, `I18N5`.
 *
 * Separate from `customer-web`'s catalogue and not shared, deliberately. The two surfaces address
 * different people in different registers: Priya is being persuaded, Anita is adjudicating. A
 * shared catalogue makes "Approve" mean two things and produces the compromise wording that
 * serves neither.
 */

export const en = {
  // --- chrome ---------------------------------------------------------------
  'adm.chrome.skipToContent': 'Skip to main content',
  'adm.chrome.mainLandmark': 'Main content',
  'adm.chrome.brand': 'GymMap Admin',
  'adm.chrome.nav.label': 'Sections',
  'adm.chrome.nav.dashboard': 'Dashboard',
  'adm.chrome.nav.sessions': 'Your devices',
  'adm.chrome.nav.approvals': 'Approvals',
  'adm.chrome.nav.tenants': 'Gyms',
  'adm.chrome.nav.finance': 'Finance',
  'adm.chrome.nav.moderation': 'Moderation',
  'adm.chrome.nav.audit': 'Audit',
  'adm.chrome.signOut': 'Sign out',
  'adm.chrome.search.label': 'Search gyms, accounts and transactions',
  'adm.chrome.search.placeholder': 'Search gyms, accounts, transactions… (arrives with M-023)',
  'adm.theme.label': 'Colour theme',
  'adm.theme.system': 'Auto',
  'adm.theme.light': 'Light',
  'adm.theme.dark': 'Dark',
  'adm.rail.quickActions': 'Quick actions',
  'adm.rail.reviewQueue': 'Review the queue',
  'adm.rail.gymRegister': 'Open the gym register',
  'adm.rail.accounts': 'Accounts by role',
  'adm.rail.devices': 'Your devices',
  'adm.chrome.group.gyms': 'Gym management',
  'adm.chrome.group.people': 'People',
  'adm.chrome.group.commerce': 'Commerce',
  'adm.chrome.group.operations': 'Operations',
  'adm.chrome.nav.allGyms': 'All gyms',
  'adm.chrome.nav.approvalDetail': 'Application detail',
  'adm.chrome.nav.disputes': 'Disputes',
  'adm.chrome.nav.branches': 'Branches',
  'adm.chrome.nav.categories': 'Categories & amenities',
  'adm.chrome.nav.people': 'Accounts',
  'adm.chrome.nav.roles': 'Roles & permissions',
  'adm.chrome.nav.orders': 'Orders',
  'adm.chrome.nav.settlements': 'Settlements',
  'adm.chrome.nav.refunds': 'Refunds',
  'adm.chrome.nav.reconciliation': 'Reconciliation',
  'adm.chrome.nav.support': 'Support',
  'adm.chrome.nav.analytics': 'Analytics',
  // Shown ON the link, not only after clicking it. A nav item that looks identical to a working
  // one and lands on an empty panel teaches an operator that the console is unreliable.
  'adm.chrome.inDevelopment': 'In development',
  // The sidebar mark. Short so the LABEL keeps the width; the full wording is on the link's
  // `title` and in visually-hidden text, so nothing is lost to a screen reader.
  'adm.chrome.inDevelopmentShort': 'dev',
  'adm.chrome.collapse': 'Collapse',
  'adm.chrome.expand': 'Expand',

  // --- SCR-ADM-002, the approval queue --------------------------------------
  'adm.queue.title': 'Approval queue',
  'adm.queue.subtitle':
    'Nothing is listed to the public before a person approves it. These applications are waiting on one.',
  'adm.queue.empty': 'Nothing is waiting for review.',
  'adm.queue.waiting': 'waiting',
  'adm.queue.days': 'days',
  'adm.queue.day': 'day',
  'adm.queue.col.applicant': 'Gym / applicant',
  'adm.queue.col.type': 'Type',
  'adm.queue.col.applied': 'Applied on',
  'adm.queue.col.actions': 'Actions',
  'adm.queue.daysAgo': 'days ago',
  'adm.queue.review': 'Review',
  'adm.queue.emptyBody':
    'Every application has been dealt with. New ones appear here as gyms submit them.',
  'adm.queue.emptyFiltered': 'Nothing in this state',
  'adm.queue.emptyFilteredBody':
    'No application is currently in this state. Other tabs may still have work waiting.',
  'adm.page.showing': 'Showing',
  'adm.page.to': 'to',
  'adm.page.of': 'of',
  'adm.page.results': 'results',
  'adm.page.previous': 'Previous',
  'adm.page.next': 'Next',
  'adm.queue.reviewNote':
    'Opening an application, and approving or rejecting it, arrives with M-036. This list is live: it reads the real tenant status column, which carries the whole approval state machine.',

  // --- SCR-ADM-004, the gym register ----------------------------------------
  'adm.gyms.title': 'All gyms',
  'adm.gyms.subtitle': 'Every gym business on the platform, newest first.',
  'adm.gyms.filterAll': 'All',
  'adm.gyms.col.gym': 'Gym',
  'adm.gyms.col.location': 'Location',
  'adm.gyms.col.status': 'Status',
  'adm.gyms.col.subscription': 'Subscription',
  'adm.gyms.col.commission': 'Commission',
  'adm.gyms.col.gstin': 'GSTIN',
  'adm.gyms.view': 'View',
  'adm.gyms.moreActions': 'More actions',
  'adm.gyms.filters': 'Filters',
  'adm.gyms.export': 'Export',
  'adm.gyms.notRegistered': 'Not registered',
  'adm.gyms.empty': 'No gyms match this filter.',
  // --- SCR-ADM-004 detail ----------------------------------------------------
  'adm.detail.region': 'Gym detail',
  'adm.detail.edit': 'Edit gym',
  'adm.detail.notFound': 'No such gym',
  'adm.detail.notFoundBody':
    'This gym is not on the register. It may have been closed, or the link may be out of date.',
  'adm.detail.tab.overview': 'Overview',
  'adm.detail.tab.branches': 'Branches & facilities',
  'adm.detail.tab.plans': 'Plans & pricing',
  'adm.detail.tab.documents': 'Documents',
  'adm.detail.tab.members': 'Members',
  'adm.detail.tab.finance': 'Finance',
  'adm.detail.tab.reviews': 'Reviews',
  'adm.detail.tab.activity': 'Activity',
  'adm.detail.business': 'Business',
  'adm.detail.legalName': 'Legal name',
  'adm.detail.entityType': 'Entity type',
  'adm.detail.registeredOn': 'Registered on',
  'adm.detail.address': 'Registered address',
  'adm.detail.noAddress': 'No address on file',
  // Says WHY the street line is absent rather than leaving a gap that reads as missing data.
  'adm.detail.addressNote':
    'The full street address is part of the application dossier and is not returned to the register, which lists gyms rather than contacts them.',
  'adm.detail.identifiers': 'Identifiers',
  'adm.detail.kyc': 'KYC & documents',
  'adm.detail.kycPending':
    'Document checks arrive with M-029. Showing a list of verified ticks before anything is verified would be the one thing on this screen nobody could check.',
  'adm.gyms.emptyBody': 'No gym is in this state right now. Other tabs may still have rows.',
  'adm.gyms.emptyAll': 'No gyms yet',
  'adm.gyms.emptyAllBody':
    'Gyms appear here as soon as they start an application, before anyone approves them.',
  'adm.gyms.loadFailed': 'Could not load the gym register.',

  // --- accounts -------------------------------------------------------------
  'adm.people.title': 'Accounts',
  'adm.people.subtitle': 'Role grants across the platform. A person can hold more than one.',
  'adm.people.role': 'Role',
  'adm.people.grants': 'Grants',

  // --- the in-development panel ---------------------------------------------
  'adm.pending.title': 'This screen is in development',
  'adm.pending.body':
    'The navigation shows it so the remaining work is visible in one place rather than hidden. It is not an error and nothing is broken.',
  'adm.pending.screen': 'Screen',
  'adm.pending.milestone': 'Arrives in',

  // --- FR-AUTH-04, the sign-in form -----------------------------------------
  'adm.signIn.identifier': 'Email or phone',
  // Both, because FR-AUTH-01 makes the phone the primary identifier in the launch market and an
  // operator should not have to work out which one this console wants.
  'adm.signIn.identifierHint': 'The address or number your platform account was created with.',
  'adm.signIn.password': 'Password',
  'adm.signIn.working': 'Signing in…',
  'adm.signIn.mfaNotice':
    'Platform accounts will also require a second factor. That step arrives with the MFA milestone; until then a password is enough to reach this console, which is why it is not yet open to the internet.',

  // --- FR-AUTH-09, the device list ------------------------------------------
  'adm.sessions.title': 'Your devices',
  'adm.sessions.subtitle':
    'Every place your account is currently signed in. If you do not recognise one, revoke it — that signs it out immediately rather than when its token expires.',
  'adm.sessions.thisDevice': 'This device',
  'adm.sessions.unknownDevice': 'Unrecognised device',
  'adm.sessions.unknownAddress': 'Address not recorded',
  'adm.sessions.revoke': 'Revoke',
  'adm.sessions.signOutHere': 'Sign out here',
  'adm.sessions.revoking': 'Revoking…',
  'adm.sessions.loadFailed': 'Could not load your devices. Try again in a moment.',
  'adm.sessions.revokeFailed': 'That device could not be revoked. It may already be signed out.',

  // --- SCR-ADM-001, the dashboard -------------------------------------------
  'adm.dashboard.tile.awaiting': 'Awaiting review',
  'adm.dashboard.tile.listed': 'Listed gyms',
  'adm.dashboard.tile.accounts': 'Accounts',
  'adm.dashboard.tile.sessions': 'Active sessions',
  'adm.dashboard.pipeline.title': 'Application pipeline',
  'adm.dashboard.pipeline.body':
    'Every gym on the platform by approval state. Nothing is listed to the public before a person approves it.',
  'adm.dashboard.health.title': 'Platform health',
  'adm.dashboard.health.up': 'up',
  'adm.dashboard.health.down': 'down',
  // Says what is NOT checked. A green dot for a dependency with no probe behind it is worse
  // than no dot: it is a reassurance nobody is verifying.
  'adm.dashboard.health.note':
    'Only dependencies with a registered probe appear here. Object storage and the job queue have none yet, so they are absent rather than shown as healthy.',
  'adm.dashboard.api.ready': 'Ready',
  'adm.dashboard.api.notReady': 'Not ready',
  'adm.dashboard.lastUpdated': 'Updated',
  'adm.dashboard.refreshing': 'Refreshing…',
  'adm.dashboard.refresh': 'Refresh',
  'adm.dashboard.awaiting.title': 'In development',
  'adm.dashboard.awaiting.body':
    'These screens have no endpoint behind them yet, so they show no figure. A zero here would be indistinguishable from a real zero.',
  'adm.dashboard.awaiting.milestone': 'Arrives in',
  'adm.dashboard.live': 'live',
  'adm.dashboard.greeting': 'Welcome back, Super Admin',
  'adm.sample.recentActivity': 'Recent activity',
  'adm.sample.topGyms': 'Top gyms by revenue',
  'adm.sample.membershipStats': 'Membership stats',
  'adm.sample.renewalRate': 'Renewal rate',
  'adm.viewAll': 'View all',
  'adm.queue.dayShort': 'd waiting',

  // --- SAMPLE figures. Everything below the banner on SCR-ADM-001 -----------
  // The banner is not decoration: revenue, orders and alerts have no tables until M-096…M-115,
  // and inventing them is only honest because the screen says it did.
  'adm.sample.notice':
    'Sample figures below this line. Revenue, orders and alerts are illustrative until the billing and moderation tables are live. Gym counts, the approval pipeline, accounts and platform health above are read from the database.',
  'adm.sample.tag': 'Sample',
  'adm.sample.totalRevenue': 'Total revenue',
  'adm.sample.todayRevenue': "Today's revenue",
  'adm.sample.commission': 'Platform commission',
  'adm.sample.activeMemberships': 'Active memberships',
  'adm.sample.supportTickets': 'Support tickets',
  'adm.sample.refundRequests': 'Refund requests',
  'adm.sample.vsThirtyDays': 'vs last 30 days',
  'adm.sample.vsYesterday': 'vs yesterday',
  'adm.sample.revenueOverview': 'Revenue overview',
  'adm.sample.revenueBreakdown': 'Revenue breakdown',
  'adm.sample.newRegistrations': 'New registrations',
  'adm.sample.marketplaceSales': 'Marketplace sales',
  'adm.sample.saasSubscriptions': 'SaaS subscriptions',
  'adm.sample.commissionSlice': 'Commission',
  'adm.sample.others': 'Others',
  'adm.sample.users': 'Members',
  'adm.sample.gyms': 'Gyms',
  'adm.sample.staff': 'Staff',
  'adm.sample.recentOrders': 'Recent orders',
  'adm.sample.col.order': 'Order',
  'adm.sample.col.member': 'Member',
  'adm.sample.col.amount': 'Amount',
  'adm.sample.col.status': 'Status',
  'adm.sample.systemAlerts': 'System alerts',
  'adm.sample.alert.refunds': 'High refund requests',
  'adm.sample.alert.refundsDetail': '8 refund requests pending',
  'adm.sample.alert.payments': 'Payment failure spike',
  'adm.sample.alert.paymentsDetail': '18 failed payments in the last hour',
  'adm.sample.alert.kyc': 'KYC documents pending',
  'adm.sample.alert.kycDetail': '15 gyms uploaded new documents',
  'adm.sample.alert.settlement': 'Settlement completed',
  'adm.sample.alert.settlementDetail': 'Rs 12,45,000 settled to 24 gyms',

  // --- NFR-SEC-11, the gate -------------------------------------------------
  'adm.gate.loading': 'Checking your session',
  'adm.gate.signIn.title': 'Sign in to the admin console',
  'adm.gate.signIn.body':
    'This console is not open to the public. Sign in with your platform account.',
  'adm.gate.signIn.action': 'Sign in',
  'adm.gate.signIn.unavailable':
    'Sign-in is not wired up yet. The identity module arrives in the milestones that follow this shell.',
  'adm.gate.mfa.title': 'Second factor required',
  // NFR-SEC-11 stated as a reason, not as an obstacle. An operator who understands why a control
  // exists is one who does not look for a way around it.
  'adm.gate.mfa.body':
    'Every platform account uses two-factor authentication. This console can read across every gym on the platform, so a password alone is not enough.',
  'adm.gate.mfa.action': 'Enter your code',

  // --- FR-AUTH-12 / BR-DAT-02, the impersonation banner ---------------------
  'adm.impersonation.label': 'You are acting as another user',
  'adm.impersonation.actingAs': 'Acting as',
  'adm.impersonation.end': 'Stop acting as this user',
  // FR-PAY / AC-AUTH-03.2 — an agent standing in for a member must not do what the member's money
  // depends on. Said out loud, because a silent restriction reads as a bug.
  'adm.impersonation.restriction':
    'Financial actions and cross-gym reads are disabled while acting as another user.',

  // --- FR-ADMN-02, the reason ------------------------------------------------
  'adm.reason.label': 'Reason for this action',
  'adm.reason.help':
    'Recorded in the audit log and readable by anyone reviewing this account later. Describe what you are doing and why.',
  'adm.reason.error.empty': 'A reason is required.',
  'adm.reason.error.tooShort': 'Too short. Write at least 20 characters explaining why.',

  // --- SCR-ADM-001, the dashboard -------------------------------------------
  'adm.dashboard.title': 'Platform dashboard',
  'adm.dashboard.subtitle': 'What needs attention today.',

  // --- the four states, B6 ---------------------------------------------------
  'adm.state.loading': 'Loading',
  'adm.state.empty.title': 'Nothing to review',
  'adm.state.empty.body': 'The queue is clear.',
  'adm.state.error.title': 'Something went wrong at our end',
  'adm.state.error.body':
    'This is a fault on our side. The reference below identifies it in the logs.',
  'adm.state.error.reference': 'Reference',
  'adm.state.error.retry': 'Try again',
  'adm.state.denied.title': 'You do not have access to this',
  // Says which permission, because "access denied" with no detail generates a support ticket
  // that a permission name would have answered.
  'adm.state.denied.body':
    'Your account is missing the permission this screen requires. Ask a platform administrator to grant it.',
  'adm.state.denied.permission': 'Required permission',

  // --- the shell's own status ------------------------------------------------
  'adm.shell.status.title': 'This is the shell',
  'adm.shell.status.body':
    'Navigation, the MFA gate, the reason requirement and the impersonation banner are in place. The screens they frame arrive with their own milestones.',
} as const;

export type MessageKey = keyof typeof en;
