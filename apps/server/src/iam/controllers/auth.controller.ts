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

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
  registerBody,
  resetPasswordBody,
  type ForgotPasswordBody,
  type LoginBody,
  type RegisterBody,
  type ResetPasswordBody,
} from '@gymmap/types';

import { EmitsErrors } from '../../common/decorators/emits-errors.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { zodPipe } from '../../common/validation/zod-validation.pipe.js';
import { LoginWithPasswordUseCase } from '../application/login-with-password.use-case.js';
import { RegisterWithPasswordUseCase } from '../application/register-with-password.use-case.js';
import { ResetPasswordUseCase } from '../application/reset-password.use-case.js';

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
}
