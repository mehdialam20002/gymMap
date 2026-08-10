/**
 * `A-42` · `ADR-0048` — the scanner, against a REAL clamd.
 *
 * ┌─ WHY THIS IS AN INTEGRATION TEST AND A UNIT TEST WOULD PROVE NOTHING ────────────────────────┐
 * │ The whole adapter is a wire protocol: a `z`-prefixed command, big-endian length frames, a     │
 * │ zero-length terminator, and a reply this code has to recognise. Every one of those is a claim │
 * │ about what clamd does, and a mock would only ever confirm what I believed while writing it.   │
 * │                                                                                              │
 * │ Forget the terminator and clamd simply waits — the scan times out, the adapter says           │
 * │ `UNSCANNED`, and against a mock that returns `OK` the bug is invisible.                       │
 * └──────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * `parseClamdReply` is exercised as a pure function too, because the malformed-reply branch cannot
 * be produced by a working clamd — and it is the branch that decides an unrecognised answer is
 * `UNSCANNED` rather than a guess.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { Socket } from 'node:net';

import {
  ClamAvMalwareScanAdapter,
  parseClamdReply,
} from '../../dist/common/storage/clamav-malware-scan.adapter.js';
import { mayBeServed } from '../../dist/common/storage/malware-scan.port.js';

const HOST = process.env['CLAMAV_HOST'] ?? 'localhost';
const PORT = Number(process.env['CLAMAV_PORT'] ?? 3310);

/**
 * EICAR — the industry's standard harmless test string. Every scanner detects it and it is not
 * malware; it exists precisely so a pipeline can be proved end to end without handling a real
 * sample. Split so this source file does not itself trip a scanner reading the repository.
 */
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-', 'ANTIVIRUS-TEST-FILE!$H+H*'].join(
  '',
);

const adapter = new ClamAvMalwareScanAdapter({ host: HOST, port: PORT, timeoutMs: 30_000 });

let reachable = false;

before(async () => {
  reachable = await new Promise<boolean>((resolve) => {
    const probe = new Socket();
    probe.setTimeout(2_000);
    const done = (ok: boolean): void => {
      probe.destroy();
      resolve(ok);
    };
    probe.on('error', () => done(false));
    probe.on('timeout', () => done(false));
    probe.connect(PORT, HOST, () => done(true));
  });

  if (!reachable) {
    console.error(`\n  SKIPPING the A-42 scan assertions — no clamd at ${HOST}:${String(PORT)}.\n`);
  }
});

const it = (name: string, fn: () => Promise<void>) =>
  test(name, async (t) => {
    if (!reachable) return t.skip('no clamd');
    await fn();
  });

// ═══════════════════════════════════════════════════════════════════════════
// The two answers that matter, from a real daemon.
// ═══════════════════════════════════════════════════════════════════════════

it('a clean file scans CLEAN and may be served', async () => {
  const pdf = Buffer.alloc(4096, 0x20);
  Buffer.from('%PDF-1.7').copy(pdf, 0);

  const verdict = await adapter.scan(pdf);
  assert.equal(verdict.outcome, 'CLEAN', JSON.stringify(verdict));
  assert.ok(mayBeServed(verdict));
});

it('EICAR scans INFECTED, names the signature, and may NOT be served', async () => {
  /*
   * The assertion the whole approval was for. Until `A-42` this could not pass at all: the bound
   * adapter answered `UNSCANNED` unconditionally, so nothing distinguished a passport from a virus
   * and no document could ever be opened by a reviewer — `KL-104`.
   */
  const verdict = await adapter.scan(Buffer.from(EICAR, 'ascii'));

  assert.equal(verdict.outcome, 'INFECTED', JSON.stringify(verdict));
  assert.match(String(verdict.signature), /eicar/i, 'the signature should name what was found');
  assert.ok(!mayBeServed(verdict), 'an infected object must never be servable');
});

it('a large file still terminates — the zero-length frame is actually sent', async () => {
  // 8 MiB crosses the 64 KiB chunk boundary 128 times. If the terminator were missing, clamd would
  // wait for more and this would time out into UNSCANNED rather than answering.
  const verdict = await adapter.scan(Buffer.alloc(8 * 1024 * 1024, 0x41));
  assert.equal(verdict.outcome, 'CLEAN', JSON.stringify(verdict));
});

// ═══════════════════════════════════════════════════════════════════════════
// Every failure path resolves to UNSCANNED. None resolves to CLEAN.
// ═══════════════════════════════════════════════════════════════════════════

test('an unreachable clamd is UNSCANNED, never CLEAN', async () => {
  // Runs with or without a daemon: port 1 has nothing on it either way. This is the assertion that
  // matters most in this file — "the scanner is down, let it through" is the failure mode the port
  // was designed to make impossible, and this is where that design is actually checked.
  const dead = new ClamAvMalwareScanAdapter({ host: '127.0.0.1', port: 1, timeoutMs: 2_000 });
  const verdict = await dead.scan(Buffer.from('anything'));

  assert.equal(verdict.outcome, 'UNSCANNED');
  assert.ok(!mayBeServed(verdict));
  assert.match(String(verdict.detail), /unreachable/i, 'the detail must say why, for the log');
});

test('an unrecognised reply is UNSCANNED — a protocol disagreement is not a pass', async () => {
  // Cannot be produced by a working clamd, and is exactly the branch where a careless
  // `!reply.includes('FOUND')` would return CLEAN for a reply nobody understood.
  assert.deepEqual(parseClamdReply('stream: something new\0'), {
    outcome: 'UNSCANNED',
    detail: 'clamd replied with something this adapter does not recognise: stream: something new',
  });
  assert.equal(parseClamdReply('INSTREAM size limit exceeded. ERROR\0').outcome, 'UNSCANNED');
  assert.equal(parseClamdReply('').outcome, 'UNSCANNED');
});

test('parseClamdReply reads the two well-formed answers', async () => {
  assert.deepEqual(parseClamdReply('stream: OK\0'), { outcome: 'CLEAN' });
  assert.deepEqual(parseClamdReply('stream: Win.Test.EICAR_HDB-1 FOUND\0'), {
    outcome: 'INFECTED',
    signature: 'Win.Test.EICAR_HDB-1',
  });
});
