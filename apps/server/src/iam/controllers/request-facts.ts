/**
 * M-022 · What a session row records about the caller — `FR-AUTH-09`, `BR-DAT-06`.
 *
 * ┌─ EXTRACTED ONCE, SO TWO CONTROLLERS CANNOT DISAGREE ────────────────────────────────────────┐
 * │ The password path and the OTP path both open sessions, and the `FR-AUTH-09` screen must     │
 * │ show the same fields however the member signed in. Two call sites reading the headers       │
 * │ separately is how one of them ends up showing "Unknown device" forever for everybody who    │
 * │ signed in with a code.                                                                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE USER AGENT IS TRUNCATED, AND THE IP IS TAKEN FROM EXPRESS ─────────────────────────────┐
 * │ A user-agent header is attacker-controlled and unbounded — a caller can send 8 KB of it on  │
 * │ every login, and it lands in a `text` column that is read back onto a member's screen.      │
 * │ 512 characters is more than any real agent string and bounds the row.                        │
 * │                                                                                              │
 * │ `request.ip` rather than `x-forwarded-for` directly: Express resolves it through the        │
 * │ configured `trust proxy` setting, so a client that simply sets the header on a direct        │
 * │ connection cannot choose its own address — which would let it spread OTP requests across    │
 * │ as many per-IP buckets as it liked.                                                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { Request } from 'express';

import type { RequestFacts } from '../application/session.use-cases.js';

/** Longer than any genuine agent string, short enough to bound the column. */
const MAX_USER_AGENT = 512;

export function requestFacts(request: Request): RequestFacts {
  const raw = request.headers['user-agent'];
  const userAgent = typeof raw === 'string' && raw !== '' ? raw.slice(0, MAX_USER_AGENT) : null;
  const ip = typeof request.ip === 'string' && request.ip !== '' ? request.ip : null;
  return { userAgent, ip };
}
