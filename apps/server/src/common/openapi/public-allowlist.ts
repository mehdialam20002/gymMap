/**
 * M-008 AC-3 · The `@Public()` allowlist — FR-RBAC-01, AC-FND-14.4, E1.4.
 *
 * `@Public()` on a controller is what the guard reads at runtime. THIS FILE is what a human
 * reviews. Both are required, deliberately.
 *
 * The reason for two mechanisms: opening a route to the unauthenticated internet should not be
 * possible by adding five characters to a controller. Requiring an entry here means the diff
 * also touches a file whose entire purpose is to be argued about — and a reviewer scanning it
 * sees every public surface in the system on one screen, which is the only way anyone notices
 * that the list has grown from six routes to sixteen.
 *
 * A route with `@Public()` and no row here fails job 8 (PG-1). A row here for a route that no
 * longer exists also fails, so the list cannot rot into a set of stale permissions.
 */

export interface PublicRoute {
  /** `METHOD /path` exactly as registered, including the version prefix where present. */
  readonly route: string;
  /** Why this may be reached without authentication. Not optional, and not "it's public". */
  readonly reason: string;
  /** What stops it being abused, given there is no principal to rate-limit by. */
  readonly abuseControl: string;
}

export const PUBLIC_ALLOWLIST: readonly PublicRoute[] = [
  {
    route: 'GET /healthz',
    reason:
      'Liveness. The load balancer has no credentials and must be able to decide whether to ' +
      'route traffic here. NFR-AVL-03.',
    abuseControl:
      'Returns a fixed body with no system detail — no version, no dependency names, no ' +
      'hostname. An unauthenticated caller learns only that a process is alive.',
  },
  {
    route: 'GET /readyz',
    reason:
      'Readiness. The orchestrator must know whether this instance can serve before sending ' +
      'it a request, and it authenticates to nothing.',
    abuseControl:
      'Reports dependency health as booleans only. It never names a host, a port or an error ' +
      'string — a readiness probe that leaks "postgres at 10.0.3.14 refused connection" is a ' +
      'network map served to anyone who asks.',
  },

  // ── M-020 · the password path ────────────────────────────────────────────────────────────
  //
  // All four must be public: nobody can authenticate before they have authenticated. That is
  // the easy part. The interesting column below is `abuseControl`, because "unauthenticated"
  // means there is no principal to rate-limit by, and each of these four is abused differently.
  {
    route: 'POST /v1/auth/register',
    reason:
      'Account creation. A member with no account has no credential, so there is nothing to ' +
      'authenticate with. FR-AUTH-01.',
    abuseControl:
      'RL-AUTH per identifier and per IP. Argon2id runs behind an 8-permit semaphore, so a ' +
      'registration flood cannot exhaust memory (Security.md §2.4.2) — the request queues and ' +
      'then gets a 503 rather than taking the instance down. The password policy is checked ' +
      'BEFORE the hash, so a nine-character password costs no CPU.',
  },
  {
    route: 'POST /v1/auth/login',
    reason: 'Sign-in. The credential being presented is the thing that would authenticate.',
    abuseControl:
      'RL-AUTH (10 per 15 minutes per identifier) AND the FR-AUTH-08 lockout at the same ten ' +
      'attempts by design, so a caller never sees a 429 and a lockout disagreeing about how ' +
      'many attempts they made. The lockout is checked BEFORE any verification, so a locked ' +
      'account costs one Redis read rather than 250ms of Argon2id — otherwise the control ' +
      'itself becomes the amplifier.',
  },
  {
    route: 'POST /v1/auth/password/forgot',
    reason:
      'Password recovery. A member who has forgotten their password cannot present one, which ' +
      'is the entire premise of the endpoint. FR-AUTH-10.',
    abuseControl:
      'RL-AUTH, and the response is IDENTICAL for a known and an unknown address — same 202, ' +
      'same body, same latency, because the unknown path performs equivalent Redis work. ' +
      'Without that this is a free account-existence oracle over any address anyone tries. ' +
      'Emails are the real cost, and the per-identifier limit is what bounds them.',
  },
  {
    route: 'POST /v1/auth/password/reset',
    reason:
      'Completes the recovery above. The bearer credential IS the reset token; requiring a ' +
      'session would mean only an already-signed-in member could reset a password.',
    abuseControl:
      'The token is 256 bits of CSPRNG, stored only as its SHA-256, single-use through an ' +
      'atomic GETDEL, and valid for 30 minutes. RL-AUTH bounds guessing, though 2^256 does ' +
      'most of that work. An unknown, spent and expired token are one indistinguishable 422, ' +
      'so a guess never reveals whether a value was ever real.',
  },

  // ── M-021 · phone OTP. The FR-AUTH-01 consumer default in the launch market ──────────────
  //
  // These two are the most expensive public routes in the system to abuse, and the only ones
  // where abuse costs REAL MONEY per request rather than CPU: roughly ₹0.15 an SMS (CON-02).
  {
    route: 'POST /v1/auth/otp/request',
    reason:
      'Phone-OTP sign-in and registration. In India the phone is the primary identifier ' +
      '(FR-AUTH-02) and most members have no password at all, so this is the main way in.',
    abuseControl:
      'FIVE limits, and two of them are independent ceilings rather than one: 3 sends per 30 ' +
      'minutes PER NUMBER with a 30-second cool-down, and 20 operations per hour PER IP with a ' +
      'captcha demanded from the 11th. The per-number limit protects a member from being ' +
      'SMS-bombed; the per-IP limit protects the platform from an attacker cycling ten thousand ' +
      'numbers, who would never trip a per-number limit once. Implementing only one of the two ' +
      'is the documented trap. Every budget is checked BEFORE the enqueue — a limit enforced ' +
      'after the send costs ₹0.15 on each request it refuses. RL-OTP is tier 1 and fails closed.',
  },
  {
    route: 'POST /v1/auth/otp/verify',
    reason:
      'Completes the above. The code IS the credential; requiring a session would mean only an ' +
      'already-signed-in member could verify a number.',
    abuseControl:
      'Six digits is a million possibilities, so the attempt ceiling is what matters: 5 per ' +
      'code, enforced inside the same atomic Redis script that does the comparison, so it ' +
      'cannot be raced to stay below the limit. The fifth wrong attempt destroys the challenge ' +
      'and a new one costs a 30-second cool-down — about 3 guesses a minute against 10^6. ' +
      'RL-OTP applies on top. The stored value is an HMAC bound to the purpose, the number and ' +
      'the generation, so a code cannot be replayed across purposes or after a resend.',
  },
];

/** Fast lookup for the gate. */
export const PUBLIC_ROUTES = new Set(PUBLIC_ALLOWLIST.map((r) => r.route));

/**
 * The five audience prefixes of `API_Catalog.md` §1.2 R7. A sixth fails job 8 (AC-5).
 *
 * The set is closed because the prefix is what an auditor reads to answer "who can reach this".
 * `/owner`, `/dashboard`, `/staff`, `/api` and `/internal` are explicitly forbidden: each of
 * them describes a CLIENT rather than an AUDIENCE, and a route named for its caller stops
 * telling you anything about who is authorised the moment a second client calls it.
 */
export const AUDIENCE_PREFIXES = ['', '/me', '/tenant', '/admin', '/webhooks'] as const;

export const FORBIDDEN_PREFIXES = ['/owner', '/dashboard', '/staff', '/api', '/internal'] as const;

/** Unversioned by design — a probe cannot be asked to negotiate an API version (AC-5). */
export const UNVERSIONED_ROUTES = ['/healthz', '/readyz'] as const;
