/**
 * M-020 · "Build the module graph, connect to nothing" — the OpenAPI emitter's mode.
 *
 * ┌─ THE DEFECT THIS FIXES HAD BEEN LIVE SINCE M-010 ───────────────────────────────────────────┐
 * │ `openapi:emit` boots the real `AppModule` against placeholder credentials, because a route  │
 * │ contract should be generable on a machine with no database. That worked until `M-010` added │
 * │ `TenancyModule`, whose three Prisma services all `$connect()` in `onModuleInit`.             │
 * │                                                                                              │
 * │ From that point the emitter died on                                                          │
 * │   "Authentication failed against database server ... credentials for `openapi` are not      │
 * │    valid"                                                                                    │
 * │ and `openapi.json` stopped being regenerable. It was last written at M-012 and still         │
 * │ described only `/healthz`, `/readyz` and the two ping routes.                                │
 * │                                                                                              │
 * │ NOTHING CAUGHT IT. `ci:api-gates` reads the DECORATORS in source, not the emitted document, │
 * │ so every gate stayed green while the published contract fell eight milestones behind. The    │
 * │ document is what a client generator consumes — a stale one is an SDK missing every route     │
 * │ added since.                                                                                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY A FLAG RATHER THAN "TOLERATE A FAILED CONNECT" ────────────────────────────────────────┐
 * │ Making `$connect()` failures non-fatal everywhere would be the smaller diff and the worse   │
 * │ change: a deployed instance that cannot reach PostgreSQL would then start, pass its          │
 * │ liveness probe, and serve 500s. Failing fast at boot is the correct behaviour and must stay │
 * │ the default.                                                                                 │
 * │                                                                                              │
 * │ So the emitter says so explicitly, once, and `assertNotDeployed()` refuses to let the flag  │
 * │ survive into an environment where it would be dangerous.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Logger } from '@nestjs/common';

/** Set only by `common/openapi/emit.ts`. Never in `.env.example`, never in a compose file. */
export const CONTRACT_ONLY_ENV = 'GYMMAP_CONTRACT_ONLY';

/**
 * True when this process exists solely to produce the OpenAPI document.
 *
 * In that mode a service builds its client but does NOT open a connection — the document is
 * derived from decorators and DTOs, and no route is ever invoked.
 */
export function isContractOnly(): boolean {
  return process.env[CONTRACT_ONLY_ENV] === '1';
}

/**
 * Skips an eager connect in contract-only mode, and refuses to do so anywhere deployed.
 *
 * Returns `true` when the caller should skip. The `APP_ENV` check is the guard rail: the flag is
 * only ever set by a build-time script, and if it somehow reaches a running deployment the
 * process must fail loudly rather than start with no database and serve 500s.
 */
export function skipEagerConnect(appEnv: string, what: string): boolean {
  if (!isContractOnly()) return false;

  if (appEnv === 'staging' || appEnv === 'production') {
    throw new Error(
      `${CONTRACT_ONLY_ENV}=1 in APP_ENV=${appEnv}. That flag suppresses the database connect ` +
        'at boot, which exists so an instance that cannot reach PostgreSQL fails immediately ' +
        'instead of starting, passing its liveness probe and serving 500s. It is set by the ' +
        'OpenAPI emitter and must never be set on a running server.',
    );
  }

  new Logger('ContractOnly').log(
    `${what}: client built, connection NOT opened — generating the API contract only.`,
  );
  return true;
}
