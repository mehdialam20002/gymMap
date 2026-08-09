/**
 * `M-030` `AC-7` · Refusing a decompression bomb without decoding it — `TR-40`, `NFR-SEC-10`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE RESOURCE LIMIT IS THE HALF THAT WORKS TODAY, AND IT IS THE HALF THAT MATTERS
 *
 * `AC-7`: *"Image decoding is resource-limited — dimensions, pixel count and time — so a
 * decompression bomb cannot exhaust a worker."*
 *
 * A decompression bomb is a small file that declares enormous dimensions: a 12 KB PNG saying
 * 55,000 × 55,000 expands to about 12 GB of pixels, and the worker dies before any "limit" that
 * runs after decoding gets a chance to fire. The defence therefore cannot be a check on the decoded
 * image — it has to happen BEFORE the decoder is handed the bytes.
 *
 * Dimensions live in the file's header, at a fixed offset, in plain integers. Reading them costs
 * two dozen bytes and no decoder at all — so the guard is complete and correct with no dependency,
 * and it is exactly the guard `TR-40` asks for.
 *
 * ┌─ WHAT IS NOT BUILT, AND WHY IT IS NOT PRETENDED ─────────────────────────────────────────────┐
 * │ Blur thresholds and perceptual-hash duplicate detection both need the pixels. That needs a    │
 * │ decoder: `A-17` approves **Sharp** and it is not installed, and no perceptual-hash library has │
 * │ an `A-NN` row in any status. Those two report `ERROR` with the reason rather than `PASS`,      │
 * │ because "not checked" is not "checked and fine" — `KL-110`.                                    │
 * │                                                                                              │
 * │ The split is honest rather than convenient: the bomb guard is the one that protects the        │
 * │ worker, and it is the one that runs.                                                            │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { precheck, type PrecheckResult } from '../../domain/precheck-result.vo.js';

export interface ImageLimits {
  /** Either side. A 60,000-pixel edge is not a photograph of a gym. */
  readonly maxEdgePixels: number;
  /** Width × height. This is the one that catches the bomb — area grows as the square. */
  readonly maxTotalPixels: number;
  readonly maxBytes: number;
}

/**
 * Defaults sized against what the check is for.
 *
 * ┌─ THE FIRST NUMBERS HERE WERE WRONG, AND WRONG IN THE DANGEROUS DIRECTION ────────────────────┐
 * │ `maxTotalPixels` was 12,000,000, with a comment claiming that was "a modern phone at full     │
 * │ resolution". A standard 12 MP phone photograph is 4032 × 3024 = **12,192,768** pixels — just  │
 * │ over it. Every ordinary upload would have been flagged, reviewers would have learned the      │
 * │ check is noise, and the one real bomb would have been dismissed with the rest. Caught by the  │
 * │ control test rather than by re-reading the constant.                                           │
 * │                                                                                              │
 * │ 50 MP admits current high-resolution phones with room to spare and still catches the 55,000² │
 * │ bomb by a factor of sixty. Decoded at four bytes a pixel that is ~200 MB, which a worker      │
 * │ survives; three gigapixels is not.                                                             │
 * │                                                                                              │
 * │ The edge limit is separate and not redundant: a 30,000 × 500 panorama is inside the area      │
 * │ budget and still makes a decoder allocate one enormous row.                                    │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 */
export const DEFAULT_IMAGE_LIMITS: ImageLimits = {
  maxEdgePixels: 20_000,
  maxTotalPixels: 50_000_000,
  maxBytes: 10 * 1024 * 1024,
};

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

/** PNG: `IHDR` is the first chunk; width and height are big-endian uint32 at bytes 16 and 20. */
function pngDimensions(bytes: Buffer): Dimensions | null {
  const isPng =
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  return isPng ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;
}

/**
 * JPEG: walk the segment markers to the first `SOFn` and read height then width from it.
 *
 * The walk is bounded by the buffer, so a file of `0xFF` bytes runs out rather than looping — an
 * infinite loop here is a worker hang, which is the same outcome the bomb guard exists to prevent.
 */
function jpegDimensions(bytes: Buffer): Dimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;

    /*
     * SOF0–SOF3 and SOF5–SOF15 carry the frame header. 0xC4 is a Huffman table and 0xC8/0xCC are
     * not frame headers either — reading dimensions from one of those is how a progressive JPEG
     * reports nonsense.
     */
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrameHeader) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }

    const segmentLength = bytes.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null; // malformed; a zero-length segment would not advance
    offset += 2 + segmentLength;
  }

  return null;
}

/**
 * Width and height from the file header, without decoding.
 *
 * Returns `null` when the header cannot be read, which the caller must treat as "unknown", never
 * as "fine".
 */
export function readDimensions(bytes: Buffer): Dimensions | null {
  return pngDimensions(bytes) ?? jpegDimensions(bytes);
}

export interface ImageQualityInput {
  readonly images: readonly { readonly label: string; readonly bytes: Buffer }[];
  readonly limits?: ImageLimits;
}

export function runImageQualityCheck(input: ImageQualityInput, ranAt: Date): PrecheckResult {
  const limits = input.limits ?? DEFAULT_IMAGE_LIMITS;

  if (input.images.length === 0) {
    return precheck('IMAGE_QUALITY', 'PASS', { images: 0 }, ranAt);
  }

  const refused: { label: string; reason: string; detail: Record<string, number> }[] = [];
  const unreadable: string[] = [];

  for (const { label, bytes } of input.images) {
    if (bytes.length > limits.maxBytes) {
      refused.push({
        label,
        reason: 'TOO_LARGE',
        detail: { byteSize: bytes.length, maxBytes: limits.maxBytes },
      });
      continue;
    }

    const size = readDimensions(bytes);
    if (size === null) {
      // Not a refusal and NOT a pass. The header could not be parsed, so nothing is known — and a
      // permitted format whose header this cannot read is itself worth a reviewer's glance.
      unreadable.push(label);
      continue;
    }

    const totalPixels = size.width * size.height;

    if (size.width > limits.maxEdgePixels || size.height > limits.maxEdgePixels) {
      refused.push({
        label,
        reason: 'EDGE_TOO_LONG',
        detail: { width: size.width, height: size.height, maxEdgePixels: limits.maxEdgePixels },
      });
      continue;
    }

    if (totalPixels > limits.maxTotalPixels) {
      /*
       * The bomb lands here.
       *
       * 55,000 × 55,000 is 3.02 billion pixels — about 12 GB decoded — from a file of a few
       * kilobytes. Nothing has been decoded at this point and nothing will be.
       */
      refused.push({
        label,
        reason: 'PIXEL_BOMB',
        detail: { totalPixels, maxTotalPixels: limits.maxTotalPixels },
      });
    }
  }

  /*
   * ┌─ WHY THIS CAN BE `FLAG` AND NOT `ERROR` WHEN SOMETHING IS REFUSED ─────────────────────────┐
   * │ A refused image is a CHECKED image: the header was read and the answer is "too big". That   │
   * │ is a finding, and findings flag.                                                             │
   * │                                                                                              │
   * │ The blur and perceptual-hash halves are different — they were never attempted, so the       │
   * │ result carries `notChecked` naming them. A reviewer reading this row learns both what was    │
   * │ found and what was not looked at, which is the distinction `AC-8` is about.                   │
   * └───────────────────────────────────────────────────────────────────────────────────────────┘
   */
  const notChecked = ['BLUR_THRESHOLD', 'PERCEPTUAL_HASH_DUPLICATE'];

  return precheck(
    'IMAGE_QUALITY',
    refused.length > 0 || unreadable.length > 0 ? 'FLAG' : 'PASS',
    {
      images: input.images.length,
      refused,
      unreadable,
      // Named, not silently omitted. KL-110: no decoder is installed and no perceptual-hash
      // library has an A-NN row, so these two were not attempted.
      notChecked,
    },
    ranAt,
  );
}
