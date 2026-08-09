/**
 * `M-029` · The binding that refuses, until `BLK-16` is answered — `BR-DAT-07`, `NFR-SEC-02`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A REFUSAL IS A FEATURE HERE, AND A STUB WOULD BE A HAZARD
 *
 * `A-18` approves the AWS SDK v3 S3 client, so nothing about the dependency blocks a real adapter.
 * What blocks it is that three of its decisions are specified twice and differently, and two are
 * not specified at all — see `BLK-16`:
 *
 *   · TTL — `Security.md` KY2 says **300 seconds**; `Admin.md` §5.2 says **15 minutes**. Peer rank,
 *     so neither wins, and `CLAUDE.md` §9.3 forbids settling it in code
 *   · single-use — `Admin.md` §5.2 requires it. A presigned S3 GET is not single-use and cannot be
 *     made so by the SDK; it needs a redirect endpoint the specification does not describe
 *   · `K-03` (the separate KMS CMK) and `K-09` (the separate storage credential) have NO
 *     configuration keys. `app-config.schema.ts` declares one access-key pair shared between the
 *     media and KYC buckets, so two of `Security.md` §8.3's four separations cannot be expressed
 *
 * ┌─ WHAT A "TEMPORARY" REAL ADAPTER WOULD HAVE DONE ─────────────────────────────────────────────┐
 * │ Picked one of the two TTLs. Used the media credential for KYC. Skipped single-use because the │
 * │ SDK cannot do it. Then passed every test, because the tests would have been written against   │
 * │ what it did. The enclave would exist on paper, and the first person to notice would be an     │
 * │ auditor asking which key encrypts the passports.                                               │
 * │                                                                                              │
 * │ `SprintPlanning` makes this a rule rather than a preference: the bucket, the key and the       │
 * │ access log must exist BEFORE the upload endpoint ships. Refusing is compliance with it.        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * The `KL-099` precedent, restated: the breached-password checker answers `UNAVAILABLE` and never
 * `NOT_BREACHED`, so the gap is a metric pinned at 100% rather than an invisible no-op. Same shape,
 * and the counters below are the same idea — the day an adapter lands they drop to zero, and
 * somebody can see that they did.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, Logger } from '@nestjs/common';

import type {
  ObjectStoragePort,
  PutObjectCommand,
  SignedUrl,
  SignedUrlCommand,
  StorageArea,
  StorageResult,
} from './object-storage.port.js';

const WHY =
  'No object-storage adapter is bound. BLK-16: the signed-URL TTL is specified as both 300s ' +
  '(Security.md KY2) and 15 minutes (Admin.md §5.2), single-use URLs are required but not ' +
  'providable by a presigned GET, and the K-03 KMS key and K-09 credential have no configuration ' +
  "keys — so two of Security.md §8.3's four KYC separations cannot currently be expressed.";

@Injectable()
export class UnavailableObjectStorageAdapter implements ObjectStoragePort {
  private readonly logger = new Logger(UnavailableObjectStorageAdapter.name);

  /**
   * Refusals since boot, by operation.
   *
   * Exported deliberately. `KL-099`'s value is that the gap is a NUMBER somebody can put on a
   * dashboard rather than a silence, and a port nobody calls looks identical to a port that works.
   */
  readonly refusals: Record<string, number> = { put: 0, signedUrl: 0, isPrivate: 0 };

  private refuse<T>(operation: string, context: Record<string, unknown>): StorageResult<T> {
    this.refusals[operation] = (this.refusals[operation] ?? 0) + 1;
    // `warn`, not `error`: this is the recorded state of the system, not a malfunction. An error
    // here would page somebody nightly for a decision that is sitting with the project owner.
    this.logger.warn({
      message: `object storage ${operation} refused — adapter unavailable (BLK-16)`,
      ...context,
    });
    return { ok: false, failure: 'UNAVAILABLE', detail: WHY };
  }

  put(command: PutObjectCommand): Promise<StorageResult<{ readonly key: string }>> {
    /*
     * `key` is NOT logged, even here where nothing was written.
     *
     * `KY9` puts `storage_key` on the redaction list, and a refusal path is exactly where somebody
     * reaches for "log everything so we can debug it". The area and the size answer every question
     * a debugger has; the key answers one only an attacker is asking.
     */
    return Promise.resolve(
      this.refuse('put', { area: command.area, byteSize: command.body.length }),
    );
  }

  signedUrl(command: SignedUrlCommand): Promise<StorageResult<SignedUrl>> {
    return Promise.resolve(
      this.refuse('signedUrl', { area: command.area, ttlSeconds: command.ttlSeconds }),
    );
  }

  isPrivate(area: StorageArea): Promise<StorageResult<boolean>> {
    /*
     * ┌─ THIS REFUSES RATHER THAN ANSWERING `false` ────────────────────────────────────────────┐
     * │ `false` would mean "the bucket is public", which is a claim about infrastructure this    │
     * │ adapter has not looked at. `true` would be worse — an unchecked all-clear on the exact   │
     * │ control `AC-7` asks to be asserted at runtime.                                            │
     * │                                                                                          │
     * │ Callers must treat `UNAVAILABLE` as "not proven private", never as "assume fine", and    │
     * │ the union type makes the third case impossible to ignore: there is no boolean to read    │
     * │ without first narrowing on `ok`.                                                          │
     * └──────────────────────────────────────────────────────────────────────────────────────────┘
     */
    return Promise.resolve(this.refuse('isPrivate', { area }));
  }
}
