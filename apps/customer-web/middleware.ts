/**
 * The per-response CSP nonce — `Security.md` §11.1, §11.3. `NFR-SEC-12`.
 *
 * ┌─ WHY THE NONCE CANNOT LIVE IN `next.config.mjs` ────────────────────────────────────────────┐
 * │ §11.1 splits header ownership: the edge sets the STATIC headers, and the application sets    │
 * │ CSP, because "the nonce must be generated per response and injected into the document,       │
 * │ which only the application can do". A nonce in a static config is a constant, and a constant │
 * │ nonce is `'unsafe-inline'` with extra steps — defeated the moment an attacker reads a page.  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The policy itself is built in `src/shared/security/csp.ts` so the suite can assert the string
 * that actually ships rather than the source that produces it.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  STATIC_SECURITY_HEADERS,
  buildContentSecurityPolicy,
  cspHostsFromEnv,
  generateNonce,
} from './src/shared/security/csp.ts';

export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();

  // Forwarded so the root layout can read it via `headers()` and stamp it onto its inline
  // scripts. Without this the theme bootstrap is blocked by the very policy this sets.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    'Content-Security-Policy',
    // The dev flag comes from NODE_ENV, which `next build` sets to 'production' itself — so a
    // production bundle cannot take the relaxed branch even if this line were edited carelessly.
    buildContentSecurityPolicy(
      nonce,
      cspHostsFromEnv(process.env),
      process.env.NODE_ENV !== 'production',
    ),
  );
  for (const [header, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  return response;
}

export const config = {
  // Static assets and the image optimiser need no nonce, and running middleware on them costs a
  // function invocation per request. `_next/static` is already immutable and content-hashed.
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
