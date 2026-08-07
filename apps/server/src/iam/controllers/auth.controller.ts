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

import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
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
  resetPasswordBody,
  type ForgotPasswordBody,
  type LoginBody,
  type OtpRequestBody,
  type OtpVerifyBody,
  type RegisterBody,
  type ResetPasswordBody,
} from '@gymmap/types';

import { EmitsErrors } from '../../common/decorators/emits-errors.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { zodPipe } from '../../common/validation/zod-validation.pipe.js';
import { OTP_TTL_SECONDS } from '../domain/otp.policy.js';
import { LoginWithPasswordUseCase } from '../application/login-with-password.use-case.js';
import { RegisterWithPasswordUseCase } from '../application/register-with-password.use-case.js';
import { ResetPasswordUseCase } from '../application/reset-password.use-case.js';
import { RequestOtpUseCase } from '../application/request-otp.use-case.js';
import { VerifyOtpUseCase } from '../application/verify-otp.use-case.js';

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
      'in a minute. NO SESSION IS ISSUED — that is M-022 (SE1, ADR-0011).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { user_id: { type: 'string', format: 'uuid' } },
    },
  })
  async loginWithPassword(@Body(zodPipe(loginBody)) body: LoginBody): Promise<{ user_id: string }> {
    const result = await this.login.execute({
      identifier: body.identifier,
      password: body.password,
    });
    return { user_id: result.userId };
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
  ): Promise<{ verified: boolean; user_id: string | null }> {
    const result = await this.verifyOtp.execute({
      phone: body.phone,
      purpose: body.purpose,
      code: body.code,
    });
    return { verified: true, user_id: result.userId };
  }
}
