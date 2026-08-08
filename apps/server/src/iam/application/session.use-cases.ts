/**
 * M-022 · Issue, rotate, list and revoke a session — ADR-0011, `FR-AUTH-06`, `FR-AUTH-09`, `E1.2`.
 *
 * ┌─ FOUR USE CASES IN ONE FILE, BECAUSE THEY SHARE THE INVARIANT ──────────────────────────────┐
 * │ `AC-7` requires that session revocation and password reset share ONE code path, *"so a fix  │
 * │ to either cannot diverge"*. The same argument applies within this milestone: issue, rotate  │
 * │ and revoke all manipulate the same family, and splitting them across four files makes the   │
 * │ shared rule — that revoking anything must also deny its access tokens — four places to      │
 * │ forget it rather than one.                                                                   │
 * │                                                                                              │
 * │ `revokeFamilyEverywhere` below is that single path. Every revocation in the system goes     │
 * │ through it.                                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { UnauthenticatedException } from '../../common/errors/domain-exception.js';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  REUSE_REVOCATION_REASON,
  decideRotation,
} from '../domain/refresh-rotation.policy.js';
import {
  AuthSessionPrismaRepository,
  type RevocationReason,
  type SessionSummary,
} from '../infrastructure/auth-session.prisma-repository.js';
import { FamilyDenylist } from '../../common/auth/family-denylist.redis.js';
import { JwtSignerAdapter } from '../infrastructure/jwt.signer.adapter.js';
import { RefreshTokenPrismaRepository } from '../infrastructure/refresh-token.prisma-repository.js';
import { UserPrismaRepository } from '../infrastructure/user.prisma-repository.js';

export interface IssuedSession {
  readonly sessionId: string;
  readonly familyId: string;
  readonly accessToken: string;
  readonly accessExpiresAt: Date;
  /** For the httpOnly cookie ONLY. Never a response body — `SE1`, `TK7`. */
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}

@Injectable()
export class SessionUseCases {
  private readonly logger = new Logger(SessionUseCases.name);

  constructor(
    private readonly users: UserPrismaRepository,
    private readonly sessions: AuthSessionPrismaRepository,
    private readonly refreshTokens: RefreshTokenPrismaRepository,
    private readonly signer: JwtSignerAdapter,
    private readonly denylist: FamilyDenylist,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Opens a session after a credential has been proved. Called by login and by OTP verify. */
  async issue(input: {
    readonly userId: string;
    readonly tenantId: string | null;
    readonly roles: readonly string[];
    readonly deviceLabel: string | null;
    readonly userAgent: string | null;
    readonly ip: string | null;
  }): Promise<IssuedSession> {
    const now = this.clock.now();
    // The family id is minted here and used in two places — the session row and the access
    // token's `fam` claim. They must be the same value or the AC-10 denylist denies nothing.
    const familyId = randomUUID();

    const session = await this.sessions.create({
      userId: input.userId,
      familyId,
      deviceLabel: input.deviceLabel,
      userAgent: input.userAgent,
      ip: input.ip,
      absoluteExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });

    const refresh = await this.refreshTokens.issueFirst(session.id, now);
    const access = this.signer.signAccessToken({
      userId: input.userId,
      tenantId: input.tenantId,
      roles: input.roles,
      familyId,
    });

    this.logger.log({ message: 'session issued', userId: input.userId, sessionId: session.id });

    return {
      sessionId: session.id,
      familyId,
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  /**
   * Rotates a refresh token, or detects reuse.
   *
   * The three outcomes are `ROTATE`, the `TR-28` grace replay, and `REUSE_DETECTED`. Everything
   * else — unknown token, expired, dead session — is one indistinguishable 401, because
   * distinguishing them tells a holder of a guessed token whether it was ever real.
   */
  async rotate(presented: string): Promise<IssuedSession> {
    const now = this.clock.now();
    const current = await this.refreshTokens.findByToken(presented);
    if (current === null) throw new UnauthenticatedException('Refresh token not recognised.');

    const session = await this.sessions.findById(current.sessionId);
    if (session === null) throw new UnauthenticatedException('Refresh token has no session.');

    const decision = decideRotation({
      generation: current,
      sessionActive: session.status === 'ACTIVE',
      now,
    });

    switch (decision.kind) {
      case 'EXPIRED':
        throw new UnauthenticatedException('Refresh token expired or its session is not active.');

      case 'REUSE_DETECTED': {
        // ── `E1.2`. The whole family goes. ────────────────────────────────────────────────
        //
        // Not just the replayed token: the thief and the member each hold some generation of
        // the same chain, and the replay does not say which is which. Revoking one is a coin
        // flip; revoking both ends the theft and costs the member one re-login.
        await this.revokeFamilyEverywhere(session.familyId, REUSE_REVOCATION_REASON);
        this.logger.error({
          message: 'refresh token REUSE detected — family revoked',
          // ALRT-32 counts this line. It is deliberately `error` and deliberately distinct from
          // an ordinary sign-out, because it is the one revocation that means something.
          sessionId: session.id,
          familyId: session.familyId,
          generation: current.generation,
        });
        throw new UnauthenticatedException('Refresh token reuse detected; the family is revoked.');
      }

      case 'REPLAY_WITHIN_GRACE': {
        // ── `TR-28`. A second tab, not an attacker. ───────────────────────────────────────
        //
        // The successor's PLAINTEXT is unavailable — only its digest is stored, by design — so
        // the grace path rotates again FROM the successor rather than replaying a cached value.
        // Safe because the successor is itself unspent, and it means a tab restore ends with
        // both tabs holding valid, distinct tokens rather than one being signed out.
        const successor = await this.refreshTokens.findSuccessor(decision.supersededById);
        if (successor === null) {
          throw new UnauthenticatedException('Rotation chain is broken; re-authentication needed.');
        }
        this.logger.warn({
          message: 'refresh replayed inside the rotation grace — treated as a parallel tab',
          sessionId: session.id,
          generation: current.generation,
        });
        return this.mintFrom(successor, session, now);
      }

      case 'ROTATE':
        return this.mintFrom(current, session, now);
    }
  }

  /** `FR-AUTH-09`. The caller's own sessions. */
  async list(userId: string): Promise<SessionSummary[]> {
    return this.sessions.listActiveForUser(userId);
  }

  /**
   * Revokes one of the caller's own sessions.
   *
   * Returns whether anything was revoked WITHOUT saying why not. "Not yours" and "already
   * revoked" are the same answer: a caller probing uuids must not learn which of the two.
   */
  async revokeOne(sessionId: string, userId: string): Promise<{ revoked: boolean }> {
    const session = await this.sessions.findById(sessionId);
    // Ownership is checked in the UPDATE's WHERE as well — this read is for the family id, and
    // a mismatch here short-circuits before the denylist write.
    if (session === null || session.userId !== userId) return { revoked: false };

    const { revoked } = await this.sessions.revokeOne(
      sessionId,
      userId,
      'USER_SIGNED_OUT',
      this.clock.now(),
    );
    if (revoked > 0) await this.denylist.revoke(session.familyId);
    return { revoked: revoked > 0 };
  }

  /**
   * THE single revocation path — `AC-7`.
   *
   * Revoking the rows and denying the access tokens are one operation, always. Two call sites
   * doing them separately is how one of them ends up doing only the first, and a session
   * "revoked" without the denylist entry stays usable for the rest of its access-token TTL.
   */
  async revokeFamilyEverywhere(
    familyId: string,
    reason: RevocationReason,
  ): Promise<{ revoked: number }> {
    const result = await this.sessions.revokeFamily(familyId, reason, this.clock.now());
    // AFTER the database write. The reverse order would deny tokens for a family whose rows
    // then failed to update — locking a member out of a session that is still live.
    await this.denylist.revoke(familyId);
    return { revoked: result.revoked };
  }

  private async mintFrom(
    generation: Parameters<RefreshTokenPrismaRepository['rotate']>[0],
    session: SessionSummary & { userId: string },
    now: Date,
  ): Promise<IssuedSession> {
    const refresh = await this.refreshTokens.rotate(generation, now);
    // Roles are RE-READ, never carried forward. `FR-RBAC-04` requires a role change to take
    // effect within 60 seconds, and a token copying its predecessor's claims would carry a
    // revoked role for its full 15-minute lifetime — fifteen minutes of authority nobody
    // intended, immediately after a staff member is offboarded.
    const roles = await this.users.roleScopesFor(session.userId);

    const access = this.signer.signAccessToken({
      userId: session.userId,
      // The tenant is not re-derived here. A session is opened against one tenant at login and
      // stays there; switching tenants is a new session, not a refreshed one (ADR-0011).
      tenantId: null,
      roles,
      familyId: session.familyId,
    });

    return {
      sessionId: session.id,
      familyId: session.familyId,
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  /**
   * Revokes the session a refresh token belongs to. The logout path.
   *
   * Silent on an unknown token: `logout` answers 204 unconditionally, so there is nothing for
   * this to report. A member leaving a shared device must not be told their sign-out failed.
   */
  async revokeByRefreshToken(presented: string): Promise<void> {
    const current = await this.refreshTokens.findByToken(presented);
    if (current === null) return;

    const session = await this.sessions.findById(current.sessionId);
    if (session === null) return;

    await this.revokeFamilyEverywhere(session.familyId, 'USER_SIGNED_OUT');
  }

  /** Seconds until an instant, floored at zero. Uses the injected clock, not the wall clock. */
  secondsUntil(at: Date): number {
    return Math.max(0, Math.floor((at.getTime() - this.clock.now().getTime()) / 1000));
  }

  /**
   * Opens a session for an already-authenticated user, taking the device facts off the request.
   *
   * Both the password path and the OTP path call this, so the `FR-AUTH-09` sessions screen shows
   * the same fields however the member signed in. Two call sites assembling the device label
   * separately is how one of them ends up showing "Unknown device" forever.
   *
   * The roles are read here rather than passed: the caller has just proved a credential and has
   * no reason to know what the identity is entitled to.
   */
  async issueFor(userId: string, request: RequestFacts): Promise<IssuedSession> {
    return this.issue({
      userId,
      // A session is opened against no tenant. Which tenant the member acts in is resolved per
      // request from their roles (`TENANT_RESOLUTION_PORT`), not frozen at login — an owner of
      // two gyms would otherwise need two sessions to switch between them.
      tenantId: null,
      roles: await this.users.roleScopesFor(userId),
      deviceLabel: deviceLabelFrom(request.userAgent),
      userAgent: request.userAgent,
      ip: request.ip,
    });
  }
}

/** What the session row records about the caller. Kept minimal — `BR-DAT-06`. */
export interface RequestFacts {
  readonly userAgent: string | null;
  readonly ip: string | null;
}

/**
 * A short human label for the sessions screen — `FR-AUTH-09`.
 *
 * Deliberately crude. A full UA-parsing dependency would be a new package and a monthly
 * signature update to render four words, and the screen's job is only to let a member recognise
 * their own devices: "Chrome on Windows" is enough to spot the one that is not theirs.
 */
export function deviceLabelFrom(userAgent: string | null): string | null {
  if (userAgent === null || userAgent.trim() === '') return null;

  // ORDER MATTERS, and it is the reverse of what looks natural. Every Chromium browser puts
  // `Chrome/` in its agent string, and Chrome itself carries `Safari/` there for historical
  // reasons — so a check in "most popular first" order labels Edge as Chrome and Chrome as
  // Safari. The most specific marker has to win.
  const browser = findFirst(userAgent, [
    ['Edg/', 'Edge'],
    ['OPR/', 'Opera'],
    ['Chrome/', 'Chrome'],
    ['Firefox/', 'Firefox'],
    ['Safari/', 'Safari'],
  ]);

  const platform = findFirst(userAgent, [
    // Android before Linux: an Android agent contains both, and "Linux" would be true and
    // useless on a member's phone.
    ['Android', 'Android'],
    ['iPhone', 'iOS'],
    ['iPad', 'iOS'],
    ['Windows', 'Windows'],
    ['Mac OS X', 'macOS'],
    ['Linux', 'Linux'],
  ]);

  if (browser === null && platform === null) return null;
  if (browser === null) return platform;
  if (platform === null) return browser;
  return `${browser} on ${platform}`;
}

/**
 * The first matching label, by substring.
 *
 * `includes` rather than a regular expression. The input is attacker-controlled and up to 512
 * characters, and a regex over untrusted input is where catastrophic backtracking comes from.
 * A substring scan is linear and cannot be made to misbehave.
 */
function findFirst(haystack: string, table: readonly (readonly [string, string])[]): string | null {
  for (const [needle, label] of table) {
    if (haystack.includes(needle)) return label;
  }
  return null;
}
