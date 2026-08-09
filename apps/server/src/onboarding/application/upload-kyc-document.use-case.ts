/**
 * `M-029` · Accepting one KYC document — `FR-ONB-03`, `AC-9`, `NFR-SEC-10`, `BR-DAT-07`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ORDER IS THE DESIGN. EVERY STEP IS PLACED WHERE IT IS FOR A REASON THAT BITES.
 *
 *   1. INSPECT the bytes      cheapest, and it refuses the case `AC-9` names — a `.pdf` that is an
 *                             executable. Before anything touches storage or a scanner.
 *   2. HASH                   over the bytes we inspected, so the digest describes the object that
 *                             was judged and not some later re-read of a stream.
 *   3. SCAN                   only after the format is known to be one of three. Handing arbitrary
 *                             bytes to a scanner is how a scanner becomes the attack surface.
 *   4. PROVE the bucket private  `AC-7`'s runtime half. A KYC object is never written to a bucket
 *                             nobody just checked, and "could not check" is not "fine".
 *   5. PUT                    then, and only then.
 *   6. ROW + EVENT            in ONE transaction, `AC-6`'s guarantee, the same as submission.
 *
 * ┌─ WHY PUT BEFORE ROW, AND NOT THE OTHER WAY ──────────────────────────────────────────────────┐
 * │ Neither ordering is atomic across two systems, so the question is which orphan is less bad.   │
 * │                                                                                              │
 * │   object with no row  invisible to everything, and the bucket lifecycle eventually expires    │
 * │                       it. Nobody is misled                                                     │
 * │   row with no object  the checklist counts the document as supplied, a reviewer opens it and  │
 * │                       gets nothing, and `BR-GYM-01` approval rests on evidence that is not     │
 * │                       there                                                                    │
 * │                                                                                              │
 * │ So the object goes first. The row is the claim that the object exists, and a claim should not │
 * │ precede the fact.                                                                              │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ THIS USE CASE CANNOT SUCCEED TODAY, AND IT IS STILL WORTH HAVING ────────────────────────────┐
 * │ `ObjectStoragePort` is bound to an adapter that answers `UNAVAILABLE` (`BLK-16`) and           │
 * │ `MalwareScanPort` to one that answers `UNSCANNED` (`KL-104`), so step 4 refuses and nothing    │
 * │ is written. That is the accurate state of the enclave, not a gap in this file.                 │
 * │                                                                                              │
 * │ What is built here is the ORDER and the refusal semantics, which are the part that is easy to │
 * │ get wrong later under time pressure and hard to notice. Every step is exercised by unit tests │
 * │ against in-memory doubles, so the day an adapter lands the sequence is already proved.         │
 * │ `submit-application.use-case.ts` is the precedent: a use case with no route yet.               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  CLOCK,
  ID_GENERATOR,
  type Clock,
  type IdGenerator,
} from '../../common/clock/clock.port.js';
import { BusinessRuleException } from '../../common/errors/domain-exception.js';
import { OUTBOX_PORT, type OutboxPort } from '../../common/outbox/outbox.port.js';
import {
  MALWARE_SCAN_PORT,
  mayBeServed,
  type MalwareScanPort,
} from '../../common/storage/malware-scan.port.js';
import {
  OBJECT_STORAGE_PORT,
  type ObjectStoragePort,
} from '../../common/storage/object-storage.port.js';
import { inspectContent } from '../../common/storage/content-inspection.js';
import { PrismaService } from '../../tenancy/prisma/prisma.service.js';
import { currentTenantContext } from '../../tenancy/context/tenant-context.als.js';
import { MissingTenantContextError } from '../../tenancy/domain/tenancy.errors.js';

/**
 * `Security.md` §9.3 and `Gym.md` disagree about the ceiling — 20 MiB against 10 MB — so this is
 * the SMALLER of the two.
 *
 * A ceiling that is too low refuses a legitimate scan and the applicant re-exports at lower
 * quality; one that is too high accepts something a specification meant to refuse. Only one of
 * those is recoverable by the person on the other end, and picking the smaller number is not
 * settling the conflict — both documents permit it.
 */
export const MAX_KYC_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface UploadKycDocumentCommand {
  readonly documentType: string;
  /** As uploaded. Used for display only — never for the content type, never for the storage key. */
  readonly originalFilename: string;
  /** What the client CLAIMS it is. Recorded as a signal, never obeyed. */
  readonly declaredContentType?: string;
  readonly bytes: Buffer;
  /** `null` while the tenant is still assembling a draft — `Schema.md` §4.3. */
  readonly applicationId: string | null;
  readonly correlationId: string;
}

export interface UploadKycDocumentResult {
  readonly documentId: string;
  readonly contentType: string;
  readonly byteSize: number;
}

@Injectable()
export class UploadKycDocumentUseCase {
  constructor(
    private readonly db: PrismaService,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @Inject(MALWARE_SCAN_PORT) private readonly scanner: MalwareScanPort,
    @Inject(OUTBOX_PORT) private readonly outbox: OutboxPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: UploadKycDocumentCommand): Promise<UploadKycDocumentResult> {
    const context = currentTenantContext();
    if (context.kind !== 'TENANT') {
      throw new MissingTenantContextError('KycDocument', 'upload');
    }

    // ── 1 · what the bytes actually are ──────────────────────────────────────────────────────
    const inspection = inspectContent(command.bytes, MAX_KYC_DOCUMENT_BYTES);
    if (!inspection.ok) {
      /*
       * The REASON reaches the applicant; the detail does not name the file and never dumps bytes.
       * `Gym.md` §793: name the field and the expected shape, never the value.
       */
      throw new BusinessRuleException(
        'KYC_DOCUMENT_REJECTED',
        `The uploaded file was refused: ${inspection.reason}. ${inspection.detail}`,
      );
    }

    // ── 2 · the digest, over the bytes that were just judged ─────────────────────────────────
    const checksumSha256 = createHash('sha256').update(command.bytes).digest('hex');

    // ── 3 · malware ──────────────────────────────────────────────────────────────────────────
    const verdict = await this.scanner.scan(command.bytes);
    if (!mayBeServed(verdict)) {
      /*
       * ┌─ `UNSCANNED` AND `INFECTED` BOTH LAND HERE, AND THAT IS THE POINT ────────────────────┐
       * │ `mayBeServed` is true only for `CLEAN`, so "the scanner is down" and "the file is      │
       * │ infected" produce the same refusal. The tempting alternative — let it through and scan │
       * │ later — converts a scanner outage into an unscanned corpus nobody can identify          │
       * │ afterwards. `Security.md` §9.3 `U12` keeps an upload quarantined until it is scanned;   │
       * │ unavailable simply means quarantine never ends.                                         │
       * │                                                                                        │
       * │ The two are distinguished in the MESSAGE, because they mean different things to the    │
       * │ person holding the file, and identical in EFFECT, because nothing is stored either way.│
       * └────────────────────────────────────────────────────────────────────────────────────────┘
       */
      throw new BusinessRuleException(
        'KYC_DOCUMENT_REJECTED',
        verdict.outcome === 'INFECTED'
          ? 'The uploaded file did not pass the malware scan.'
          : `The file could not be scanned, so it has not been stored. ${verdict.detail ?? ''}`,
      );
    }

    // ── 4 · the enclave is intact, checked NOW ───────────────────────────────────────────────
    const privacy = await this.storage.isPrivate('KYC');
    if (!privacy.ok || !privacy.value) {
      /*
       * `!privacy.ok` and `privacy.value === false` are both refusals, deliberately.
       *
       * Terraform asserts `block_public_access` at apply time; a bucket policy can be changed by a
       * console click at 3am. "Could not check" is not "fine" — a KYC object written to a bucket
       * nobody just proved private is the one mistake `BR-DAT-07` exists to prevent, and it is
       * unrecoverable once the object is out.
       */
      throw new BusinessRuleException(
        'KYC_STORAGE_UNAVAILABLE',
        privacy.ok
          ? 'The KYC bucket is not private. No document may be written until it is.'
          : `The KYC enclave could not be verified: ${privacy.detail}`,
      );
    }

    // ── 5 · store ────────────────────────────────────────────────────────────────────────────
    /*
     * The key is OPAQUE and derived from a fresh id, never from the filename.
     *
     * A key built from `${tenant}/${filename}` leaks the tenant and the document's nature to
     * anyone who sees a key — and `KY9` puts `storage_key` on the redaction list precisely because
     * a key is the address of a passport scan. An opaque key also cannot collide on two applicants
     * uploading `pan.pdf`.
     */
    const documentId = this.ids.uuid();
    const storageKey = `kyc/${documentId}`;

    const stored = await this.storage.put({
      area: 'KYC',
      key: storageKey,
      body: command.bytes,
      contentType: inspection.contentType,
      checksumSha256,
    });
    if (!stored.ok) {
      throw new BusinessRuleException(
        'KYC_STORAGE_UNAVAILABLE',
        `The document could not be stored: ${stored.detail}`,
      );
    }

    // ── 6 · the row and the event, together ──────────────────────────────────────────────────
    await this.db.client.$transaction(async (tx) => {
      await tx.kycDocument.create({
        data: {
          id: documentId,
          tenantId: context.tenantId,
          applicationId: command.applicationId,
          documentType: command.documentType as never,
          storageKey,
          originalFilename: command.originalFilename,
          contentType: inspection.contentType,
          byteSize: BigInt(command.bytes.length),
          checksumSha256,
        },
      });

      /*
       * `kyc.document.uploaded`, not `KycDocumentUploaded`.
       *
       * `ck_outbox__event_type` requires lowercase dotted segments and the first may not contain a
       * hyphen, so the spec's `KycDocumentUploaded` and the obvious `kyc-document.uploaded` are
       * both refused by the database. The committed precedent is
       * `submit-application.use-case.ts`: aggregate `Application`, event `application.submitted`.
       *
       * No filename, no key, no digest in the payload. A consumer that needs the document reads it
       * through the audited access path; an event is not a side door into the enclave.
       */
      await this.outbox.record(tx as never, {
        aggregateType: 'KycDocument',
        aggregateId: documentId,
        eventType: 'kyc.document.uploaded',
        payload: { documentType: command.documentType, uploadedAt: this.clock.now().toISOString() },
      });
    });

    return { documentId, contentType: inspection.contentType, byteSize: command.bytes.length };
  }
}
