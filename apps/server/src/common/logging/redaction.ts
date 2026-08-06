/**
 * M-004 · The log redaction deny-list — BR-DAT-06, AC-FND-10.1, NFR-SEC-04.
 *
 * BR-DAT-06: personal data never appears in application logs, error traces or analytics events.
 *
 * A deny-list is the wrong shape for a security control and is used here anyway, deliberately:
 * Pino's redaction is path-based and an allow-list would mean enumerating every safe field of
 * every log object in the system, which nobody maintains past month two. The mitigation is that
 * this list is REVIEWED (CODEOWNERS-locked), tested against a synthetic PII corpus, and paired
 * with a lint rule that forbids string-concatenated log messages — because a concatenated message
 * is one flat string and no path-based redactor can reach inside it.
 *
 * ┌─ OI-S1, RAISED AND STILL OPEN ──────────────────────────────────────────────────────────┐
 * │ BR-DAT-06's list as written in the PRD has NO LOCATION FIELD. A request logger would    │
 * │ write `?lat=12.934512&lng=77.610134` straight into the aggregator — roughly 0.1 m       │
 * │ resolution, which identifies not just a building but a floor. That defeats the §C6      │
 * │ precision-reduction rule entirely, since the reduced value is published while the exact │
 * │ one is retained in logs. `lat`, `lng`, `latitude`, `longitude`, `location` and          │
 * │ `coordinates` are redacted here ANYWAY, ahead of the PRD amendment, because shipping    │
 * │ the logger without them would create the exposure this note describes. Flagged as       │
 * │ privacy-blocking; the PRD list needs the amendment.                                     │
 * └──────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Field names whose VALUE must never be logged, at any depth.
 *
 * AC-FND-10.1 mandates the first fifteen. The remainder are additions justified inline.
 */
export const REDACTED_FIELD_NAMES = [
  // --- AC-FND-10.1 mandated minimum ---
  'token',
  'authorization',
  'cookie',
  'password',
  'otp',
  'email',
  'phone',
  'name',
  'dob',
  'address',
  'card',
  'cvv',
  'aadhaar',
  'pan',
  'health_notes',

  // --- additions, each with a reason ---
  'refreshToken', // camelCase sibling of `token`; paths are literal, not fuzzy
  'refresh_token',
  'accessToken',
  'access_token',
  'secret',
  'apiKey',
  'api_key',
  'signature', // Razorpay webhook signature — replayable if leaked (BR-PAY-05)
  'otpHash',
  'passwordHash', // a hash is still a credential-equivalent for offline attack
  'gstin', // business identifier, but personal for a sole proprietor
  'upi', // UPI VPA is a payment identifier tied to a person
  'accountNumber',
  'account_number',
  'ifsc',
  'bankAccount',
  'emergencyContact',
  'emergency_contact',
  'healthNotes',
  'medicalNotes',
  'medical_notes', // health data — the most sensitive category under DPDP

  // --- OI-S1: location, redacted ahead of the PRD amendment ---
  'lat',
  'lng',
  'latitude',
  'longitude',
  'coordinates',
  'location',
  'geo',
] as const;

/** The placeholder written in place of a redacted value. */
export const REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Builds the Pino `redact.paths` list.
 *
 * Pino matches literal paths, not names at arbitrary depth, unless a wildcard is used. `*.field`
 * covers one level and `*` alone does not recurse, so each field is registered at the roots where
 * request and response data actually lands. Getting this wrong is silent — the log simply keeps
 * the value — which is why `redaction.spec.ts` runs a synthetic corpus through the real
 * serialiser rather than asserting on this array.
 */
export function buildRedactionPaths(): string[] {
  const roots = [
    '',
    'req.',
    'req.body.',
    'req.query.',
    'req.params.',
    'req.headers.',
    'res.',
    'res.body.',
    'res.headers.',
    'err.',
    'error.',
    'context.',
    'payload.',
    'data.',
    'body.',
    'user.',
    'member.',
    'actor.',
    'details.',
    '*.',
    '*.*.',
  ];

  const paths = new Set<string>();
  for (const field of REDACTED_FIELD_NAMES) {
    for (const root of roots) {
      paths.add(`${root}${field}`);
      // Header names arrive lower-cased by Node; `Authorization` would otherwise slip through.
      paths.add(`${root}${field.toLowerCase()}`);
    }
  }

  // Headers are the highest-risk surface and are worth naming explicitly rather than relying on
  // the loop above: a bearer token in `authorization` is a complete session in one log line.
  paths.add('req.headers["authorization"]');
  paths.add('req.headers["cookie"]');
  paths.add('req.headers["x-api-key"]');
  paths.add('res.headers["set-cookie"]');

  return [...paths];
}

/**
 * Recursively redacts an arbitrary object. Used by the exception filter and any non-Pino sink
 * (Sentry `beforeSend`, the audit trail's diff builder) where Pino's path redaction does not run.
 *
 * Pino's own redaction does not apply to data handed to Sentry, and "we already redact in the
 * logger" is precisely how personal data reaches an error-tracking vendor instead.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isRedactedFieldName(key) ? REDACTION_PLACEHOLDER : redactDeep(v, depth + 1);
  }
  return out;
}

const REDACTED_LOWER = new Set<string>(REDACTED_FIELD_NAMES.map((f) => f.toLowerCase()));

/** Case-insensitive membership test. `Email`, `EMAIL` and `email` are all the same field. */
export function isRedactedFieldName(name: string): boolean {
  return REDACTED_LOWER.has(name.toLowerCase());
}
