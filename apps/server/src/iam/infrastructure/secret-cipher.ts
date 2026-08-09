/**
 * `M-024` · Encrypting the TOTP secret at rest — `NFR-SEC-07`, `Security.md` §2.8, §7.2.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * AES-256-GCM, AND THE ENVELOPE IS THE POINT
 *
 * §2.8: the TOTP secret is *"160-bit CSPRNG, encrypted at rest under the application data key"*.
 * What gets stored is not ciphertext — it is a self-describing envelope:
 *
 *     v1.<keyId>.<iv-base64url>.<ciphertext-base64url>.<tag-base64url>
 *
 * Every part of that earns its place. The VERSION lets the algorithm change without a migration
 * that cannot read what it is migrating. The KEY ID is what makes rotation possible at all: a new
 * key encrypts new rows, and old rows still decrypt because each one names the key it needs. The IV
 * is per-secret and random — reusing one under the same key in GCM is catastrophic, it leaks the
 * XOR of two plaintexts and forges the authenticator. The TAG is what makes this AUTHENTICATED
 * encryption: without it a corrupted row decrypts to garbage that gets used as a TOTP secret, and
 * every code the user submits is wrong with no error anywhere.
 *
 * GCM rather than CBC because a TOTP secret is small, and the tag is the difference between
 * "decryption failed" and "decryption produced nonsense".
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─ WHAT THIS DOES NOT DO, STATED PLAINLY ─────────────────────────────────────────────────────┐
 * │ `M-024` acceptance criterion 4 asks for a key "from the managed secret store, never in source, │
 * │ never in an environment file". There IS no managed secret store in this stack yet — `A-15`'s   │
 * │ observability vendor is approved, a secret manager is not — so the key arrives the same way    │
 * │ `JWT_ACCESS_SECRET` and `QR_SIGNING_PRIVATE_KEY` already do: configuration, which in local     │
 * │ development is `.env.local` and in a deployment is whatever injects the environment.           │
 * │                                                                                                │
 * │ The half of the criterion that IS met is the half this file can meet: the key is never in      │
 * │ source, the port below is where a secret-store adapter binds when one exists, and the envelope │
 * │ already carries the key id that rotation needs. The gap is recorded in `KNOWN_LIMITATIONS.md`  │
 * │ rather than left for someone to discover by reading the criterion and assuming.                │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/** The port. A secret-store-backed implementation binds here without touching a caller. */
export const SECRET_CIPHER = Symbol('SecretCipher');

export interface SecretCipher {
  /** Encrypts, returning the storable envelope. */
  seal(plaintext: Buffer): string;
  /**
   * Decrypts an envelope.
   *
   * Throws on a tampered, truncated or wrong-key envelope rather than returning a best effort —
   * a TOTP secret that is silently wrong locks the user out with no diagnosable cause.
   */
  open(envelope: string): Buffer;
}

const VERSION = 'v1';
const IV_BYTES = 12; // 96 bits — the size GCM is specified and optimised for.
const KEY_BYTES = 32; // AES-256.

const b64 = (buffer: Buffer): string => buffer.toString('base64url');
const unb64 = (value: string): Buffer => Buffer.from(value, 'base64url');

export class AesGcmSecretCipher implements SecretCipher {
  private readonly key: Buffer;

  /**
   * @param keyMaterial base64 or hex of exactly 32 bytes.
   * @param keyId  recorded in every envelope this instance writes, so rotation can tell them apart.
   */
  constructor(
    keyMaterial: string,
    private readonly keyId: string,
  ) {
    const key = decodeKey(keyMaterial);

    // A short key is the failure that must never be tolerated. Node would happily accept 16 bytes
    // and silently give AES-128, or throw at the first encryption — long after boot, on a user's
    // enrolment request. Checked here so a misconfigured deployment fails to START.
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `The MFA secret key must be ${String(KEY_BYTES)} bytes; got ${String(key.length)}. ` +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
      );
    }
    if (keyId.trim() === '') {
      throw new Error('The MFA secret key needs an id — rotation cannot tell two keys apart without one.');
    }

    this.key = key;
  }

  seal(plaintext: Buffer): string {
    // A FRESH iv per call. Deriving it from the user id, or reusing one, breaks GCM completely:
    // two secrets encrypted under the same (key, iv) leak their XOR and let the tag be forged.
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    return [VERSION, this.keyId, b64(iv), b64(ciphertext), b64(cipher.getAuthTag())].join('.');
  }

  open(envelope: string): Buffer {
    const parts = envelope.split('.');
    if (parts.length !== 5) {
      throw new Error('The MFA secret envelope is malformed — expected five dot-separated parts.');
    }

    const [version, keyId, iv, ciphertext, tag] = parts as [string, string, string, string, string];

    if (version !== VERSION) {
      throw new Error(`Unsupported MFA secret envelope version "${version}".`);
    }

    // Compared in constant time and only for the DIAGNOSTIC below — the tag is what actually
    // authenticates. A plain `!==` here would be harmless, and being consistent about it costs
    // nothing and removes a thing a reviewer has to reason about.
    if (!sameString(keyId, this.keyId)) {
      throw new Error(
        `The MFA secret was sealed under key "${keyId}" and this process holds "${this.keyId}". ` +
          'Rotation needs the previous key available until every row is re-sealed.',
      );
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, unb64(iv));
    decipher.setAuthTag(unb64(tag));
    // `final()` is what verifies the tag — it throws on any tampering. Omitting it, or catching and
    // returning the partial plaintext, turns authenticated encryption back into plain encryption.
    return Buffer.concat([decipher.update(unb64(ciphertext)), decipher.final()]);
  }
}

/** Accepts base64 or hex, because a key pasted from two different tools looks like both. */
function decodeKey(material: string): Buffer {
  const trimmed = material.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
  return Buffer.from(trimmed, 'base64');
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
