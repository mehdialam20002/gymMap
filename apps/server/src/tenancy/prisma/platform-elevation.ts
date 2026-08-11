/**
 * M-014 · `runElevated()` — the ONLY way to read across tenants. AC-FND-05.1, PE2, PE4.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THERE IS NO AMBIENT CAPABILITY TO ELEVATE
 *
 * No request-scoped flag, no `isAdmin` short-circuit, no elevated session. Crossing a tenant
 * boundary is a function call that names a reason, an actor and a scope, and writes an audit row
 * before it does anything.
 *
 * The alternative — a session that "is elevated" for its duration — fails in a specific way:
 * the elevation outlives the operation that needed it. An admin opens the approval queue, and
 * every subsequent query in that request, including ones nobody thought about, silently reads
 * across tenants. Nothing looks wrong, and the audit log records one elevation for twenty
 * cross-tenant reads.
 *
 * `PE-T6` asserts the opposite property: the scope ends with the callback.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * THE REASON IS REQUIRED AT THE TYPE LEVEL — AC-3, PE-T9.
 *
 * `NonEmptyReason` is a branded string with a validating constructor, so `runElevated('', …)`
 * does not compile. It is re-checked at runtime because a cast can defeat any brand, and an
 * unexplained cross-tenant read is indistinguishable from an attack in the audit log.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import type { Brand } from '@gymmap/types';

import type { AuditEntry, AuditWritePort } from '../../audit/ports/audit-write.port.js';
import { currentImpersonation } from '../../common/auth/impersonation.als.js';
import { currentCorrelationId } from '../../common/logging/correlation.als.js';
import { mayElevate } from '../../iam/domain/impersonation.policy.js';
import { currentTenantContext } from '../context/tenant-context.als.js';
import {
  isTenantScope,
  platformScoped,
  type PlatformContext,
} from '../context/tenant-context.vo.js';
import { ElevationRefusedError } from '../domain/tenancy.errors.js';

/** A reason that is provably not empty. Produced only by `reason()`. */
export type NonEmptyReason = Brand<string, 'NonEmptyReason'>;

/**
 * The closed set of elevation scopes.
 *
 * A free-text scope would make the inventory (`elevation-inventory.mjs`) unaggregatable: forty
 * call sites with forty slightly different strings cannot be reviewed, and "has the number of
 * cross-tenant reads grown" becomes unanswerable.
 */
export const ELEVATION_SCOPES = [
  /** Read tenants across the platform — the admin approval queue, platform reporting. */
  'READ_ALL_TENANTS',
  /** Read one named tenant from a platform context — opening a single application. */
  'READ_ONE_TENANT',
  /** Reconciliation and settlement aggregates that span tenants by definition. */
  'READ_FINANCIAL_AGGREGATE',
  /** The audit explorer. */
  'READ_AUDIT',
] as const;

export type ElevationScope = (typeof ELEVATION_SCOPES)[number];

/** A named human being. `SUPPORT_IMPERSONATION` is deliberately absent — see the guard below. */
export interface HumanActor {
  readonly kind: 'HUMAN';
  readonly userId: string;
  /** The permission the actor exercised, recorded on the audit row (PE2). */
  readonly permission: string;
}

/** A scheduled job or a webhook. Named, so "which job read this" is answerable. */
export interface SystemActor {
  readonly kind: 'SYSTEM';
  /** The `§C5` job name or the provider. Never a person's name. */
  readonly label: string;
}

export type ElevationActor = HumanActor | SystemActor;

/**
 * Constructs a `NonEmptyReason`, or throws.
 *
 * Twenty characters, matching the `BR-DAT-02` floor for impersonation. "admin", "fix" and
 * "checking" are not reasons — the audit row exists so a cross-tenant read can be JUDGED later,
 * and it cannot be judged from a placeholder. The bar is deliberately high enough to be
 * annoying, because the alternative is a log full of the word "debug".
 */
export function reason(raw: string): NonEmptyReason {
  const trimmed = raw.trim();
  if (trimmed.length < 20) {
    throw new TypeError(
      `An elevation reason must be at least 20 characters; received ${trimmed.length}. ` +
        `A cross-tenant read with no stated reason is indistinguishable from an attack when ` +
        `somebody reads the audit log six months from now (FR-ADMN-02, PE-T9).`,
    );
  }
  return trimmed as NonEmptyReason;
}

/** True while a `runElevated` callback is on the stack. Used by the platform client's guard. */
const elevationStorage = new AsyncLocalStorage<PlatformContext>();

export function currentElevation(): PlatformContext | undefined {
  return elevationStorage.getStore();
}

export interface ElevationOptions {
  readonly reason: NonEmptyReason;
  readonly actor: ElevationActor;
  readonly scope: ElevationScope;
  /**
   * The entity the elevation is about, for the audit row's `entity_id`.
   *
   * Optional because `READ_ALL_TENANTS` is about no single entity — the approval queue spans
   * them. Where it IS about one, recording it turns "somebody looked at something" into
   * "somebody looked at THIS", which is the difference between an audit trail and a log.
   */
  readonly entityId?: string;
  readonly entityType?: string;
}

/**
 * Runs `fn` with cross-tenant read authority.
 *
 * The audit row is written FIRST and the elevation is abandoned if it fails — the opposite of
 * the `@Audited()` interceptor, which is best-effort. The asymmetry is deliberate: a failed
 * audit on an ordinary mutation costs one missing record, while a cross-tenant read that
 * happened with no record is the exact event the audit log exists for. Better to refuse.
 */
export async function runElevated<T>(
  audit: AuditWritePort,
  options: ElevationOptions,
  fn: (context: PlatformContext) => Promise<T>,
): Promise<T> {
  // Defensive re-check. `NonEmptyReason` makes an empty reason a compile error, and a cast
  // defeats any brand — so the runtime check is what actually holds at the boundary (AC-3).
  const statedReason = reason(options.reason);

  if (!ELEVATION_SCOPES.includes(options.scope)) {
    throw new TypeError(`Unknown elevation scope "${options.scope}".`);
  }

  const existing = currentTenantContext();

  // PE-T5 · Elevation is NEVER available from inside a tenant scope.
  //
  // An elevation begun inside one tenant's request is how a cross-tenant read gets attributed
  // to that request's actor and that tenant's context — the shape of an accidental privilege
  // escalation, and one that reads as ordinary code at the call site.
  if (isTenantScope(existing)) {
    throw new ElevationRefusedError(
      `a tenant context (${existing.tenantId}) is already open. Leave it first — an elevation ` +
        `begun inside one tenant's request attributes a cross-tenant read to that tenant`,
      options.scope,
    );
  }

  /*
   * ┌─ PE-T5 · NEVER DURING IMPERSONATION, AND THIS NOW ASKS THE RIGHT QUESTION ─────────────────┐
   * │ An agent acting AS a member must not reach beyond that member's tenant: the member could    │
   * │ not, and the agent is standing in for them. `AC-6` and `AC-AUTH-03.2`.                       │
   * │                                                                                            │
   * │ Until 2026-08-11 the only check was `options.actor.permission.startsWith('impersonation.')` │
   * │ — a string prefix on a caller-supplied field, which the comment here honestly called         │
   * │ *"the scaffolded principal … re-run against real roles in M-025"*. It answers a different    │
   * │ question from the one that matters: not *"is this session impersonated"* but *"did the       │
   * │ caller happen to name a permission beginning with those fourteen characters"*. Any elevation │
   * │ made under a borrowed identity while citing, say, `admin.tenant.read` passed it cleanly.     │
   * │                                                                                            │
   * │ `currentImpersonation()` reads the `AsyncLocalStorage` frame the request opened, so it is a  │
   * │ fact about the SESSION rather than about the argument. The prefix check is kept beneath it:  │
   * │ it catches a caller who states an impersonation permission outside a frame, which is a       │
   * │ differently-shaped mistake and still not something to elevate on.                            │
   * │                                                                                            │
   * │ `mayElevate()` is the pure predicate both halves come from, so `AC-6` has one definition.    │
   * └────────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const impersonation = currentImpersonation();
  if (impersonation !== null && !mayElevate('IMPERSONATION')) {
    throw new ElevationRefusedError(
      `an impersonation session by ${impersonation.impersonatorId} is open. An agent acting AS a ` +
        "member must not reach beyond that member's tenant — the member could not (AC-AUTH-03.2)",
      options.scope,
    );
  }

  if (options.actor.kind === 'HUMAN' && options.actor.permission.startsWith('impersonation.')) {
    throw new ElevationRefusedError(
      'the actor states an impersonation permission. An agent acting AS a member must not reach ' +
        "beyond that member's tenant — the member could not (AC-AUTH-03.2)",
      options.scope,
    );
  }

  // Narrowed through the discriminant rather than `?? actor.label`, which does not typecheck
  // and — more usefully — would have silently used a job label as a user id had it compiled.
  // The context's `actorId` is what lands on every audit row written inside the callback, so
  // conflating the two would attribute a job's reads to a user who does not exist.
  const actorId = options.actor.kind === 'HUMAN' ? options.actor.userId : null;
  const contextActor = options.actor.kind === 'HUMAN' ? options.actor.userId : options.actor.label;
  const context = platformScoped(contextActor, statedReason);

  const entry: AuditEntry = {
    // NULL: the whole point of an elevation is that it belongs to no single tenant.
    tenantId: null,
    actorId,
    actorType: options.actor.kind === 'HUMAN' ? 'PLATFORM_ADMIN' : 'JOB',
    actorLabel: options.actor.kind === 'SYSTEM' ? options.actor.label : null,
    entityType: options.entityType ?? 'TENANT',
    entityId: options.entityId ?? ZERO_UUID,
    action: 'ELEVATE',
    reason: statedReason,
    permission: options.actor.kind === 'HUMAN' ? options.actor.permission : null,
    elevationScope: options.scope,
    correlationId: currentCorrelationId(),
  };

  // BEFORE the work. If this throws, the elevation does not happen.
  await audit.append(entry);

  // Bounded to the callback. `elevationStorage.run` and the tenant-context frame both end when
  // `fn` resolves, so the next query on this request is tenant-scoped again (PE-T6).
  return elevationStorage.run(context, async () => runWithPlatformContext(context, fn));
}

/**
 * Enters the PLATFORM arm of the tenant-context union for the duration of `fn`.
 *
 * Separate from `runWithPlatformScope` in the ALS module because that one is the low-level
 * primitive with no audit and no actor validation. This is the only path application code may
 * take, and `no-platform-prisma-outside-allowlist` limits even this to four modules.
 */
async function runWithPlatformContext<T>(
  context: PlatformContext,
  fn: (context: PlatformContext) => Promise<T>,
): Promise<T> {
  const { runWithPlatformScope } = await import('../context/tenant-context.als.js');
  return runWithPlatformScope(context.actorId, context.reason, async () => fn(context));
}

/**
 * The all-zero UUID, for an elevation that is about no single entity.
 *
 * `entity_id` is NOT NULL on `audit_log` — deliberately, because a nullable entity id makes
 * "what was this about" unanswerable for the rows where it matters. A sentinel that is
 * obviously a sentinel is better than a null that could mean either "platform-wide" or
 * "somebody forgot".
 */
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
