/**
 * `M-024` · `AesGcmSecretCipher` — `NFR-SEC-07`, `Security.md` §2.8, §7.2.
 *
 * The properties that matter are the ones whose absence is invisible: a reused IV, a missing auth
 * tag check, a short key silently becoming AES-128. Each one leaves a system that encrypts, decrypts
 * and passes a round-trip test while providing much less than it claims.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { AesGcmSecretCipher } from '../dist/iam/infrastructure/secret-cipher.js';

const KEY = randomBytes(32).toString('base64');
const KEY_ID = 'local-dev-1';
const cipher = new AesGcmSecretCipher(KEY, KEY_ID);

const SECRET = randomBytes(20); // a 160-bit TOTP secret

test('a sealed secret opens back to exactly the same bytes', () => {
  assert.deepEqual(cipher.open(cipher.seal(SECRET)), SECRET);
});

test('the envelope is self-describing: version, key id, iv, ciphertext, tag', () => {
  const parts = cipher.seal(SECRET).split('.');

  assert.equal(parts.length, 5);
  assert.equal(parts[0], 'v1', 'the version is what lets the algorithm change later');
  assert.equal(parts[1], KEY_ID, 'the key id is what makes rotation possible');
  // 12 raw bytes → 16 base64url characters, unpadded.
  assert.equal(Buffer.from(parts[2] ?? '', 'base64url').length, 12);
  assert.equal(Buffer.from(parts[4] ?? '', 'base64url').length, 16, 'GCM tags are 128 bits');
});

test('the ciphertext never contains the plaintext', () => {
  // Trivial to state and worth asserting: an implementation that fell back to storing the raw
  // secret would pass the round-trip test above perfectly.
  const envelope = cipher.seal(SECRET);
  assert.ok(!envelope.includes(SECRET.toString('base64url')));
  assert.ok(!envelope.includes(SECRET.toString('hex')));
});

test('THE IV IS FRESH EVERY TIME — sealing the same secret twice gives different envelopes', () => {
  // ┌─ THE FAILURE THIS CATCHES IS TOTAL AND SILENT ─────────────────────────────────────────────┐
  // │ A deterministic IV — derived from the user id, or a constant "because the key is secret" —  │
  // │ round-trips perfectly and breaks GCM completely: two secrets under the same (key, iv) leak  │
  // │ the XOR of their plaintexts and let an attacker forge the authentication tag.                │
  // │                                                                                            │
  // │ Every other test in this file passes with a constant IV. This is the only one that does not.│
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const envelopes = new Set(Array.from({ length: 32 }, () => cipher.seal(SECRET)));
  assert.equal(envelopes.size, 32, 'the same secret sealed twice produced an identical envelope');

  // …and all of them still open to the same secret.
  for (const envelope of envelopes) assert.deepEqual(cipher.open(envelope), SECRET);
});

test('a TAMPERED ciphertext throws rather than decrypting to nonsense', () => {
  // Without the tag check, a corrupted row yields garbage that gets used as a TOTP secret: every
  // code the user submits is wrong, the account is locked out, and nothing anywhere logs an error.
  const [version, keyId, iv, ciphertext, tag] = cipher.seal(SECRET).split('.') as string[];

  const flipped = Buffer.from(ciphertext ?? '', 'base64url');
  flipped[0] = (flipped[0] ?? 0) ^ 0x01;

  assert.throws(() =>
    cipher.open([version, keyId, iv, flipped.toString('base64url'), tag].join('.')),
  );
});

test('a tampered TAG throws, and so does a tampered IV', () => {
  const [version, keyId, iv, ciphertext, tag] = cipher.seal(SECRET).split('.') as string[];

  const badTag = Buffer.from(tag ?? '', 'base64url');
  badTag[0] = (badTag[0] ?? 0) ^ 0x01;
  assert.throws(() => cipher.open([version, keyId, iv, ciphertext, badTag.toString('base64url')].join('.')));

  const badIv = Buffer.from(iv ?? '', 'base64url');
  badIv[0] = (badIv[0] ?? 0) ^ 0x01;
  assert.throws(() => cipher.open([version, keyId, badIv.toString('base64url'), ciphertext, tag].join('.')));
});

test('a DIFFERENT key cannot open the envelope', () => {
  const other = new AesGcmSecretCipher(randomBytes(32).toString('base64'), KEY_ID);
  assert.throws(() => other.open(cipher.seal(SECRET)));
});

test('an envelope sealed under another key ID is refused with a rotation-shaped message', () => {
  // Not a generic failure: the operator needs to know the previous key must stay available until
  // every row is re-sealed, which is the whole content of a rotation runbook.
  const rotated = new AesGcmSecretCipher(KEY, 'local-dev-2');
  assert.throws(
    () => rotated.open(cipher.seal(SECRET)),
    /sealed under key "local-dev-1".*holds "local-dev-2"/s,
  );
});

test('a malformed envelope throws instead of being parsed optimistically', () => {
  for (const bad of ['', 'v1', 'v1.k.a.b', 'v1.k.a.b.c.d', 'not-an-envelope']) {
    assert.throws(() => cipher.open(bad), `"${bad}" was accepted`);
  }

  // A version this build does not understand is refused rather than guessed at.
  const [, keyId, iv, ciphertext, tag] = cipher.seal(SECRET).split('.') as string[];
  assert.throws(() => cipher.open(['v2', keyId, iv, ciphertext, tag].join('.')), /version/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// Construction — the failures that must happen at BOOT, not at a user's request
// ═══════════════════════════════════════════════════════════════════════════

test('a key that is not 32 bytes is refused at construction, with instructions', () => {
  // ┌─ WHY THIS BELONGS AT BOOT ─────────────────────────────────────────────────────────────────┐
  // │ Node accepts a 16-byte key and gives AES-128 without comment. A deployment misconfigured    │
  // │ that way starts, serves traffic, and encrypts every secret at half the intended strength —  │
  // │ or throws on the first enrolment, hours later, in front of a user.                          │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  assert.throws(() => new AesGcmSecretCipher(randomBytes(16).toString('base64'), KEY_ID), /32 bytes/);
  assert.throws(() => new AesGcmSecretCipher('', KEY_ID), /32 bytes/);
  // The message tells the operator how to make one, because the next thing they do is search for it.
  assert.throws(() => new AesGcmSecretCipher('short', KEY_ID), /randomBytes\(32\)/);
});

test('hex and base64 key material are both accepted', () => {
  // The same 32 bytes pasted from two different tools look like two different strings, and a key
  // silently decoded as the wrong bytes produces a cipher that works — until the other one runs.
  const raw = randomBytes(32);
  const fromHex = new AesGcmSecretCipher(raw.toString('hex'), KEY_ID);
  const fromB64 = new AesGcmSecretCipher(raw.toString('base64'), KEY_ID);

  assert.deepEqual(fromB64.open(fromHex.seal(SECRET)), SECRET, 'hex and base64 decoded differently');
});

test('an empty key id is refused — rotation cannot tell two keys apart without one', () => {
  assert.throws(() => new AesGcmSecretCipher(KEY, ''), /id/i);
  assert.throws(() => new AesGcmSecretCipher(KEY, '   '), /id/i);
});
