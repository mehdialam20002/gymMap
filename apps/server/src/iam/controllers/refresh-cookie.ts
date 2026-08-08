/**
 * M-022 · The refresh cookie — `FR-AUTH-06`, `E1.1`, `TK7`, `Security.md` §2.6.
 *
 * ┌─ ONE DEFINITION, BECAUSE THREE ROUTES SET IT AND ONE CLEARS IT ─────────────────────────────┐
 * │ `login`, `otp/verify` and `refresh` all set this cookie; `logout` clears it. A browser      │
 * │ matches a clear against a set by NAME, PATH and DOMAIN — so a clear whose attributes differ │
 * │ from the set leaves the original in place, and the "logout" leaves a 30-day credential in   │
 * │ the browser.                                                                                 │
 * │                                                                                              │
 * │ Four copies of an attribute list is four chances for one of them to drift. One module is    │
 * │ the only version of this that stays true.                                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ WHY EVERY ATTRIBUTE IS THERE ──────────────────────────────────────────────────────────────┐
 * │ `httpOnly`  THE requirement. An XSS that reads `localStorage` still cannot read this, so a  │
 * │             script injection does not hand an attacker a 30-day credential.                  │
 * │ `secure`    demanded by the `__Host-` prefix, and it stops the token crossing plain HTTP.   │
 * │ `sameSite`  `strict` — the cookie does not ride along on a cross-site request, which is what │
 * │             makes a CSRF against `/auth/refresh` inert.                                      │
 * │ `path: '/'` also demanded by `__Host-`. A narrower path would look tighter and is not        │
 * │             permitted with that prefix.                                                       │
 * │ NO `domain` again `__Host-`: the cookie is pinned to the exact host that set it and cannot   │
 * │             be widened to a sibling subdomain by anyone who compromises one.                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import type { Request, Response } from 'express';

import { REFRESH_TOKEN_TTL_SECONDS } from '../../common/auth/token-lifetimes.js';

/** `Security.md` §2.6, `TK7`. The strictest scope a cookie can carry. */
export const REFRESH_COOKIE = '__Host-gm_rt';

export function setRefreshCookie(response: Response, refreshToken: string): void {
  response.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshCookie(response: Response): void {
  // The SAME attributes as the set — see the header. Different ones and the browser keeps it.
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Reads the cookie off the request.
 *
 * Parsed by hand rather than with `cookie-parser`: one header, one name, on three routes. Adding
 * a middleware to every request in the application to read a single cookie is a dependency and a
 * per-request cost for no benefit.
 */
export function readRefreshCookie(request: Request): string | null {
  const raw = request.headers.cookie;
  if (raw === undefined) return null;

  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${REFRESH_COOKIE}=`)) continue;
    const value = trimmed.slice(REFRESH_COOKIE.length + 1);
    return value === '' ? null : value;
  }
  return null;
}
