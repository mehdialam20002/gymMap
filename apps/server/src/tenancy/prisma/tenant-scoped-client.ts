/**
 * M-010 · THE TENANT-CONTEXT PRISMA EXTENSION — ADR-0005, A-01's approval condition.
 *
 * `SprintPlanning.md` calls this "the single highest-consequence task in the programme" (TR-01,
 * scored 15). `STACK_ADDITIONS.md` A-01 approved Prisma **conditionally on this existing**, so a
 * variant is a stack-approval breach rather than a design choice.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PROBLEM, PRECISELY
 *
 * RLS reads `current_setting('app.tenant_id')`, which is a property of a POSTGRES SESSION.
 * Prisma uses a connection POOL. Those two facts do not compose:
 *
 *     await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${id}, false)`  ← connection 7
 *     await prisma.gym.findMany()                                                 ← connection 3
 *
 * The second statement runs on a different connection, where `app.tenant_id` is unset. With the
 * strict policy this RAISES, which is the good outcome. But swap the order under load and
 * connection 7 goes back to the pool still carrying tenant A's id — and the next request, for
 * tenant B, gets tenant A's rows. Nothing throws. Nothing is logged. The response is a valid
 * page of somebody else's data.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE FIX, AND WHY EACH PART IS LOAD-BEARING
 *
 *  1. An INTERACTIVE TRANSACTION (`$transaction(async tx => …)`) pins one connection for its
 *     whole body. `set_config` and the query are then provably on the same backend — PX-1
 *     asserts `pg_backend_pid()` is identical at both points.
 *
 *  2. `set_config(..., true)` — the third argument is `is_local`. TRUE scopes the setting to the
 *     transaction, so COMMIT discards it. With `false` the setting is session-level and survives
 *     the connection's return to the pool, which is the leak above. PX-2 asserts the setting is
 *     gone after commit.
 *
 *  3. `$allModels.$allOperations`. Not a list of models: a model added tomorrow is protected the
 *     moment it exists (PX-5, P6). An allow-list here would be a file somebody forgets to edit,
 *     and the forgetting produces an unscoped model rather than an error.
 *
 *  4. `ADR-0004`: the POOLER must run in SESSION mode. A transaction-mode pooler can hand the
 *     `set_config` and the query to different server connections — PX-1's failure with a
 *     different actor. This file cannot defend against that; M-005 and the Terraform module must.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { Prisma, PrismaClient } from '@prisma/client';

import { currentTenantContext } from '../context/tenant-context.als.js';
import {
  isPlatformScope,
  isTenantScope,
  type TenantContext,
} from '../context/tenant-context.vo.js';
import { MissingTenantContextError, NestedTransactionError } from '../domain/tenancy.errors.js';

/**
 * Models that are NOT tenant-owned — the GLOBAL reference tables of §C2.3 plus infrastructure.
 *
 * Reading these needs no tenant, and requiring one would make the login page depend on knowing
 * who is logging in. Every entry is a table with no `tenant_id` column, which `rls-coverage.sql`
 * PC2 independently proves — so this list cannot drift into covering a tenant-owned table
 * without CI failing.
 */
export const GLOBAL_MODELS = new Set<string>([
  'Country',
  'City',
  'Locality',
  'Amenity',
  'GymCategory',
  'ReasonCode',
  'HelpArticle',
  'FeatureFlag',
  'NotificationTemplate',
  'SubscriptionTier',
  'TaxProfile',
  'KycChecklist',
  'CommissionRule',
  'ReportDefinition',
  'Role',
  'Permission',
  'RolePermission',
]);

/**
 * Models in the IDENTITY class — `Schema.md` §1.3. Also unscoped, for a DIFFERENT reason.
 *
 * ┌─ WHY THIS IS A SECOND SET AND NOT FOUR MORE LINES ABOVE ────────────────────────────────────┐
 * │ `GLOBAL_MODELS` rests on "there is no tenant_id here", and `rls-coverage.sql` PC2 proves it │
 * │ independently. Folding these in would make that sentence false: `UserRole` HAS a            │
 * │ `tenant_id`, and the reason it is unscoped is not that it lacks one.                        │
 * │                                                                                              │
 * │ The IDENTITY reason is different and worth keeping legible. These rows are scoped by        │
 * │ `user_id` and protected by AUTHORISATION, not by RLS (§1.3), and the tenant is a            │
 * │ CONSEQUENCE of the roles an identity holds — so it is not knowable at the moment they are   │
 * │ read. Login resolves an identity; the tenant follows from it.                                │
 * │                                                                                              │
 * │ M-020 found this by writing the endpoint: every `/v1/auth/*` route returned                  │
 * │ `TENANT_CONTEXT_MISSING`, because the extension wrapped a `users` lookup in a transaction   │
 * │ demanding an `app.tenant_id` that cannot exist before authentication. The whole auth track  │
 * │ is unbuildable without this distinction.                                                     │
 * │                                                                                              │
 * │ `UserRole` carrying a `tenant_id` and still being unscoped is the SAME reviewed exception   │
 * │ as `PC2-IDENTITY` in `rls-coverage.sql`: an RLS policy on it evaluates `NULL = <uuid>` for   │
 * │ every platform-role grant, making super-admins invisible to themselves. There is no policy  │
 * │ to enforce, so there is nothing for a scoped transaction to enforce it with.                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const IDENTITY_MODELS = new Set<string>([
  'User', // §4.6 — no tenant_id at all
  'UserRole', // §4.7 — HAS a tenant_id, no policy, the one reviewed exception
  'AuthSession', // §4.8
  'RefreshToken', // §4.8
]);

/** Reachable without a tenant context: GLOBAL reference data, or IDENTITY-class rows. */
export function isUnscopedModel(model: string): boolean {
  return GLOBAL_MODELS.has(model) || IDENTITY_MODELS.has(model);
}

/**
 * Depth guard for P4 — exactly one interactive transaction per unit of work.
 *
 * ┌─ THIS IS ASYNCLOCALSTORAGE, NOT A MODULE-LEVEL COUNTER. THE DIFFERENCE IS A REAL BUG. ─────┐
 * │ The obvious implementation is `let transactionDepth = 0`, and it is wrong the moment two   │
 * │ requests overlap — which is the normal state of a server.                                   │
 * │                                                                                             │
 * │ Request A enters its transaction and raises the counter. Request B, a completely unrelated │
 * │ request for a DIFFERENT tenant, then reads `depth > 0`, concludes it is already inside a   │
 * │ scoped transaction, and skips its own `set_config` — running its query on the base client  │
 * │ with no `app.tenant_id` at all.                                                             │
 * │                                                                                             │
 * │ Under the strict policy that RAISES rather than leaking, so it is a spurious 500 rather    │
 * │ than a breach. But it is a 500 whose frequency depends on concurrency, which makes it       │
 * │ invisible in development and constant under load — and the obvious "fix" for a mysterious  │
 * │ 42704 storm is to make the policy permissive.                                               │
 * │                                                                                             │
 * │ An ALS-scoped depth is per-async-context by construction: request B cannot see request A's │
 * │ frame. PX-3 (20 interleaved operations, two tenants, pool of 2) is the test that would have │
 * │ found this.                                                                                 │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const depthStorage = new AsyncLocalStorage<{ depth: number }>();

function currentDepth(): number {
  return depthStorage.getStore()?.depth ?? 0;
}

/**
 * Runs `fn` one level deeper.
 *
 * A mutable holder inside the frame rather than `run()` per level: the counter has to be
 * readable by code that is already inside the frame, and re-entering `run()` would create a
 * sibling frame whose parent is invisible.
 */
async function atDepth<T>(fn: () => Promise<T>): Promise<T> {
  const store = depthStorage.getStore();
  if (store) {
    store.depth += 1;
    try {
      return await fn();
    } finally {
      // `finally`, not after the await: a throw inside the body must not leave the depth
      // raised, or every later operation in this request silently skips its own scoping.
      store.depth -= 1;
    }
  }
  return depthStorage.run({ depth: 1 }, fn);
}

/** Exposed so a test can assert the guard resets even when the body throws. */
export function currentTransactionDepth(): number {
  return currentDepth();
}

/**
 * Wraps a client so that every operation on every model runs inside a tenant-scoped
 * transaction.
 *
 * Returns Prisma's extended-client type, which is structurally the client plus the extension —
 * so consumers keep full model typing and cannot tell they are talking to a wrapper.
 */
export function withTenantContext(client: PrismaClient) {
  return client.$extends({
    name: 'gymmap-tenant-context',
    query: {
      $allModels: {
        // Annotated rather than inferred. Prisma's `$extends` gives these `any` when the
        // extension is defined against the bare `PrismaClient` type, and `noImplicitAny` is
        // correct to object: an untyped `model` string is what a `GLOBAL_MODELS.has()` typo
        // would hide, and that typo produces an UNSCOPED model rather than a compile error.
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const context = currentTenantContext();

          // Reachable without a tenant, for two distinct reasons — see both sets.
          //
          //   GLOBAL   reference data with no tenant_id and no policy. Scoping it would be
          //            meaningless, and requiring a context would make `GET /v1/cities`
          //            unreachable before login.
          //   IDENTITY scoped by `user_id` and protected by authorisation (Schema.md §1.3).
          //            The tenant is a CONSEQUENCE of the roles an identity holds, so it
          //            cannot be known at the moment these rows are read — which is why
          //            every /v1/auth/* route 500'd with TENANT_CONTEXT_MISSING until M-020.
          if (isUnscopedModel(model)) return query(args);

          // Already inside our transaction: `set_config` has run on this connection, and
          // re-entering would open a savepoint that inherits the outer scope while looking
          // independent (PX-6). Read from ALS, so a concurrent request cannot see this frame.
          if (currentDepth() > 0) return query(args);

          return runScoped(client, context, model, operation, args);
        },
      },
    },
  });
}

/**
 * Opens the interactive transaction, sets the context, and RE-DISPATCHES the operation onto the
 * transactional client.
 *
 * ┌─ WHY RE-DISPATCH RATHER THAN CALL `query(args)` ───────────────────────────────────────────┐
 * │ The obvious implementation is:                                                              │
 * │                                                                                             │
 * │     client.$transaction(async tx => {                                                       │
 * │       await tx.$executeRaw`SELECT set_config(...)`;                                         │
 * │       return query(args);          // ← WRONG                                               │
 * │     })                                                                                      │
 * │                                                                                             │
 * │ It does not work, and it took a failing test to see why. `query` is bound to the client the │
 * │ operation was invoked on — NOT to `tx`. So `set_config` runs on the transaction's pinned    │
 * │ connection and the query runs on whatever the pool hands out next. Exactly the split PX-1   │
 * │ exists to detect.                                                                            │
 * │                                                                                             │
 * │ What saved it was the strict policy: `current_setting('app.tenant_id')` with no missing_ok  │
 * │ raised SQLSTATE 42704 on every read. Every query failed loudly. Had the policy been written │
 * │ permissively — the trap M-009 names — the same bug would have returned an empty result set  │
 * │ instead, and it would have looked like "no data yet" rather than a broken extension.        │
 * │                                                                                             │
 * │ Re-dispatching `tx[model][operation](args)` puts the query on the SAME pinned connection.   │
 * │ `tx` comes from the BASE client, so this does not re-enter the extension.                   │
 * └─────────────────────────────────────────────────────────────────────────────────────────────┘
 */
async function runScoped(
  client: PrismaClient,
  context: TenantContext,
  model: string,
  operation: string,
  args: unknown,
): Promise<unknown> {
  if (context.kind === 'NONE') {
    // THROW. Not "run unfiltered", and not "run and return nothing".
    //
    // Running unfiltered is the breach. Returning nothing is WORSE, because an empty result set
    // is indistinguishable from a correct answer — nobody investigates, and the fix somebody
    // eventually applies is to widen the policy.
    throw new MissingTenantContextError(model, operation);
  }

  const tenantId = isTenantScope(context) ? context.tenantId : null;

  return atDepth(async () =>
    client.$transaction(async (tx: Prisma.TransactionClient) => {
      if (!isPlatformScope(context)) {
        // `set_config(key, value, is_local)`. The third argument is the whole design.
        //
        // TRUE  → scoped to this transaction; COMMIT discards it; the connection returns to
        //         the pool clean.
        // FALSE → session-level; survives into the next request on this connection, which is
        //         precisely the cross-tenant leak.
        //
        // Platform scope deliberately sets NOTHING: cross-tenant reads are permitted by the
        // `rls_<table>__platform_read` policy, bound to `app_platform_ro` and SELECT-only at
        // the database level, so an accidental write there fails in Postgres rather than in a
        // code review. M-014 adds the role switch and the audit row.
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;
      }

      return await dispatchOnTransaction(tx, model, operation, args);
    }),
  );
}

/**
 * Invokes `tx.<model>.<operation>(args)`.
 *
 * The extension callback gives `model` in PascalCase (`Tenant`) while the client property is
 * camelCase (`tenant`), so the first character is lowered. Getting that wrong yields
 * `undefined` and a `TypeError` rather than a silent miss — which is the right failure, but
 * only because the delegate lookup is checked below rather than assumed.
 */
async function dispatchOnTransaction(
  tx: Prisma.TransactionClient,
  model: string,
  operation: string,
  args: unknown,
): Promise<unknown> {
  const property = model.charAt(0).toLowerCase() + model.slice(1);
  const delegate = (tx as unknown as Record<string, Record<string, unknown>>)[property];

  if (!delegate || typeof delegate[operation] !== 'function') {
    // Never swallowed. A model or operation the transactional client does not expose means the
    // extension's assumption about Prisma's shape has broken — and silently falling back to the
    // unscoped client would turn a broken assumption into an unscoped query.
    throw new TypeError(
      `The tenant-context extension cannot dispatch ${model}.${operation} onto the ` +
        `transactional client (looked for tx.${property}.${operation}). Prisma's client shape ` +
        `has changed; the extension must be updated rather than bypassed.`,
    );
  }

  return (delegate[operation] as (a: unknown) => Promise<unknown>)(args);
}

/**
 * Opens ONE interactive transaction for a whole unit of work — §11.4.2 P4.
 *
 * Use this when several operations must commit together. Without it, each operation opens its
 * own transaction and a failure halfway through leaves the earlier ones committed.
 *
 * A nested call throws (PX-6): a nested `$transaction` is a SAVEPOINT sharing the outer
 * connection and therefore the outer `app.tenant_id`, while reading like an independent
 * boundary — and each interactive transaction holds a pooled connection for its full lifetime,
 * so nesting multiplies the hold and is the fastest way to exhaust the pool.
 */
export async function runInTenantTransaction<T>(
  client: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { readonly timeoutMs?: number } = {},
): Promise<T> {
  if (currentDepth() > 0) throw new NestedTransactionError();

  const context = currentTenantContext();
  if (context.kind === 'NONE') {
    throw new MissingTenantContextError('$transaction', 'unitOfWork');
  }

  return atDepth(async () =>
    client.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (isTenantScope(context)) {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}::text, true)`;
        }
        return await fn(tx);
      },
      {
        // An interactive transaction holds a connection for its entire body, so an unbounded
        // one is a leaked connection. TR-37: the timeout is a pool-protection control, not a
        // performance setting.
        timeout: options.timeoutMs ?? 10_000,
        maxWait: 5_000,
      },
    ),
  );
}
