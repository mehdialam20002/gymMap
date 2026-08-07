/**
 * M-020 · `iam/` — identity, RBAC and the password path.
 *
 * ┌─ `iam/` IS NOT TENANT-SCOPED, AND THAT IS DELIBERATE ───────────────────────────────────────┐
 * │ Every table this module owns is IDENTITY or GLOBAL (`Schema.md` §1.3), so none carries an    │
 * │ RLS policy and none is reached through `runInTenantTransaction`. A `TenantScopedRepository`  │
 * │ here would be actively wrong: `users` has no `tenant_id` to scope by, scoping `user_roles`   │
 * │ would hide every platform-role grant, and login runs BEFORE a tenant is known — the tenant  │
 * │ is a consequence of the roles the identity holds.                                            │
 * │                                                                                              │
 * │ What replaces tenancy as the control is AUTHORISATION: `user_id` on the row, plus the        │
 * │ permission the endpoint declares. A different mechanism with different failure modes, which │
 * │ is why §1.3 gives it its own class name rather than "RLS with an exception".                 │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE BREACH CHECKER IS BOUND TO A NO-OP THAT ANSWERS `UNAVAILABLE` ─────────────────────────┐
 * │ `BLK-09` / `KL-099`. `A-32` is `PROPOSED`, absent from `STACK_ADDITIONS.md`, and its number │
 * │ is claimed by three documents. `NoBreachCheckConfigured` never answers `NOT_BREACHED`, so   │
 * │ the gap is a counter in the logs rather than a stub reporting success.                       │
 * │                                                                                              │
 * │ Bound HERE rather than left unprovided: an unprovided token fails at boot, and the honest   │
 * │ state is that registration works and one advisory control does not.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Not `@Global()`. The cap is two — `CommonModule` and `TenancyModule` — and a third would make
 * "what does this module depend on" unanswerable from its imports.
 */

import { Module } from '@nestjs/common';

import { RedisConnectionLifecycle, redisProvider } from '../common/persistence/redis.provider.js';
import { AuthController } from './controllers/auth.controller.js';
import { LoginWithPasswordUseCase } from './application/login-with-password.use-case.js';
import { RegisterWithPasswordUseCase } from './application/register-with-password.use-case.js';
import { ResetPasswordUseCase } from './application/reset-password.use-case.js';
import { VerifyEmailUseCase } from './application/verify-email.use-case.js';
import {
  BREACHED_PASSWORD_CHECKER,
  NoBreachCheckConfigured,
} from './application/ports/breached-password.port.js';
import { CREDENTIAL_TOKEN_STORE } from './application/ports/credential-token-store.port.js';
import { LOCKOUT_COUNTER } from './application/ports/lockout-counter.port.js';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port.js';
import { Argon2HasherAdapter } from './infrastructure/argon2.hasher.adapter.js';
import { AuthSessionPrismaRepository } from './infrastructure/auth-session.prisma-repository.js';
import { RedisCredentialTokenStore } from './infrastructure/redis-credential-token.store.js';
import { RedisLockoutCounter } from './infrastructure/redis-lockout-counter.adapter.js';
import { UserPrismaRepository } from './infrastructure/user.prisma-repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    redisProvider,
    // Closes the connection on SIGTERM. Without it the process never exits — an ioredis
    // connection is an active handle, so a rolling deploy would hit its grace period and be
    // SIGKILLed, dropping in-flight requests every time.
    RedisConnectionLifecycle,

    // Repositories. `iam/` OWNS these tables, so they are classes and not ports — a port to
    // your own table is indirection with no seam in it.
    UserPrismaRepository,
    AuthSessionPrismaRepository,

    // Adapters, bound to their ports. Consumers inject the TOKEN, so a test substitutes a
    // double without a database or a Redis.
    Argon2HasherAdapter,
    { provide: PASSWORD_HASHER, useExisting: Argon2HasherAdapter },
    RedisLockoutCounter,
    { provide: LOCKOUT_COUNTER, useExisting: RedisLockoutCounter },
    RedisCredentialTokenStore,
    { provide: CREDENTIAL_TOKEN_STORE, useExisting: RedisCredentialTokenStore },
    { provide: BREACHED_PASSWORD_CHECKER, useClass: NoBreachCheckConfigured },

    LoginWithPasswordUseCase,
    RegisterWithPasswordUseCase,
    ResetPasswordUseCase,
    VerifyEmailUseCase,
  ],
  // Only the session repository leaves the module, and only because M-023's session-management
  // endpoints will need it. Nothing that can hash, mint a token or verify a password is
  // exported: a module holding the hasher could write a password bypassing the policy.
  exports: [AuthSessionPrismaRepository],
})
export class IamModule {}
