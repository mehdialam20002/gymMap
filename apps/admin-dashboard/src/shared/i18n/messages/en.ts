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

  // --- SCR-ADM-001, the dashboard tiles -------------------------------------
  'adm.dashboard.tile.api': 'API',
  'adm.dashboard.tile.dependencies': 'Dependencies',
  'adm.dashboard.tile.yourDevices': 'Your devices',
  'adm.dashboard.tile.yourDevicesDetail': 'Signed-in sessions on your own account',
  'adm.dashboard.tile.approvals': 'Gyms awaiting approval',
  'adm.dashboard.tile.gyms': 'Listed gyms',
  'adm.dashboard.tile.settlements': 'Settlements due',
  'adm.dashboard.tile.moderation': 'Reports to review',
  'adm.dashboard.api.ready': 'Ready',
  'adm.dashboard.api.notReady': 'Not ready',
  'adm.dashboard.lastUpdated': 'Updated',
  'adm.dashboard.refreshing': 'Refreshing…',
  'adm.dashboard.awaiting.title': 'Not built yet',
  // Says why there is no number rather than showing a zero. A zero meaning "not built" and a zero
  // meaning "nothing to do today" look identical, and only one of them needs an operator.
  'adm.dashboard.awaiting.body':
    'These tiles have no endpoint behind them yet, so they show no figure. A zero here would be indistinguishable from a real zero.',
  'adm.dashboard.awaiting.milestone': 'Arrives in',

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
