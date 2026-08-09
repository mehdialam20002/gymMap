/**
 * `M-029` · The object store, as a port — `BR-DAT-07`, `NFR-SEC-02`, `UP6`, `Security.md` §8.3.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO STORES, AND THE TYPE SYSTEM KNOWS WHICH IS WHICH
 *
 * `Security.md` §8.3 names four separations between media and KYC, and `PROJECT_CONSTITUTION.md`
 * `UP6` restates the load-bearing ones:
 *
 *   separate bucket             KYC objects never share a bucket with media
 *   separate key (`K-03`)       a KMS CMK whose key policy names only the KYC principal
 *   separate credential (`K-09`)a different principal from the media credential
 *   no CDN, ever                the KYC bucket has no distribution in front of it
 *
 * A single `putObject(bucket, key, body)` would make all four a matter of every caller passing the
 * right string. So `StorageArea` is a two-value union and the adapter resolves the bucket, the key
 * and the credential from it — a caller cannot write a passport scan into the media bucket by
 * getting an argument wrong, because there is no argument to get wrong.
 *
 * ┌─ WHY THIS FILE EXISTS BEFORE ANY ADAPTER DOES ────────────────────────────────────────────────┐
 * │ `A-18` approves the AWS SDK v3 S3 client, so an adapter is legal to write. It is not legal to │
 * │ write HONESTLY yet, and the reasons are recorded as `BLK-16`: the signed-URL TTL is specified │
 * │ twice and differently (300 s in `Security.md` KY2, 15 minutes in `Admin.md` §5.2), the spec   │
 * │ requires SINGLE-USE URLs which a presigned S3 GET does not provide, and the configuration     │
 * │ schema has one credential pair shared between both buckets and no KMS key id at all — so two  │
 * │ of §8.3's four separations are currently unrepresentable.                                      │
 * │                                                                                              │
 * │ An adapter written anyway would pick a TTL, share the media credential, and look finished.    │
 * │ The port is written now because everything downstream depends on its SHAPE, and the shape is  │
 * │ not in doubt.                                                                                  │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Which of the two stores an operation addresses.
 *
 * Not a bucket name. The adapter maps this to a bucket, a credential and a key — the caller never
 * names any of them, which is what makes the segregation structural rather than a convention.
 */
export type StorageArea = 'MEDIA' | 'KYC';

export interface PutObjectCommand {
  readonly area: StorageArea;
  /** Opaque. Never derived from a filename — see `KycStoragePort` for why. */
  readonly key: string;
  readonly body: Buffer;
  /** Determined by inspecting the bytes (`NFR-SEC-10`), never the client's declared header. */
  readonly contentType: string;
  /** Lower-case hex SHA-256 of `body`, so the store and the row cannot disagree about what landed. */
  readonly checksumSha256: string;
}

export interface SignedUrlCommand {
  readonly area: StorageArea;
  readonly key: string;
  /**
   * Seconds. The caller states it rather than the adapter defaulting it, because the correct value
   * is a specification question with two answers today (`BLK-16`) and a silent default would settle
   * it by accident.
   */
  readonly ttlSeconds: number;
  /**
   * `KY3` — `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` on the
   * presigned response. A KYC object is never rendered in a browser context.
   */
  readonly forceDownload: boolean;
}

/**
 * Why an operation could not be performed.
 *
 * ┌─ `UNAVAILABLE` IS NOT AN ERROR CASE, IT IS THE CURRENT STATE ─────────────────────────────────┐
 * │ No adapter is bound (`BLK-16`), so every call answers `UNAVAILABLE` today. This is the        │
 * │ `KL-099` pattern: the breached-password checker answers `UNAVAILABLE` and never                │
 * │ `NOT_BREACHED`, so the gap is a counter pinned at 100% rather than a stub reporting success.   │
 * │                                                                                              │
 * │ The distinction matters more here than there. A storage stub that returned a fabricated URL   │
 * │ would make the upload path look complete while writing nothing; one that returned "stored"    │
 * │ would let a reviewer approve a gym whose evidence does not exist.                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export type StorageFailure =
  'UNAVAILABLE' | 'NOT_FOUND' | 'CHECKSUM_MISMATCH' | 'REFUSED_PUBLIC_BUCKET';

export type StorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: StorageFailure; readonly detail: string };

export interface SignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface ObjectStoragePort {
  put(command: PutObjectCommand): Promise<StorageResult<{ readonly key: string }>>;

  /**
   * A URL good for one read, for `ttlSeconds`.
   *
   * The caller must have written its audit row FIRST — `BR-DAT-07`, and `Security.md` §8.3 states
   * the ordering explicitly so that a crash after the write still leaves the access on the record.
   * This port cannot enforce that and does not pretend to; `issue-kyc-access-url` is where the
   * ordering lives, and it is asserted there.
   */
  signedUrl(command: SignedUrlCommand): Promise<StorageResult<SignedUrl>>;

  /**
   * `NFR-SEC-02` / `AC-7` — the runtime half of the block-public-access assertion.
   *
   * Terraform asserts it at apply time; this asserts it at CALL time, because a bucket policy can
   * be changed by a console click at 3am and the next upload should refuse rather than proceed.
   * `false` means the enclave is not intact and no KYC object may be written.
   */
  isPrivate(area: StorageArea): Promise<StorageResult<boolean>>;
}

export const OBJECT_STORAGE_PORT = Symbol('OBJECT_STORAGE_PORT');
