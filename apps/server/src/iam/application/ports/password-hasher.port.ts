/**
 * M-020 · The password hasher — `A-12`, `FR-AUTH-04`, `NFR-SEC-01`.
 *
 * A port rather than a direct `argon2` import at the call site, for one specific reason beyond
 * the usual: `A-12`'s approval condition is *"Parameter tuning must be recorded."* A port gives
 * the parameters exactly one home, and `argon2.hasher.adapter.spec.ts` asserts them there — so a
 * dependency upgrade that changed a default cannot silently weaken every password on the
 * platform while every test still passes.
 */

export const PASSWORD_HASHER = Symbol('PasswordHasher');

export interface PasswordHasher {
  /**
   * Hashes a chosen password. Returns a PHC string — `$argon2id$v=19$m=…,t=…,p=…$salt$hash`.
   *
   * The PHC format carries the parameters and the salt WITH the digest, which is what makes
   * `needsRehash` possible at all: raising the cost later does not invalidate existing
   * passwords, because each one records what it was hashed with.
   */
  hash(password: string): Promise<string>;

  /**
   * Verifies a presented password against a stored PHC string.
   *
   * Returns `false` rather than throwing on a mismatch — a mismatch is the expected outcome of a
   * typo, not an exceptional condition. It DOES throw on a malformed stored hash, because that
   * is data corruption and treating it as "wrong password" would lock a member out silently.
   */
  verify(storedHash: string, password: string): Promise<boolean>;

  /**
   * Whether the stored hash was produced with weaker parameters than current policy.
   *
   * Called after a SUCCESSFUL verify, because that is the only moment the plaintext exists and a
   * stronger hash can be written without asking the member for anything.
   */
  needsRehash(storedHash: string): boolean;

  /**
   * Burns the same work as a real verify, for an identifier that does not exist.
   *
   * `Security.md` §1.6 requires that an unknown address and a wrong password be indistinguishable
   * — and the timing is the hard half. Argon2id at these parameters takes tens of milliseconds;
   * skipping it for an unknown account makes that path measurably faster, and the difference is
   * a working enumeration oracle over any network an attacker can sample.
   *
   * It must hash against a REAL stored digest with the SAME parameters, not sleep for an
   * estimate: a fixed delay has different variance from a CPU-bound hash, and variance is
   * itself a signal.
   */
  burnEquivalentWork(password: string): Promise<void>;
}
