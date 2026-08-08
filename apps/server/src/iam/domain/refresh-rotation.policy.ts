/**
 * M-022 · Refresh rotation and reuse detection — ADR-0011, `FR-AUTH-06`, `E1.2`, `TR-28`.
 *
 * ┌─ WHAT REUSE DETECTION ACTUALLY DETECTS ─────────────────────────────────────────────────────┐
 * │ Rotation means each refresh mints generation N+1 and spends generation N. A token is        │
 * │ therefore usable exactly once, and a SECOND use of a spent generation means two parties     │
 * │ hold the same token — which happens for exactly one reason that matters: somebody stole it. │
 * │                                                                                              │
 * │ The response is to revoke the WHOLE FAMILY, not the replayed token. The thief and the       │
 * │ member each hold some generation of the same chain, and there is no way to tell from the    │
 * │ replay which of them is which. Revoking one is a coin flip; revoking both ends the theft    │
 * │ and costs the member one re-login.                                                           │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `TR-28`: THE PARALLEL-TAB FALSE POSITIVE, AND WHY A GRACE WINDOW RATHER THAN A LOCK ───────┐
 * │ A mobile browser restoring two tabs fires two refreshes within milliseconds, both carrying  │
 * │ the SAME generation. A naive implementation sees the second as reuse, revokes the family,   │
 * │ and logs the member out of every device — reporting a security event that did not happen.   │
 * │                                                                                              │
 * │ `Authentication.md` §5.1 permits a grace on the IMMEDIATELY-PREVIOUS generation or a        │
 * │ rotation lock. The grace is chosen:                                                          │
 * │                                                                                              │
 * │   A LOCK serialises every refresh on a family through one mutex. It is correct and it adds  │
 * │   a distributed lock to the hottest authenticated path in the system, where a lock left     │
 * │   holding after a crash logs the member out for its whole TTL.                               │
 * │                                                                                              │
 * │   THE GRACE is a timestamp comparison already available on the row: a replay WITHIN a few   │
 * │   seconds of the rotation returns the token that rotation already minted, and a replay      │
 * │   after it is treated as theft.                                                              │
 * │                                                                                              │
 * │ The window is the cost. Ten seconds is long enough for a tab restore on a slow device and   │
 * │ short enough that a stolen token is worth almost nothing — an attacker must replay inside   │
 * │ ten seconds of the legitimate rotation, which means they were already watching in real      │
 * │ time, and a real-time attacker has the live token anyway.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

// The lifetimes live in `common/auth/token-lifetimes.ts` and are re-exported here for the
// domain's own readers. ONE declaration, because the guard's denylist TTL and the signer's `exp`
// must agree — a denylist shorter than the token leaves a revoked session working for the
// difference, silently.
export {
  ACCESS_TOKEN_TTL_SECONDS,
  FAMILY_DENYLIST_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../common/auth/token-lifetimes.js';

/**
 * `TR-28`'s grace on the immediately-previous generation. See the header for the trade.
 *
 * Deliberately short. This is the window in which a stolen token still works, and every second
 * of it is bought with a tab-restore that would otherwise log a member out of everything.
 */
export const ROTATION_GRACE_SECONDS = 10;

/** The stored state of one refresh generation, as the policy needs to see it. */
export interface StoredGeneration {
  readonly id: string;
  readonly sessionId: string;
  readonly generation: number;
  readonly usedAt: Date | null;
  readonly supersededById: string | null;
  readonly expiresAt: Date;
}

export type RotationDecision =
  /** Mint the next generation and spend this one. */
  | { readonly kind: 'ROTATE' }
  /**
   * `TR-28`. This generation was spent moments ago by a concurrent request; return what that
   * rotation produced rather than treating the second tab as an attacker.
   */
  | { readonly kind: 'REPLAY_WITHIN_GRACE'; readonly supersededById: string }
  /** A used generation replayed outside the grace. Revoke the family — `E1.2`. */
  | { readonly kind: 'REUSE_DETECTED' }
  /** Expired, or the session is no longer active. Re-authenticate; no alarm. */
  | { readonly kind: 'EXPIRED' };

/**
 * Decides what a presented refresh generation means. Pure.
 *
 * `sessionActive` is passed rather than read: the session may have been revoked by a password
 * reset (M-020) or by an explicit sign-out, and a refresh against a dead session is an ordinary
 * expiry rather than a security event.
 */
export function decideRotation(input: {
  readonly generation: StoredGeneration;
  readonly sessionActive: boolean;
  readonly now: Date;
}): RotationDecision {
  const { generation, sessionActive, now } = input;

  // Checked BEFORE the reuse branch. A revoked family's tokens are all spent — including by the
  // revocation itself — so a member refreshing after a password reset would otherwise be
  // reported as a token thief, and the alert that matters would be drowned in false ones.
  if (!sessionActive) return { kind: 'EXPIRED' };

  if (generation.expiresAt.getTime() <= now.getTime()) return { kind: 'EXPIRED' };

  if (generation.usedAt === null) return { kind: 'ROTATE' };

  // ── Spent. Theft, or a second tab? ───────────────────────────────────────────────────────
  const sinceUseMs = now.getTime() - generation.usedAt.getTime();
  const withinGrace = sinceUseMs >= 0 && sinceUseMs <= ROTATION_GRACE_SECONDS * 1000;

  if (withinGrace && generation.supersededById !== null) {
    return { kind: 'REPLAY_WITHIN_GRACE', supersededById: generation.supersededById };
  }

  // Spent, and either outside the grace or with no successor recorded. The second case is the
  // more suspicious of the two: a generation marked used with nothing superseding it means the
  // rotation did not complete, and a replay of it is not a tab restore.
  return { kind: 'REUSE_DETECTED' };
}

/** The next generation number. Monotonic within a family — `uq_refresh_tokens__session_generation`. */
export function nextGeneration(current: number): number {
  return current + 1;
}

/**
 * Why the family was revoked. Stored on every session in it, so the reason survives the incident.
 *
 * `TOKEN_REUSE_DETECTED` is deliberately distinct from an ordinary sign-out: it is what the
 * `ALRT-32` query counts, and folding it into `USER_SIGNED_OUT` would make the one alert that
 * matters invisible among thousands of routine logouts.
 */
export const REUSE_REVOCATION_REASON = 'TOKEN_REUSE_DETECTED';
