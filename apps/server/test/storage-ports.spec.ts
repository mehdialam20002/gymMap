/**
 * `M-029` · The bindings refuse, and refuse in the RIGHT DIRECTION — `BLK-09`, `BLK-16`, `KL-104`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * A STUB THAT SAYS "FINE" IS WORSE THAN NO STUB
 *
 * Both adapters here are unbound-on-purpose, and for each there is a one-word change that would
 * make the whole upload path work today and be a breach:
 *
 *   `UnavailableMalwareScanAdapter`   `CLEAN` instead of `UNSCANNED` — every document in the
 *                                     platform recorded as scanned by a scanner that does not
 *                                     exist, indistinguishably from a real record, forever
 *   `UnavailableObjectStorageAdapter` `isPrivate` → `true` — an unchecked all-clear on the exact
 *                                     control `AC-7` asks to be asserted at runtime
 *
 * These tests exist to make those one-word changes fail loudly, because nothing else would notice.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { UnavailableObjectStorageAdapter } from '../dist/common/storage/unavailable-object-storage.adapter.js';
import { UnavailableMalwareScanAdapter } from '../dist/common/storage/unavailable-malware-scan.adapter.js';
import { mayBeServed } from '../dist/common/storage/malware-scan.port.js';

// ═══════════════════════════════════════════════════════════════════════════
// The scanner
// ═══════════════════════════════════════════════════════════════════════════

test('the unbound scanner answers UNSCANNED, and never CLEAN', async () => {
  const scanner = new UnavailableMalwareScanAdapter();
  const verdict = await scanner.scan(Buffer.from('anything at all'));

  assert.equal(verdict.outcome, 'UNSCANNED');
  assert.notEqual(verdict.outcome, 'CLEAN', 'an unbound scanner reported a file clean');
  assert.match(verdict.detail ?? '', /A-31|BLK-09|KL-104/);
});

test('mayBeServed is true ONLY for CLEAN', () => {
  // A single function rather than `outcome === 'CLEAN'` at four call sites, because one of those
  // four would eventually be written `!== 'INFECTED'` — and that one would serve every unscanned
  // object in the platform.
  assert.equal(mayBeServed({ outcome: 'CLEAN' }), true);
  assert.equal(mayBeServed({ outcome: 'INFECTED', signature: 'Eicar-Test-Signature' }), false);
  assert.equal(mayBeServed({ outcome: 'UNSCANNED', detail: 'no scanner' }), false);
});

test('the scanner counts what it could not scan, so the gap is a number', () => {
  // KL-099's shape: a metric pinned at 100% rather than an invisible no-op. A port nobody can see
  // failing looks identical to a port that works.
  const scanner = new UnavailableMalwareScanAdapter();
  assert.equal(scanner.unscanned, 0);
  return Promise.all([scanner.scan(Buffer.from('a')), scanner.scan(Buffer.from('b'))]).then(() => {
    assert.equal(scanner.unscanned, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The object store
// ═══════════════════════════════════════════════════════════════════════════

const put = {
  area: 'KYC' as const,
  key: 'kyc/opaque',
  body: Buffer.from('bytes'),
  contentType: 'application/pdf',
  checksumSha256: 'a'.repeat(64),
};

test('every operation refuses with UNAVAILABLE and says why', async () => {
  const storage = new UnavailableObjectStorageAdapter();

  for (const result of [
    await storage.put(put),
    await storage.signedUrl({
      area: 'KYC',
      key: 'kyc/opaque',
      ttlSeconds: 300,
      forceDownload: true,
    }),
    await storage.isPrivate('KYC'),
  ]) {
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.failure, 'UNAVAILABLE');
    assert.match(result.detail, /BLK-16/);
  }
});

test('isPrivate REFUSES rather than answering — neither true nor false is honest', async () => {
  // ┌─ THE ASSERTION THAT MATTERS MOST IN THIS FILE ─────────────────────────────────────────────┐
  // │ `true` is an unchecked all-clear on AC-7's runtime block-public-access assertion. `false`  │
  // │ is a claim about infrastructure this adapter never looked at, and would make callers        │
  // │ believe the bucket is public when nothing checked.                                          │
  // │                                                                                            │
  // │ The result union makes the third answer impossible to ignore: there is no boolean to read  │
  // │ without narrowing on `ok` first, so a caller cannot accidentally treat "unknown" as "fine". │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const storage = new UnavailableObjectStorageAdapter();
  const result = await storage.isPrivate('KYC');

  assert.equal(result.ok, false);
  assert.equal('value' in result, false, 'a boolean was returned for a check that never ran');
});

test('a refused put does NOT log the storage key', async () => {
  // KY9 puts `storage_key` on the redaction list, and a refusal path is exactly where somebody
  // reaches for "log everything so we can debug it". The area and the size answer every question a
  // debugger has; the key answers one only an attacker is asking.
  const storage = new UnavailableObjectStorageAdapter();
  const logged: unknown[] = [];
  (storage as unknown as { logger: { warn: (p: unknown) => void } }).logger = {
    warn: (payload: unknown) => logged.push(payload),
  };

  await storage.put({ ...put, key: 'kyc/tenant-a/passport-scan' });

  assert.equal(logged.length, 1);
  assert.equal(
    JSON.stringify(logged[0]).includes('passport-scan'),
    false,
    'the storage key reached a log line',
  );
});

test('refusals are counted per operation', () => {
  const storage = new UnavailableObjectStorageAdapter();
  return storage
    .signedUrl({ area: 'KYC', key: 'k', ttlSeconds: 300, forceDownload: true })
    .then(() =>
      storage.signedUrl({ area: 'MEDIA', key: 'k', ttlSeconds: 60, forceDownload: false }),
    )
    .then(() => {
      assert.equal(storage.refusals['signedUrl'], 2);
      assert.equal(storage.refusals['put'], 0);
    });
});
