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

import { AuthController } from './controllers/auth.controller.js';
import { SessionController } from './controllers/session.controller.js';
import { LoginWithPasswordUseCase } from './application/login-with-password.use-case.js';
import { RegisterWithPasswordUseCase } from './application/register-with-password.use-case.js';
import { ResetPasswordUseCase } from './application/reset-password.use-case.js';
import { VerifyEmailUseCase } from './application/verify-email.use-case.js';
import { OTP_DELIVERY, RequestOtpUseCase } from './application/request-otp.use-case.js';
import { VerifyOtpUseCase } from './application/verify-otp.use-case.js';
import { SessionUseCases } from './application/session.use-cases.js';
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
import { PERMISSION_CACHE } from './application/ports/permission-cache.port.js';
import { RedisPermissionCache } from './infrastructure/permission-cache.redis.js';
import {
  ChangeUserRoleUseCase,
  USER_ROLE_STORE,
} from './application/change-user-role.use-case.js';
import { UserRolePrismaRepository } from './infrastructure/user-role.prisma-repository.js';
import { APP_CONFIG, type AppConfig } from '../common/config/app-config.schema.js';
import { MFA_STORE } from './application/ports/mfa-store.port.js';
import { MfaPrismaRepository } from './infrastructure/mfa.prisma-repository.js';
import { AesGcmSecretCipher, SECRET_CIPHER } from './infrastructure/secret-cipher.js';
import { EnrolMfaUseCase } from './application/enrol-mfa.use-case.js';
import { VerifyMfaUseCase } from './application/verify-mfa.use-case.js';
import { DisableMfaUseCase } from './application/disable-mfa.use-case.js';
import { StartImpersonationUseCase } from './application/start-impersonation.use-case.js';
import { EndImpersonationUseCase } from './application/end-impersonation.use-case.js';
import { AccountActivityUseCase } from './application/account-activity.use-case.js';
import { FamilyDenylist } from '../common/auth/family-denylist.redis.js';
import { RedisLockoutCounter } from './infrastructure/redis-lockout-counter.adapter.js';
import { UserPrismaRepository } from './infrastructure/user.prisma-repository.js';
import { OtpRedisStore } from './infrastructure/otp.redis-store.js';
import { OtpDeliveryAdapter } from './infrastructure/otp-delivery.adapter.js';
import { JwtSignerAdapter } from './infrastructure/jwt.signer.adapter.js';
import { RefreshTokenPrismaRepository } from './infrastructure/refresh-token.prisma-repository.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  // M-021 needs the channel registry to deliver an OTP. `notifications/` remains the only
  // module that decides a channel (ModuleDependency.md §4.2) — `iam/` asks, through
  // OtpDeliveryAdapter, and owns only the SMS-then-email fallback POLICY that
  // AC-AUTH-01.5 states in authentication terms.
  imports: [NotificationsModule],
  controllers: [AuthController, SessionController],
  providers: [
    // The Redis connection and the family denylist are `CommonModule`'s — the guard needs them
    // on every request, so they belong to the kernel rather than to this module.

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

    OtpRedisStore,
    OtpDeliveryAdapter,
    { provide: OTP_DELIVERY, useExisting: OtpDeliveryAdapter },

    LoginWithPasswordUseCase,
    RegisterWithPasswordUseCase,
    ResetPasswordUseCase,
    VerifyEmailUseCase,
    RequestOtpUseCase,
    VerifyOtpUseCase,

    // M-022 · sessions. `JwtSignerAdapter` is NOT exported — a module holding the signer could
    // mint a token for any user and any role, which is every authorisation control bypassed.
    JwtSignerAdapter,
    RefreshTokenPrismaRepository,
    SessionUseCases,

    /*
     * ┌─ M-023 · AUTHORISATION. THESE THREE MUST LAND TOGETHER ────────────────────────────────┐
     * │ `ChangeUserRoleUseCase` injects `USER_ROLE_STORE`, and Nest instantiates module          │
     * │ providers EAGERLY — so listing the use case without a store bound to that token is a     │
     * │ hard boot failure ("Nest can't resolve dependencies … argument at index [0]"), and it    │
     * │ fails even though no controller consumes it yet. That is the correct behaviour and the   │
     * │ reason the wiring gap was invisible until now: the only caller was a unit test           │
     * │ constructing the class directly.                                                        │
     * │                                                                                        │
     * │ `REDIS_CLIENT` and `AUDIT_WRITE_PORT` need no new entry in `imports` — `CommonModule`    │
     * │ and `AuditModule` are each `@Global()` and each export their token, and two existing     │
     * │ adapters here already inject the Redis one.                                              │
     * └────────────────────────────────────────────────────────────────────────────────────────┘
     */
    RedisPermissionCache,
    { provide: PERMISSION_CACHE, useExisting: RedisPermissionCache },
    UserRolePrismaRepository,
    { provide: USER_ROLE_STORE, useExisting: UserRolePrismaRepository },
    ChangeUserRoleUseCase,

    /*
     * ┌─ M-024 · THE SECOND FACTOR ────────────────────────────────────────────────────────────┐
     * │ `AesGcmSecretCipher` is a FACTORY rather than a class provider: it takes key material,   │
     * │ not injectable dependencies, and its constructor refuses a key that is not 32 bytes. So  │
     * │ a misconfigured deployment fails at BOOT with a message naming the problem, instead of   │
     * │ starting and throwing on the first enrolment in front of a user.                          │
     * │                                                                                          │
     * │ Nothing here is exported. A module holding the cipher could decrypt every TOTP secret on │
     * │ the platform, which is every second factor at once.                                       │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    MfaPrismaRepository,
    { provide: MFA_STORE, useExisting: MfaPrismaRepository },
    {
      provide: SECRET_CIPHER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new AesGcmSecretCipher(config.MFA_SECRET_KEY, config.MFA_SECRET_KEY_ID),
    },
    EnrolMfaUseCase,
    VerifyMfaUseCase,
    DisableMfaUseCase,

    // M-025 · impersonation. `FamilyDenylist` is `common/`'s class rather than a port — the
    // kernel owns it so the guard can reach it on every request, and ending a session must use
    // the SAME denylist the verifier reads or the revocation would be invisible to it.
    FamilyDenylist,
    StartImpersonationUseCase,
    EndImpersonationUseCase,
    // `FR-USER-05`. Reads through `AUDIT_READ_PORT`, which `AuditModule` is @Global() and exports.
    AccountActivityUseCase,
  ],
  // Only the session repository leaves the module, and only because M-023's session-management
  // endpoints will need it. Nothing that can hash, mint a token or verify a password is
  // exported: a module holding the hasher could write a password bypassing the policy.
  exports: [AuthSessionPrismaRepository],
})
export class IamModule {}
