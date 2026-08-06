/**
 * M-004 · `ZodValidationPipe` — A-02.
 *
 * The pipe exists because Nest's built-in ValidationPipe needs class-validator, which would be a
 * substitution for Zod and is forbidden. These assertions pin the behaviour that made Zod the
 * approved choice: one schema, shared with the browser, that PARSES rather than merely checks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { ZodValidationPipe, zodPipe } from '../dist/common/validation/zod-validation.pipe.js';

const metadata = { type: 'body' as const, metatype: undefined, data: undefined };

test('a valid payload passes through', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string() }).strict());
  assert.deepEqual(pipe.transform({ name: 'Iron Gym' }, metadata), { name: 'Iron Gym' });
});

test('the pipe returns the schema OUTPUT, so transforms are applied at the boundary', () => {
  // The money case: a string on the wire becomes a real bigint before the handler sees it.
  const schema = z.object({ amountMinor: z.string().transform((v) => BigInt(v)) });
  const out = zodPipe(schema).transform({ amountMinor: '250000' }, metadata) as {
    amountMinor: bigint;
  };
  assert.equal(out.amountMinor, 250000n);
  assert.equal(typeof out.amountMinor, 'bigint');
});

test('an invalid payload throws a ZodError for the filter to map', () => {
  const pipe = new ZodValidationPipe(z.object({ email: z.string().email() }));
  assert.throws(
    () => pipe.transform({ email: 'nope' }, metadata),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'ZodError');
      return true;
    },
  );
});

test('a strict schema rejects an unknown property rather than stripping it', () => {
  // Silent stripping is how a client believes it disabled a setting that never arrived.
  const pipe = new ZodValidationPipe(z.object({ name: z.string() }).strict());
  assert.throws(() => pipe.transform({ name: 'x', isAdmin: true }, metadata));
});

test('the thrown error carries field paths, so the envelope can build details[]', () => {
  const pipe = new ZodValidationPipe(z.object({ a: z.string(), b: z.number() }));
  try {
    pipe.transform({ a: 1, b: 'x' }, metadata);
    assert.fail('expected a throw');
  } catch (error) {
    const issues = (error as { issues: { path: string[] }[] }).issues;
    assert.deepEqual(issues.map((i) => i.path.join('.')).sort(), ['a', 'b']);
  }
});
