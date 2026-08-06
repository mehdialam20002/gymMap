/**
 * M-008 · `@RateLimit()` — NFR-SEC-06, PG-5.
 *
 * Every route carries a rate-limit CLASS, not a number. The numbers live in one table so that
 * tuning `RL-SEARCH` is a config change rather than a sweep through forty controllers — and so
 * that a reviewer can see the whole budget at once instead of inferring it from decorators.
 *
 * `RL-SEARCH` is the one to watch: its 60/min session budget covers search AND autocomplete
 * together, so a fast legitimate user can exhaust it while typing. Tracked as OI-S2.
 */

import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_CLASS = 'gymmap:rate-limit-class';

/** The closed set of rate-limit classes. A route outside it fails PG-5. */
export const RATE_LIMIT_CLASSES = [
  'RL-AUTH',
  'RL-OTP',
  'RL-SEARCH',
  'RL-READ',
  'RL-WRITE',
  'RL-PAYMENT',
  'RL-WEBHOOK',
  'RL-EXPORT',
  'RL-ADMIN',
] as const;

export type RateLimitClass = (typeof RATE_LIMIT_CLASSES)[number];

export const RateLimit = (rateLimitClass: RateLimitClass): MethodDecorator =>
  SetMetadata(RATE_LIMIT_CLASS, rateLimitClass);
