/**
 * `M-029` · The upload sequence — `FR-ONB-03`, `AC-6`, `AC-7`, `AC-9`, `NFR-SEC-10`, `BR-DAT-07`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ORDER IS THE THING UNDER TEST, NOT THE HAPPY PATH
 *
 * Every collaborator here records that it was called, so the assertions are about WHAT RAN and
 * WHAT DID NOT. That is the property worth protecting: each step is placed where it is because
 * running it later would be a real hazard, and nothing about a rearranged sequence looks wrong in
 * a diff.
 *
 *   inspect before scan      handing arbitrary bytes to a scanner makes the scanner the surface
 *   scan before isPrivate    no point proving a bucket private for a file that will not be stored
 *   isPrivate before put     `AC-7` — never write to a bucket nobody just checked
 *   put before the row       a row claiming an object that does not exist misleads a reviewer
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_KYC_DOCUMENT_BYTES,
  UploadKycDocumentUseCase,
} from '../dist/onboarding/application/upload-kyc-document.use-case.js';
import { runWithTenant } from '../dist/tenancy/context/tenant-context.als.js';

const TENANT = '0192de00-6028-7000-8000-0000000000c1';

/** A real PDF prefix. Everything downstream treats it as `application/pdf`. */
function pdf(length = 4096): Buffer {
  const bytes = Buffer.alloc(length, 0x20);
  Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]).copy(bytes, 0);
  return bytes;
}

interface Recorded {
  readonly calls: string[];
  readonly created: Record<string, unknown>[];
  readonly events: Record<string, unknown>[];
}

interface Doubles {
  readonly scan: 'CLEAN' | 'INFECTED' | 'UNSCANNED';
  readonly isPrivate: boolean | 'REFUSE';
  readonly put: 'ok' | 'REFUSE';
}

function build(overrides: Partial<Doubles> = {}) {
  const options: Doubles = { scan: 'CLEAN', isPrivate: true, put: 'ok', ...overrides };
  const recorded: Recorded = { calls: [], created: [], events: [] };

  const storage = {
    isPrivate: (area: string) => {
      recorded.calls.push(`isPrivate:${area}`);
      return Promise.resolve(
        options.isPrivate === 'REFUSE'
          ? { ok: false, failure: 'UNAVAILABLE', detail: 'no adapter (BLK-16)' }
          : { ok: true, value: options.isPrivate },
      );
    },
    put: (command: { key: string }) => {
      recorded.calls.push('put');
      return Promise.resolve(
        options.put === 'REFUSE'
          ? { ok: false, failure: 'UNAVAILABLE', detail: 'no adapter (BLK-16)' }
          : { ok: true, value: { key: command.key } },
      );
    },
    signedUrl: () => Promise.reject(new Error('not used')),
  };

  const scanner = {
    scan: () => {
      recorded.calls.push('scan');
      return Promise.resolve({ outcome: options.scan, detail: 'doubled' });
    },
  };

  const tx = {
    kycDocument: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        recorded.calls.push('createRow');
        recorded.created.push(data);
        return Promise.resolve(data);
      },
    },
  };

  const db = {
    client: {
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => {
        recorded.calls.push('beginTransaction');
        return fn(tx);
      },
    },
  };

  const outbox = {
    record: (_tx: unknown, event: Record<string, unknown>) => {
      recorded.calls.push('outbox');
      recorded.events.push(event);
      return Promise.resolve();
    },
  };

  const clock = { now: () => new Date('2026-08-09T12:00:00.000Z') };
  let n = 0;
  const ids = { uuid: () => `0192de00-0000-7000-8000-00000000000${String(++n)}` };

  const useCase = new UploadKycDocumentUseCase(
    db as never,
    storage as never,
    scanner as never,
    outbox as never,
    clock as never,
    ids as never,
  );

  return { useCase, recorded };
}

const command = (bytes: Buffer) => ({
  documentType: 'PAN',
  originalFilename: 'pan-card.pdf',
  declaredContentType: 'application/octet-stream',
  bytes,
  applicationId: null,
  correlationId: '0192de00-6028-7000-8000-0000000000ff',
});

function inTenant<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(TENANT as never, fn);
}

// ═══════════════════════════════════════════════════════════════════════════
// The sequence
// ═══════════════════════════════════════════════════════════════════════════

test('the happy path runs every step, in order', async () => {
  const { useCase, recorded } = build();

  const result = await inTenant(() => useCase.execute(command(pdf()) as never));

  assert.deepEqual(recorded.calls, [
    'scan',
    'isPrivate:KYC',
    'put',
    'beginTransaction',
    'createRow',
    'outbox',
  ]);
  assert.equal(result.contentType, 'application/pdf');
  assert.equal(result.byteSize, 4096);
});

test('AC-9 — a mislabelled executable is refused BEFORE the scanner is called', async () => {
  // ┌─ WHY THIS ORDER, NOT MERELY THAT BOTH HAPPEN ──────────────────────────────────────────────┐
  // │ A scanner is a parser fed attacker-controlled bytes, and parsers are where scanners have    │
  // │ their own CVEs. Refusing three-formats-or-nothing first means the scanner only ever sees a  │
  // │ PDF, a JPEG or a PNG.                                                                        │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const { useCase, recorded } = build();
  const executable = Buffer.alloc(512, 0x20);
  Buffer.from([0x4d, 0x5a, 0x90, 0x00]).copy(executable, 0);

  await assert.rejects(
    () => inTenant(() => useCase.execute(command(executable) as never)),
    /EXECUTABLE_CONTENT/,
  );
  assert.deepEqual(recorded.calls, [], 'something ran before the format was known');
});

test('AC-7 — the bucket is proved private BEFORE anything is written', async () => {
  const { useCase, recorded } = build({ isPrivate: false });

  await assert.rejects(
    () => inTenant(() => useCase.execute(command(pdf()) as never)),
    /not private/,
  );
  assert.deepEqual(recorded.calls, ['scan', 'isPrivate:KYC'], 'a put happened anyway');
});

test('AC-7 — "could not check" is treated as NOT private, never as fine', async () => {
  // The refusal that matters. A bucket policy can be changed by a console click at 3am; an
  // unverifiable enclave is not a verified one, and the object is unrecoverable once written.
  const { useCase, recorded } = build({ isPrivate: 'REFUSE' });

  await assert.rejects(
    () => inTenant(() => useCase.execute(command(pdf()) as never)),
    /could not be verified/,
  );
  assert.equal(recorded.calls.includes('put'), false);
});

test('no row is written when the object was not stored', async () => {
  // The orphan that misleads: a row claiming an object that is not there makes the checklist
  // report the document supplied and gives the reviewer a 404 on the evidence.
  const { useCase, recorded } = build({ put: 'REFUSE' });

  await assert.rejects(() => inTenant(() => useCase.execute(command(pdf()) as never)), /stored/);
  assert.equal(recorded.calls.includes('beginTransaction'), false);
  assert.deepEqual(recorded.created, []);
});

// ═══════════════════════════════════════════════════════════════════════════
// The scan verdict
// ═══════════════════════════════════════════════════════════════════════════

test('INFECTED and UNSCANNED both stop the upload, and both stop it at the same place', async () => {
  for (const outcome of ['INFECTED', 'UNSCANNED'] as const) {
    const { useCase, recorded } = build({ scan: outcome });

    await assert.rejects(() => inTenant(() => useCase.execute(command(pdf()) as never)));
    assert.deepEqual(recorded.calls, ['scan'], `${outcome} got past the scanner`);
  }
});

test('the two scan refusals differ in MESSAGE, because they mean different things', async () => {
  // Identical in effect, distinguishable to the person holding the file: one of them should try a
  // different document, the other should try again later.
  const infected = build({ scan: 'INFECTED' });
  await assert.rejects(
    () => inTenant(() => infected.useCase.execute(command(pdf()) as never)),
    /malware scan/,
  );

  const unscanned = build({ scan: 'UNSCANNED' });
  await assert.rejects(
    () => inTenant(() => unscanned.useCase.execute(command(pdf()) as never)),
    /could not be scanned/,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// What is written
// ═══════════════════════════════════════════════════════════════════════════

test('the stored content type is the INSPECTED one, not the declared one', async () => {
  // The command declares `application/octet-stream`. The bytes are a PDF. The row records the PDF.
  const { useCase, recorded } = build();
  await inTenant(() => useCase.execute(command(pdf()) as never));

  assert.equal(recorded.created[0]?.['contentType'], 'application/pdf');
});

test('the storage key is opaque and contains no filename', async () => {
  // `KY9` puts `storage_key` on the redaction list because a key is the address of a passport
  // scan. A key built from the filename would leak the document's nature to anyone who sees one,
  // and would collide across two applicants both uploading `pan.pdf`.
  const { useCase, recorded } = build();
  await inTenant(() => useCase.execute(command(pdf()) as never));

  const key = String(recorded.created[0]?.['storageKey']);
  assert.match(key, /^kyc\/[0-9a-f-]+$/);
  assert.equal(key.includes('pan-card'), false);
  assert.equal(key.includes(TENANT), false, 'the key leaks the tenant id');
});

test('the digest is the SHA-256 of the bytes that were inspected', async () => {
  const { useCase, recorded } = build();
  const bytes = pdf();
  await inTenant(() => useCase.execute(command(bytes) as never));

  const { createHash } = await import('node:crypto');
  assert.equal(
    recorded.created[0]?.['checksumSha256'],
    createHash('sha256').update(bytes).digest('hex'),
  );
});

test('AC-6 — the row and the event are in ONE transaction, event last', async () => {
  const { useCase, recorded } = build();
  await inTenant(() => useCase.execute(command(pdf()) as never));

  const begin = recorded.calls.indexOf('beginTransaction');
  assert.ok(begin < recorded.calls.indexOf('createRow'));
  assert.ok(recorded.calls.indexOf('createRow') < recorded.calls.indexOf('outbox'));
});

test('the event name satisfies ck_outbox__event_type, which the spec wording does not', async () => {
  // `Gym.md` says "outbox KycDocumentUploaded". The CHECK requires lowercase dotted segments whose
  // first may not contain a hyphen, so both `KycDocumentUploaded` and `kyc-document.uploaded` are
  // refused by the database — and unlike the audit path that failure is loud, because the outbox
  // write is inside the caller's transaction and rolls the whole upload back.
  const { useCase, recorded } = build();
  await inTenant(() => useCase.execute(command(pdf()) as never));

  const event = recorded.events[0];
  assert.equal(event?.['aggregateType'], 'KycDocument');
  assert.match(String(event?.['eventType']), /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,3}$/);
  assert.equal(event?.['eventType'], 'kyc.document.uploaded');
});

test('the event carries no filename, key or digest', async () => {
  // An event is not a side door into the enclave. A consumer that needs the document reads it
  // through the audited access path.
  const { useCase, recorded } = build();
  await inTenant(() => useCase.execute(command(pdf()) as never));

  const payload = JSON.stringify(recorded.events[0]?.['payload']);
  for (const leak of ['pan-card', 'kyc/', 'checksum']) {
    assert.equal(payload.includes(leak), false, `the event payload leaks ${leak}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Boundaries
// ═══════════════════════════════════════════════════════════════════════════

test('the ceiling is the SMALLER of the two specified figures', async () => {
  // `Security.md` §9.3 says 20 MiB and `Gym.md` says 10 MB. Both permit 10 MB, so choosing it is
  // not settling the conflict — and the direction of the error is recoverable by the applicant.
  assert.equal(MAX_KYC_DOCUMENT_BYTES, 10 * 1024 * 1024);

  const { useCase, recorded } = build();
  await assert.rejects(
    () => inTenant(() => useCase.execute(command(pdf(MAX_KYC_DOCUMENT_BYTES + 1)) as never)),
    /TOO_LARGE/,
  );
  assert.deepEqual(recorded.calls, []);
});

test('a draft upload with no application is accepted — Schema.md §4.3', async () => {
  // The state every applicant passes through. M-026 had `application_id NOT NULL`, which required
  // submitting before uploading anything; TD-037 corrected it.
  const { useCase, recorded } = build();
  await inTenant(() => useCase.execute({ ...command(pdf()), applicationId: null } as never));

  assert.equal(recorded.created[0]?.['applicationId'], null);
});

test('no tenant context is a refusal, not a row with a guessed tenant', async () => {
  const { useCase, recorded } = build();

  await assert.rejects(() => useCase.execute(command(pdf()) as never));
  assert.deepEqual(recorded.calls, []);
});
