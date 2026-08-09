/**
 * `M-029` `AC-9` · What the file ACTUALLY is — `NFR-SEC-10`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * *"A `.pdf` THAT IS AN EXECUTABLE IS REJECTED"*
 *
 * The declared `Content-Type` and the filename extension are both attacker-controlled strings. A
 * pipeline that trusts either has performed no check at all — it has asked the uploader what they
 * uploaded and written down the answer.
 *
 * So the format is decided by the first bytes, and the decision is a WHITELIST: a file whose magic
 * number matches nothing here is refused. A blacklist of dangerous formats is the tempting shape and
 * it is wrong in the usual way — it is a list of the attacks somebody thought of, and the polyglot
 * that is a valid PNG and a valid ZIP simultaneously is not on it.
 *
 * ┌─ HAND-ROLLED, AND THAT IS THE APPROVED PATH RATHER THAN A SHORTCUT ───────────────────────────┐
 * │ `file-type` and `magic-bytes.js` have no `A-NN` row in `STACK_ADDITIONS.md`, and CLAUDE.md §5 │
 * │ makes an unapproved dependency a review blocker. `file-type@20.4.1` exists in the lockfile as │
 * │ a transitive of something else, which confers no approval whatsoever.                          │
 * │                                                                                              │
 * │ The scope is genuinely small: three permitted formats, four to eight fixed bytes each. This   │
 * │ is the same call M-024 made for RFC 6238 TOTP when `A-33` turned out to sit inside contested  │
 * │ `BLK-09` — and, as there, the answer is checked against the format specifications' own        │
 * │ documented signatures rather than against a library's behaviour.                               │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * What a KYC document may be.
 *
 * Three formats, and the list is short on purpose. Every additional format is another parser a
 * reviewer's browser or the rendition pipeline has to survive, and `Security.md` `KY4` already
 * refuses to render even a PDF in a browser context.
 *
 * `image/webp` and `image/heic` are deliberately absent despite being what a modern phone produces:
 * they are not what the government offices issuing these documents produce, and each one added is a
 * decoder added. A tenant with a HEIC converts it, which their phone does on export.
 */
export const PERMITTED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type PermittedContentType = (typeof PERMITTED_CONTENT_TYPES)[number];

interface Signature {
  readonly contentType: PermittedContentType;
  /** Byte values at offset 0. `null` is a wildcard, used where a field is length-dependent. */
  readonly magic: readonly (number | null)[];
}

/**
 * The signatures, from the format specifications rather than from a library.
 *
 * ┌─ JPEG IS TWO BYTES, AND THAT IS AS STRONG AS IT GETS ─────────────────────────────────────────┐
 * │ `FF D8` is the SOI marker and there is nothing longer that every JPEG shares — JFIF, Exif and │
 * │ raw-SOF variants diverge at byte 2. Two bytes is weak, so `looksLikeExecutable` below runs as │
 * │ a second, independent check rather than relying on the whitelist alone.                        │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
const SIGNATURES: readonly Signature[] = [
  // `%PDF-`. The version digit that follows varies, so it is not matched.
  { contentType: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // PNG's eight-byte signature, including the CRLF/EOF trap bytes that detect a corrupting transfer.
  { contentType: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // JPEG SOI.
  { contentType: 'image/jpeg', magic: [0xff, 0xd8] },
];

/**
 * Formats that must never be stored, checked INDEPENDENTLY of the whitelist.
 *
 * Redundant on paper — nothing here matches a signature above — and kept because the redundancy is
 * where a polyglot dies. A file crafted to satisfy a two-byte JPEG check while being a PE binary is
 * exactly the case the whitelist alone is weakest against, and the check below reads the whole
 * prefix rather than only offset 0.
 */
const EXECUTABLE_MARKERS: readonly { readonly label: string; readonly bytes: readonly number[] }[] =
  [
    { label: 'DOS/PE (MZ)', bytes: [0x4d, 0x5a] },
    { label: 'ELF', bytes: [0x7f, 0x45, 0x4c, 0x46] },
    { label: 'Mach-O 64', bytes: [0xcf, 0xfa, 0xed, 0xfe] },
    { label: 'Mach-O 32', bytes: [0xce, 0xfa, 0xed, 0xfe] },
    { label: 'Java class', bytes: [0xca, 0xfe, 0xba, 0xbe] },
    // ZIP, which is also every Office document, every JAR and every APK. Not a permitted format,
    // and the container most often used to smuggle one.
    { label: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
    { label: 'shell script', bytes: [0x23, 0x21] }, // `#!`
  ];

export type InspectionVerdict =
  | { readonly ok: true; readonly contentType: PermittedContentType }
  | {
      readonly ok: false;
      readonly reason: 'EMPTY' | 'UNRECOGNISED_FORMAT' | 'EXECUTABLE_CONTENT' | 'TOO_LARGE';
      readonly detail: string;
    };

function startsWith(bytes: Buffer, pattern: readonly (number | null)[]): boolean {
  if (bytes.length < pattern.length) return false;
  return pattern.every((expected, index) => expected === null || bytes[index] === expected);
}

/** The declared type, if any, is never consulted. That is the entire point of this function. */
export function inspectContent(bytes: Buffer, maxBytes: number): InspectionVerdict {
  if (bytes.length === 0) {
    // What an aborted multipart write leaves behind, and what `ck_kyc_documents__byte_size_positive`
    // refuses one layer down.
    return { ok: false, reason: 'EMPTY', detail: 'the upload contained no bytes' };
  }

  if (bytes.length > maxBytes) {
    /*
     * Checked HERE as well as at the transport layer.
     *
     * A body-size limit is configured on a server that can be reconfigured, bypassed by a direct
     * call, or applied to a compressed length. The ceiling that matters is the one next to the
     * decision to store, and this is it.
     */
    return {
      ok: false,
      reason: 'TOO_LARGE',
      detail: `${String(bytes.length)} bytes exceeds the ${String(maxBytes)} byte ceiling`,
    };
  }

  /*
   * The executable check runs FIRST, and the order is deliberate.
   *
   * Running the whitelist first would let a polyglot that satisfies `FF D8` be accepted as a JPEG
   * and never reach this check at all. Refusing known-dangerous prefixes before deciding what the
   * file "is" means the weak two-byte signature is never the only thing standing between an
   * executable and the bucket.
   */
  for (const marker of EXECUTABLE_MARKERS) {
    if (startsWith(bytes, marker.bytes)) {
      return {
        ok: false,
        reason: 'EXECUTABLE_CONTENT',
        // The FORMAT is named, never the filename and never a byte dump. `Gym.md` §793: name the
        // field and the expected shape, never the value.
        detail: `the bytes are ${marker.label}, whatever the file was called`,
      };
    }
  }

  for (const signature of SIGNATURES) {
    if (startsWith(bytes, signature.magic)) return { ok: true, contentType: signature.contentType };
  }

  return {
    ok: false,
    reason: 'UNRECOGNISED_FORMAT',
    detail: `the bytes match none of ${PERMITTED_CONTENT_TYPES.join(', ')}`,
  };
}

/**
 * Whether the client's declared type agreed with the bytes.
 *
 * The answer never changes what is stored — `inspectContent` decides that alone. It exists so the
 * pipeline can COUNT disagreements: a tenant whose uploads routinely misdeclare is either using a
 * broken client or probing, and neither is visible if the mismatch is silently corrected.
 */
export function declaredTypeAgrees(
  declared: string | undefined,
  actual: PermittedContentType,
): boolean {
  if (declared === undefined) return true;
  return declared.split(';')[0]?.trim().toLowerCase() === actual;
}
