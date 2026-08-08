/**
 * M-022 · The session routes — `Authentication.md` §8.5, §8.6, §8.9, §8.10, ADR-0011.
 *
 * ┌─ A SEPARATE CONTROLLER BECAUSE THE AUDIENCE DIFFERS, NOT BECAUSE THE FILE WAS LONG ─────────┐
 * │ `refresh` and `logout` are `@Public()` — a caller with an expired access token has nothing  │
 * │ to authenticate with, which is the entire premise of refreshing. `sessions` and             │
 * │ `sessions/:id` are `/me`-audience and require a principal.                                   │
 * │                                                                                              │
 * │ Mixing the two in one class means one `@Public()` slip opens a route that lists a member's  │
 * │ devices to anybody. Separate classes make the audience a property of the file.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE REFRESH TOKEN IS A COOKIE AND NEVER A BODY FIELD — `SE1`, `TK7`, `E1.1` ───────────────┐
 * │ `httpOnly` is the requirement, and the reason is specific: an XSS that can read             │
 * │ `localStorage` still cannot read this, so a script injection does not hand an attacker a    │
 * │ 30-day credential. `__Host-` additionally pins it to HTTPS, to no `Domain`, and to path     │
 * │ `/` — the strictest scope a cookie can have.                                                 │
 * │                                                                                              │
 * │ The ACCESS token IS returned in the body. It is short-lived and the SPA must put it in an   │
 * │ `Authorization` header; `SE1` forbids a body token for the long-lived one.                   │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { EmitsErrors } from '../../common/decorators/emits-errors.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { RequiredPermission } from '../../common/decorators/required-permission.decorator.js';
import {
  NotFoundException,
  UnauthenticatedException,
} from '../../common/errors/domain-exception.js';
import { SessionUseCases } from '../application/session.use-cases.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie.js';
import { IAM_PERMISSIONS } from '../permissions.js';

interface Principal {
  readonly sub: string;
  readonly fam?: string;
}

@ApiTags('iam')
@Controller({ path: 'auth', version: '1' })
export class SessionController {
  constructor(private readonly sessions: SessionUseCases) {}

  @Post('refresh')
  @Public()
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.OK)
  @EmitsErrors('UNAUTHENTICATED', 'RATE_LIMIT_EXCEEDED')
  @ApiOperation({
    summary: 'Rotates the refresh token and issues a new access token.',
    description:
      'Each rotation mints generation N+1 and spends N, so a refresh token is usable exactly ' +
      'once. A SECOND use of a spent generation means two parties hold it, which revokes the ' +
      'ENTIRE FAMILY and signs out every device on it (E1.2) — the thief and the member each ' +
      'hold some generation of the same chain and the replay does not say which is which. A ' +
      'replay within a short grace is treated as a parallel tab rather than theft (TR-28). ' +
      'Roles are RE-READ on every rotation, so a revoked role stops working within one refresh ' +
      'rather than at the end of the token lifetime (FR-RBAC-04).',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        expires_in_seconds: { type: 'integer', example: 900 },
      },
    },
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ access_token: string; expires_in_seconds: number }> {
    const presented = readRefreshCookie(request);
    if (presented === null) throw new UnauthenticatedException('No refresh cookie presented.');

    const issued = await this.sessions.rotate(presented);
    setRefreshCookie(response, issued.refreshToken);

    return {
      access_token: issued.accessToken,
      expires_in_seconds: this.sessions.secondsUntil(issued.accessExpiresAt),
    };
  }

  @Post('logout')
  @Public()
  @RateLimit('RL-AUTH')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmitsErrors('RATE_LIMIT_EXCEEDED')
  @ApiOperation({
    summary: 'Ends the current session.',
    description:
      '204 UNCONDITIONALLY, including for a missing, unknown or already-spent cookie. A logout ' +
      'that can fail is a logout a member cannot rely on, and the failure would arrive at the ' +
      'exact moment they are trying to leave a shared device. The cookie is cleared either way.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const presented = readRefreshCookie(request);
    // Cleared FIRST, so a failure below still leaves the browser without the credential.
    clearRefreshCookie(response);
    if (presented === null) return;
    await this.sessions.revokeByRefreshToken(presented);
  }

  @Get('sessions')
  @RequiredPermission(IAM_PERMISSIONS.OWN_SESSION_READ)
  @RateLimit('RL-READ')
  @EmitsErrors('UNAUTHENTICATED', 'PERMISSION_DENIED')
  @ApiOperation({
    summary: 'Lists the active sessions of the calling member.',
    description:
      'FR-AUTH-09. Device, address and start time — enough to recognise the one you do not. ' +
      'Each row is flagged `current` so a member can tell which entry not to revoke; without ' +
      'it the most common outcome of this screen is signing yourself out by accident.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              device_label: { type: 'string', nullable: true },
              ip: { type: 'string', nullable: true },
              started_at: { type: 'string', format: 'date-time' },
              current: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  async listSessions(@Req() request: Request): Promise<{ sessions: unknown[] }> {
    const principal = principalOf(request);
    const sessions = await this.sessions.list(principal.sub);

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        device_label: session.deviceLabel,
        // The member's OWN address, on their own screen. Masking it would remove the signal
        // this page exists to give — "signed in from a city I have never visited".
        ip: session.ip,
        started_at: session.createdAt.toISOString(),
        current: session.familyId === principal.fam,
      })),
    };
  }

  @Delete('sessions/:sessionId')
  @RequiredPermission(IAM_PERMISSIONS.OWN_SESSION_REVOKE)
  @RateLimit('RL-WRITE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmitsErrors('UNAUTHENTICATED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  @ApiOperation({
    summary: 'Revokes one of the calling member’s own sessions.',
    description:
      'A session belonging to anyone else is a 404 and not a 403 — a 403 confirms the uuid ' +
      'exists, and "not yours" and "already revoked" must be one answer. Revocation reaches ' +
      'the already-issued access token through the family denylist (AC-10) rather than waiting ' +
      'for the next refresh to fail.',
  })
  async revokeSession(
    @Req() request: Request,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    const principal = principalOf(request);
    const { revoked } = await this.sessions.revokeOne(sessionId, principal.sub);
    if (!revoked) throw new NotFoundException('No such active session for this caller.');
  }
}

function principalOf(request: Request): Principal {
  const principal = (request as unknown as { principal?: Principal }).principal;
  if (principal === undefined) throw new UnauthenticatedException('No principal on request.');
  return principal;
}
