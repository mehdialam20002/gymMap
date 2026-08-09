/**
 * `M-029` `AC-9` · The bytes decide, not the header — `NFR-SEC-10`.
 *
 * *"Content type is determined by inspecting the bytes, not by trusting the declared header; a
 * `.pdf` that is an executable is rejected."*
 *
 * Every buffer here is constructed byte by byte. No fixture file is read, because a fixture that is
 * genuinely a Windows executable is a thing to have in a repository, and the first two bytes are
 * the whole test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PERMITTED_CONTENT_TYPES,
  declaredTypeAgrees,
  inspectContent,
} from '../dist/common/storage/content-inspection.js';

const MAX = 20 * 1024 * 1024;

/** A buffer beginning with `prefix`, padded to a plausible length. */
function file(prefix: number[], length = 512): Buffer {
  const bytes = Buffer.alloc(length, 0x20);
  Buffer.from(prefix).copy(bytes, 0);
  return bytes;
}

const PDF = file([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = file([0xff, 0xd8, 0xff, 0xe0]);

// ═══════════════════════════════════════════════════════════════════════════
// The three permitted formats
// ═══════════════════════════════════════════════════════════════════════════

test('the three permitted formats are recognised from their signatures', () => {
  for (const [bytes, expected] of [
    [PDF, 'application/pdf'],
    [PNG, 'image/png'],
    [JPEG, 'image/jpeg'],
  ] as const) {
    const verdict = inspectContent(bytes, MAX);
    assert.equal(verdict.ok, true, `${expected} was refused`);
    if (!verdict.ok) continue;
    assert.equal(verdict.contentType, expected);
  }
});

test('the permitted set is exactly three, and adding a fourth is a deliberate edit', () => {
  // Every additional format is another decoder in the path of the highest-authority surface in
  // the product. `image/webp` and `image/heic` are absent on purpose despite being what a modern
  // phone produces — they are not what a government office issues.
  assert.deepEqual([...PERMITTED_CONTENT_TYPES], ['application/pdf', 'image/jpeg', 'image/png']);
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-9 — the assertion the criterion names
// ═══════════════════════════════════════════════════════════════════════════

test('AC-9 — a .pdf that is a Windows executable is REJECTED', () => {
  // The criterion's own example. `MZ`, then a plausible DOS stub, called anything at all — the
  // function is never told the filename, which is the point.
  const executable = file([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

  const verdict = inspectContent(executable, MAX);
  assert.equal(verdict.ok, false);
  if (verdict.ok) return;
  assert.equal(verdict.reason, 'EXECUTABLE_CONTENT');
  assert.match(verdict.detail, /DOS\/PE/);
});

test('the other executable containers are refused too', () => {
  for (const [label, prefix] of [
    ['ELF', [0x7f, 0x45, 0x4c, 0x46]],
    ['Mach-O 64', [0xcf, 0xfa, 0xed, 0xfe]],
    ['Java class', [0xca, 0xfe, 0xba, 0xbe]],
    ['shell script', [0x23, 0x21, 0x2f, 0x62]],
  ] as const) {
    const verdict = inspectContent(file([...prefix]), MAX);
    assert.equal(verdict.ok, false, `${label} was accepted`);
    if (verdict.ok) continue;
    assert.equal(verdict.reason, 'EXECUTABLE_CONTENT', label);
  }
});

test('ZIP is refused, and it is the one people argue about', () => {
  // A ZIP is also every Office document, every JAR and every APK. It is not a permitted format and
  // it is the container most often used to carry one that is not.
  const zip = file([0x50, 0x4b, 0x03, 0x04]);
  const verdict = inspectContent(zip, MAX);
  assert.equal(verdict.ok, false);
  if (verdict.ok) return;
  assert.equal(verdict.reason, 'EXECUTABLE_CONTENT');
});

test('A POLYGLOT IS ACCEPTED. This test pins a real gap — see KL-106.', () => {
  // ┌─ THIS ASSERTION IS DELIBERATELY THE WRONG WAY ROUND, AND IT REPLACES ONE THAT LIED ────────┐
  // │ An earlier test here claimed "the executable check runs BEFORE the whitelist, so a polyglot │
  // │ cannot slip past". It used a buffer beginning `4D 5A` — an executable marker at offset 0 —  │
  // │ which the executable pass catches whichever loop runs first. So the test passed with the    │
  // │ implementation INVERTED, and it proved nothing about ordering or about polyglots.            │
  // │                                                                                            │
  // │ The truth: `startsWith` compares from offset 0 only. A JPEG with a ZIP appended after the   │
  // │ image data is a valid JPEG, its first two bytes are `FF D8`, and it IS accepted. Scanning   │
  // │ the whole body is not the fix — a two-byte marker occurs by chance ~70 times in 5 MiB of    │
  // │ entropy-coded image data, so a body scan would refuse real photographs.                      │
  // │                                                                                            │
  // │ The control is re-encoding (`KY4`'s raster rendition), which is unbuilt for want of an      │
  // │ approved rasteriser. Until then this records the true behaviour instead of a comforting     │
  // │ falsehood. When the rendition lands, this test should go red and be rewritten.               │
  // └───────────────────────────────────────────────────────────────────────────────────────────┘
  const jpegThenZip = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), // a ZIP local file header, appended
    Buffer.alloc(256),
  ]);

  const verdict = inspectContent(jpegThenZip, MAX);
  assert.equal(
    verdict.ok,
    true,
    'a polyglot is now refused — KL-106 may be closed. Rewrite this test as a positive assertion.',
  );
  if (!verdict.ok) return;
  assert.equal(verdict.contentType, 'image/jpeg');
});

test('the executable list changes the MESSAGE, which is the whole of what it buys', () => {
  // Replaces the ordering claim with the property that is actually true and actually useful: a
  // bare executable is reported as one, rather than as an unrecognised format that sends somebody
  // looking for a corrupt scan.
  const verdict = inspectContent(file([0x4d, 0x5a, 0x90, 0x00]), MAX);
  assert.equal(verdict.ok, false);
  if (verdict.ok) return;
  assert.equal(verdict.reason, 'EXECUTABLE_CONTENT');
  assert.notEqual(verdict.reason, 'UNRECOGNISED_FORMAT');
});

// ═══════════════════════════════════════════════════════════════════════════
// The whitelist is a whitelist
// ═══════════════════════════════════════════════════════════════════════════

test('an unrecognised format is refused rather than stored as unknown', () => {
  // The difference between a whitelist and a blacklist, in one assertion. A blacklist is a list of
  // the attacks somebody thought of; this refuses everything that is not one of three things.
  const gif = file([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a — harmless, and not permitted
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'); // a scripting host
  const plain = Buffer.from('this is just some text');

  for (const [label, bytes] of [
    ['GIF', gif],
    ['SVG', svg],
    ['plain text', plain],
  ] as const) {
    const verdict = inspectContent(bytes, MAX);
    assert.equal(verdict.ok, false, `${label} was accepted`);
    if (verdict.ok) continue;
    assert.equal(verdict.reason, 'UNRECOGNISED_FORMAT', label);
  }
});

test('a truncated signature is not a match', () => {
  // Four bytes of a PNG header is not a PNG. `startsWith` must compare the whole pattern, and a
  // length check that ran the other way would accept every prefix of every signature.
  const verdict = inspectContent(Buffer.from([0x89, 0x50, 0x4e]), MAX);
  assert.equal(verdict.ok, false);
  if (verdict.ok) return;
  assert.equal(verdict.reason, 'UNRECOGNISED_FORMAT');
});

// ═══════════════════════════════════════════════════════════════════════════
// Size and emptiness
// ═══════════════════════════════════════════════════════════════════════════

test('an empty upload is refused, and reported as EMPTY rather than as an unknown format', () => {
  // What an aborted multipart write leaves behind. Reporting "unrecognised format" would send the
  // applicant to look at a file that is fine and re-upload it over the same broken connection.
  const verdict = inspectContent(Buffer.alloc(0), MAX);
  assert.equal(verdict.ok, false);
  if (verdict.ok) return;
  assert.equal(verdict.reason, 'EMPTY');
});

test('the ceiling is enforced here, not only at the transport layer', () => {
  // A body-size limit lives on a server that can be reconfigured, bypassed by a direct call, or
  // applied to a compressed length. The ceiling that matters is the one beside the decision to store.
  const verdict = inspectContent(file([0x25, 0x50, 0x44, 0x46, 0x2d], 2048), 1024);
  assert.equal(verdict.ok, false);
  if (verdict.ok) return;
  assert.equal(verdict.reason, 'TOO_LARGE');
  assert.match(verdict.detail, /2048 bytes exceeds the 1024 byte ceiling/);
});

test('a file exactly at the ceiling is accepted', () => {
  // Off-by-one on a size limit is the classic, and it is invisible: the only person who notices is
  // the one whose document is exactly at the boundary.
  const verdict = inspectContent(file([0x25, 0x50, 0x44, 0x46, 0x2d], 1024), 1024);
  assert.equal(verdict.ok, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// The declared type is observed, never obeyed
// ═══════════════════════════════════════════════════════════════════════════

test('a mislabelled but permitted file is STORED, under its real type', () => {
  // A phone that labels a JPEG `application/octet-stream` is common and is not an attack. The
  // upload succeeds and the recorded content type is what the bytes say.
  const verdict = inspectContent(JPEG, MAX);
  assert.equal(verdict.ok, true);
  if (!verdict.ok) return;
  assert.equal(verdict.contentType, 'image/jpeg');

  // …and the disagreement is still observable, so a client that always misdeclares can be counted.
  assert.equal(declaredTypeAgrees('application/octet-stream', 'image/jpeg'), false);
});

test('declaredTypeAgrees ignores parameters and case, and treats absence as agreement', () => {
  assert.equal(declaredTypeAgrees('IMAGE/JPEG; charset=binary', 'image/jpeg'), true);
  assert.equal(declaredTypeAgrees(undefined, 'image/jpeg'), true, 'no claim is not a disagreement');
  assert.equal(declaredTypeAgrees('application/pdf', 'image/jpeg'), false);
});
