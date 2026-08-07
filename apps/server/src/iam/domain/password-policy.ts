/**
 * M-020 · The password policy — `FR-AUTH-04`, `Security.md` §2.4.1, ADR-0033.
 *
 * ┌─ THE MAXIMUM IS 128, AND THAT IS A RECORDED RECONCILIATION ─────────────────────────────────┐
 * │ `Security.md` §2.4.1 says 128; `Authentication.md` §5.2 says 256. Both are rank-3 documents │
 * │ under `CLAUDE.md` §2, so precedence returns no answer and it was raised as a halt.           │
 * │                                                                                              │
 * │ 128 is not "Security.md winning". Each document states a CEILING, and 128 is the only value │
 * │ that leaves both true: a 128-character password is within 128 and within 256, while a        │
 * │ 200-character one is within one and outside the other. Same move as M-019's widening of      │
 * │ `ck_users__has_contact` — where two clauses can both hold, make both hold. See ADR-0033.     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE POLICY APPLIES WHERE A PASSWORD IS *CHOSEN*, NEVER WHERE IT IS *PRESENTED* ────────────┐
 * │ Register, reset and change are choices — the policy binds. Login and re-authentication are  │
 * │ presentations, and `Authentication.md` §8.4 keeps them at `min(1).max(256)` deliberately:    │
 * │ a stored password may predate any policy, and refusing a LOGIN because the password on file │
 * │ is too short locks a member out of their own account with no path forward.                   │
 * │                                                                                              │
 * │ `loginPasswordBounds` below exists so that distinction is a named thing rather than a        │
 * │ different literal somebody has to notice.                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THERE IS NO COMPOSITION RULE, AND THAT IS DELIBERATE ──────────────────────────────────────┐
 * │ No "one uppercase, one digit, one symbol". `FR-AUTH-04` does not ask for one, and neither    │
 * │ does `Security.md` §2.4.1 — it asks for LENGTH and a BREACH CHECK. Composition rules push    │
 * │ people toward `Password1!`, which is in every breach corpus, while refusing                  │
 * │ `correct horse battery staple`, which is in none.                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/** `Security.md` §2.4.1 and `Authentication.md` §5.2 agree on the floor. */
export const PASSWORD_MIN_LENGTH = 10;

/** ADR-0033 — the value that satisfies both documents. See the header. */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The bounds for a password being PRESENTED rather than chosen.
 *
 * `Authentication.md` §8.4 verbatim. Wider on purpose, and never used for register or reset.
 */
export const LOGIN_PASSWORD_MIN_LENGTH = 1;
export const LOGIN_PASSWORD_MAX_LENGTH = 256;

/** Why a candidate password was refused. One reason per failure — see `checkPassword`. */
export type PasswordRejection = 'TOO_SHORT' | 'TOO_LONG' | 'BREACHED';

export interface PasswordCheck {
  readonly ok: boolean;
  /** `null` when `ok`. The FIRST failing rule, never a list — see below. */
  readonly rejection: PasswordRejection | null;
}

const ACCEPTED: PasswordCheck = { ok: true, rejection: null };

/**
 * Applies the LENGTH half of the policy. The breach check is a separate, asynchronous step.
 *
 * Returns ONE rejection rather than a list. `Authentication.md` §13.3 V2 requires one `details`
 * entry per FIELD, not per rule — a response carrying three entries all naming `password` reads
 * as three fields to a form that binds errors by field name, and the member sees the same box
 * flagged three times.
 *
 * The input is NOT trimmed. A leading or trailing space is a character the member chose and
 * typed; silently removing it means the password they set is not the password they entered, and
 * the mismatch surfaces later as a login failure nobody can explain.
 */
export function checkPasswordLength(password: string): PasswordCheck {
  // Unicode code points, not UTF-16 code units. `.length` counts an emoji or an astral-plane
  // character as two, so a 10-character passphrase containing one would be refused as nine —
  // and the member would be told to lengthen something that is already long enough.
  const length = [...password].length;

  if (length < PASSWORD_MIN_LENGTH) return { ok: false, rejection: 'TOO_SHORT' };
  if (length > PASSWORD_MAX_LENGTH) return { ok: false, rejection: 'TOO_LONG' };
  return ACCEPTED;
}

/** The same count `checkPasswordLength` uses, exported so a message can quote it. */
export function passwordLength(password: string): number {
  return [...password].length;
}

/**
 * The message for a rejection. `NFR-USE-05` and `UM1`: what happened, why, and what next.
 *
 * The value is NEVER interpolated — `AC-FND-09.6` keeps a submitted password out of the response
 * envelope, and out of the log line the envelope is built from.
 */
export function rejectionMessage(rejection: PasswordRejection): string {
  switch (rejection) {
    case 'TOO_SHORT':
      return (
        `Your password needs to be at least ${String(PASSWORD_MIN_LENGTH)} characters. ` +
        'A short phrase you can remember — three or four unrelated words — is stronger than a ' +
        'short one with symbols in it.'
      );
    case 'TOO_LONG':
      return (
        `Your password can be at most ${String(PASSWORD_MAX_LENGTH)} characters. ` +
        'If you are using a password manager, generate a shorter one — anything over about 40 ' +
        'characters is already beyond what any attacker can guess.'
      );
    case 'BREACHED':
      return (
        'This password has appeared in a known data breach, so it is one of the first an ' +
        'attacker will try. Choose a different one — it does not need to be more complicated, ' +
        'just not one that has been published.'
      );
  }
}
