/**
 * The policy, as a pure function — `Security.md` §11.2, §11.3. `NFR-SEC-12`.
 *
 * ┌─ SEPARATE FROM `middleware.ts` SO THE EMITTED STRING CAN BE ASSERTED ───────────────────────┐
 * │ The first version built the CSP inline in the middleware, and the spec that checked it read  │
 * │ the source FILE — so it matched the word `'unsafe-inline'` inside a comment explaining why   │
 * │ `'unsafe-inline'` is forbidden, and reported the policy as unsafe. A test that reads prose   │
 * │ is a test that fails on its own documentation.                                                │
 * │                                                                                              │
 * │ Building the policy here makes it DATA: the suite calls the function and inspects the string │
 * │ that actually ships, which is both simpler and strictly stronger.                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Hosts CSP admits, read from the environment so a deployment names its own CDN, tile and ingest
 * hosts without a code change. Empty in local development, where everything is `'self'`.
 */
export interface CspHosts {
  /** The API origin. `connect-src`. */
  api?: string | undefined;
  /** The public media origin. `img-src`. */
  media?: string | undefined;
  /** The map tile / geocoding host (`DEP-02`). `img-src` and `connect-src`. */
  tiles?: string | undefined;
  /** The Sentry ingest host (`A-15`). `connect-src`. */
  ingest?: string | undefined;
  /**
   * The provider payment host. Present only under the provider-hosted IFRAME model; under the
   * redirect model the directive becomes `'none'`. Either way `PCI-1` holds: we inject no script
   * into it (§8.4).
   */
  payment?: string | undefined;
}

export function cspHostsFromEnv(env: Record<string, string | undefined>): CspHosts {
  return {
    api: env['CSP_API_HOST'],
    media: env['CSP_MEDIA_HOST'],
    tiles: env['CSP_TILE_HOST'],
    ingest: env['CSP_INGEST_HOST'],
    payment: env['CSP_PAYMENT_HOST'],
  };
}

/** Joins `'self'` with whichever configured hosts are present. Never emits a wildcard. */
function sources(...parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(' ');
}

/**
 * Builds the `Content-Security-Policy` value for one response.
 *
 * The nonce is per response and must be — a constant nonce is `'unsafe-inline'` with extra steps,
 * defeated the moment an attacker reads one page.
 */
export function buildContentSecurityPolicy(nonce: string, hosts: CspHosts = {}): string {
  return [
    // Deny by default; grant each capability explicitly. `default-src 'self'` silently permits
    // every fetch type nobody thought about.
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Next's App Router emits inline hydration scripts; a nonce is the only way to allow them
    // without unsafe-inline. `strict-dynamic` lets the nonced loader load its own chunks and
    // makes host allowlists irrelevant for scripts — the stronger modern form.
    `script-src ${sources("'self'", `'nonce-${nonce}'`, "'strict-dynamic'")}`,
    // Tailwind (A-03) compiles to a static stylesheet, so inline styles are not needed. The
    // nonce covers only the small amount of framework-injected critical CSS.
    `style-src ${sources("'self'", `'nonce-${nonce}'`)}`,
    // `data:` is required for inline SVG icons from the component library. Safe for images, and
    // granted to NEITHER script-src NOR object-src.
    `img-src ${sources("'self'", 'data:', hosts.media, hosts.tiles)}`,
    "font-src 'self'",
    // What stops exfiltration to an arbitrary host AFTER a successful script injection. A scheme
    // wildcard here would make the directive decorative.
    `connect-src ${sources("'self'", hosts.api, hosts.tiles, hosts.ingest)}`,
    `frame-src ${hosts.payment ?? "'none'"}`,
    // `SCR-WEB-001`'s hero loop. Was `'none'` until a video existed, which is the correct default
    // and the correct thing to widen ONLY when something legitimately needs it — the media CDN
    // rides the same host as images because it serves the same asset class.
    //
    // Still deny-by-default in the way that matters: no scheme wildcard, no `blob:`, no `data:`.
    // `data:` here would let an injected script mint a media element out of thin air, and the
    // hero needs a file from our own origin, not a synthesised one.
    `media-src ${sources("'self'", hosts.media)}`,
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * §11.2 · the static headers, also set at the edge.
 *
 * The duplication is deliberate: the edge covers responses the application never sees (static
 * assets, redirects, error pages), and this covers local development and any deployment whose
 * edge configuration has drifted. A header present twice with the same value is harmless; a
 * header silently dropped is not.
 *
 * `Strict-Transport-Security` is absent ON PURPOSE — it is an edge concern, and a two-year
 * `preload` directive escaping from a dev server running on plain-HTTP localhost is a foot-gun
 * with a long memory.
 *
 * `Cross-Origin-Embedder-Policy` is absent on purpose too: it would break the map tile embed
 * (`DEP-02`) for no benefit at Phase-1 scope. Recorded so it is not "fixed" later.
 */
export const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  // Origin-level, not `no-referrer`: the customer site needs it for outbound analytics and
  // partner links. The two dashboards get `no-referrer`, because a dashboard URL can carry
  // identifiers.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'ambient-light-sensor=()',
    // `(self)`, not `()` and not `*`. The hero loop is muted, so no sound can start on its own —
    // the policy that actually protects a visitor is the `muted` attribute, and this grant only
    // stops the browser refusing our own first-party decorative video. A third-party frame still
    // cannot autoplay anything, because it is not `self`.
    'autoplay=(self)',
    'battery=()',
    // The customer site never uses a camera — the QR is DISPLAYED here, not scanned. The scanner
    // lives on gym-dashboard, the only surface with a camera grant.
    'camera=()',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    // The "near me" search of SCR-WEB-001/002 needs it. Everything else is off.
    'geolocation=(self)',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    // The Payment Request API is not used; the provider page handles payment.
    'payment=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'usb=()',
    'xr-spatial-tracking=()',
  ].join(', '),
};

/** 128 bits, base64. Web Crypto — `node:crypto` is unavailable in the Edge runtime. */
export function generateNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}
