/**
 * M-010 · The `AsyncLocalStorage` carrier — §11.4.2 P5.
 *
 * ┌─ WHY ASYNCLOCALSTORAGE AND NOT A PARAMETER ─────────────────────────────────────────────────┐
 * │ Threading a tenant id through every call is the "explicit" design, and it fails for one     │
 * │ reason: it is opt-in. Every new method has to remember, and the one that forgets compiles   │
 * │ fine. §11.5 BR5 goes further and FORBIDS the parameter — a repository that takes a tenant   │
 * │ id can be passed the wrong one, and the resulting query is syntactically valid.             │
 * │                                                                                             │
 * │ ALS inverts that: the context is ambient, and code that forgets to establish it gets a      │
 * │ THROW rather than an unscoped query. Forgetting fails closed.                                │
 * │                                                                                              │
 * │ The cost is real and worth stating: an async boundary that escapes the `run()` callback     │
 * │ loses the frame. A `setTimeout`, an un-awaited promise, an EventEmitter listener registered │
 * │ inside a request and fired outside it — all of them see NONE. That is why                   │
 * │ MissingTenantContextError's diagnosis names those three specifically.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { TenantContextAlreadySetError } from '../domain/tenancy.errors.js';
import {
  NO_TENANT,
  isTenantScope,
  platformScoped,
  tenantScoped,
  type PlatformContext,
  type TenantContext,
} from './tenant-context.vo.js';
import type { TenantId } from '@gymmap/types';

const storage = new AsyncLocalStorage<TenantContext>();

/** The current context. `NONE` when nothing has established one — never `undefined`. */
export function currentTenantContext(): TenantContext {
  return storage.getStore() ?? NO_TENANT;
}

/**
 * Runs `fn` with the given tenant in scope.
 *
 * Re-entering the SAME tenant is permitted and does nothing — nested service calls do it
 * constantly and forbidding it would make every call site check first. Entering a DIFFERENT
 * tenant throws (`BR-TEN-02-N1`).
 */
export function runWithTenant<T>(tenantId: TenantId, fn: () => T, actorId?: string): T {
  const existing = currentTenantContext();

  if (isTenantScope(existing)) {
    if (existing.tenantId !== tenantId) {
      throw new TenantContextAlreadySetError(existing.tenantId, tenantId);
    }
    // Same tenant, already scoped. Run in the existing frame rather than nesting a new one:
    // an identical nested frame costs an ALS entry and buys nothing.
    return fn();
  }

  if (existing.kind === 'PLATFORM') {
    // Narrowing FROM platform scope TO a single tenant is legitimate and common — the admin
    // console lists applications across tenants, then opens one. The reverse is not, and is
    // blocked in runElevated (M-014).
    return storage.run(tenantScoped(tenantId, actorId ?? existing.actorId), fn);
  }

  return storage.run(tenantScoped(tenantId, actorId), fn);
}

/**
 * Runs `fn` with PLATFORM scope — a named, reasoned, audited elevation.
 *
 * The real `runElevated()` arrives in M-014 with the audit write and the `app_platform_ro`
 * role switch. This is the context half, so M-011 and M-012 have something to build against.
 *
 * Deliberately NOT callable from inside a tenant scope: an elevation that starts inside one
 * tenant's request is how a cross-tenant read gets attributed to the wrong actor, and it is
 * exactly the shape of an accidental privilege escalation.
 */
export function runWithPlatformScope<T>(
  actorId: string,
  reason: string,
  fn: (context: PlatformContext) => T,
): T {
  const existing = currentTenantContext();
  if (isTenantScope(existing)) {
    throw new TenantContextAlreadySetError(existing.tenantId, `PLATFORM(${reason})`);
  }
  const context = platformScoped(actorId, reason);
  return storage.run(context, () => fn(context));
}

/**
 * Runs `fn` with NO context, explicitly.
 *
 * For the genuinely tenant-free paths — health probes, the login endpoint before a tenant is
 * known, reference-data reads. Explicit rather than implicit so that "no context" is a decision
 * somebody made rather than a frame that was never entered.
 */
export function runWithoutTenant<T>(fn: () => T): T {
  return storage.run(NO_TENANT, fn);
}

/**
 * FOR TESTS ONLY. Clears the store for the duration of `fn`.
 *
 * Named this way so it is obvious in a diff. A production call site would be trying to escape
 * the tenant scope, which is the one thing this module exists to make impossible.
 */
export function unsafeRunWithoutContextForTests<T>(fn: () => T): T {
  return storage.exit(fn);
}
