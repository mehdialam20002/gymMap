/**
 * M-020 · Email verification — `FR-AUTH-01`, `BR-GYM-02`, `Authentication.md` §8.3.
 *
 * ┌─ VERIFYING AN EMAIL DOES NOT SIGN YOU IN ───────────────────────────────────────────────────┐
 * │ No session is created, no token is issued, nothing is returned that authenticates. A link   │
 * │ that logs you in is a phishing primitive: the link travels through an inbox, and an inbox   │
 * │ is exactly the thing an attacker who has compromised the member already controls.            │
 * │                                                                                              │
 * │ It is also the more common accident than it sounds — "verify and log in" is a smoother      │
 * │ onboarding flow, and it is one line away at all times. The use case returning only a user   │
 * │ id is the structural version of not doing it.                                                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK, type Clock } from '../../common/clock/clock.port.js';
import { VerificationTokenInvalidError } from '../domain/iam.errors.js';
import {
  CREDENTIAL_TOKEN_STORE,
  type CredentialTokenStore,
} from './ports/credential-token-store.port.js';
import { UserPrismaRepository } from '../infrastructure/user.prisma-repository.js';

@Injectable()
export class VerifyEmailUseCase {
  private readonly logger = new Logger(VerifyEmailUseCase.name);

  constructor(
    private readonly users: UserPrismaRepository,
    @Inject(CREDENTIAL_TOKEN_STORE) private readonly tokens: CredentialTokenStore,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Returns only the verified user's id. Deliberately not a session — see the header. */
  async execute(token: string): Promise<{ userId: string }> {
    const userId = await this.tokens.consume('EMAIL_VERIFICATION', token);
    if (userId === null) throw new VerificationTokenInvalidError();

    // `markEmailVerified` stamps the timestamp unconditionally and moves the status to ACTIVE
    // only from PENDING_VERIFICATION — a suspended account must not be revived by a link sent
    // before the suspension.
    await this.users.markEmailVerified(userId, this.clock.now());

    this.logger.log({ message: 'email verified', userId });
    return { userId };
  }
}
