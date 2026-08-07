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
  'adm.chrome.nav.approvals': 'Approvals',
  'adm.chrome.nav.tenants': 'Gyms',
  'adm.chrome.nav.finance': 'Finance',
  'adm.chrome.nav.moderation': 'Moderation',
  'adm.chrome.nav.audit': 'Audit',
  'adm.chrome.signOut': 'Sign out',

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
