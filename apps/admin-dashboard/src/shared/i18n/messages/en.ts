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
  // -- "Needs your attention". Every one of these describes REAL data - see the panel's header.
  'adm.sample.metricLabel': 'Which measure to chart',
  'adm.sample.rangeLabel': 'Time range',
  'adm.sample.metric.revenue': 'Revenue',
  // Gross merchandise value: what members paid in total, of which revenue is the platform's slice.
  'adm.sample.metric.gmv': 'GMV',
  'adm.sample.metric.commission': 'Commission',
  'adm.sample.metric.memberships': 'Memberships',
  // -- SCR-ADM-004's eight administrative actions (FR-ADMN-01, AdminDashboard.md 6.4).
  'adm.gyms.action.suspend': 'Suspend',
  'adm.gyms.action.reinstate': 'Reinstate',
  'adm.gyms.action.tier': 'Change tier',
  'adm.gyms.action.commission': 'Override commission',
  'adm.gyms.action.reverify': 'Force re-verification',
  'adm.gyms.action.close': 'Close tenant',
  'adm.gyms.action.notListed': 'Only a listed gym',
  'adm.gyms.selectAll': 'Select every gym on this page',
  'adm.gyms.selectRow': 'Select {n}',
  'adm.gyms.bulkSelected': '{n} selected',
  'adm.gyms.bulkClear': 'Clear',
  'adm.gyms.bulkRegion': 'Bulk actions',
  'adm.gyms.bulkExport': 'Export selected',
  'adm.gyms.bulkAssign': 'Assign',
  // 5.2 destructive action 3. DC2: what happens to whom, never "Are you sure?".
  'adm.gyms.suspendTitle': 'Suspend {g}?',
  'adm.gyms.suspendBody':
    'The listing is hidden from the marketplace immediately and payouts stop. Members keep their gym access - a suspension is a listing and settlement action, not a lockout. The active member count and unsettled balance this line should also state need the membership and ledger tables (M-114); they are absent rather than estimated.',
  'adm.gyms.suspendReversible':
    'Reversible - Reinstate republishes the listing and resumes payouts.',
  'adm.gyms.suspendTypeName': 'Type the legal name to confirm',
  'adm.gyms.suspendUnavailable':
    'Nothing was suspended. POST /v1/admin/tenants/:id/suspend arrives with M-114 - the dialog is here so the confirmation is right before the action is live.',
  // -- SCR-ADM-003, Application Review. AdminDashboard.md 6.3.
  //
  // Every "not yet" string below names its milestone. On THIS screen that is not politeness: a
  // fabricated pre-check pass would be a screenshot claiming a human verified a business, which is
  // the exact claim the marketplace sells (OBJ-03, RSK-01 score 20).
  'adm.review.region': 'Application review',
  'adm.review.notFound': 'No application with that reference',
  'adm.review.notFoundBody':
    'The link may be stale, or the application may already have been decided. The queue has the current list.',
  'adm.review.submitted': 'Submitted',
  'adm.review.reassign': 'Reassign',
  // The reason goes in the `title`, not the label. A button whose text carries its own excuse is
  // three times the width of the control beside it and reads as a sentence rather than an action.
  'adm.review.reassignWhy': 'Needs an assignee, which arrives with the applications table (M-036)',
  'adm.review.tenantId': 'Tenant id',
  'adm.review.applicationData': 'Application data',
  'adm.review.dataNote':
    'PAN, registration number, street address, contact number and bank details belong on this screen and are deliberately absent from the register response - BR-DAT-06 keeps them out of a list of gyms. They arrive with the dossier endpoint, which can log the access that reading them requires.',

  // 6.3.4 PC1 - above the split, full width, first thing below the header.
  'adm.review.prechecks': 'Pre-checks',
  'adm.review.prechecksBody':
    'The eight automated checks - geo distance, duplicate address, duplicate registration id, duplicate bank account, image quality, content screening, minimum photos, published plan - are not computed yet. Nothing here is passing or failing: it is unknown. Do not read the absence of failures as an absence of problems.',

  // 6.3.3 - inline viewer, and DV1/DV2 make the missing download button a control.
  'adm.review.documents': 'Documents',
  'adm.review.documentsBody':
    'KYC documents have no table until M-029. When they land they render in an inline viewer with zoom and rotate and NO download - BR-DAT-07 requires every KYC access to be logged, and a downloaded file is an access nobody logged and a copy nobody can revoke.',

  // 6.3.5 - CL1 makes the checklist version part of the record.
  'adm.review.checklist': 'Checklist',
  'adm.review.checklistBody':
    'The structured checklist is snapshotted at submit, so adding a tenth required document in March cannot make a February application incomplete. It needs the applications table (M-036), and each item needs an evidence reference into the document viewer.',

  'adm.review.notes': 'Internal notes',
  'adm.review.notesBody':
    'Not shown to the gym owner. Needs somewhere to store them (M-036).',

  'adm.review.history': 'History',
  'adm.review.historyEmpty': 'Nothing recorded yet.',
  'adm.review.timelineSubmitted': 'Application arrived',
  'adm.review.timelineOnlyEvent':
    'The only event on record. Prior versions and the field-level diff against them arrive with M-036 - BR-GYM-05 retains them, so the history exists in the data before it exists on this screen.',

  // 6.3.2 - the bar is sticky at every width "because an officer must never scroll to decide".
  'adm.review.barRegion': 'Decision',
  'adm.review.barNote':
    'The three decision endpoints arrive with M-036. The bar is here, and sticky, because the layout is what is being got right - not because a decision can be made yet.',
  'adm.review.approve': 'Approve',
  'adm.review.reject': 'Reject',
  'adm.review.requestInfo': 'Request information',
  'adm.detail.breadcrumb': 'Breadcrumb',
  // -- The verification SLA. AdminDashboard.md 6.2 column semantics; nothing here is computed.
  // -- The reason dialog and the destructive confirmation. AdminDashboard.md 5.1 and 5.2.
  // RD2: ten characters after trimming, matching the server's RS3.
  'adm.reason.hint': 'Recorded in the audit log. Minimum 10 characters.',
  'adm.reason.short': '{n} more characters needed.',
  'adm.action.cancel': 'Cancel',
  'adm.action.close': 'Close',
  'adm.action.dismiss': 'Dismiss',
  // 5.2 destructive action 6 - "Force logout / revoke sessions". DC4: the verb, never "OK".
  'adm.sessions.confirm.verb': 'Sign out this device',
  'adm.sessions.confirm.title': 'Sign out this device?',
  'adm.sessions.confirm.titleHere': 'Sign out the device you are using?',
  'adm.sessions.confirm.body':
    '{d} will be signed out immediately. You have {n} active sessions in total.',
  'adm.sessions.confirm.bodyHere':
    'This is the device you are using right now. You will be returned to the sign-in screen and will need your password and second factor again.',
  // DC5 - reversible, and the reverse is named.
  'adm.sessions.confirm.reversible': 'Reversible - signing in again creates a new session.',
  'adm.sessions.revoked': 'Signed out. Access stops within a minute on every service.',
  'adm.sla.header': 'SLA',
  'adm.sla.breached': 'SLA breached',
  'adm.sla.approaching': 'SLA approaching',
  'adm.sla.within': 'Within SLA',
  'adm.sla.paused': 'SLA paused, waiting on the gym',
  'adm.sla.pausedShort': 'paused',
  'adm.sla.none': 'No SLA - already decided',
  'adm.sla.days': 'd',
  'adm.sla.tip': 'Target {t} hours. Open {h} hours.',
  // 6.2: the wall-clock age must stay visible on a paused row "so a paused queue cannot hide a
  // stalled application".
  'adm.sla.pausedTip': 'Clock paused - the gym owes information. Open {h} hours in total.',
  'adm.queue.col.age': 'Age',
  'adm.queue.summary.open': 'Open',
  'adm.queue.summary.breached': 'Breached',
  'adm.queue.summary.approaching': 'Approaching',
  'adm.queue.summary.paused': 'Paused',
  'adm.queue.summary.oldest': 'Oldest',
  'adm.queue.summary.hours': 'h',
  'adm.queue.summary.region': 'Queue summary',
  // 6.2 region 2 needs `queue_summary.by_officer`, and an assignee exists only once the
  // applications table does (M-036). Named rather than silently missing.
  'adm.queue.workloadPending': 'Workload by officer arrives with the applications table (M-036).',
  'adm.queue.kbd': 'Press / to search, j and k to move, Enter to open.',
  'adm.attention.title': 'Needs your attention',
  'adm.attention.clear': 'Nothing is waiting on you right now.',
  'adm.attention.dependency': 'A dependency is not answering',
  'adm.attention.viewHealth': 'Platform health',
  'adm.attention.queue': '{n} gyms are waiting for review',
  'adm.attention.queueDetail': 'The oldest has been open {h} hours.',
  'adm.attention.queueBreached': '{n} are past the review SLA the server reports.',
  'adm.attention.queueDetailUnknown': 'Loading how long the oldest has waited.',
  'adm.attention.review': 'Review',
  'adm.attention.suspended': '{n} gyms are suspended',
  'adm.attention.suspendedDetail':
    'A suspended gym is hidden from members and still billed for its subscription.',
  'adm.attention.openRegister': 'Open the register',
  'adm.attention.infoRequested': '{n} applications are waiting on the gym',
  'adm.attention.infoRequestedDetail': 'Information was requested and has not come back yet.',
  'adm.chrome.roleUnknown': 'Platform staff',
  'adm.dashboard.greetingPrefix': 'Welcome back, ',
  'adm.dashboard.greetingPlain': 'Welcome back',
  'adm.chrome.notifications': 'Notifications - arrives with the notification service (A-19)',
  'adm.chrome.help': 'Help - the operator handbook is not written yet',
  'adm.chrome.search.shortcut': 'Ctrl K',
  'adm.chrome.env': 'Development',
  'adm.palette.placeholder': 'Jump to a screen…',
  'adm.palette.label': 'Jump to a screen',
  'adm.palette.empty': 'No screen matches that.',
  // Says what it does and what it does not. Cross-entity search needs the B3.2 matrix to decide
  // which results an operator may see, so calling this "search" would be a small lie.
  'adm.palette.hint':
    'Arrows to move, Enter to open, Esc to close. This jumps between screens; searching gyms and accounts arrives with M-023.',
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
  'adm.chrome.group.configuration': 'Configuration',
  'adm.chrome.group.system': 'System',
  'adm.chrome.nav.commission': 'Commission',
  'adm.chrome.nav.subscriptions': 'Subscriptions',
  'adm.chrome.nav.tax': 'Tax',
  'adm.chrome.nav.kyc': 'KYC',
  'adm.chrome.nav.flags': 'Feature flags',
  'adm.chrome.nav.notifications': 'Notifications',
  'adm.chrome.nav.settings': 'Settings',
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
  'adm.reason.error.tooShort': 'Too short. Write at least 10 characters explaining why.',

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
