/**
 * M-020 · The four password routes — `Authentication.md` §8.3, §8.4, §8.7, §8.8.
 *
 * ┌─ ALL FOUR ARE `@Public()`, AND ALL FOUR HAVE A ROW IN THE ALLOWLIST ────────────────────────┐
 * │ They must be: nobody can authenticate before they have authenticated. `PG-1` fails a        │
 * │ `@Public()` route with no entry in `common/openapi/public-allowlist.ts`, which is the file  │
 * │ a human reviews — the decorator is what the guard reads, the allowlist is what somebody     │
 * │ argues about.                                                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE RESPONSE FOR A FAILED LOGIN AND AN UNKNOWN ACCOUNT IS THE SAME OBJECT ─────────────────┐
 * │ Not "similar". The same status, the same code, the same message, produced by the same       │
 * │ throw. There is no branch here that could diverge, because the use case raises one          │
 * │ exception type for both and `iam.errors.ts` defines no other.                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ NOTHING HERE RETURNS A TOKEN, AND THAT IS BECAUSE M-020 DOES NOT ISSUE ONE ────────────────┐
 * │ `login` proves the credential and returns the authenticated user's id. Session creation,    │
 * │ the `__Host-gm_at` cookie and rotation are M-022's (`SE1`, `TK7`, ADR-0011). Returning a    │
 * │ bearer string in a body would also violate `SE1` outright — tokens travel as cookies.        │
 * │                                                                                              │
 * │ So this milestone's login is verifiable and not yet useful, which is the honest shape of a  │
 * │ half-built auth track. The feature flag keeps the routes off until it is whole.              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Body, Controller, Delete, HttpCode, HttpStatus, Ip, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  forgotPasswordBody,
  loginBody,
  otpRequestBody,
  otpVerifyBody,
  registerBody,
  impersonateBody,
  mfaDisableBody,
  mfaEnrolBody,
  mfaVerifyBody,
  resetPasswordBody,
  type ForgotPasswordBody,
  type LoginBody,
  type OtpRequestBody,
  type OtpVerifyBody,
  type RegisterBody,
  type ImpersonateBody,
  type MfaDisableBody,
  type MfaEnrolBody,
  type MfaVerifyBody,
  type ResetPasswordBody,
} from '@gymmap/types';

import { UnauthenticatedException } from '../../common/errors/domain-exception.js';
import { EmitsErrors } from '../../common/decorators/emits-errors.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequiredPermission } from '../../common/decorators/required-permission.decorator.js';
import { MfaExempt } from '../../common/guards/mfa.guard.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { zodPipe } from '../../common/validation/zod-validation.pipe.js';
import { OTP_TTL_SECONDS } from '../domain/otp.policy.js';
import { LoginWithPasswordUseCase } from '../application/login-with-password.use-case.js';
import { RegisterWithPasswordUseCase } from '../application/register-with-password.use-case.js';
import { ResetPasswordUseCase } from '../application/reset-password.use-case.js';
import { RequestOtpUseCase } from '../application/request-otp.use-case.js';
import { VerifyOtpUseCase } from '../application/verify-otp.use-case.js';
import { SessionUseCases } from '../application/session.use-cases.js';
import { EnrolMfaUseCase } from '../application/enrol-mfa.use-case.js';
import { VerifyMfaUseCase } from '../application/verify-mfa.use-case.js';
import { DisableMfaUseCase } from '../application/disable-mfa.use-case.js';
import { StartImpersonationUseCase } from '../application/start-impersonation.use-case.js';
import { EndImpersonationUseCase } from '../application/end-impersonation.use-case.js';
import { UserPrismaRepository } from '../infrastructure/user.prisma-repository.js';
import { IAM_PERMISSIONS } from '../permissions.js';
import { parseRoleGrants } from '../domain/effective-permissions.js';
import { setRefreshCookie } from './refresh-cookie.js';
import { requestFacts } from './request-facts.js';
import { currentCorrelationId } from '../../common/logging/correlation.als.js';

/** `Authentication.md` §8.7 — one message for both branches, so the two are indistinguishable. */
const FORGOT_ACKNOWLEDGEMENT =
  'If an account exists for that address, a password reset link has been sent. ' +
  'The link is valid for 30 minutes.';

@ApiTags('iam')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly register: RegisterWithPasswordUseCase,
    private readonly login: LoginWithPasswordUseCase,
    private readonly reset: ResetPasswordUseCase,
    private readonly requestOtp: RequestOtpUseCase,
    private readonly verifyOtp: VerifyOtpUseCase,
    private readonly sessions: SessionUseCases,
    private readonly enrolMfa: EnrolMfaUseCase,
    private readonly verifyMfa: VerifyMfaUseCase,
    private readonly disableMfa: DisableMfaUseCase,
    private readonly users: UserPrismaRepository,
    private readonly startImpersonation: StartImpersonationUseCase,
    private readonly endImpersonation: EndImpersonationUseCase,
  ) {}

  @Post('register')
  @Public()
  @RateLimit('RL-AUTH')
  @EmitsErrors(
    'VALIDATION_FAILED',
    'EMAIL_ALREADY_REGISTERED',
    'PHONE_ALREADY_REGISTERED',
    'PASSWORD_BREACHED',
    'RATE_LIMIT_EXCEEDED',
    'DEPENDENCY_UNAVAILABLE',
  )
  @ApiOperation({
    summary: 'Registers an account with a password.',
    description:
      'At least one of email or phone is required — an India walk-in member may have only a ' +
      'phone (FR-CRM-04). The account is created PENDING_VERIFICATION; an email registration ' +
      'receives a verification link valid for 24 hours. No session is created: verifying an ' +
      'email must not sign anyone in, because the link travels through an inbox.',
  })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'PENDING_VERIFICATION' },
        verification_sent: { type: 'boolean' },
      },
    },
  })
  async registerAccount(
    @Body(zodPipe(registerBody)) body: RegisterBody,
  ): Promise<{ user_id: string; status: string; verification_sent: boolean }> {
    const result = await this.register.execute({
      email: body.email ?? null,
      phone: body.phone ?? null,
      fullName: body.full_name ?? null,
      password: body.password,
    });

    // The token is NOT in the response. It goes to `notifications/`, which is the only module
    // permitted to decide a channel and resolve an address (ModuleDependency.md §4.2) — and a
    // verification token in a response body is a link anyone who can read the response can use.
    return {
      user_id: result.userId,
      status: 'PENDING_VERIFICATION',
      verification_sent: result.verificationToken !== null,
    };
  }

  @Post('login')
  @Public()
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.OK)
  @EmitsErrors(
    'VALIDATION_FAILED',
    'UNAUTHENTICATED',
    'ACCOUNT_LOCKED',
    'RATE_LIMIT_EXCEEDED',
    'DEPENDENCY_UNAVAILABLE',
  )
  @ApiOperation({
    summary: 'Verifies a password.',
    description:
      'Returns 401 UNAUTHENTICATED for an unknown identifier AND for a wrong password — the ' +
      'same status, the same code, the same message and the same latency (Security.md §1.6). ' +
      'A locked account is 403 ACCOUNT_LOCKED, never 429: a lockout is about this account and ' +
      'clears with an unlock, while a 429 tells the victim of credential stuffing to try again ' +
      'in a minute. On success a session is opened (M-022): the ACCESS token is returned here ' +
      'because the SPA must place it in an Authorization header, while the 30-day REFRESH token ' +
      'is set as an httpOnly cookie and never appears in this body (SE1, TK7, ADR-0011).',
  })
  @ApiOkResponse({
    description:
      'Sets the `__Host-gm_rt` refresh cookie — httpOnly, Secure, SameSite=Strict, path `/`.',
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid' },
        access_token: { type: 'string' },
        expires_in_seconds: { type: 'integer', example: 900 },
      },
    },
  })
  async loginWithPassword(
    @Body(zodPipe(loginBody)) body: LoginBody,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user_id: string; access_token: string; expires_in_seconds: number }> {
    const result = await this.login.execute({
      identifier: body.identifier,
      password: body.password,
    });

    // M-022 · the credential is proved, so a session opens here.
    //
    // The REFRESH token goes into an httpOnly cookie and never into this body (`SE1`, `TK7`) —
    // it is a 30-day credential, and JavaScript must not be able to read it. The ACCESS token
    // DOES come back in the body: it lives fifteen minutes and the SPA has to put it in an
    // Authorization header, so there is nowhere else for it to go.
    const issued = await this.sessions.issueFor(result.userId, requestFacts(request));
    setRefreshCookie(response, issued.refreshToken);

    return {
      user_id: result.userId,
      access_token: issued.accessToken,
      expires_in_seconds: this.sessions.secondsUntil(issued.accessExpiresAt),
    };
  }

  @Post('password/forgot')
  @Public()
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.ACCEPTED)
  @EmitsErrors('VALIDATION_FAILED', 'RATE_LIMIT_EXCEEDED', 'DEPENDENCY_UNAVAILABLE')
  @ApiOperation({
    summary: 'Requests a password reset link.',
    description:
      'ALWAYS 202, whether or not the address is known. The caller here is guessing rather ' +
      'than asserting, so a differing status, body or latency would be an account-existence ' +
      'oracle over any address anyone cares to try — the unknown path performs equivalent work.',
  })
  @ApiAcceptedResponse({
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  async forgotPassword(
    @Body(zodPipe(forgotPasswordBody)) body: ForgotPasswordBody,
  ): Promise<{ message: string }> {
    // The result is DISCARDED. Reading it here to vary the response is the one change that
    // would undo the whole design of this endpoint.
    await this.reset.requestReset(body.identifier);
    return { message: FORGOT_ACKNOWLEDGEMENT };
  }

  @Post('password/reset')
  @Public()
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.OK)
  @EmitsErrors(
    'VALIDATION_FAILED',
    'RESET_TOKEN_INVALID',
    'PASSWORD_BREACHED',
    'RATE_LIMIT_EXCEEDED',
    'DEPENDENCY_UNAVAILABLE',
  )
  @ApiOperation({
    summary: 'Completes a password reset.',
    description:
      'Revokes EVERY session for the account in the same transaction as the password write ' +
      '(FR-AUTH-10). Authentication.md §8.8: not revoking "is not a compatibility question" — ' +
      'a reset exists for the case where someone else is in the account, and changing the ' +
      'password without ending their session changes nothing for them.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { sessions_revoked: { type: 'integer', example: 3 } },
    },
  })
  async resetPassword(
    @Body(zodPipe(resetPasswordBody)) body: ResetPasswordBody,
  ): Promise<{ sessions_revoked: number }> {
    const result = await this.reset.reset(body.token, body.new_password);
    // The count is returned because §8.8 asks for it, and because "3 other devices were signed
    // out" is how a member notices the one they do not recognise.
    return { sessions_revoked: result.sessionsRevoked };
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // M-021 · phone OTP — the FR-AUTH-01 consumer default in the launch market.
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('otp/request')
  @Public()
  @RateLimit('RL-OTP')
  @HttpCode(HttpStatus.ACCEPTED)
  @EmitsErrors(
    'VALIDATION_FAILED',
    'OTP_RESEND_LIMIT_REACHED',
    'OTP_RESEND_TOO_SOON',
    'CAPTCHA_REQUIRED',
    'RATE_LIMIT_EXCEEDED',
    'DEPENDENCY_UNAVAILABLE',
  )
  @ApiOperation({
    summary: 'Sends a six-digit code to an Indian mobile number.',
    description:
      'ALWAYS 202 for a well-formed number, whether or not it has an account — the same status, ' +
      'body and latency. §8.1 calls a 404 here forbidden rather than merely breaking: it would ' +
      'be an existence oracle over every mobile number in India. Five limits apply: 6 digits, ' +
      '300s validity, 5 verify attempts, 3 sends per 30 minutes per number with a 30s cool-down, ' +
      'and 20 operations per hour per IP with a captcha demanded from the 11th. The per-number ' +
      'and per-IP ceilings are INDEPENDENT — one protects the member from being SMS-bombed, the ' +
      'other protects the platform from a ₹0.15-a-message bill (CON-02).',
  })
  @ApiAcceptedResponse({
    schema: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: ['SMS', 'EMAIL'] },
        fallback: { type: 'string', enum: ['EMAIL'], nullable: true },
        expires_in_seconds: { type: 'integer', example: 300 },
      },
    },
  })
  async requestOtpCode(
    @Body(zodPipe(otpRequestBody)) body: OtpRequestBody,
    @Ip() ip: string,
  ): Promise<{ channel: string; fallback: string | null; expires_in_seconds: number }> {
    const result = await this.requestOtp.execute({
      phone: body.phone,
      purpose: body.purpose,
      ip,
      // Verification of the token itself arrives with the captcha provider. Presence is what
      // §8.1's validation table gates on today, and treating an unverified token as satisfied
      // would make the threshold decorative — recorded as the reason this is not `!== undefined`
      // alone once a provider exists.
      captchaSatisfied: typeof body.captcha_token === 'string' && body.captcha_token.length > 0,
    });

    // A RELATIVE expiry, not an absolute timestamp. A client with a skewed clock renders an
    // absolute one wrongly, and the member is told a code expired that has not.
    return {
      channel: result.channel,
      fallback: result.fallback,
      expires_in_seconds: OTP_TTL_SECONDS,
    };
  }

  @Post('otp/verify')
  @Public()
  @RateLimit('RL-OTP')
  @HttpCode(HttpStatus.OK)
  @EmitsErrors(
    'VALIDATION_FAILED',
    'OTP_INVALID',
    'OTP_EXPIRED',
    'OTP_ATTEMPTS_EXCEEDED',
    'RATE_LIMIT_EXCEEDED',
  )
  @ApiOperation({
    summary: 'Verifies a six-digit code.',
    description:
      'Single-use: the code is compared and consumed in ONE atomic Redis operation, so five ' +
      'simultaneous submissions yield exactly one verification. A wrong code returns 400 with ' +
      'attempts_remaining (AC-AUTH-01.3) and does NOT consume the challenge; the fifth wrong ' +
      'attempt destroys it. NO SESSION IS ISSUED — an SMS is the channel most exposed to ' +
      'interception, and session creation is M-022 (ADR-0011).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        user_id: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  async verifyOtpCode(
    @Body(zodPipe(otpVerifyBody)) body: OtpVerifyBody,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    verified: boolean;
    user_id: string | null;
    access_token: string | null;
    expires_in_seconds: number | null;
  }> {
    const result = await this.verifyOtp.execute({
      phone: body.phone,
      purpose: body.purpose,
      code: body.code,
    });

    // A session opens ONLY for a purpose that is a way IN, and only when the number resolves to
    // an account. A REGISTER verification proves control of the number and nothing more — the
    // account does not exist yet — and PHONE_CHANGE and SENSITIVE_STEP_UP are re-proofs inside
    // a session that already exists. Minting one for those would turn a re-proof into a
    // second way in.
    const opensSession =
      result.userId !== null && (body.purpose === 'LOGIN' || body.purpose === 'UNLOCK');

    if (!opensSession || result.userId === null) {
      return {
        verified: true,
        user_id: result.userId,
        access_token: null,
        expires_in_seconds: null,
      };
    }

    const issued = await this.sessions.issueFor(result.userId, requestFacts(request));
    setRefreshCookie(response, issued.refreshToken);

    return {
      verified: true,
      user_id: result.userId,
      access_token: issued.accessToken,
      expires_in_seconds: this.sessions.secondsUntil(issued.accessExpiresAt),
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // M-024 · the second factor — `FR-AUTH-07`, `NFR-SEC-11`, `Security.md` §2.8
  //
  // ┌─ NOT `@Public()`, AND `@MfaExempt()` ON EVERY ONE ────────────────────────────────────────┐
  // │ Authenticated: you cannot enrol a factor for an account you have not signed into. But also  │
  // │ exempt from `MfaGuard`, because a staff account with no enrolment must be able to REACH     │
  // │ these — §2.8: it "can reach ONLY `/auth/mfa/enrol`". Without the exemption the mandate       │
  // │ locks every unenrolled staff member out of the only route that could fix it.                 │
  // │                                                                                            │
  // │ The exemption is per-route rather than on the class, so a future `/auth/*` route does not    │
  // │ inherit it by sitting in the same file.                                                      │
  // └────────────────────────────────────────────────────────────────────────────────────────────┘
  // ═════════════════════════════════════════════════════════════════════════

  @Post('mfa/enrol')
  @MfaExempt()
  @RequiredPermission(IAM_PERMISSIONS.OWN_MFA_ENROL)
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.OK)
  @EmitsErrors('MFA_NOT_AVAILABLE_FOR_ROLE', 'MFA_VERIFICATION_FAILED', 'UNAUTHENTICATED')
  @ApiOperation({
    summary: 'Begin TOTP enrolment',
    description:
      'Re-authenticates with the password, mints a secret and returns a provisioning URI. The ' +
      'factor is NOT active until POST /auth/mfa/verify confirms it with a live code.',
  })
  async beginMfaEnrolment(
    @Req() request: Request,
    @Body(zodPipe(mfaEnrolBody)) body: MfaEnrolBody,
  ): Promise<{ provisioning_uri: string }> {
    const principal = mfaPrincipalOf(request);

    const result = await this.enrolMfa.begin({
      userId: principal.sub,
      // The label an authenticator shows. `sub` would be a uuid, which tells the account holder
      // nothing when they have three entries in their app.
      accountLabel: principal.email ?? principal.sub,
      roles: parseRoleGrants(principal.roles).map((grant) => grant.role),
      password: body.password,
      storedPasswordHash: await this.users.passwordHashFor(principal.sub),
      correlationId: currentCorrelationId(),
    });

    // The secret is INSIDE this URI. Returned once, never logged, never persisted client-side —
    // `Security.md` classifies it C5 and Pino's redaction list does not know this shape.
    return { provisioning_uri: result.provisioningUri };
  }

  @Post('mfa/verify')
  @MfaExempt()
  @RequiredPermission(IAM_PERMISSIONS.OWN_MFA_VERIFY)
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.OK)
  @EmitsErrors('MFA_VERIFICATION_FAILED', 'UNAUTHENTICATED')
  @ApiOperation({
    summary: 'Confirm enrolment, or present the second factor',
    description:
      'One endpoint for both, and for both a TOTP code and a recovery code. Splitting them would ' +
      'split the lockout budget, so an attacker who exhausts one could simply move to the other.',
  })
  async verifyMfaCode(
    @Req() request: Request,
    @Body(zodPipe(mfaVerifyBody)) body: MfaVerifyBody,
  ): Promise<Record<string, unknown>> {
    const principal = mfaPrincipalOf(request);
    const correlationId = currentCorrelationId();

    /*
     * Confirmation FIRST, and only when there is a pending enrolment to confirm.
     *
     * The two paths are told apart by state rather than by a flag in the body: a client that could
     * choose would be able to send `mode: "login"` during enrolment and skip the confirmation step
     * entirely, which is the step that stops people locking themselves out.
     */
    const state = await this.verifyMfa.stateFor(principal.sub);
    if (state !== null && !state.enabled && state.secretEnvelope !== null) {
      const confirmed = await this.enrolMfa.confirm({
        userId: principal.sub,
        code: body.code,
        correlationId,
      });

      // The ONLY time these are ever returned. There is no endpoint that re-reads them, because
      // only the Argon2id hashes are stored.
      return { enrolled: true, recovery_codes: confirmed.recoveryCodes };
    }

    const result = await this.verifyMfa.execute({
      userId: principal.sub,
      submitted: body.code,
      correlationId,
    });

    return {
      verified: true,
      method: result.method,
      recovery_codes_remaining: result.recoveryCodesRemaining,
      should_regenerate_recovery_codes: result.shouldRegenerateRecoveryCodes,
    };
  }

  @Delete('mfa')
  @MfaExempt()
  @RequiredPermission(IAM_PERMISSIONS.OWN_MFA_DISABLE)
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmitsErrors('MFA_MANDATORY_FOR_ROLE', 'MFA_VERIFICATION_FAILED', 'UNAUTHENTICATED')
  @ApiOperation({
    summary: 'Remove the second factor',
    description:
      'Refused with 422 MFA_MANDATORY_FOR_ROLE for platform staff — the factor is mandatory, so ' +
      'this is not an operation the domain offers, which is a different thing from a 403.',
  })
  async removeMfa(
    @Req() request: Request,
    @Body(zodPipe(mfaDisableBody)) body: MfaDisableBody,
  ): Promise<void> {
    const principal = mfaPrincipalOf(request);

    await this.disableMfa.execute({
      userId: principal.sub,
      roles: parseRoleGrants(principal.roles).map((grant) => grant.role),
      password: body.password,
      storedPasswordHash: await this.users.passwordHashFor(principal.sub),
      correlationId: currentCorrelationId(),
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // M-025 · impersonation — `FR-AUTH-12`, `Authentication.md` §8.14, §8.15
  // ═════════════════════════════════════════════════════════════════════════

  @Post('impersonate')
  @MfaExempt()
  @RequiredPermission(IAM_PERMISSIONS.IMPERSONATION_START)
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.OK)
  // `UNAUTHENTICATED` and `PERMISSION_DENIED` were missing, and rbac.contract-spec.ts caught it.
  // The route is guarded — `iam.impersonation.start` is SUPPORT_AGENT and SUPER_ADMIN only — so a
  // client generated from the document had no branch for the refusal it will actually meet.
  @EmitsErrors('IMPERSONATION_REFUSED', 'UNAUTHENTICATED', 'PERMISSION_DENIED')
  @ApiOperation({
    summary: 'Act as another user, briefly and with a reason',
    description:
      "Returns a token of a DISTINCT type that carries the intersection of the agent's and the " +
      "subject's permissions, expires within 30 minutes, and can execute no financial mutation.",
  })
  async impersonate(
    @Req() request: Request,
    @Body(zodPipe(impersonateBody)) body: ImpersonateBody,
  ): Promise<{ token: string; expires_at: string; effective_permissions: readonly string[] }> {
    const principal = mfaPrincipalOf(request);

    /*
     * `@MfaExempt()` and that is NOT a hole worth closing here.
     *
     * Only `SUPPORT_AGENT` and `SUPER_ADMIN` may impersonate, and both are platform-staff roles for
     * which MFA is MANDATORY — so `MfaGuard` would refuse an unenrolled agent at every other route
     * anyway, and the enrolment they need is one endpoint away. Adding the gate here too would be a
     * second copy of a rule the policy already enforces more precisely.
     */
    const result = await this.startImpersonation.execute({
      impersonatorId: principal.sub,
      impersonatorRoles: parseRoleGrants(principal.roles).map((grant) => grant.role),
      subjectUserId: body.user_id,
      reason: body.reason,
      minutes: body.minutes,
      correlationId: currentCorrelationId(),
    });

    return {
      token: result.token,
      expires_at: result.expiresAt.toISOString(),
      // So the console can render honestly rather than showing the subject's full menu and
      // discovering the refusals one click at a time.
      effective_permissions: result.effectivePermissions,
    };
  }

  @Post('impersonate/end')
  @MfaExempt()
  @RequiredPermission(IAM_PERMISSIONS.IMPERSONATION_END)
  // This route declared NO error codes at all. `Authentication.md` §8.15's own error table names
  // `UNAUTHENTICATED` for "called with an ACCESS token instead of the IMPERSONATION token" — the
  // most likely mistake a client makes here — and the route is guarded, so it can also refuse.
  @EmitsErrors('UNAUTHENTICATED', 'PERMISSION_DENIED')
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'End an impersonation',
    description:
      'Revokes the token family, so the credential stops working immediately rather than running ' +
      'to its 30-minute expiry, and records the duration.',
  })
  async endImpersonationSession(@Req() request: Request): Promise<void> {
    const principal = mfaPrincipalOf(request);

    /*
     * Called UNDER the impersonation token, so everything needed is on the principal — and taking
     * any of it from a body would let an agent close somebody else's session, or name a family that
     * is not theirs.
     */
    if (principal.typ !== 'IMPERSONATION' || principal.imp === undefined) {
      throw new UnauthenticatedException('This is not an impersonation session.');
    }

    await this.endImpersonation.execute({
      impersonatorId: principal.imp,
      subjectUserId: principal.sub,
      familyId: principal.fam ?? currentCorrelationId(),
      startedAt: new Date((principal.imp_at ?? 0) * 1000),
      correlationId: currentCorrelationId(),
    });
  }
}

/**
 * The principal, or a 401.
 *
 * A local helper rather than a shared one: `session.controller.ts` has its own for the same reason,
 * and the duplication is two lines against a `common/` export that would let any module reach into
 * the request shape.
 */
function mfaPrincipalOf(request: Request): {
  readonly sub: string;
  readonly email?: string;
  readonly roles?: readonly string[];
  /** `M-025`. Present only on an impersonation token. */
  readonly typ?: string;
  readonly imp?: string;
  readonly imp_at?: number;
  readonly fam?: string;
} {
  const principal = (
    request as unknown as {
      principal?: {
        sub: string;
        email?: string;
        roles?: readonly string[];
        typ?: string;
        imp?: string;
        imp_at?: number;
        fam?: string;
      };
    }
  ).principal;
  if (principal === undefined) throw new UnauthenticatedException('No principal on request.');
  return principal;
}
