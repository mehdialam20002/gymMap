/**
 * The two idempotency refusals — `AC-FND-07.1`, `AC-FND-07.3`, `BR-PAY-03`.
 *
 * Both are the CALLER's, so both are 4xx. That matters: a 500 here would be retried by the
 * client's own retry policy, and retrying a request that was refused for reusing a key is how a
 * client hammers itself into a rate limit while never succeeding.
 */

import { DomainException } from '../errors/domain-exception.js';

/**
 * 400 — a `§14.2.1` REQ-class endpoint was called with no `Idempotency-Key`.
 *
 * Refused rather than generated server-side. A server-generated key makes every attempt unique,
 * so a retry is a second execution — which is exactly the failure the header exists to prevent,
 * delivered by the mechanism meant to prevent it. The key must come from the client, because
 * only the client knows which two attempts are the same logical operation.
 */
export class IdempotencyKeyRequiredError extends DomainException {
  constructor(endpoint: string) {
    super('IDEMPOTENCY_KEY_REQUIRED', `${endpoint} requires an Idempotency-Key header.`, [
      {
        field: 'Idempotency-Key',
        endpoint,
        remedy:
          'Send a client-chosen value that is unique per logical operation and STABLE across ' +
          'retries — a UUID generated once, before the first attempt, and reused for every ' +
          'retry of it. A fresh value per attempt makes every retry a new charge.',
        diagnosis:
          'The server does not generate one. Only the client knows which two attempts are ' +
          'the same operation, so a server-generated key would make every retry unique — the ' +
          'exact failure this header exists to prevent (BR-PAY-03).',
      },
    ]);
  }
}

/**
 * 409 — the key has been seen, with a DIFFERENT request.
 *
 * Not "the key is in use". The key is fine; the body under it changed. That distinction is the
 * whole message, because the two remedies are opposite: a client that meant to retry has a bug
 * in what it is sending, and a client that meant a new operation has a bug in its key.
 */
export class IdempotencyKeyMismatchError extends DomainException {
  constructor(endpoint: string) {
    super(
      'IDEMPOTENCY_KEY_MISMATCH',
      'This Idempotency-Key was already used for a different request.',
      [
        {
          field: 'Idempotency-Key',
          endpoint,
          // The stored fingerprint is NOT returned. It would let a caller probe for the shape of
          // another request that used a colliding key, and it tells an honest client nothing it
          // can act on.
          remedy:
            'If this is a RETRY, send the identical body — the request differs from the one ' +
            'first stored under this key. If this is a NEW operation, generate a new key.',
          diagnosis:
            'Not retryable. Retrying reproduces the conflict, and retrying with a fresh key on ' +
            'a payment path turns a network blip into a double charge (BR-PAY-03).',
        },
      ],
    );
  }
}
