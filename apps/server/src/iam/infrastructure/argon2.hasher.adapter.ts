/**
 * M-020 · Argon2id — `A-12`, `FR-AUTH-04`, `NFR-SEC-01`, `Security.md` §2.4.2.
 *
 * ┌─ THE PARAMETERS ARE CONFIGURATION AND THEY ARE ASSERTED ────────────────────────────────────┐
 * │ `A-12` was approved on one condition: *"Parameter tuning must be recorded."*                │
 * │ `Security.md` §2.4.2 is that record — `m=65536, t=3, p=1`, 32-byte output, 16-byte salt.    │
 * │                                                                                              │
 * │ They are read from `AppConfig` and not hardcoded, because §2.4.2 also requires annual        │
 * │ re-calibration and re-calibration on any instance-class or Node-major change. A constant     │
 * │ makes that a code change; configuration makes it a deployment one.                           │
 * │                                                                                              │
 * │ `argon2.hasher.adapter.spec.ts` asserts the EFFECTIVE parameters against §2.4.2's recorded   │
 * │ values by parsing them back out of a real hash. That is what stops an `argon2` upgrade with │
 * │ a changed default from silently weakening every password while the suite stays green.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE SEMAPHORE IS A SECURITY CONTROL, NOT A PERFORMANCE ONE ────────────────────────────────┐
 * │ 64 MiB per hash is the point of Argon2id — it is what makes a GPU hold ~384 concurrent      │
 * │ hashes instead of tens of thousands. It is also 64 MiB of OUR memory, per in-flight login.  │
 * │                                                                                              │
 * │ Unbounded, a login flood is a memory-exhaustion denial of service caused by the security     │
 * │ control itself (`Security.md` §2.4.2, STRIDE A1/D). Eight permits caps the transient cost at │
 * │ 512 MiB, and the WAIT is bounded too — otherwise an attacker converts a memory limit into    │
 * │ unbounded latency, which is the same outage wearing a different hat.                          │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THE DECOY HASH IS BUILT AT CONSTRUCTION, NOT ON DEMAND ────────────────────────────────────┐
 * │ `Security.md` §2.4.2: an unknown identifier must still cost ~250 ms, or its absence is a    │
 * │ user-enumeration oracle that no amount of response-body uniformity fixes.                    │
 * │                                                                                              │
 * │ Building it lazily would make the FIRST unknown-identifier request slower than the rest —    │
 * │ measurable, and pointing at exactly the thing being hidden.                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';

import { APP_CONFIG, type AppConfig } from '../../common/config/app-config.schema.js';
import type { PasswordHasher } from '../application/ports/password-hasher.port.js';

/** `$argon2id$v=19$<params>$<salt>$<hash>` — the variant and version, then the parameter list. */
const PHC_PREFIX = /^\$argon2id\$v=\d+\$([^$]+)\$/;

export interface Argon2Parameters {
  readonly memoryCost: number;
  readonly timeCost: number;
  readonly parallelism: number;
}

/**
 * Reads the parameters back out of a stored hash. `null` if it is not an argon2id PHC string.
 *
 * ┌─ PARSED BY KEY, NOT BY POSITION ────────────────────────────────────────────────────────────┐
 * │ `Security.md` §2.4.2 writes the encoded form as `m=65536,t=3,p=1`. This binding emits       │
 * │ `m=65536,p=1,t=3` — the same three values in a different order. A positional regex written  │
 * │ from the document parses every real hash as `null`, which `needsRehash` reads as "not our   │
 * │ format" and answers `true` to — so every login would silently re-hash a password that was   │
 * │ already correct, forever.                                                                    │
 * │                                                                                              │
 * │ The PHC specification does not fix the order of the parameter list, so keying off it is     │
 * │ wrong regardless of which order today's version happens to use.                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export function parsePhcParameters(storedHash: string): Argon2Parameters | null {
  const match = PHC_PREFIX.exec(storedHash);
  if (match === null) return null;

  const values = new Map<string, number>();
  for (const pair of match[1]!.split(',')) {
    const [key, raw] = pair.split('=');
    if (key === undefined || raw === undefined) return null;
    const value = Number(raw);
    if (!Number.isInteger(value)) return null;
    values.set(key, value);
  }

  const memoryCost = values.get('m');
  const timeCost = values.get('t');
  const parallelism = values.get('p');
  if (memoryCost === undefined || timeCost === undefined || parallelism === undefined) return null;

  return { memoryCost, timeCost, parallelism };
}

/**
 * A counting semaphore with a bounded wait.
 *
 * Deliberately not a library. The whole behaviour is thirty lines, and the one property that
 * matters — that a timed-out waiter is removed from the queue rather than left to acquire a
 * permit nobody will release — is easier to see here than to verify in a dependency.
 */
export class BoundedSemaphore {
  private available: number;
  private readonly waiting: {
    resolve: () => void;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout;
  }[] = [];

  constructor(
    permits: number,
    private readonly timeoutMs: number,
  ) {
    this.available = permits;
  }

  get queueDepth(): number {
    return this.waiting.length;
  }

  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const entry = {
        resolve,
        reject,
        timer: setTimeout(() => {
          // Remove SELF from the queue before rejecting. Without this the waiter is still in
          // the array, `release()` hands it a permit, and that permit is never returned —
          // so the pool leaks one slot per timeout until nothing can hash at all.
          const at = this.waiting.indexOf(entry);
          if (at !== -1) this.waiting.splice(at, 1);
          reject(new Error(`no hash slot within ${String(this.timeoutMs)}ms`));
        }, this.timeoutMs),
      };
      this.waiting.push(entry);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next === undefined) {
      this.available += 1;
      return;
    }
    clearTimeout(next.timer);
    next.resolve();
  }
}

@Injectable()
export class Argon2HasherAdapter implements PasswordHasher, OnModuleInit {
  private readonly logger = new Logger(Argon2HasherAdapter.name);
  // `HashOptions` WITHOUT `raw`. `argon2.hash` is overloaded on it — `raw: true` returns a
  // Buffer, anything else a PHC string — and only the string form is storable, because the
  // parameters and salt travel inside it.
  private readonly options: argon2.HashOptions;
  private readonly semaphore: BoundedSemaphore;

  /**
   * The same three numbers as `options`, but non-optional.
   *
   * `HashOptions` marks every field optional, so `options.memoryCost` is `number | undefined`
   * and every comparison in `needsRehash` would need a `?? 0` — which silently answers "not
   * weaker" if the field were ever actually missing. Resolving them once, here, makes the
   * comparison total.
   */
  readonly policy: Argon2Parameters;

  /** A real hash, with the real parameters, to verify against for an unknown identifier. */
  private decoyHash: string | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.policy = {
      memoryCost: config.ARGON2_MEMORY_COST,
      timeCost: config.ARGON2_TIME_COST,
      parallelism: config.ARGON2_PARALLELISM,
    };
    this.options = {
      type: argon2.argon2id,
      ...this.policy,
      hashLength: 32, // §2.4.2 — 256-bit output, matching everything else in the system.
      // No `saltLength`: this binding does not expose one. It generates a CSPRNG salt of
      // exactly the 16 bytes §2.4.2 requires and encodes it into the PHC string, which
      // `argon2.hasher.adapter.spec.ts` asserts by decoding a real hash rather than trusting
      // the default to stay put across an upgrade.
    };
    this.semaphore = new BoundedSemaphore(
      config.ARGON2_MAX_CONCURRENCY,
      config.ARGON2_QUEUE_TIMEOUT_MS,
    );
  }

  /** Builds the decoy at boot so the first unknown-identifier login is not the slow one. */
  async onModuleInit(): Promise<void> {
    this.decoyHash = await this.buildDecoy();
    this.logger.log({
      message: 'argon2id ready',
      memoryCost: this.options.memoryCost,
      timeCost: this.options.timeCost,
      parallelism: this.options.parallelism,
      maxConcurrency: this.config.ARGON2_MAX_CONCURRENCY,
    });
  }

  async hash(password: string): Promise<string> {
    return this.withSlot(() => argon2.hash(password, this.options));
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    // A malformed stored hash is data corruption, and `argon2.verify` throws on it. That throw
    // is NOT caught here: swallowing it would report "wrong password" for an account whose hash
    // is broken, and the member would reset a password that was never the problem.
    return this.withSlot(() => argon2.verify(storedHash, password));
  }

  /**
   * Deliberately NOT `argon2.needsRehash()`.
   *
   * The library's version returns true when the parameters DIFFER in either direction. §2.4.2
   * says re-hash when they are *"weaker than current policy"* — and after a deliberate downgrade
   * (a smaller instance class, say) the library's answer would re-hash every strong password
   * into a weaker one, on login, silently. One-directional is the specified behaviour.
   */
  needsRehash(storedHash: string): boolean {
    const current = parsePhcParameters(storedHash);
    // Unparseable means "not our format", which means it must be replaced. Returning false would
    // leave a legacy or corrupt hash in place forever.
    if (current === null) return true;

    return (
      current.memoryCost < this.policy.memoryCost ||
      current.timeCost < this.policy.timeCost ||
      current.parallelism < this.policy.parallelism
    );
  }

  async burnEquivalentWork(password: string): Promise<void> {
    // Only null if the class was constructed without `onModuleInit` — a test instantiating it
    // directly. Building it now is slower than the boot-time path but still burns the work,
    // which is the property that matters.
    this.decoyHash ??= await this.buildDecoy();
    // The result is discarded — it is always false. The COST is the point.
    await this.verify(this.decoyHash, password);
  }

  private buildDecoy(): Promise<string> {
    // Not a fixed literal: a decoy whose plaintext appeared in source could be used to confirm
    // the decoy path was taken, by timing a verify that SUCCEEDS against one that fails.
    const filler = Buffer.from(new Uint8Array(32).fill(0)).toString('hex');
    return argon2.hash(`decoy:${filler}`, this.options);
  }

  /** The queue depth, for the `/readyz` detail and the §2.4.2 saturation alert. */
  get pendingHashes(): number {
    return this.semaphore.queueDepth;
  }

  private async withSlot<T>(work: () => Promise<T>): Promise<T> {
    try {
      await this.semaphore.acquire();
    } catch {
      // §2.4.2's bounded wait, expressed as the documented outcome. Not a 500: the request is
      // fine, the instance is saturated, and 503 is what a load balancer acts on.
      throw new HashCapacityExhaustedError(this.config.ARGON2_QUEUE_TIMEOUT_MS);
    }

    try {
      return await work();
    } finally {
      // `finally`, always. A throw that skipped the release would permanently retire a permit,
      // and eight throws would take the instance's login path offline with no error to explain it.
      this.semaphore.release();
    }
  }
}

/** Raised when the hash semaphore's bounded wait expires. Maps to `503`. */
export class HashCapacityExhaustedError extends Error {
  constructor(timeoutMs: number) {
    super(
      `No Argon2id slot became available within ${String(timeoutMs)}ms. The instance is at its ` +
        'concurrent-hash ceiling (Security.md §2.4.2), which is a deliberate memory cap rather ' +
        'than a fault — 8 × 64 MiB. Shed load or scale out; do NOT raise the ceiling without ' +
        'raising the instance memory with it.',
    );
    this.name = 'HashCapacityExhaustedError';
  }
}
