/**
 * M-020 · `users` and `auth_sessions` access — `Schema.md` §4.6, §4.8.
 *
 * ┌─ NOT A `TenantScopedRepository`, AND THAT IS NOT AN OVERSIGHT ──────────────────────────────┐
 * │ Every repository since M-012 extends it. This one must not: `users` is IDENTITY class       │
 * │ (`Schema.md` §1.3) with no `tenant_id` and no RLS policy, so there is nothing for            │
 * │ `runInTenantTransaction` to set and nothing for a policy to filter.                          │
 * │                                                                                              │
 * │ It is also reached BEFORE a tenant is known. Login resolves an identity; the tenant is a     │
 * │ consequence of the roles that identity holds. A tenant-scoped read here would need a tenant │
 * │ the request does not have yet.                                                               │
 * │                                                                                              │
 * │ The control that replaces RLS is authorisation on `user_id` — a different mechanism with     │
 * │ different failure modes, which is exactly why §1.3 gives it its own class name rather than   │
 * │ calling it "RLS with an exception".                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ EMAIL IS LOWERCASED BEFORE EVERY COMPARISON ───────────────────────────────────────────────┐
 * │ `Schema.md` §4.6: *"Lowercased before write."* The unique index is over the stored value,   │
 * │ so `Priya@example.com` and `priya@example.com` are two rows unless the application          │
 * │ normalises — and the second registration succeeds, giving one person two accounts and one   │
 * │ of them access to nothing they expect.                                                       │
 * │                                                                                              │
 * │ Normalising on WRITE alone is not enough: a login that does not lowercase looks up the raw  │
 * │ input, misses, and reports "no such account" to someone whose account plainly exists.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../tenancy/prisma/prisma.service.js';

/** The projection the password path needs. Deliberately narrow — see `findForAuthentication`. */
export interface AuthenticationSubject {
  readonly id: string;
  readonly passwordHash: string | null;
  readonly status: string;
  readonly emailVerifiedAt: Date | null;
  readonly phoneVerifiedAt: Date | null;
  /** Masked at the boundary, never returned raw to a caller. */
  readonly email: string | null;
  readonly phone: string | null;
}

/** `Schema.md` §4.6 — the identifier a caller may sign in with. */
export type Identifier = { kind: 'EMAIL'; value: string } | { kind: 'PHONE'; value: string };

/** `Priya@Example.COM ` → `priya@example.com`. Phone is E.164 already and is only trimmed. */
export function normaliseIdentifier(raw: string): Identifier {
  const trimmed = raw.trim();
  return trimmed.includes('@')
    ? { kind: 'EMAIL', value: trimmed.toLowerCase() }
    : { kind: 'PHONE', value: trimmed };
}

@Injectable()
export class UserPrismaRepository {
  constructor(private readonly db: PrismaService) {}

  /**
   * The login lookup. Returns `null` for an unknown identifier.
   *
   * The projection omits `fullName` and every profile field on purpose. A login handler has no
   * use for them, and a row that never carries them cannot leak them into a log line, an error
   * envelope or a debugger session on the one code path an unauthenticated caller can reach.
   */
  async findForAuthentication(identifier: Identifier): Promise<AuthenticationSubject | null> {
    const where =
      identifier.kind === 'EMAIL' ? { email: identifier.value } : { phone: identifier.value };

    const row = await this.db.client.user.findFirst({
      // `deletedAt: null` is part of the QUERY, not a filter applied afterwards. The unique
      // indexes are partial on it (SD7), so a soft-deleted account's address is free for
      // re-registration — and without this clause a login could resolve to the DEAD row.
      where: { ...where, deletedAt: null },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        email: true,
        phone: true,
      },
    });

    return row;
  }

  /** Whether an address is already taken by a LIVE account. */
  async identifierExists(identifier: Identifier): Promise<boolean> {
    const where =
      identifier.kind === 'EMAIL' ? { email: identifier.value } : { phone: identifier.value };
    const count = await this.db.client.user.count({ where: { ...where, deletedAt: null } });
    return count > 0;
  }

  /**
   * Creates an account. `status` defaults to `PENDING_VERIFICATION` in the column.
   *
   * The caller supplies the id — `ERD.md` §11.5 requires an application-supplied UUIDv7, because
   * the id must exist BEFORE the insert so an outbox row and its aggregate can reference each
   * other inside one transaction.
   */
  async createWithPassword(input: {
    readonly id: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly fullName: string | null;
    readonly passwordHash: string;
  }): Promise<void> {
    await this.db.client.user.create({
      data: {
        id: input.id,
        email: input.email,
        phone: input.phone,
        fullName: input.fullName,
        passwordHash: input.passwordHash,
      },
    });
  }

  /** Replaces the stored hash. Used by reset, and by the re-hash-on-login upgrade path. */
  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db.client.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  /** `FR-AUTH-09`. Stamped on a successful login, for the sessions screen. */
  async recordLogin(userId: string, at: Date): Promise<void> {
    await this.db.client.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  /**
   * Marks the email verified. `BR-GYM-02` makes a verified owner email an approval precondition.
   *
   * The status transition is CONDITIONAL — `PENDING_VERIFICATION` only. A `SUSPENDED` or
   * `DEACTIVATED` account must not be revived by clicking a verification link that was sent
   * before the suspension; that would make an admin action undoable from an old email.
   *
   * The timestamp is written regardless, because the address WAS verified and that fact is true
   * whatever the account's status. Two statements rather than one, so the two outcomes stay
   * independent — an `updateMany` covering both would skip the timestamp for a suspended user.
   */
  async markEmailVerified(userId: string, at: Date): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: at },
    });
    await this.db.client.user.updateMany({
      where: { id: userId, status: 'PENDING_VERIFICATION' },
      data: { status: 'ACTIVE' },
    });
  }

  /**
   * M-021. Marks the phone verified after a successful OTP.
   *
   * Same conditional status transition as `markEmailVerified`, for the same reason: a suspended
   * account must not be revived by proving control of a number. In the launch market this is the
   * common path — `FR-AUTH-02` makes the phone the primary identifier, so most accounts reach
   * `ACTIVE` through here rather than through an email link.
   */
  async markPhoneVerified(userId: string, at: Date): Promise<void> {
    await this.db.client.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: at },
    });
    await this.db.client.user.updateMany({
      where: { id: userId, status: 'PENDING_VERIFICATION' },
      data: { status: 'ACTIVE' },
    });
  }

  /**
   * M-022 · The role scope codes for an access token — `SE2`, `FR-RBAC-04`.
   *
   * ┌─ RE-READ ON EVERY REFRESH, NEVER COPIED FROM THE PREVIOUS TOKEN ────────────────────────┐
   * │ `FR-RBAC-04` requires a role change to take effect within 60 seconds without forcing a  │
   * │ re-authentication. A refresh that copied its predecessor's claims would carry a REVOKED │
   * │ role for the full 15-minute access-token lifetime — and after a staff member is         │
   * │ offboarded, that is fifteen minutes of authority nobody intended.                        │
   * │                                                                                          │
   * │ Reading is also what makes `revoked_at` mean anything: revocation is a timestamp rather │
   * │ than a delete (`AC-STAF-01.4`), so only a live query sees it.                            │
   * └──────────────────────────────────────────────────────────────────────────────────────────┘
   *
   * `SE2` — SCOPE CODES, never a permission list. `MEMBER@self`, `GYM_OWNER@t:9f2a…`. A client
   * rendering navigation from these is doing presentation, and the server still refuses
   * independently (`AZ5`, `FR-RBAC-02`).
   */
  async roleScopesFor(userId: string): Promise<string[]> {
    const grants = await this.db.client.userRole.findMany({
      // `revokedAt: null` is the whole point — see above.
      where: { userId, revokedAt: null },
      select: { tenantId: true, role: { select: { key: true, scope: true } } },
    });

    return grants
      .map((grant) =>
        grant.tenantId === null
          ? `${grant.role.key}@${grant.role.scope.toLowerCase()}`
          : `${grant.role.key}@t:${grant.tenantId}`,
      )
      .sort();
  }
}
