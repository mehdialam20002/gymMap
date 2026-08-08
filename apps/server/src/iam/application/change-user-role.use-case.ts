/**
 * `M-023` · Changing a user's role — `FR-RBAC-04`, `FR-RBAC-07`, `BR-DAT-01`, `AC-6`, `AC-9`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THREE OBLIGATIONS THAT MUST NOT BE ABLE TO HAPPEN SEPARATELY
 *
 *   1  the last-owner policy is honoured        `FR-RBAC-07`
 *   2  the cache is invalidated                 `FR-RBAC-04` — or the old access stays live
 *   3  an audit row is written                  `BR-DAT-01` — actor, before, after, reason
 *
 * They are here, in one use case, because each one alone is the kind of thing a second caller
 * forgets. A role change that skips (2) reports success over access it did not actually remove; one
 * that skips (3) is a permission change nobody can attribute six months later, which is exactly the
 * event an audit log exists for.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ THE ORDER IS: PERSIST, INVALIDATE, AUDIT — AND IT IS NOT ARBITRARY ────────────────────────┐
 * │ Invalidating BEFORE the write would open a window where the cache is empty and the database    │
 * │ still holds the old role, so the next request repopulates the cache with exactly the value      │
 * │ that was meant to be removed. The bug is timing-dependent, rare, and permanent once it lands.  │
 * │                                                                                              │
 * │ Auditing LAST is safe because `append()` never throws into the caller's path — the audit        │
 * │ repository swallows write failures deliberately, so a failed row cannot roll back a change      │
 * │ that has already taken effect. That is a trade the audit module documents: a lost row is        │
 * │ recoverable from the application log, a lost role change is not.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable } from '@nestjs/common';

import { AUDIT_WRITE_PORT, type AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { mayChangeRole, type TenantRoleAssignment } from '../domain/last-owner.policy.js';
import { PERMISSION_CACHE, type PermissionCache } from './ports/permission-cache.port.js';
import type { PlatformRole } from '../types/iam.types.js';

/**
 * What the use case needs from persistence.
 *
 * ┌─ NO METHOD TAKES A TENANT ID, AND A LINT RULE CAUGHT ME ADDING ONE ─────────────────────────┐
 * │ The first version was `assignmentsFor(tenantId)` and `replaceRole(tenantId, …)`, which reads   │
 * │ as careful and is the opposite. Constitution §11.5 `BR5`: tenant scope comes from the REQUEST  │
 * │ CONTEXT and is enforced by RLS, never from an argument — because a caller that passes the      │
 * │ wrong id reads another tenant, and the query is syntactically valid, so nothing throws.        │
 * │                                                                                              │
 * │ `gymmap/no-tenant-id-parameter` failed the build on both signatures. The Prisma tenant-context │
 * │ extension supplies the tenant to every operation (`A-01`), so an implementation of this port   │
 * │ cannot reach another tenant even if it tried.                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export interface UserRoleStore {
  /** Every role assignment in the CURRENT tenant. Whole, because the last-owner count is over all. */
  assignmentsFor(): Promise<readonly TenantRoleAssignment[]>;
  /** Replaces one user's role, returning the role they held before. */
  replaceRole(userId: string, role: PlatformRole): Promise<PlatformRole | null>;
}

export const USER_ROLE_STORE = Symbol('UserRoleStore');

export interface ChangeRoleCommand {
  // No `tenantId`. Same rule as the port above: the tenant is whichever one the request established,
  // and accepting it here would let a caller name a different one for the audit row than the one the
  // write actually landed in — a row that says the wrong gym is worse than no row.
  readonly targetUserId: string;
  readonly nextRole: PlatformRole;
  /** Who is doing this. On the audit row, and never defaulted. */
  readonly actorId: string;
  /**
   * Why. At least ten characters after trimming — `Admin.md` RS3.
   *
   * Not optional and not defaulted: `FR-ADMN-02` requires a reason on every administrative action,
   * and a default would put the same sentence on every row in the estate and answer nothing.
   */
  readonly reason: string;
  readonly correlationId: string;
}

@Injectable()
export class ChangeUserRoleUseCase {
  constructor(
    @Inject(USER_ROLE_STORE) private readonly store: UserRoleStore,
    @Inject(PERMISSION_CACHE) private readonly cache: PermissionCache,
    @Inject(AUDIT_WRITE_PORT) private readonly audit: AuditWritePort,
  ) {}

  async execute(command: ChangeRoleCommand): Promise<void> {
    const assignments = await this.store.assignmentsFor();

    // The policy runs on the state as it stands, BEFORE the write. Checking afterwards would mean
    // detecting the lockout by having caused it.
    const verdict = mayChangeRole(assignments, command.targetUserId, command.nextRole);
    if (!verdict.permitted) {
      // 422 rather than 403: the caller may well be permitted to change roles. What they asked for
      // is a state the domain refuses, which is the distinction `BusinessRuleException` carries.
      throw new BusinessRuleException('LAST_OWNER_PROTECTED', verdict.reason);
    }

    const before = await this.store.replaceRole(command.targetUserId, command.nextRole);

    // Then invalidate. See the header for why this cannot come first.
    await this.cache.invalidate(command.targetUserId);

    // The tenant on the audit row is the one the WRITE happened in, read from the same context the
    // repository used. Taking it from the command would let the two disagree.
    const context = currentTenantContext();

    await this.audit.append({
      tenantId: context.kind === 'TENANT' ? context.tenantId : null,
      actorId: command.actorId,
      actorType: 'USER',
      entityType: 'user_role',
      entityId: command.targetUserId,
      action: 'UPDATE',
      // `BR-DAT-01` wants before and after, and CHANGED FIELDS ONLY — never the whole row. The role
      // is the only thing that moved.
      before: { role: before },
      after: { role: command.nextRole },
      reason: command.reason,
      correlationId: command.correlationId,
    });
  }
}
